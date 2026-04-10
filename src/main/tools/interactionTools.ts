import { tool } from "ai";
import { z } from "zod";
import type { Tab } from "../core/tab";
import {
  buildAddHighlightsScript,
  buildClearScript,
  buildControllerScript,
  buildFilterScript,
  buildSelectHighlightScript,
} from "./overlayController";
import type { HighlightItem } from "./overlayController";
import { escapeForJs, getTab } from "./helpers";
import { JS_BUILD_SELECTOR, JS_LUMINANCE, JS_PARSE_COLOR, JS_GET_EFF_BG } from "./clientScripts";

export function createInteractionTools(getActiveTab: () => Tab | null) {
  return {
    click_element: tool({
      description:
        "Click an element on the page by CSS selector. Useful for testing interactive elements and navigation flows.",
      inputExamples: [
        { selector: '#submit-btn' },
        { selector: 'a[href="/about"]' },
        { selector: 'button.primary' },
      ],
      inputSchema: z.object({
        selector: z.string().describe("CSS selector for the element to click"),
      }),
      needsApproval: async ({ selector }) => {
        // Require approval for potentially destructive actions
        return /submit|delete|remove|logout|sign.?out|buy|purchase|pay|confirm|accept/i.test(selector);
      },
      execute: async ({ selector }) => {
        try {
          const tab = getTab(getActiveTab);
          const escaped = escapeForJs(selector);
          return await tab.runJs(`
            (function() {
              var el = document.querySelector('${escaped}');
              if (!el) return { success: false, error: 'Element not found: ${escaped}' };
              el.click();
              return {
                success: true,
                tagName: el.tagName.toLowerCase(),
                text: (el.textContent || '').trim().substring(0, 100),
                href: el.href || null
              };
            })()
          `);
        } catch (error) {
          return { success: false, error: `Tool failed: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    fill_input: tool({
      description:
        "Fill an input field with a value. Dispatches focus, input, and change events to trigger validation.",
      inputExamples: [
        { selector: 'input[name="email"]', value: 'test@example.com' },
        { selector: '#search-box', value: 'AI SDK documentation' },
      ],
      inputSchema: z.object({
        selector: z.string().describe("CSS selector for the input element"),
        value: z.string().describe("Value to fill into the input"),
      }),
      needsApproval: async ({ selector, value }) => {
        // Require approval for password/credit card fields or sensitive data
        return /password|credit|card|cvv|ssn|social/i.test(selector) ||
               /password|credit|card|cvv|ssn|social/i.test(value);
      },
      execute: async ({ selector, value }) => {
        try {
          const tab = getTab(getActiveTab);
          const escapedSelector = escapeForJs(selector);
          const escapedValue = escapeForJs(value);
          return await tab.runJs(`
            (function() {
              var el = document.querySelector('${escapedSelector}');
              if (!el) return { success: false, error: 'Element not found: ${escapedSelector}' };
              el.focus();
              el.value = '${escapedValue}';
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              return {
                success: true,
                tagName: el.tagName.toLowerCase(),
                type: el.type || null,
                name: el.name || null,
                newValue: el.value
              };
            })()
          `);
        } catch (error) {
          return { success: false, error: `Tool failed: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    scroll_to_element: tool({
      description: "Scroll the page to bring an element into view by CSS selector.",
      inputSchema: z.object({
        selector: z.string().describe("CSS selector for the element to scroll to"),
      }),
      execute: async ({ selector }) => {
        try {
          const tab = getTab(getActiveTab);
          const escaped = escapeForJs(selector);
          return await tab.runJs(`
            (function() {
              var el = document.querySelector('${escaped}');
              if (!el) return { success: false, error: 'Element not found: ${escaped}' };
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              return {
                success: true,
                tagName: el.tagName.toLowerCase(),
                text: (el.textContent || '').trim().substring(0, 100)
              };
            })()
          `);
        } catch (error) {
          return { success: false, error: `Tool failed: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    scroll_page: tool({
      description: "Scroll the page up or down by a specified amount, or to the top/bottom.",
      inputSchema: z.object({
        direction: z.enum(["up", "down", "top", "bottom"]).describe("Direction to scroll"),
        amount: z.number().nullable().describe("Pixels to scroll (default 500). Ignored for top/bottom."),
      }),
      execute: async ({ direction, amount }) => {
        try {
          const tab = getTab(getActiveTab);
          const px = amount || 500;
          const script = direction === "top"
            ? "window.scrollTo(0, 0); ({scrollY: window.scrollY, scrollHeight: document.body.scrollHeight})"
            : direction === "bottom"
            ? "window.scrollTo(0, document.body.scrollHeight); ({scrollY: window.scrollY, scrollHeight: document.body.scrollHeight})"
            : direction === "down"
            ? `window.scrollBy(0, ${px}); ({scrollY: window.scrollY, scrollHeight: document.body.scrollHeight})`
            : `window.scrollBy(0, -${px}); ({scrollY: window.scrollY, scrollHeight: document.body.scrollHeight})`;
          return await tab.runJs(script);
        } catch (error) {
          return { success: false, error: `Tool failed: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    highlight_elements: tool({
      description:
        "Highlight specific elements on the page with colored borders and numbered badges.",
      inputExamples: [
        { highlights: [{ selector: '#header', color: '#ff0000', label: '1' }, { selector: '.nav', color: '#00ff00', label: '2' }] },
      ],
      inputSchema: z.object({
        highlights: z.array(
          z.object({
            selector: z.string().describe("CSS selector"),
            color: z.string().describe("CSS color for the highlight border"),
            label: z.string().describe("Badge label text"),
          })
        ),
      }),
      execute: async ({ highlights }) => {
        try {
          const tab = getTab(getActiveTab);
          const items: HighlightItem[] = highlights.map((h, i) => ({
            id: `manual-${i}-${Date.now()}`,
            selector: h.selector,
            category: "manual",
            severity: "info",
            label: h.label,
            description: h.label,
            color: h.color,
          }));
          const script = buildAddHighlightsScript(items);
          const result = await tab.runJs(script);
          return {
            success: true,
            added: result?.added ?? highlights.length,
            failed: result?.failed ?? [],
            total: highlights.length,
          };
        } catch (error) {
          return { success: false, error: `Failed to execute highlight_elements: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    highlight_audit_issues: tool({
      description:
        "Automatically detect and highlight real issues on the page with severity-weighted scoring, " +
        "context-aware filtering, and deduplication. " +
        "Runs client-side analysis — highlights scroll with the page and show concise issue labels. " +
        "Categories: contrast failures, missing alt text, excessive padding/margins, empty elements, small click targets, broken images.",
      inputSchema: z.object({
        categories: z.array(z.enum([
          "contrast", "alt-text", "spacing", "empty-elements", "click-targets", "errors", "all"
        ])).default(["all"]).describe("Which issue categories to scan for"),
        strictness: z.enum(["strict", "standard", "lenient"]).nullable().describe("Strictness level: strict (minScore 10), standard (minScore 25, default), lenient (minScore 50)"),
        maxIssues: z.number().nullable().describe("Maximum number of issues to highlight (default 30)"),
      }),
      execute: async ({ categories, strictness, maxIssues }) => {
        try {
          const tab = getTab(getActiveTab);
          const cats = categories.includes("all")
            ? ["contrast", "alt-text", "spacing", "empty-elements", "click-targets", "errors"]
            : categories;
          const catsJson = JSON.stringify(cats);
          const resolvedStrictness = strictness || "standard";
          const resolvedMaxIssues = maxIssues || 30;

          // First ensure the overlay controller is initialized
          await tab.runJs(buildControllerScript());

          // Run detection script
          const result = await tab.runJs(`
            (function() {
              var cats = ${catsJson};
              var strictness = '${escapeForJs(resolvedStrictness)}';
              var MAX_ISSUES = ${resolvedMaxIssues};
              var minScore = strictness === 'strict' ? 10 : strictness === 'lenient' ? 50 : 25;

              var issues = [];
              var totalDetected = 0;
              var duplicatesSuppressed = 0;
              var idx = 0;

              var COLORS = {
                contrast: '#ef4444',
                'alt-text': '#f97316',
                spacing: '#eab308',
                'empty-elements': '#a855f7',
                'click-targets': '#06b6d4',
                errors: '#dc2626'
              };

              var SEVERITY_MAP = {
                100: 'critical',
                75: 'high',
                50: 'medium',
                25: 'low'
              };

              function getSeverity(score) {
                if (score >= 90) return 'critical';
                if (score >= 65) return 'high';
                if (score >= 40) return 'medium';
                return 'low';
              }

              ${JS_BUILD_SELECTOR}
              ${JS_LUMINANCE}
              ${JS_PARSE_COLOR}
              ${JS_GET_EFF_BG}

              // Context-aware skip check
              function shouldSkip(el) {
                var st = getComputedStyle(el);
                if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return true;
                if (el.getAttribute('aria-hidden') === 'true') return true;
                var role = el.getAttribute('role');
                if (role === 'presentation' || role === 'none') return true;
                if (st.backgroundImage && st.backgroundImage !== 'none' && !el.textContent.trim()) return true;
                var cls = (el.className && typeof el.className === 'string' ? el.className : '').toLowerCase();
                if (/spacer|divider|separator/.test(cls)) return true;
                var rect = el.getBoundingClientRect();
                if (rect.bottom < 0 || rect.top > window.innerHeight * 3) return true;
                return false;
              }

              // Deduplication
              var dedupMap = {};
              function getDedupKey(el, category) {
                if (category === 'contrast') {
                  var st = getComputedStyle(el);
                  var bg = getEffBg(el);
                  return 'contrast:' + st.color + ':' + bg.r + ',' + bg.g + ',' + bg.b;
                }
                if (category === 'click-targets' || category === 'empty-elements') {
                  var tag = el.tagName.toLowerCase();
                  var cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\\s+/).slice(0,2).join('.') : '';
                  return category + ':' + tag + '.' + cls;
                }
                return category + ':' + buildSelector(el);
              }

              function canAddDedup(el, category) {
                var key = getDedupKey(el, category);
                if (!dedupMap[key]) dedupMap[key] = 0;
                dedupMap[key]++;
                totalDetected++;
                if (dedupMap[key] > 3) {
                  duplicatesSuppressed++;
                  return false;
                }
                return true;
              }

              function addIssue(el, label, description, category, score) {
                if (score < minScore) return;
                if (issues.length >= MAX_ISSUES) return;
                if (!canAddDedup(el, category)) return;
                idx++;
                var severity = getSeverity(score);
                var color = COLORS[category] || '#ef4444';
                issues.push({
                  id: category + '-' + idx + '-' + Date.now(),
                  selector: buildSelector(el),
                  category: category,
                  severity: severity,
                  label: label,
                  description: description,
                  color: color,
                  score: score,
                  text: (el.textContent || '').trim().substring(0, 60)
                });
              }

              // --- Contrast check ---
              if (cats.indexOf('contrast') > -1) {
                var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
                var checked = new Set();
                var n;
                while ((n = walker.nextNode()) && issues.length < MAX_ISSUES) {
                  var el = n.parentElement;
                  if (!el || checked.has(el) || !n.textContent.trim()) continue;
                  checked.add(el);
                  if (shouldSkip(el)) continue;
                  var fg = parseColor(getComputedStyle(el).color);
                  if (!fg) continue;
                  var bg = getEffBg(el);
                  var fgL = luminance(fg.r, fg.g, fg.b);
                  var bgL = luminance(bg.r, bg.g, bg.b);
                  var ratio = (Math.max(fgL, bgL) + 0.05) / (Math.min(fgL, bgL) + 0.05);
                  var fs = parseFloat(getComputedStyle(el).fontSize);
                  var required = (fs >= 24 || (fs >= 18.66 && (parseInt(getComputedStyle(el).fontWeight) || 400) >= 700)) ? 3 : 4.5;
                  if (ratio >= required) continue;
                  var score;
                  if (ratio < 2) score = 100;
                  else if (ratio < 3) score = 75;
                  else if (ratio < required * 0.8) score = 50;
                  else score = 25;
                  addIssue(el, 'Contrast ' + ratio.toFixed(1) + ':1 (need ' + required + ':1)', 'Text contrast ratio is ' + ratio.toFixed(2) + ':1, requires ' + required + ':1', 'contrast', score);
                }
              }

              // --- Missing alt text ---
              if (cats.indexOf('alt-text') > -1) {
                document.querySelectorAll('img').forEach(function(img) {
                  if (issues.length >= MAX_ISSUES) return;
                  if (shouldSkip(img)) return;
                  if (!img.hasAttribute('alt')) {
                    addIssue(img, 'Missing alt text', 'Image has no alt attribute', 'alt-text', 75);
                  } else if (img.alt.trim() === '') {
                    addIssue(img, 'Empty alt text', 'Image has empty alt attribute', 'alt-text', 50);
                  }
                });
              }

              // --- Excessive spacing ---
              if (cats.indexOf('spacing') > -1) {
                document.querySelectorAll('div, section, article, main, aside, header, footer').forEach(function(el) {
                  if (issues.length >= MAX_ISSUES) return;
                  if (shouldSkip(el)) return;
                  var st = getComputedStyle(el);
                  var pt = parseFloat(st.paddingTop), pb = parseFloat(st.paddingBottom);
                  var pl = parseFloat(st.paddingLeft), pr = parseFloat(st.paddingRight);
                  var mt = parseFloat(st.marginTop), mb = parseFloat(st.marginBottom);
                  var maxPad = Math.max(pt, pb, pl, pr);
                  var maxMar = Math.max(mt, mb);
                  var maxValue = Math.max(maxPad, maxMar);
                  if (maxPad > 80) {
                    var score = Math.min(100, Math.round(maxPad / 2));
                    addIssue(el, 'Padding ' + maxPad.toFixed(0) + 'px', 'Excessive padding of ' + maxPad.toFixed(0) + 'px detected', 'spacing', score);
                  } else if (maxMar > 80) {
                    var score = Math.min(100, Math.round(maxMar / 2));
                    addIssue(el, 'Margin ' + maxMar.toFixed(0) + 'px', 'Excessive margin of ' + maxMar.toFixed(0) + 'px detected', 'spacing', score);
                  }
                });
              }

              // --- Empty visible elements ---
              if (cats.indexOf('empty-elements') > -1) {
                document.querySelectorAll('div, p, span, section, li').forEach(function(el) {
                  if (issues.length >= MAX_ISSUES) return;
                  if (shouldSkip(el)) return;
                  var rect = el.getBoundingClientRect();
                  if (rect.height > 20 && rect.width > 20 && !el.textContent.trim() && !el.querySelector('img, video, canvas, svg, iframe, input, button')) {
                    var area = rect.width * rect.height;
                    var score = Math.min(100, Math.round(area / 500));
                    addIssue(el, 'Empty (' + Math.round(rect.width) + 'x' + Math.round(rect.height) + 'px)', 'Empty visible element taking ' + Math.round(area) + 'px\u00B2 of space', 'empty-elements', score);
                  }
                });
              }

              // --- Small click targets ---
              if (cats.indexOf('click-targets') > -1) {
                document.querySelectorAll('a, button, [role="button"], input[type="submit"], input[type="button"], input[type="checkbox"], input[type="radio"]').forEach(function(el) {
                  if (issues.length >= MAX_ISSUES) return;
                  if (shouldSkip(el)) return;
                  var rect = el.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
                    var minDim = Math.min(rect.width, rect.height);
                    var deficit = 44 - minDim;
                    var score = Math.min(100, Math.round(deficit * 5));
                    addIssue(el, 'Target ' + Math.round(rect.width) + 'x' + Math.round(rect.height) + 'px (min 44x44)', 'Click target is ' + Math.round(rect.width) + 'x' + Math.round(rect.height) + 'px, minimum recommended is 44x44px', 'click-targets', score);
                  }
                });
              }

              // --- Broken images ---
              if (cats.indexOf('errors') > -1) {
                document.querySelectorAll('img').forEach(function(img) {
                  if (issues.length >= MAX_ISSUES) return;
                  if (shouldSkip(img)) return;
                  if (img.complete && img.naturalWidth === 0) {
                    addIssue(img, 'Broken image', 'Image failed to load: ' + (img.src || '').substring(0, 100), 'errors', 75);
                  }
                });
              }

              // Now add highlights via the overlay controller
              var hlResult = { added: 0, failed: [] };
              if (issues.length > 0 && window.__blueberry) {
                var highlightItems = issues.map(function(issue) {
                  return {
                    id: issue.id,
                    selector: issue.selector,
                    category: issue.category,
                    severity: issue.severity,
                    label: issue.label,
                    description: issue.description,
                    color: issue.color
                  };
                });
                hlResult = window.__blueberry.addHighlights(highlightItems) || hlResult;
              }

              return {
                highlighted: hlResult.added,
                totalDetected: totalDetected,
                duplicatesSuppressed: duplicatesSuppressed,
                failedSelectors: hlResult.failed,
                issues: issues.map(function(issue) {
                  return {
                    id: issue.id,
                    category: issue.category,
                    severity: issue.severity,
                    label: issue.label,
                    selector: issue.selector,
                    score: issue.score,
                    text: issue.text
                  };
                })
              };
            })()
          `);
          return result;
        } catch (error) {
          return { success: false, error: `Failed to highlight audit issues: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    clear_highlights: tool({
      description: "Remove all highlight overlays from the page.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const tab = getTab(getActiveTab);
          await tab.runJs(buildClearScript());
          return { success: true };
        } catch (error) {
          return { success: false, error: `Failed to execute clear_highlights: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    filter_highlights: tool({
      description:
        "Show or hide highlights by category. Pass an array of category names to show only those categories. Empty array shows all highlights.",
      inputSchema: z.object({
        categories: z.array(z.string()).describe("Array of category names to show. Empty array = show all."),
      }),
      execute: async ({ categories }) => {
        try {
          const tab = getTab(getActiveTab);
          await tab.runJs(buildFilterScript(categories));
          return { success: true, filtering: categories.length > 0 ? categories : "all" };
        } catch (error) {
          return { success: false, error: `Failed to filter highlights: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    select_highlight: tool({
      description:
        "Scroll to and visually select a specific highlight by its ID. The highlight will flash to draw attention.",
      inputSchema: z.object({
        id: z.string().describe("The highlight ID to scroll to and select"),
      }),
      execute: async ({ id }) => {
        try {
          const tab = getTab(getActiveTab);
          const result = await tab.runJs(buildSelectHighlightScript(id));
          return { success: true, found: result };
        } catch (error) {
          return { success: false, error: `Failed to select highlight: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    take_screenshot: tool({
      description: "Take a screenshot of the current page state. Returns base64 image for visual analysis.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const tab = getTab(getActiveTab);
          const compressed = await tab.screenshotCompressed();
          return {
            type: "image" as const,
            image: compressed,
            note: "Current state of the page.",
          };
        } catch (error) {
          return { success: false, error: `Failed to execute take_screenshot: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    get_scroll_info: tool({
      description: "Get current scroll position and page dimensions. Helps decide if more scrolling is needed.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const tab = getTab(getActiveTab);
          return await tab.runJs(`
            (function() {
              var scrollY = window.scrollY || window.pageYOffset;
              var scrollHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
              var viewportHeight = window.innerHeight;
              var scrollPercent = scrollHeight > viewportHeight ? Math.round((scrollY / (scrollHeight - viewportHeight)) * 100) : 100;
              return {
                scrollY: Math.round(scrollY),
                scrollHeight: scrollHeight,
                viewportHeight: viewportHeight,
                scrollPercent: Math.min(scrollPercent, 100),
                isAtBottom: scrollY + viewportHeight >= scrollHeight - 10
              };
            })()
          `);
        } catch (error) {
          return { success: false, error: `Tool failed: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    scroll_by_viewport: tool({
      description: "Scroll the page by a fraction of the viewport height. Better than fixed-pixel scrolling for capturing full pages.",
      inputSchema: z.object({
        direction: z.enum(["down", "up"]).describe("Direction to scroll"),
        fraction: z.number().nullable().describe("Fraction of viewport to scroll (default 0.8 = 80%)"),
      }),
      execute: async ({ direction, fraction }) => {
        try {
          const tab = getTab(getActiveTab);
          const frac = fraction || 0.8;
          const sign = direction === "down" ? 1 : -1;
          return await tab.runJs(`
            (function() {
              var amount = Math.round(window.innerHeight * ${frac} * ${sign});
              window.scrollBy(0, amount);
              var scrollY = window.scrollY || window.pageYOffset;
              var scrollHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
              var viewportHeight = window.innerHeight;
              var scrollPercent = scrollHeight > viewportHeight ? Math.round((scrollY / (scrollHeight - viewportHeight)) * 100) : 100;
              return {
                scrollY: Math.round(scrollY),
                scrollHeight: scrollHeight,
                viewportHeight: viewportHeight,
                scrollPercent: Math.min(scrollPercent, 100),
                isAtBottom: scrollY + viewportHeight >= scrollHeight - 10
              };
            })()
          `);
        } catch (error) {
          return { success: false, error: `Tool failed: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    wait_for_element: tool({
      description: "Wait for an element to appear on the page. Useful for SPAs and dynamic content. Waits up to the specified timeout.",
      inputSchema: z.object({
        selector: z.string().describe("CSS selector to wait for"),
        timeout: z.number().nullable().describe("Max wait time in milliseconds (default 5000)"),
      }),
      execute: async ({ selector, timeout }) => {
        const tab = getTab(getActiveTab);
        const maxWait = timeout || 5000;
        const escaped = escapeForJs(selector);

        try {
          return await tab.runJs(`
            (function() {
              return new Promise((resolve, reject) => {
                const selector = '${escaped}';
                const timeout = ${maxWait};
                const startTime = Date.now();

                function check() {
                  const el = document.querySelector(selector);
                  if (el) {
                    resolve({ success: true, found: true, waitTime: Date.now() - startTime });
                  } else if (Date.now() - startTime > timeout) {
                    resolve({ success: false, found: false, error: 'Timeout waiting for element' });
                  } else {
                    setTimeout(check, 100);
                  }
                }
                check();
              });
            })()
          `);
        } catch (error) {
          return { success: false, error: `Failed to wait for element: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),
  };
}
