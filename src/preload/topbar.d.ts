// topbar.d.ts — typed preload API

interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

interface TopBarAPI {
  // Tab management
  createTab: (
    url?: string
  ) => Promise<{ id: string; title: string; url: string } | null>;
  closeTab: (tabId: string) => Promise<boolean>;
  switchTab: (tabId: string) => Promise<boolean>;
  getTabs: () => Promise<TabInfo[]>;

  // Tab navigation
  navigateTab: (tabId: string, url: string) => Promise<void>;
  goBack: (tabId: string) => Promise<void>;
  goForward: (tabId: string) => Promise<void>;
  reload: (tabId: string) => Promise<void>;

  // Tab actions
  tabScreenshot: (tabId: string) => Promise<string | null>;
  tabRunJs: (tabId: string, code: string) => Promise<any>;

  // Sidebar
  toggleSidebar: () => Promise<void>;

  // Window controls
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;

  // Tab update notifications
  onTabsUpdated: (callback: () => void) => void;
  removeTabsUpdatedListener: () => void;

  // Dark mode
  sendDarkModeChange: (isDark: boolean) => void;
  onDarkModeUpdate: (callback: (isDark: boolean) => void) => void;
  removeDarkModeListener: () => void;
}

declare global {
  interface Window {
    topBarAPI: TopBarAPI;
  }
}

