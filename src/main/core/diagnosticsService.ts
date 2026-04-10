import { Session } from "electron";
import { Tab } from "./tab";
import {
  DIAGNOSTICS_CONSOLE_BUFFER_SIZE,
  DIAGNOSTICS_NETWORK_BUFFER_SIZE,
} from "../config/constants";

// --- Types ---

export interface ConsoleEntry {
  timestamp: number;
  level: "verbose" | "info" | "warning" | "error";
  message: string;
  line: number;
  sourceId: string;
}

export interface NetworkEntry {
  timestamp: number;
  url: string;
  method: string;
  statusCode: number;
  error: string;
  resourceType: string;
}

export interface ErrorSummary {
  consoleErrors: number;
  networkErrors: number;
  recentErrors: string[];
}

// --- Ring Buffer ---

class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head: number = 0;
  private count: number = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  getAll(): T[] {
    if (this.count === 0) return [];

    const result: T[] = [];
    // Start from the oldest item
    const start =
      this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.capacity;
      result.push(this.buffer[idx] as T);
    }
    return result;
  }

  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.count = 0;
  }

  get length(): number {
    return this.count;
  }
}

// --- Console level mapping ---

const CONSOLE_LEVEL_MAP: Record<number, ConsoleEntry["level"]> = {
  0: "verbose",
  1: "info",
  2: "warning",
  3: "error",
};

// --- DiagnosticsService ---

export class DiagnosticsService {
  private consoleLogs: Map<string, RingBuffer<ConsoleEntry>> = new Map();
  private networkErrors: Map<string, RingBuffer<NetworkEntry>> = new Map();
  private webContentsIdToTabId: Map<number, string> = new Map();

  registerTab(tab: Tab): void {
    const tabId = tab.id;
    const wcId = tab.webContents.id;

    this.webContentsIdToTabId.set(wcId, tabId);
    this.consoleLogs.set(tabId, new RingBuffer<ConsoleEntry>(DIAGNOSTICS_CONSOLE_BUFFER_SIZE));
    this.networkErrors.set(tabId, new RingBuffer<NetworkEntry>(DIAGNOSTICS_NETWORK_BUFFER_SIZE));

    tab.webContents.on("console-message", (event) => {
      const buffer = this.consoleLogs.get(tabId);
      if (!buffer) return;
      buffer.push({
        timestamp: Date.now(),
        level: CONSOLE_LEVEL_MAP[event.level] ?? "info",
        message: event.message,
        line: event.line,
        sourceId: event.sourceId,
      });
    });
  }

  attachNetworkListeners(sess: Session): void {
    const filter = { urls: ["<all_urls>"] };

    sess.webRequest.onCompleted(filter, (details) => {
      if (details.statusCode < 400) return;
      const tabId = this.webContentsIdToTabId.get(details.webContentsId);
      if (!tabId) return;
      const buffer = this.networkErrors.get(tabId);
      if (!buffer) return;
      buffer.push({
        timestamp: Date.now(),
        url: details.url,
        method: details.method,
        statusCode: details.statusCode,
        error: "",
        resourceType: details.resourceType ?? "unknown",
      });
    });

    sess.webRequest.onErrorOccurred(filter, (details) => {
      const tabId = this.webContentsIdToTabId.get(details.webContentsId);
      if (!tabId) return;
      const buffer = this.networkErrors.get(tabId);
      if (!buffer) return;
      buffer.push({
        timestamp: Date.now(),
        url: details.url,
        method: details.method,
        statusCode: 0,
        error: details.error ?? "unknown",
        resourceType: details.resourceType ?? "unknown",
      });
    });
  }

  unregisterTab(tab: Tab): void {
    const wcId = tab.webContents.id;
    const tabId = this.webContentsIdToTabId.get(wcId);

    this.webContentsIdToTabId.delete(wcId);
    if (tabId) {
      this.consoleLogs.delete(tabId);
      this.networkErrors.delete(tabId);
    }
  }

  getConsoleLogsForTab(
    tabId: string,
    filter?: { level?: string; search?: string; limit?: number }
  ): ConsoleEntry[] {
    const buffer = this.consoleLogs.get(tabId);
    if (!buffer) return [];

    let entries = buffer.getAll();

    if (filter?.level) {
      entries = entries.filter((e) => e.level === filter.level);
    }
    if (filter?.search) {
      const term = filter.search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.message.toLowerCase().includes(term) ||
          e.sourceId.toLowerCase().includes(term)
      );
    }
    if (filter?.limit && filter.limit > 0) {
      entries = entries.slice(-filter.limit);
    }

    return entries;
  }

  getNetworkErrorsForTab(
    tabId: string,
    filter?: { statusCode?: number; search?: string; limit?: number }
  ): NetworkEntry[] {
    const buffer = this.networkErrors.get(tabId);
    if (!buffer) return [];

    let entries = buffer.getAll();

    if (filter?.statusCode) {
      entries = entries.filter((e) => e.statusCode === filter.statusCode);
    }
    if (filter?.search) {
      const term = filter.search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.url.toLowerCase().includes(term) ||
          e.error.toLowerCase().includes(term)
      );
    }
    if (filter?.limit && filter.limit > 0) {
      entries = entries.slice(-filter.limit);
    }

    return entries;
  }

  getErrorSummaryForTab(tabId: string): ErrorSummary {
    const consoleBuf = this.consoleLogs.get(tabId);
    const networkBuf = this.networkErrors.get(tabId);

    const consoleEntries = consoleBuf ? consoleBuf.getAll() : [];
    const networkEntries = networkBuf ? networkBuf.getAll() : [];

    const consoleErrors = consoleEntries.filter((e) => e.level === "error");
    const allErrors: { timestamp: number; text: string }[] = [
      ...consoleErrors.map((e) => ({
        timestamp: e.timestamp,
        text: `[console] ${e.message}`,
      })),
      ...networkEntries.map((e) => ({
        timestamp: e.timestamp,
        text: `[network] ${e.statusCode || "ERR"} ${e.url}${e.error ? ` (${e.error})` : ""}`,
      })),
    ];

    // Sort by timestamp descending and take the 5 most recent
    allErrors.sort((a, b) => b.timestamp - a.timestamp);
    const recentErrors = allErrors.slice(0, 5).map((e) => e.text);

    return {
      consoleErrors: consoleErrors.length,
      networkErrors: networkEntries.length,
      recentErrors,
    };
  }
}
