import { app, BaseWindow, protocol, net } from "electron";
import { electronApp } from "@electron-toolkit/utils";
import { join } from "path";
import { existsSync } from "fs";
import { Window } from "./core/window";
import { AppMenu } from "./ui/menu";
import { EventManager } from "./core/eventManager";

// Register blueberry:// as a privileged scheme BEFORE app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: "blueberry",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

let mainWindow: Window | null = null;
let eventManager: EventManager | null = null;
let menu: AppMenu | null = null;

const createWindow = (): Window => {
  const window = new Window();
  menu = new AppMenu(window);
  eventManager = new EventManager(window);
  return window;
};

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.electron");

  // Handle blueberry:// protocol requests
  protocol.handle("blueberry", (request) => {
    const url = new URL(request.url);

    // blueberry://chat/* → serve chat renderer
    if (url.hostname === "chat") {
      const pathname = url.pathname === "/" ? "/index.html" : url.pathname;

      if (process.env.ELECTRON_RENDERER_URL) {
        // Dev: proxy to Vite dev server
        return net.fetch(`${process.env.ELECTRON_RENDERER_URL}/chat${pathname}`);
      }
      // Prod: serve from built files
      const filePath = join(__dirname, "../renderer/chat", pathname);
      return net.fetch(`file://${filePath}`);
    }

    // blueberry://architecture → serve architecture visualization page
    if (url.hostname === "architecture") {
      let filePath: string;
      if (process.env.ELECTRON_RENDERER_URL) {
        // Dev: serve from project root
        filePath = join(app.getAppPath(), "docs", "architecture.html");
      } else {
        // Prod: serve from extraResources
        filePath = join(process.resourcesPath, "architecture.html");
      }
      if (existsSync(filePath)) {
        return net.fetch(`file://${filePath}`);
      }
      return new Response("Architecture page not found", { status: 404, headers: { "Content-Type": "text/plain" } });
    }

    // blueberry://report/<id> → serve report from userData
    if (url.hostname === "report") {
      const reportId = url.pathname.replace(/^\//, "");
      // Validate UUID format to prevent path traversal
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(reportId)) {
        return new Response("Invalid report ID", { status: 400, headers: { "Content-Type": "text/plain" } });
      }
      const reportsDir = join(app.getPath("userData"), "reports");
      const filePath = join(reportsDir, `${reportId}.html`);

      if (existsSync(filePath)) {
        return net.fetch(`file://${filePath}`);
      }
      return new Response("Report not found", { status: 404, headers: { "Content-Type": "text/plain" } });
    }

    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  });

  mainWindow = createWindow();

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BaseWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (eventManager) {
    eventManager.cleanup();
    eventManager = null;
  }

  // Clean up references
  if (mainWindow) {
    mainWindow = null;
  }
  if (menu) {
    menu = null;
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});
