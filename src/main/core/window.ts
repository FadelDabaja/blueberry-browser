import { BaseWindow, session } from "electron";
import { Tab } from "./tab";
import { TopBar } from "../ui/topBar";
import { SideBar } from "../ui/sideBar";
import { HistoryManager } from "../storage/historyManager";
import { DiagnosticsService } from "./diagnosticsService";
import { TOPBAR_HEIGHT, CHAT_PAGE_URL } from "../config/constants";

export interface CreateTabOptions {
  hidden?: boolean;  // Don't switch to this tab (stays invisible)
  silent?: boolean;  // Don't set up nav listeners (no sidebar page-context spam)
}

export class Window {
  private _baseWindow: BaseWindow;
  private tabsMap: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  private tabCounter: number = 0;
  private _topBar: TopBar;
  private _sideBar: SideBar;
  private _historyManager: HistoryManager;
  private _diagnosticsService: DiagnosticsService;
  private _sidebarWasVisible: boolean = true; // Track sidebar state before chat tab hides it

  constructor() {
    this._baseWindow = new BaseWindow({
      width: 1000,
      height: 800,
      show: false,
      autoHideMenuBar: false,
      titleBarStyle: "hidden",
      ...(process.platform !== "darwin" ? { titleBarOverlay: false } : {}),
      trafficLightPosition: { x: 15, y: 10 },
    });

    this._baseWindow.setMinimumSize(1000, 800);
    this._baseWindow.maximize();
    this._baseWindow.show();

    this._topBar = new TopBar(this._baseWindow);
    this._sideBar = new SideBar(this._baseWindow);
    this._historyManager = new HistoryManager();
    this._diagnosticsService = new DiagnosticsService();
    this._diagnosticsService.attachNetworkListeners(session.defaultSession);

    // Set the window reference on the LLM client
    this._sideBar.client.setWindow(this);

    // Wire up animated bounds callback
    this._sideBar.setOnBoundsUpdate((sidebarWidth: number) => {
      this.updateTabBoundsWithSidebarWidth(sidebarWidth);
    });

    // Create the first tab
    this.createTab();

    // Set up window resize handler
    this._baseWindow.on("resize", () => {
      this.updateTabBounds();
      this._topBar.updateBounds();
      this._sideBar.updateBounds();
      const contentBounds = this.getContentSize();
      if (this.activeTab) {
        this.activeTab.webContents.send("window-resized", {
          width: contentBounds.width,
          height: contentBounds.height,
        });
      }
    });

    this.setupEventListeners();
  }

  // Get content area dimensions (excludes window frame/title bar)
  private getContentSize(): { width: number; height: number } {
    const contentBounds = this._baseWindow.getContentBounds();
    return { width: contentBounds.width, height: contentBounds.height };
  }

  private setupEventListeners(): void {
    this._baseWindow.on("closed", () => {
      this.tabsMap.forEach((tab) => tab.destroy());
      this.tabsMap.clear();
    });
  }

  // Getters
  get window(): BaseWindow {
    return this._baseWindow;
  }

  get activeTab(): Tab | null {
    if (this.activeTabId) {
      return this.tabsMap.get(this.activeTabId) || null;
    }
    return null;
  }

  get allTabs(): Tab[] {
    return Array.from(this.tabsMap.values());
  }

  get tabCount(): number {
    return this.tabsMap.size;
  }

  // Tab management methods
  createTab(url?: string, options?: CreateTabOptions): Tab {
    const tabId = `tab-${++this.tabCounter}`;
    const tab = new Tab(tabId, url);

    this._baseWindow.contentView.addChildView(tab.view);

    const { width, height } = this.getContentSize();
    tab.view.setBounds({
      x: 0,
      y: TOPBAR_HEIGHT,
      width: width - this._sideBar.getWidth(),
      height: height - TOPBAR_HEIGHT,
    });

    this.tabsMap.set(tabId, tab);
    this._diagnosticsService.registerTab(tab);

    // Register chat page tabs as broadcast targets so they receive LLM IPC
    if (tab.isChatPage) {
      this._sideBar.client.addBroadcastTarget(tab.webContents);
    }

    // Silent tabs skip window-open handler and nav listeners (used by parallel agents)
    if (!options?.silent) {
      // Handle new-window requests (target="_blank" links, window.open) — open in new tab
      tab.webContents.setWindowOpenHandler((details) => {
        this.createTab(details.url);
        this.switchActiveTab(`tab-${this.tabCounter}`);
        // Notify topbar to refresh tab list
        this._topBar.view.webContents.send("tabs-updated");
        return { action: "deny" };
      });

      // Listen for navigation to track history + update sidebar page context
      this.setupTabNavListeners(tab);

      // Forward highlight clicks from the tab's overlay to the sidebar renderer
      tab.onHighlightClicked((data) => {
        try {
          this._sideBar.view.webContents.send("highlight-clicked", data);
        } catch { /* sidebar may be destroyed */ }
      });
    }

    // Hidden tabs stay invisible and never become active
    if (options?.hidden) {
      tab.hide();
    } else if (this.tabsMap.size === 1) {
      this.switchActiveTab(tabId);
    } else {
      tab.hide();
    }

    return tab;
  }

  private setupTabNavListeners(tab: Tab): void {
    tab.webContents.on("did-navigate", (_, url) => {
      const title = tab.title || "Untitled";
      this._historyManager.addEntry(url, title, "");
      this.sendPageContextToSidebar(url, title);
    });

    tab.webContents.on("page-title-updated", (_, title) => {
      if (tab.url) {
        this._historyManager.addEntry(tab.url, title, "");
      }
      if (tab.id === this.activeTabId) {
        this.sendPageContextToSidebar(tab.url, title);
      }
    });
  }

  private sendPageContextToSidebar(url: string, title: string): void {
    try {
      this._sideBar.view.webContents.send("page-context-updated", {
        url,
        title,
        favicon: "",
      });
    } catch {
      // Sidebar may not be ready yet
    }
  }

  closeTab(tabId: string): boolean {
    const tab = this.tabsMap.get(tabId);
    if (!tab) return false;

    this._baseWindow.contentView.removeChildView(tab.view);
    if (tab.isChatPage) {
      this._sideBar.client.removeBroadcastTarget(tab.webContents);
    }
    this._diagnosticsService.unregisterTab(tab);
    tab.webContents.removeAllListeners();
    tab.destroy();
    this.tabsMap.delete(tabId);

    if (this.activeTabId === tabId) {
      this.activeTabId = null;
      const remainingTabs = Array.from(this.tabsMap.keys());
      if (remainingTabs.length > 0) {
        this.switchActiveTab(remainingTabs[0]);
      }
    }

    if (this.tabsMap.size === 0) {
      this._baseWindow.close();
    }

    return true;
  }

  switchActiveTab(tabId: string): boolean {
    const tab = this.tabsMap.get(tabId);
    if (!tab) return false;

    if (this.activeTabId && this.activeTabId !== tabId) {
      const currentTab = this.tabsMap.get(this.activeTabId);
      if (currentTab) {
        currentTab.hide();
      }
    }

    tab.show();
    this.activeTabId = tabId;
    this._baseWindow.setTitle(tab.title || "Blueberry Browser");

    // Hide sidebar when chat tab is active (redundant with full-page chat)
    if (tab.isChatPage) {
      this._sidebarWasVisible = this._sideBar.getIsVisible();
      if (this._sideBar.getIsVisible()) {
        this._sideBar.hide();
      }
      // Chat tab takes full width
      const { width, height } = this.getContentSize();
      tab.view.setBounds({
        x: 0,
        y: TOPBAR_HEIGHT,
        width,
        height: height - TOPBAR_HEIGHT,
      });
    } else {
      // Restore sidebar if it was visible before switching to a chat tab
      if (this._sidebarWasVisible && !this._sideBar.getIsVisible()) {
        this._sideBar.show();
      }
      this.sendPageContextToSidebar(tab.url, tab.title);
    }

    return true;
  }

  getTab(tabId: string): Tab | null {
    return this.tabsMap.get(tabId) || null;
  }

  // Window methods
  show(): void { this._baseWindow.show(); }
  hide(): void { this._baseWindow.hide(); }
  close(): void { this._baseWindow.close(); }
  focus(): void { this._baseWindow.focus(); }
  minimize(): void { this._baseWindow.minimize(); }
  maximize(): void { this._baseWindow.maximize(); }
  unmaximize(): void { this._baseWindow.unmaximize(); }
  isMaximized(): boolean { return this._baseWindow.isMaximized(); }
  setTitle(title: string): void { this._baseWindow.setTitle(title); }

  setBounds(bounds: { x?: number; y?: number; width?: number; height?: number }): void {
    this._baseWindow.setBounds(bounds);
  }

  getBounds(): { x: number; y: number; width: number; height: number } {
    return this._baseWindow.getBounds();
  }

  // Handle window resize to update tab bounds
  private updateTabBounds(): void {
    this.updateTabBoundsWithSidebarWidth(this._sideBar.getWidth());
  }

  // Called during sidebar animation with dynamic width
  updateTabBoundsWithSidebarWidth(sidebarWidth: number): void {
    const { width, height } = this.getContentSize();
    this.tabsMap.forEach((tab) => {
      if (tab.isChatPage) {
        tab.view.setBounds({
          x: 0,
          y: TOPBAR_HEIGHT,
          width,
          height: height - TOPBAR_HEIGHT,
        });
      } else {
        tab.view.setBounds({
          x: 0,
          y: TOPBAR_HEIGHT,
          width: width - sidebarWidth,
          height: height - TOPBAR_HEIGHT,
        });
      }
    });
  }

  // Public method to update all bounds when sidebar is toggled
  updateAllBounds(): void {
    this.updateTabBounds();
    this._sideBar.updateBounds();
  }

  get sidebar(): SideBar { return this._sideBar; }
  get topBar(): TopBar { return this._topBar; }
  get historyManager(): HistoryManager { return this._historyManager; }
  get diagnosticsService(): DiagnosticsService { return this._diagnosticsService; }
  get tabs(): Tab[] { return Array.from(this.tabsMap.values()); }
  get baseWindow(): BaseWindow { return this._baseWindow; }
}
