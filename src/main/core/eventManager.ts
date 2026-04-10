import { ipcMain, WebContents } from "electron";
import type { Window } from "./window";
import { SettingsManager } from "../storage/settingsManager";
import { buildHighlightScript, CLEAR_HIGHLIGHTS_SCRIPT, buildSelectHighlightScript, buildFilterScript } from "../tools";
import { getProvider } from "../tools/integrationTools";
import { listAllReports, deleteReport } from "../tools/exportTools";

const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ALLOWED_SCHEMES = ["http:", "https:", "blueberry:"];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_SCHEMES.includes(parsed.protocol);
  } catch {
    return false;
  }
}

export class EventManager {
  private mainWindow: Window;
  private settingsManager: SettingsManager;

  constructor(mainWindow: Window) {
    this.mainWindow = mainWindow;
    this.settingsManager = new SettingsManager();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.handleTabEvents();
    this.handleSidebarEvents();
    this.handlePageContentEvents();
    this.handleAuditHighlightEvents();
    this.handleDarkModeEvents();
    this.handleHistoryEvents();
    this.handleSettingsEvents();
    this.handleResizeEvents();
    this.handleWindowControlEvents();
    this.handleTaskEvents();
    this.handleReportEvents();
    this.handleHighlightInteractionEvents();
    this.handleDebugEvents();
  }

  private handleTabEvents(): void {
    ipcMain.handle("create-tab", (_, url?: string) => {
      const newTab = this.mainWindow.createTab(url);
      this.mainWindow.switchActiveTab(newTab.id);
      this.mainWindow.topBar.view.webContents.send("tabs-updated");
      return { id: newTab.id, title: newTab.title, url: newTab.url };
    });

    ipcMain.handle("close-tab", (_, id: string) => {
      this.mainWindow.closeTab(id);
      this.mainWindow.topBar.view.webContents.send("tabs-updated");
    });

    ipcMain.handle("switch-tab", (_, id: string) => {
      this.mainWindow.switchActiveTab(id);
      this.mainWindow.topBar.view.webContents.send("tabs-updated");
    });

    ipcMain.handle("get-tabs", () => {
      const activeTabId = this.mainWindow.activeTab?.id;
      return this.mainWindow.allTabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        isActive: activeTabId === tab.id,
      }));
    });

    ipcMain.handle("navigate-tab", async (_, tabId: string, url: string) => {
      if (!isAllowedUrl(url)) return false;
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        await tab.loadURL(url);
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-go-back", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) { tab.goBack(); return true; }
      return false;
    });

    ipcMain.handle("tab-go-forward", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) { tab.goForward(); return true; }
      return false;
    });

    ipcMain.handle("tab-reload", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) { tab.reload(); return true; }
      return false;
    });

    ipcMain.handle("tab-screenshot", async (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        const image = await tab.screenshot();
        return image.toDataURL();
      }
      return null;
    });

    ipcMain.handle("tab-run-js", async (_, tabId: string, code: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        return await tab.runJs(code);
      }
      return null;
    });

    ipcMain.handle("get-active-tab-info", () => {
      const activeTab = this.mainWindow.activeTab;
      if (activeTab) {
        return {
          id: activeTab.id,
          url: activeTab.url,
          title: activeTab.title,
          canGoBack: activeTab.webContents.navigationHistory.canGoBack(),
          canGoForward: activeTab.webContents.navigationHistory.canGoForward(),
        };
      }
      return null;
    });
  }

  private handleSidebarEvents(): void {
    ipcMain.handle("toggle-sidebar", () => {
      this.mainWindow.sidebar.toggle();
      // Don't call updateAllBounds here — the animation handles it
      return true;
    });

    ipcMain.handle("sidebar-chat-message", async (_, request) => {
      await this.mainWindow.sidebar.client.sendChatMessage(request);
    });

    ipcMain.handle("sidebar-clear-chat", () => {
      this.mainWindow.sidebar.client.clearMessages();
      return true;
    });

    ipcMain.handle("sidebar-cancel-chat", () => {
      this.mainWindow.sidebar.client.cancelCurrentRequest();
      return true;
    });

    ipcMain.handle("sidebar-get-messages", () => {
      return this.mainWindow.sidebar.client.getMessages();
    });

    // Navigate from sidebar (e.g., history item click)
    ipcMain.handle("sidebar-navigate-to-url", (_, url: string) => {
      if (!isAllowedUrl(url)) return;
      // blueberry://chat needs its own tab with chat preload
      if (url.startsWith("blueberry://chat")) {
        const newTab = this.mainWindow.createTab(url);
        this.mainWindow.switchActiveTab(newTab.id);
        this.mainWindow.topBar.view.webContents.send("tabs-updated");
        return;
      }
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.loadURL(url);
      }
    });
  }

  private handlePageContentEvents(): void {
    ipcMain.handle("get-page-content", async () => {
      if (this.mainWindow.activeTab) {
        try {
          return await this.mainWindow.activeTab.getTabHtml();
        } catch (error) {
          console.error("Error getting page content:", error);
          return null;
        }
      }
      return null;
    });

    ipcMain.handle("get-page-text", async () => {
      if (this.mainWindow.activeTab) {
        try {
          return await this.mainWindow.activeTab.getTabText();
        } catch (error) {
          console.error("Error getting page text:", error);
          return null;
        }
      }
      return null;
    });

    ipcMain.handle("get-current-url", () => {
      if (this.mainWindow.activeTab) {
        return this.mainWindow.activeTab.url;
      }
      return null;
    });
  }

  private handleAuditHighlightEvents(): void {
    ipcMain.handle(
      "highlight-elements",
      async (_, highlights: { selector: string; color: string; label: string }[]) => {
        const activeTab = this.mainWindow.activeTab;
        if (!activeTab) {
          console.warn("highlight-elements: no active tab");
          return false;
        }
        try {
          const script = buildHighlightScript(highlights);
          await activeTab.runJs(script);
          return true;
        } catch (err) {
          console.error("highlight-elements failed:", err);
          return false;
        }
      }
    );

    ipcMain.handle("clear-highlights", async () => {
      const activeTab = this.mainWindow.activeTab;
      if (!activeTab) return false;
      try {
        await activeTab.runJs(CLEAR_HIGHLIGHTS_SCRIPT);
        return true;
      } catch (err) {
        console.error("clear-highlights failed:", err);
        return false;
      }
    });
  }

  private handleDarkModeEvents(): void {
    ipcMain.on("dark-mode-changed", (event, isDarkMode) => {
      this.broadcastDarkMode(event.sender, isDarkMode);
    });
  }

  private handleHistoryEvents(): void {
    ipcMain.handle("get-history", (_, search?: string, limit?: number) => {
      return this.mainWindow.historyManager.getEntries(search, limit);
    });

    ipcMain.handle("clear-history", () => {
      this.mainWindow.historyManager.clearHistory();
    });
  }

  private handleSettingsEvents(): void {
    ipcMain.handle("get-settings", () => {
      return this.settingsManager.getSettings();
    });

    ipcMain.handle("update-settings", (_, settings: any) => {
      const updated = this.settingsManager.updateSettings(settings);

      // If provider/model/apiKey changed, reconfigure the LLM client
      if (settings.provider || settings.model || settings.apiKey) {
        const s = updated;
        if (s.apiKey) {
          this.mainWindow.sidebar.client.reconfigure(
            s.provider,
            s.model,
            s.apiKey
          );
        }
      }

      return updated;
    });
  }

  private resizeInitialWidth: number = 0;

  private handleResizeEvents(): void {
    ipcMain.handle("sidebar-resize-start", () => {
      this.resizeInitialWidth = this.mainWindow.sidebar.getWidth() || 400;
      return this.resizeInitialWidth;
    });

    ipcMain.handle("sidebar-resize-move", (_, deltaX: number) => {
      const newWidth = this.resizeInitialWidth - deltaX;
      this.mainWindow.sidebar.setWidth(newWidth);
    });

    ipcMain.handle("sidebar-resize-end", () => {
      // Width is already set, just finalize
    });

    ipcMain.handle("sidebar-get-width", () => {
      return this.mainWindow.sidebar.getWidth();
    });
  }

  private handleWindowControlEvents(): void {
    ipcMain.handle("window-minimize", () => {
      this.mainWindow.minimize();
    });
    ipcMain.handle("window-maximize", () => {
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow.maximize();
      }
    });
    ipcMain.handle("window-close", () => {
      this.mainWindow.close();
    });
  }

  private handleTaskEvents(): void {
    ipcMain.handle("tasks-list", async (_, filter?: { status?: string; groupId?: string }) => {
      try {
        const p = getProvider();
        return await p.listTasks(filter as any);
      } catch (err) {
        console.error("tasks-list failed:", err);
        return [];
      }
    });

    ipcMain.handle("tasks-update", async (_, id: string, updates: Record<string, string>) => {
      try {
        if (!id || typeof id !== "string") return null;
        // Only allow safe update keys
        const allowed = ["status", "title", "description"];
        const safeUpdates: Record<string, string> = {};
        for (const key of allowed) {
          if (updates[key] !== undefined) safeUpdates[key] = String(updates[key]);
        }
        const p = getProvider();
        return await p.updateTask(id, safeUpdates);
      } catch (err) {
        console.error("tasks-update failed:", err);
        return null;
      }
    });

    ipcMain.handle("tasks-delete", async (_, id: string) => {
      try {
        if (!id || typeof id !== "string") return false;
        const p = getProvider();
        return await p.deleteTask(id);
      } catch (err) {
        console.error("tasks-delete failed:", err);
        return false;
      }
    });

    ipcMain.handle("groups-list", async () => {
      try {
        const p = getProvider();
        return await p.listGroups();
      } catch (err) {
        console.error("groups-list failed:", err);
        return [];
      }
    });

    ipcMain.handle("groups-delete", async (_, id: string) => {
      try {
        if (!id || typeof id !== "string") return false;
        const p = getProvider();
        return await p.deleteGroup(id);
      } catch (err) {
        console.error("groups-delete failed:", err);
        return false;
      }
    });
  }

  private handleReportEvents(): void {
    ipcMain.handle("reports-list", () => {
      try {
        return listAllReports();
      } catch (err) {
        console.error("reports-list failed:", err);
        return [];
      }
    });

    ipcMain.handle("reports-delete", (_, id: string) => {
      try {
        if (!UUID_RE.test(id)) return false;
        return deleteReport(id);
      } catch (err) {
        console.error("reports-delete failed:", err);
        return false;
      }
    });
  }

  private handleHighlightInteractionEvents(): void {
    ipcMain.handle("scroll-to-highlight", async (_, id: string) => {
      const activeTab = this.mainWindow.activeTab;
      if (!activeTab) return false;
      try {
        return await activeTab.runJs(buildSelectHighlightScript(id));
      } catch (err) {
        console.error("scroll-to-highlight failed:", err);
        return false;
      }
    });

    ipcMain.handle("filter-highlights", async (_, categories: string[]) => {
      const activeTab = this.mainWindow.activeTab;
      if (!activeTab) return false;
      try {
        await activeTab.runJs(buildFilterScript(categories));
        return true;
      } catch (err) {
        console.error("filter-highlights failed:", err);
        return false;
      }
    });
  }

  private handleDebugEvents(): void {
    ipcMain.on("ping", () => console.log("pong"));
  }

  private broadcastDarkMode(sender: WebContents, isDarkMode: boolean): void {
    try {
      if (this.mainWindow.topBar.view.webContents !== sender) {
        this.mainWindow.topBar.view.webContents.send("dark-mode-updated", isDarkMode);
      }
    } catch { /* view may be destroyed */ }
    try {
      if (this.mainWindow.sidebar.view.webContents !== sender) {
        this.mainWindow.sidebar.view.webContents.send("dark-mode-updated", isDarkMode);
      }
    } catch { /* view may be destroyed */ }
    this.mainWindow.allTabs.forEach((tab) => {
      try {
        if (tab.webContents !== sender) {
          tab.webContents.send("dark-mode-updated", isDarkMode);
        }
      } catch { /* tab may be destroyed */ }
    });
  }

  public cleanup(): void {
    const handleChannels = [
      "create-tab", "close-tab", "switch-tab", "get-tabs",
      "navigate-tab",
      "tab-go-back", "tab-go-forward", "tab-reload",
      "tab-screenshot", "tab-run-js", "get-active-tab-info",
      "toggle-sidebar", "sidebar-chat-message", "sidebar-clear-chat",
      "sidebar-cancel-chat", "sidebar-get-messages", "sidebar-navigate-to-url",
      "get-page-content", "get-page-text", "get-current-url",
      "highlight-elements", "clear-highlights",
      "get-history", "clear-history",
      "get-settings", "update-settings",
      "sidebar-resize-start", "sidebar-resize-move", "sidebar-resize-end",
      "sidebar-get-width",
      "window-minimize", "window-maximize", "window-close",
      "tasks-list", "tasks-update", "tasks-delete",
      "groups-list", "groups-delete",
      "reports-list", "reports-delete",
      "scroll-to-highlight", "filter-highlights",
    ];
    for (const ch of handleChannels) {
      ipcMain.removeHandler(ch);
    }
    // Only remove the on() channels this EventManager registers
    ipcMain.removeAllListeners("dark-mode-changed");
    ipcMain.removeAllListeners("ping");
  }
}
