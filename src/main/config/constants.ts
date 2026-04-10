// Layout
export const TOPBAR_HEIGHT = 44;

// Sidebar
export const DEFAULT_SIDEBAR_WIDTH = 500;
export const MIN_SIDEBAR_WIDTH = 375;
export const MAX_SIDEBAR_WIDTH = 875;
export const SIDEBAR_ANIMATION_STEPS = 12;
export const SIDEBAR_ANIMATION_DURATION = 200; // ms

// History
export const MAX_HISTORY_ENTRIES = 1000;
export const HISTORY_DEBOUNCE_MS = 2000;

// Tab defaults
export const DEFAULT_TAB_URL = "https://www.google.com";
export const CHAT_PAGE_URL = "blueberry://chat";

// Parallel orchestrator
export const MAX_PARALLEL_DEPTH = 3;
export const TAB_LOAD_TIMEOUT_MS = 30_000;
export const DEFAULT_CONCURRENCY = 3;
export const MAX_CONCURRENCY = 5;
export const MAX_PARALLEL_TASKS = 20;

// toModelOutput truncation limits (chars) — what parent agents see from subagent results
export const SUBAGENT_SUMMARY_MAX_LENGTH = 1000;
export const PARALLEL_SUMMARY_MAX_LENGTH = 500;

// Diagnostics
export const DIAGNOSTICS_CONSOLE_BUFFER_SIZE = 200;
export const DIAGNOSTICS_NETWORK_BUFFER_SIZE = 200;

// Stream processing
export const TEXT_DELTA_THROTTLE_MS = 50;
export const IPC_SUBAGENT_SUMMARY_TRUNCATE_LEN = 500;
export const IPC_PARALLEL_RESULT_TRUNCATE_LEN = 200;

// LLM timeouts
export const STEP_TIMEOUT_MS = 120_000;
export const TOTAL_TIMEOUT_MS = 600_000;

// Token estimation
export const TOKEN_ESTIMATE_DIVISOR = 4;
