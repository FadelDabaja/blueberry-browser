import { app } from "electron";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { MAX_HISTORY_ENTRIES, HISTORY_DEBOUNCE_MS } from "../config/constants";

interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  favicon: string;
  timestamp: number;
}

export class HistoryManager {
  private entries: HistoryEntry[] = [];
  private filePath: string;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.filePath = join(app.getPath("userData"), "history.json");
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(this.filePath)) {
        const data = readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          this.entries = parsed;
        } else {
          console.warn("History file is not an array, resetting");
          this.entries = [];
        }
      }
    } catch (error) {
      console.error("Failed to load history:", error);
      this.entries = [];
    }
  }

  private scheduleSave(): void {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => {
      this.save();
    }, HISTORY_DEBOUNCE_MS);
  }

  private save(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.entries), "utf-8");
    } catch (error) {
      console.error("Failed to save history:", error);
    }
  }

  addEntry(url: string, title: string, favicon: string): void {
    // Skip internal/blank pages
    if (!url || url === "about:blank" || url.startsWith("chrome://")) return;

    // Deduplicate: if last entry has same URL, update it instead
    if (this.entries.length > 0 && this.entries[0].url === url) {
      this.entries[0].title = title || this.entries[0].title;
      this.entries[0].favicon = favicon || this.entries[0].favicon;
      this.entries[0].timestamp = Date.now();
      this.scheduleSave();
      return;
    }

    const entry: HistoryEntry = {
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url,
      title: title || url,
      favicon: favicon || "",
      timestamp: Date.now(),
    };

    this.entries.unshift(entry);

    // Trim to max
    if (this.entries.length > MAX_HISTORY_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_HISTORY_ENTRIES);
    }

    this.scheduleSave();
  }

  getEntries(search?: string, limit?: number): HistoryEntry[] {
    let results = this.entries;

    if (search) {
      const lower = search.toLowerCase();
      results = results.filter(
        (e) =>
          e.title.toLowerCase().includes(lower) ||
          e.url.toLowerCase().includes(lower)
      );
    }

    if (limit && limit > 0) {
      results = results.slice(0, limit);
    }

    return results;
  }

  clearHistory(): void {
    this.entries = [];
    this.save();
  }

  /** Flush any pending writes immediately (call on shutdown) */
  flush(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
      this.save();
    }
  }
}
