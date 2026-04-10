// sidebar.d.ts — typed preload API

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

interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

interface AuditReport {
  messageId: string;
  overallScore: number;
  categories: {
    name: string;
    score: number;
    issues: {
      severity: "critical" | "serious" | "moderate" | "minor";
      title: string;
      description: string;
      helpUrl?: string;
      elements: { html: string; selector: string }[];
      suggestedFix?: string;
    }[];
  }[];
  timestamp: number;
}

interface ToolProgress {
  messageId: string;
  toolName: string;
  status: "running" | "complete" | "cancelled";
}

interface ToolCallEvent {
  messageId: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

interface ToolResultEvent extends ToolCallEvent {
  output: unknown;
  durationMs: number;
  isError?: boolean;
}

interface HighlightRequest {
  selector: string;
  color: string;
  label: string;
  id?: string;
}

interface TokenUsage {
  messageId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextLimit?: number;
  modelName?: string;
}

interface StepProgress {
  messageId: string;
  stepNumber: number;
  toolCalls: string[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

interface PageContext {
  url: string;
  title: string;
  favicon: string;
}

interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  favicon: string;
  timestamp: number;
}

interface AppSettings {
  provider: string;
  model: string;
  apiKey: string;
  theme: "light" | "dark" | "system";
}

interface SidebarAPI {
  // Chat functionality
  sendChatMessage: (request: ChatRequest) => Promise<void>;
  clearChat: () => Promise<boolean>;
  cancelChat: () => Promise<boolean>;
  getMessages: () => Promise<any[]>;
  onChatResponse: (callback: (data: ChatResponse) => void) => void;
  onMessagesUpdated: (callback: (messages: any[]) => void) => void;
  removeChatResponseListener: () => void;
  removeMessagesUpdatedListener: () => void;

  // Audit
  onAuditReportData: (callback: (report: AuditReport) => void) => void;
  onAuditToolProgress: (callback: (progress: ToolProgress) => void) => void;
  removeAuditListeners: () => void;
  highlightElements: (highlights: HighlightRequest[]) => Promise<void>;
  clearHighlights: () => Promise<void>;

  // Tool call streaming
  onToolCallStarted: (callback: (data: ToolCallEvent) => void) => void;
  onToolCallCompleted: (callback: (data: ToolResultEvent) => void) => void;
  removeToolCallListeners: () => void;

  // Token usage
  onTokenUsage: (callback: (data: TokenUsage) => void) => void;
  removeTokenUsageListener: () => void;

  // Step progress
  onStepProgress: (callback: (data: StepProgress) => void) => void;
  removeStepProgressListener: () => void;

  // Step started
  onStepStarted: (callback: (data: { messageId: string; stepNumber: number }) => void) => void;
  removeStepStartedListener: () => void;

  // Step finished (per-step usage from stream)
  onStepFinished: (callback: (data: { messageId: string; stepNumber: number; usage: any; finishReason: string; isContinued: boolean }) => void) => void;
  removeStepFinishedListener: () => void;

  // Stream finished (total usage from stream)
  onStreamFinished: (callback: (data: { messageId: string; totalUsage: any; finishReason: string }) => void) => void;
  removeStreamFinishedListener: () => void;

  // Reasoning/thinking output
  onChatReasoning: (callback: (data: { messageId: string; text: string }) => void) => void;
  removeChatReasoningListener: () => void;

  // Page content access
  getPageContent: () => Promise<string | null>;
  getPageText: () => Promise<string | null>;
  getCurrentUrl: () => Promise<string | null>;

  // Tab information
  getActiveTabInfo: () => Promise<TabInfo | null>;

  // History
  getHistory: (search?: string, limit?: number) => Promise<HistoryEntry[]>;
  clearHistory: () => Promise<void>;

  // Settings
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;

  // Sidebar resize
  resizeStart: () => Promise<number>;
  resizeMove: (deltaX: number) => Promise<void>;
  resizeEnd: () => Promise<void>;

  // Navigation from sidebar
  navigateToUrl: (url: string) => Promise<void>;

  // Open URL in a new tab
  openNewTab: (url: string) => Promise<{ id: string; title: string; url: string }>;

  // Page context updates
  onPageContextUpdated: (callback: (data: PageContext) => void) => void;
  removePageContextListener: () => void;

  // Source citations (web search)
  onChatSource: (callback: (data: { messageId: string; source: { url: string; title?: string } }) => void) => void;
  removeChatSourceListener: () => void;

  // Report management
  listReports: () => Promise<{ id: string; title: string; createdAt: string }[]>;
  deleteReport: (id: string) => Promise<boolean>;

  // Task management
  listTasks: (filter?: { status?: string; groupId?: string }) => Promise<any[]>;
  updateTask: (id: string, updates: Record<string, string>) => Promise<any>;
  deleteTask: (id: string) => Promise<boolean>;

  // Group management
  listGroups: () => Promise<{ id: string; name: string; createdAt: string }[]>;
  deleteGroup: (id: string) => Promise<boolean>;

  // Ask user response (from ToolCallCard)
  respondToQuestion: (questionId: string, response: string) => void;

  // Highlight overlay interaction
  scrollToHighlight: (id: string) => Promise<boolean>;
  filterHighlights: (categories: string[]) => Promise<void>;
  onHighlightClicked: (callback: (data: { id: string; category: string; severity: string; label: string; description: string; fix: string }) => void) => void;
  removeHighlightClickedListener: () => void;

  // Dark mode
  sendDarkModeChange: (isDark: boolean) => void;
  onDarkModeUpdate: (callback: (isDark: boolean) => void) => void;
  removeDarkModeListener: () => void;
}

declare global {
  interface Window {
    sidebarAPI: SidebarAPI;
  }
}
