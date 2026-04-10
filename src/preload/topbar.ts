import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

// TopBar specific APIs
const topBarAPI = {
  // Tab management
  createTab: (url?: string) =>
    electronAPI.ipcRenderer.invoke("create-tab", url),
  closeTab: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("close-tab", tabId),
  switchTab: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("switch-tab", tabId),
  getTabs: () => electronAPI.ipcRenderer.invoke("get-tabs"),

  // Tab navigation
  navigateTab: (tabId: string, url: string) =>
    electronAPI.ipcRenderer.invoke("navigate-tab", tabId, url),
  goBack: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("tab-go-back", tabId),
  goForward: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("tab-go-forward", tabId),
  reload: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("tab-reload", tabId),

  // Tab actions
  tabScreenshot: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("tab-screenshot", tabId),
  tabRunJs: (tabId: string, code: string) =>
    electronAPI.ipcRenderer.invoke("tab-run-js", tabId, code),

  // Sidebar
  toggleSidebar: () =>
    electronAPI.ipcRenderer.invoke("toggle-sidebar"),

  // Window controls
  minimizeWindow: () => electronAPI.ipcRenderer.invoke("window-minimize"),
  maximizeWindow: () => electronAPI.ipcRenderer.invoke("window-maximize"),
  closeWindow: () => electronAPI.ipcRenderer.invoke("window-close"),

  // Tab update notifications from main process
  onTabsUpdated: (callback: () => void) => {
    electronAPI.ipcRenderer.removeAllListeners("tabs-updated");
    electronAPI.ipcRenderer.on("tabs-updated", () => callback());
  },
  removeTabsUpdatedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("tabs-updated");
  },

  // Dark mode
  sendDarkModeChange: (isDark: boolean) =>
    electronAPI.ipcRenderer.send("dark-mode-changed", isDark),
  onDarkModeUpdate: (callback: (isDark: boolean) => void) => {
    electronAPI.ipcRenderer.removeAllListeners("dark-mode-updated");
    electronAPI.ipcRenderer.on("dark-mode-updated", (_, isDark) => callback(isDark));
  },
  removeDarkModeListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("dark-mode-updated");
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("topBarAPI", topBarAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.topBarAPI = topBarAPI;
}

