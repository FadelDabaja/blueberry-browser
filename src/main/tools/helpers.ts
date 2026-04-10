import type { Tab } from "../core/tab";

export function getTab(getActiveTab: () => Tab | null): Tab {
  const tab = getActiveTab();
  if (!tab) throw new Error("No active tab available");
  return tab;
}

export function escapeForJs(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\0/g, "\\0")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Sanitize a selector that may come from axe-core or similar tools.
 * Handles array format, special characters, and escaping.
 */
export function sanitizeSelector(selector: string): string {
  // Axe-core sometimes returns array of selectors like ["#foo", ".bar > .baz"]
  if (selector.startsWith('[') && selector.endsWith(']')) {
    try {
      const parsed = JSON.parse(selector)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[parsed.length - 1] // Use the most specific selector
      }
    } catch {
      // Not valid JSON array, treat as regular selector
    }
  }

  // Strip leading/trailing whitespace
  return selector.trim()
}
