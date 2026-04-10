import { tool } from "ai";
import { z } from "zod";
import type { Tab } from "../core/tab";
import type { Window } from "../core/window";
import { getTab } from "./helpers";

export function createDiagnosticTools(
  getActiveTab: () => Tab | null,
  getWindow?: () => Window | null
) {
  return {
    get_console_logs: tool({
      description:
        "Query JavaScript console messages (warnings and errors) from the current tab. " +
        "Use this to detect runtime JS errors, deprecation warnings, and failed assertions.",
      inputSchema: z.object({
        level: z
          .string()
          .nullable()
          .describe(
            "Filter by log level: 'verbose', 'info', 'warning', or 'error'. Null returns all levels."
          ),
        search: z
          .string()
          .nullable()
          .describe(
            "Case-insensitive search term to filter messages by content or source. Null returns all."
          ),
        limit: z
          .number()
          .nullable()
          .describe(
            "Maximum number of entries to return (most recent). Null returns all."
          ),
      }),
      execute: async ({ level, search, limit }) => {
        try {
          const tab = getTab(getActiveTab);
          const diagnostics = getWindow?.()?.diagnosticsService;
          if (!diagnostics) {
            return { success: false, error: "DiagnosticsService not available" };
          }
          const filter: { level?: string; search?: string; limit?: number } = {};
          if (level) filter.level = level;
          if (search) filter.search = search;
          if (limit) filter.limit = limit;
          const entries = diagnostics.getConsoleLogsForTab(tab.id, filter);
          return { success: true, entries, count: entries.length };
        } catch (error) {
          return {
            success: false,
            error: `Tool failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    }),

    get_network_errors: tool({
      description:
        "Query failed network requests (4xx, 5xx, CORS, connection errors) from the current tab. " +
        "Use this to find broken API calls, missing resources, and connectivity issues.",
      inputSchema: z.object({
        statusCode: z
          .number()
          .nullable()
          .describe(
            "Filter by specific HTTP status code (e.g. 404, 500). Null returns all error codes."
          ),
        search: z
          .string()
          .nullable()
          .describe(
            "Case-insensitive search term to filter by URL or error message. Null returns all."
          ),
        limit: z
          .number()
          .nullable()
          .describe(
            "Maximum number of entries to return (most recent). Null returns all."
          ),
      }),
      execute: async ({ statusCode, search, limit }) => {
        try {
          const tab = getTab(getActiveTab);
          const diagnostics = getWindow?.()?.diagnosticsService;
          if (!diagnostics) {
            return { success: false, error: "DiagnosticsService not available" };
          }
          const filter: { statusCode?: number; search?: string; limit?: number } = {};
          if (statusCode) filter.statusCode = statusCode;
          if (search) filter.search = search;
          if (limit) filter.limit = limit;
          const entries = diagnostics.getNetworkErrorsForTab(tab.id, filter);
          return { success: true, entries, count: entries.length };
        } catch (error) {
          return {
            success: false,
            error: `Tool failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    }),

    get_diagnostics_summary: tool({
      description:
        "Get a quick error count and recent errors for the current tab. " +
        "Use this for fast triage before diving deeper with get_console_logs or get_network_errors.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const tab = getTab(getActiveTab);
          const diagnostics = getWindow?.()?.diagnosticsService;
          if (!diagnostics) {
            return { success: false, error: "DiagnosticsService not available" };
          }
          const summary = diagnostics.getErrorSummaryForTab(tab.id);
          return { success: true, ...summary };
        } catch (error) {
          return {
            success: false,
            error: `Tool failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    }),
  };
}
