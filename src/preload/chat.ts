import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

interface ChatRequest {
  message: string;
  messageId: string;
  verbosity?: "concise" | "normal" | "detailed";
}

interface ChatResponse {
  messageId: string;
  content: string;
  isComplete: boolean;
  cancelled?: boolean;
}

// Chat page API — same IPC channels as sidebar so they share the same LLMClient
const chatPageAPI = {
  // Chat functionality
  sendChatMessage: (request: ChatRequest) =>
    electronAPI.ipcRenderer.invoke("sidebar-chat-message", request),

  clearChat: () => electronAPI.ipcRenderer.invoke("sidebar-clear-chat"),

  cancelChat: () => electronAPI.ipcRenderer.invoke("sidebar-cancel-chat"),

  getMessages: () => electronAPI.ipcRenderer.invoke("sidebar-get-messages"),

  onChatResponse: (callback: (data: ChatResponse) => void) => {
    electronAPI.ipcRenderer.removeAllListeners("chat-response");
    electronAPI.ipcRenderer.on("chat-response", (_, data) => callback(data));
  },

  onMessagesUpdated: (callback: (messages: any[]) => void) => {
    electronAPI.ipcRenderer.removeAllListeners("chat-messages-updated");
    electronAPI.ipcRenderer.on("chat-messages-updated", (_, messages) =>
      callback(messages)
    );
  },

  removeChatResponseListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("chat-response");
  },

  removeMessagesUpdatedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("chat-messages-updated");
  },

  // Audit report data
  onAuditReportData: (callback: (report: any) => void) => {
    electronAPI.ipcRenderer.removeAllListeners("audit-report-data");
    electronAPI.ipcRenderer.on("audit-report-data", (_, report) =>
      callback(report)
    );
  },

  onAuditToolProgress: (callback: (progress: any) => void) => {
    electronAPI.ipcRenderer.removeAllListeners("audit-tool-progress");
    electronAPI.ipcRenderer.on("audit-tool-progress", (_, progress) =>
      callback(progress)
    );
  },

  removeAuditListeners: () => {
    electronAPI.ipcRenderer.removeAllListeners("audit-report-data");
    electronAPI.ipcRenderer.removeAllListeners("audit-tool-progress");
  },

  // Tool call streaming
  onToolCallStarted: (callback: (data: any) => void) => {
    electronAPI.ipcRenderer.removeAllListeners("tool-call-started");
    electronAPI.ipcRenderer.on("tool-call-started", (_, data) => callback(data));
  },

  onToolCallCompleted: (callback: (data: any) => void) => {
    electronAPI.ipcRenderer.removeAllListeners("tool-call-completed");
    electronAPI.ipcRenderer.on("tool-call-completed", (_, data) => callback(data));
  },

  removeToolCallListeners: () => {
    electronAPI.ipcRenderer.removeAllListeners("tool-call-started");
    electronAPI.ipcRenderer.removeAllListeners("tool-call-completed");
  },

  // Token usage
  onTokenUsage: (callback: (data: any) => void) => {
    electronAPI.ipcRenderer.removeAllListeners("token-usage");
    electronAPI.ipcRenderer.on("token-usage", (_, data) => callback(data));
  },

  removeTokenUsageListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("token-usage");
  },

  // Step progress
  onStepProgress: (callback: (data: any) => void) => {
    electronAPI.ipcRenderer.removeAllListeners("step-progress");
    electronAPI.ipcRenderer.on("step-progress", (_, data) => callback(data));
  },

  removeStepProgressListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("step-progress");
  },

  // Highlight elements on page (no-op for chat page, but keeps API compatible)
  highlightElements: (_highlights: { selector: string; color: string; label: string }[]) =>
    Promise.resolve(),

  clearHighlights: () => Promise.resolve(),

  // Page content access (no active tab in chat page)
  getPageContent: () => Promise.resolve(null),
  getPageText: () => Promise.resolve(null),
  getCurrentUrl: () => Promise.resolve(null),

  // Tab information
  getActiveTabInfo: () => Promise.resolve(null),

  // History
  getHistory: (search?: string, limit?: number) =>
    electronAPI.ipcRenderer.invoke("get-history", search, limit),
  clearHistory: () => electronAPI.ipcRenderer.invoke("clear-history"),

  // Settings
  getSettings: () => electronAPI.ipcRenderer.invoke("get-settings"),
  updateSettings: (settings: any) =>
    electronAPI.ipcRenderer.invoke("update-settings", settings),

  // Navigation (no-op in chat page)
  navigateToUrl: (_url: string) => Promise.resolve(),

  // Sidebar resize (no-op in chat page)
  resizeStart: () => Promise.resolve(0),
  resizeMove: (_deltaX: number) => Promise.resolve(),
  resizeEnd: () => Promise.resolve(),

  // Page context updates (no-op in chat page)
  onPageContextUpdated: (_callback: (data: any) => void) => {},
  removePageContextListener: () => {},

  // Ask user response (from ToolCallCard)
  respondToQuestion: (questionId: string, response: string) =>
    electronAPI.ipcRenderer.send("ask-user-response", { questionId, response }),

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

  // Source citations (web search)
  onChatSource: (callback: (data: any) => void) => {
    electronAPI.ipcRenderer.removeAllListeners("chat-source");
    electronAPI.ipcRenderer.on("chat-source", (_, data) => callback(data));
  },
  removeChatSourceListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("chat-source");
  },

  // Step started
  onStepStarted: (callback: (data: any) => void) => {
    electronAPI.ipcRenderer.removeAllListeners("step-started");
    electronAPI.ipcRenderer.on("step-started", (_, data) => callback(data));
  },
  removeStepStartedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("step-started");
  },

  // Step finished (per-step usage from stream)
  onStepFinished: (callback: (data: any) => void) => {
    electronAPI.ipcRenderer.removeAllListeners("step-finished");
    electronAPI.ipcRenderer.on("step-finished", (_, data) => callback(data));
  },

  removeStepFinishedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("step-finished");
  },

  // Stream finished (total usage from stream)
  onStreamFinished: (callback: (data: any) => void) => {
    electronAPI.ipcRenderer.removeAllListeners("stream-finished");
    electronAPI.ipcRenderer.on("stream-finished", (_, data) => callback(data));
  },

  removeStreamFinishedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("stream-finished");
  },

  // Reasoning/thinking output
  onChatReasoning: (callback: (data: { messageId: string; text: string }) => void) => {
    electronAPI.ipcRenderer.removeAllListeners("chat-reasoning");
    electronAPI.ipcRenderer.on("chat-reasoning", (_, data) => callback(data));
  },
  removeChatReasoningListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("chat-reasoning");
  },

  // Open URL in a new tab
  openNewTab: (url: string) =>
    electronAPI.ipcRenderer.invoke("create-tab", url),

  // Report management
  listReports: () =>
    electronAPI.ipcRenderer.invoke("reports-list"),
  deleteReport: (id: string) =>
    electronAPI.ipcRenderer.invoke("reports-delete", id),

  // Task management
  listTasks: (filter?: { status?: string }) =>
    electronAPI.ipcRenderer.invoke("tasks-list", filter),
  updateTask: (id: string, updates: Record<string, string>) =>
    electronAPI.ipcRenderer.invoke("tasks-update", id, updates),
  deleteTask: (id: string) =>
    electronAPI.ipcRenderer.invoke("tasks-delete", id),
};

// Expose as sidebarAPI so shared components work without changes
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("sidebarAPI", chatPageAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.sidebarAPI = chatPageAPI;
}
