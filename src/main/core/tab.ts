import { join } from "path";
import { NativeImage, WebContentsView } from "electron";
import { CLEAR_HIGHLIGHTS_SCRIPT } from "../tools";
import { DEFAULT_TAB_URL, CHAT_PAGE_URL } from "../config/constants";

export class Tab {
  private webContentsView: WebContentsView;
  private _id: string;
  private _title: string;
  private _url: string;
  private _isVisible: boolean = false;

  private _isChatPage: boolean = false;

  constructor(id: string, url: string = DEFAULT_TAB_URL) {
    this._id = id;
    this._url = url;
    this._title = "New Tab";
    this._isChatPage = url === CHAT_PAGE_URL;

    // Chat page tabs use the chat preload and allow node-like access
    const webPreferences = this._isChatPage
      ? {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
          webSecurity: true,
          preload: join(__dirname, "../preload/chat.js"),
        }
      : {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
        };

    // Create the WebContentsView
    this.webContentsView = new WebContentsView({ webPreferences });

    // Raise default listener limit to avoid MaxListenersExceededWarning
    this.webContentsView.webContents.setMaxListeners(20);

    // Set up event listeners
    this.setupEventListeners();

    // Load the initial URL or chat page
    if (this._isChatPage) {
      this._title = "Blueberry Chat";
      this.loadChatPage();
    } else {
      this.loadURL(url);
    }
  }

  private loadChatPage(): void {
    // In dev, electron-vite serves renderers; in prod, load from file
    if (process.env.ELECTRON_RENDERER_URL) {
      this.webContentsView.webContents.loadURL(
        `${process.env.ELECTRON_RENDERER_URL}/chat/index.html`
      );
    } else {
      this.webContentsView.webContents.loadFile(
        join(__dirname, "../renderer/chat/index.html")
      );
    }
  }

  /** Set a callback to receive highlight click events from injected overlay scripts. */
  private highlightClickCallback: ((data: any) => void) | null = null;

  onHighlightClicked(callback: (data: any) => void): void {
    this.highlightClickCallback = callback;
  }

  private setupEventListeners(): void {
    // Update title when page title changes
    this.webContentsView.webContents.on("page-title-updated", (_, title) => {
      this._title = title;
    });

    // Update URL when navigation occurs + auto-clear audit highlights
    // Chat page tabs keep their blueberry:// URL (don't update to localhost)
    this.webContentsView.webContents.on("did-navigate", (_, url) => {
      if (!this._isChatPage) {
        this._url = url;
      }
      this.runJs(CLEAR_HIGHLIGHTS_SCRIPT).catch(() => {});
    });

    this.webContentsView.webContents.on("did-navigate-in-page", (_, url) => {
      if (!this._isChatPage) {
        this._url = url;
      }
      this.runJs(CLEAR_HIGHLIGHTS_SCRIPT).catch(() => {});
    });

    // Forward highlight click events from injected overlay scripts to sidebar
    const HIGHLIGHT_CLICK_PREFIX = "__BB_HIGHLIGHT_CLICK__";
    this.webContentsView.webContents.on("console-message", (event) => {
      const message = event.message;
      if (message.startsWith(HIGHLIGHT_CLICK_PREFIX)) {
        try {
          const data = JSON.parse(message.slice(HIGHLIGHT_CLICK_PREFIX.length));
          this.highlightClickCallback?.(data);
        } catch { /* malformed JSON — ignore */ }
      }
    });
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get title(): string {
    return this._title;
  }

  get url(): string {
    return this._url;
  }

  get isVisible(): boolean {
    return this._isVisible;
  }

  get webContents() {
    return this.webContentsView.webContents;
  }

  get isChatPage(): boolean {
    return this._isChatPage;
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }

  // Public methods
  show(): void {
    this._isVisible = true;
    this.webContentsView.setVisible(true);
  }

  hide(): void {
    this._isVisible = false;
    this.webContentsView.setVisible(false);
  }

  async screenshot(): Promise<NativeImage> {
    return await this.webContentsView.webContents.capturePage();
  }

  // Compressed screenshot for LLM context (JPEG, max 800px wide)
  async screenshotCompressed(): Promise<string> {
    const image = await this.screenshot();
    const size = image.getSize();
    const maxWidth = 800;
    const resized = size.width > maxWidth
      ? image.resize({ width: maxWidth })
      : image;
    const jpegBuffer = resized.toJPEG(60);
    return `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
  }

  async runJs(code: string): Promise<any> {
    return await this.webContentsView.webContents.executeJavaScript(code);
  }

  async getTabHtml(): Promise<string> {
    return await this.runJs("document.documentElement.outerHTML");
  }

  async getTabText(): Promise<string> {
    return await this.runJs("document.documentElement.innerText");
  }

  loadURL(url: string): Promise<void> {
    this._url = url;
    return this.webContentsView.webContents.loadURL(url);
  }

  goBack(): void {
    if (this.webContentsView.webContents.navigationHistory.canGoBack()) {
      this.webContentsView.webContents.navigationHistory.goBack();
    }
  }

  goForward(): void {
    if (this.webContentsView.webContents.navigationHistory.canGoForward()) {
      this.webContentsView.webContents.navigationHistory.goForward();
    }
  }

  reload(): void {
    this.webContentsView.webContents.reload();
  }

  stop(): void {
    this.webContentsView.webContents.stop();
  }

  destroy(): void {
    this.webContentsView.webContents.close();
  }
}
