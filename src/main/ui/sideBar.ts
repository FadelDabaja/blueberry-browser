import { is } from "@electron-toolkit/utils";
import { BaseWindow, WebContentsView } from "electron";
import { join } from "path";
import { LLMClient } from "../llm/llmClient";
import {
  DEFAULT_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  SIDEBAR_ANIMATION_STEPS,
  SIDEBAR_ANIMATION_DURATION,
  TOPBAR_HEIGHT,
} from "../config/constants";

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export class SideBar {
  private webContentsView: WebContentsView;
  private baseWindow: BaseWindow;
  private llmClient: LLMClient;
  private isVisible: boolean = true;
  private isAnimating: boolean = false;
  private currentWidth: number = DEFAULT_SIDEBAR_WIDTH;
  private onBoundsUpdate: ((sidebarWidth: number) => void) | null = null;

  constructor(baseWindow: BaseWindow) {
    this.baseWindow = baseWindow;
    this.webContentsView = this.createWebContentsView();
    baseWindow.contentView.addChildView(this.webContentsView);
    this.setupBounds();

    // Initialize LLM client
    this.llmClient = new LLMClient(this.webContentsView.webContents);
  }

  // Set callback for animated bounds updates (called by Window)
  setOnBoundsUpdate(callback: (sidebarWidth: number) => void): void {
    this.onBoundsUpdate = callback;
  }

  private createWebContentsView(): WebContentsView {
    const webContentsView = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, "../preload/sidebar.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      const sidebarUrl = new URL(
        "/sidebar/",
        process.env["ELECTRON_RENDERER_URL"]
      );
      webContentsView.webContents.loadURL(sidebarUrl.toString());
    } else {
      webContentsView.webContents.loadFile(
        join(__dirname, "../renderer/sidebar.html")
      );
    }

    // Log renderer errors/crashes to main process console
    webContentsView.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      if (level >= 2) { // warnings and errors only
        console.error(`[Sidebar renderer] ${message} (${sourceId}:${line})`);
      }
    });
    webContentsView.webContents.on("render-process-gone", (_event, details) => {
      console.error("[Sidebar renderer] process gone:", details.reason, details.exitCode);
    });

    return webContentsView;
  }

  private getContentSize(): { width: number; height: number } {
    const contentBounds = this.baseWindow.getContentBounds();
    return { width: contentBounds.width, height: contentBounds.height };
  }

  private setupBounds(): void {
    if (!this.isVisible) return;

    const { width, height } = this.getContentSize();
    this.webContentsView.setBounds({
      x: width - this.currentWidth,
      y: TOPBAR_HEIGHT,
      width: this.currentWidth,
      height: height - TOPBAR_HEIGHT,
    });
  }

  updateBounds(): void {
    if (this.isAnimating) return;

    if (this.isVisible) {
      this.setupBounds();
    } else {
      this.webContentsView.setBounds({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      });
    }
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }

  get client(): LLMClient {
    return this.llmClient;
  }

  show(): void {
    if (this.isVisible || this.isAnimating) return;
    this.isVisible = true;
    this.animateToggle(true);
  }

  hide(): void {
    if (!this.isVisible || this.isAnimating) return;
    this.animateToggle(false);
  }

  toggle(): void {
    if (this.isAnimating) return;
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  getIsVisible(): boolean {
    return this.isVisible;
  }

  getWidth(): number {
    return this.isVisible ? this.currentWidth : 0;
  }

  setWidth(width: number): void {
    this.currentWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width));
    if (this.isVisible && !this.isAnimating) {
      this.setupBounds();
      if (this.onBoundsUpdate) {
        this.onBoundsUpdate(this.currentWidth);
      }
    }
  }

  private animateToggle(showing: boolean): void {
    this.isAnimating = true;
    const { width, height } = this.getContentSize();
    const targetWidth = this.currentWidth;
    const stepDuration = SIDEBAR_ANIMATION_DURATION / SIDEBAR_ANIMATION_STEPS;
    let step = 0;

    const animate = () => {
      step++;
      const progress = step / SIDEBAR_ANIMATION_STEPS;
      const eased = easeOutCubic(progress);

      const currentWidth = showing
        ? Math.round(targetWidth * eased)
        : Math.round(targetWidth * (1 - eased));

      // Update sidebar bounds
      this.webContentsView.setBounds({
        x: width - currentWidth,
        y: TOPBAR_HEIGHT,
        width: Math.max(currentWidth, 1),
        height: height - TOPBAR_HEIGHT,
      });

      // Update tab content bounds via callback
      if (this.onBoundsUpdate) {
        this.onBoundsUpdate(currentWidth);
      }

      if (step < SIDEBAR_ANIMATION_STEPS) {
        setTimeout(animate, stepDuration);
      } else {
        this.isAnimating = false;
        if (!showing) {
          this.isVisible = false;
          this.webContentsView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
          if (this.onBoundsUpdate) {
            this.onBoundsUpdate(0);
          }
        }
      }
    };

    animate();
  }
}
