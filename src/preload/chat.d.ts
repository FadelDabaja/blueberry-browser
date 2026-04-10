// chat.d.ts — Chat page shares the same SidebarAPI interface for component compatibility
// See sidebar.d.ts for full type definitions

declare global {
  interface Window {
    sidebarAPI: import("./sidebar").SidebarAPI;
  }
}
