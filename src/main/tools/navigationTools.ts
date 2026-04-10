import { tool } from "ai";
import { z } from "zod";
import type { Tab } from "../core/tab";
import type { Window } from "../core/window";
import { escapeForJs, getTab } from "./helpers";

export function createNavigationTools(
  getActiveTab: () => Tab | null,
  getWindow?: () => Window | null
) {
  return {
    navigate_to_url: tool({
      description:
        "Navigate the current tab to a specified URL. Use this when the user asks to go to a website or visit a link. Supports blueberry:// URLs for internal pages and reports.",
      inputSchema: z.object({
        url: z.string().describe("URL to navigate to. Prepend 'https://' if user gives a bare domain. blueberry:// URLs are passed through as-is."),
      }),
      execute: async ({ url }) => {
        try {
          if (/^(javascript|data|vbscript):/i.test(url)) {
            return { success: false, error: "Blocked: dangerous URL protocol" };
          }
          const tab = getTab(getActiveTab);
          let targetUrl = url;
          if (!/^(https?|blueberry):\/\//i.test(targetUrl)) {
            targetUrl = "https://" + targetUrl;
          }
          try {
            new URL(targetUrl);
          } catch {
            return { success: false, error: `Invalid URL: ${targetUrl}` };
          }
          await tab.loadURL(targetUrl);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return { success: true, url: tab.url, title: tab.title };
        } catch (error) {
          return { success: false, error: `Tool failed: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    open_new_tab: tool({
      description:
        "Open a URL in a new browser tab and switch to it. Use when the user wants to keep the current page open while visiting another. Supports blueberry:// URLs for internal pages and reports.",
      inputSchema: z.object({
        url: z.string().describe("URL to open in the new tab. blueberry:// URLs are passed through as-is."),
      }),
      execute: async ({ url }) => {
        try {
          if (/^(javascript|data|vbscript):/i.test(url)) {
            return { success: false, error: "Blocked: dangerous URL protocol" };
          }
          const win = getWindow?.();
          if (!win) return { success: false, error: "Window not available" };
          let targetUrl = url;
          if (!/^(https?|blueberry):\/\//i.test(targetUrl)) {
            targetUrl = "https://" + targetUrl;
          }
          try {
            new URL(targetUrl);
          } catch {
            return { success: false, error: `Invalid URL: ${targetUrl}` };
          }
          const newTab = win.createTab(targetUrl);
          win.switchActiveTab(newTab.id);
          win.topBar.view.webContents.send("tabs-updated");
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return { success: true, tabId: newTab.id, url: newTab.url, title: newTab.title };
        } catch (error) {
          return { success: false, error: `Tool failed: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    switch_tab: tool({
      description:
        "Switch to a different open tab by its tab ID. Use get_open_tabs to see available tabs first.",
      inputSchema: z.object({
        tabId: z.string().describe("The tab ID to switch to"),
      }),
      execute: async ({ tabId }) => {
        const win = getWindow?.();
        if (!win) return { success: false, error: "Window not available" };
        const switched = win.switchActiveTab(tabId);
        win.topBar.view.webContents.send("tabs-updated");
        if (!switched) return { success: false, error: `Tab ${tabId} not found` };
        const tab = win.getTab(tabId);
        return { success: true, tabId, url: tab?.url || "", title: tab?.title || "" };
      },
    }),

    get_open_tabs: tool({
      description: "Get a list of all currently open browser tabs with their IDs, URLs, and titles.",
      inputSchema: z.object({}),
      execute: async () => {
        const win = getWindow?.();
        if (!win) return { tabs: [] };
        return {
          tabs: win.allTabs.map((t) => ({
            id: t.id,
            url: t.url,
            title: t.title,
            isActive: win.activeTab?.id === t.id,
          })),
        };
      },
    }),

    get_current_url: tool({
      description: "Get the current URL and page title of the active tab.",
      inputSchema: z.object({}),
      execute: async () => {
        const tab = getTab(getActiveTab);
        return { url: tab.url, title: tab.title };
      },
    }),

    get_page_links: tool({
      description:
        "Get all links on the current page. Returns href, text, and whether they are internal or external. Useful for autonomous navigation — discover links then click through them.",
      inputExamples: [
        { filter: null },
        { filter: 'pricing' },
      ],
      inputSchema: z.object({
        filter: z.string().nullable().describe("Optional text filter to match link text or URL (case-insensitive)"),
      }),
      execute: async ({ filter }) => {
        try {
          const tab = getTab(getActiveTab);
          const filterEscaped = filter ? escapeForJs(filter) : "";
          return await tab.runJs(`
            (function() {
              var links = [];
              var currentHost = location.hostname;
              document.querySelectorAll('a[href]').forEach(function(a) {
                var text = (a.textContent || '').trim().substring(0, 100);
                var href = a.href;
                if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;
                var filter = '${filterEscaped}'.toLowerCase();
                if (filter && text.toLowerCase().indexOf(filter) === -1 && href.toLowerCase().indexOf(filter) === -1) return;
                try {
                  var url = new URL(href);
                  links.push({
                    text: text,
                    href: href,
                    isInternal: url.hostname === currentHost,
                    selector: a.id ? '#' + a.id : (a.className ? 'a.' + String(a.className).split(' ').filter(Boolean)[0] : null)
                  });
                } catch(e) {}
              });
              return { links: links.slice(0, 50), totalCount: links.length };
            })()
          `);
        } catch (error) {
          return { success: false, error: `Tool failed: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    close_tab: tool({
      description: "Close a browser tab by its ID. Cannot close the last remaining tab.",
      inputSchema: z.object({
        tabId: z.string().describe("ID of the tab to close"),
      }),
      execute: async ({ tabId }) => {
        const win = getWindow?.();
        if (!win) return { success: false, error: "No window available" };
        try {
          win.closeTab(tabId);
          return { success: true };
        } catch (error) {
          return { success: false, error: `Failed to close tab: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    go_back: tool({
      description: "Navigate back in browser history for the current tab.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const tab = getTab(getActiveTab);
          tab.goBack();
          return { success: true, url: tab.url };
        } catch (error) {
          return { success: false, error: `Failed to go back: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    go_forward: tool({
      description: "Navigate forward in browser history for the current tab.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const tab = getTab(getActiveTab);
          tab.goForward();
          return { success: true, url: tab.url };
        } catch (error) {
          return { success: false, error: `Failed to go forward: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),
  };
}
