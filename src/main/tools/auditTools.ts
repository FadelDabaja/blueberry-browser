import { tool } from "ai";
import { z } from "zod";
import * as fs from "fs";
import type { Tab } from "../core/tab";
import { getTab } from "./helpers";
import { JS_BUILD_SELECTOR, JS_COLOR_HELPERS } from "./clientScripts";

// Cache axe-core source at module level
let axeCoreSource: string | null = null;
function getAxeCoreSource(): string {
  if (!axeCoreSource) {
    axeCoreSource = fs.readFileSync(
      require.resolve("axe-core/axe.min.js"),
      "utf-8"
    );
  }
  return axeCoreSource;
}

export function createAuditTools(getActiveTab: () => Tab | null) {
  return {
    run_accessibility_audit: tool({
      description:
        "Run a full WCAG 2.1 AA accessibility audit on the current page using axe-core. Returns violations grouped by impact level with affected elements.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const tab = getTab(getActiveTab);
          const axeSource = getAxeCoreSource();
          const result = await tab.runJs(`
            (async function() {
              if (!window.axe) {
                ${axeSource}
              }
              const results = await window.axe.run(document, {
                runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }
              });
              return {
                violations: results.violations.map(function(v) {
                  return {
                    id: v.id,
                    impact: v.impact,
                    description: v.description,
                    help: v.help,
                    helpUrl: v.helpUrl,
                    nodes: v.nodes.slice(0, 5).map(function(n) {
                      return {
                        html: n.html.substring(0, 200),
                        target: n.target,
                        selector: Array.isArray(n.target) ? n.target.join(' ') : String(n.target || ''),
                        failureSummary: n.failureSummary
                      };
                    }),
                    nodeCount: v.nodes.length
                  };
                }),
                passes: results.passes.length,
                incomplete: results.incomplete.length,
                inapplicable: results.inapplicable.length,
                totalViolations: results.violations.length
              };
            })()
          `);
          return result;
        } catch (error) {
          return { success: false, error: `Failed to execute run_accessibility_audit: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    analyze_visual_design: tool({
      description:
        "Take a screenshot for visual design analysis. Returns the screenshot as base64 for the LLM to analyze layout, spacing, typography, and visual hierarchy.",
      inputSchema: z.object({
        focus_area: z.string().nullable().describe("Specific area to focus on, e.g. 'header', 'navigation', 'footer'"),
      }),
      execute: async ({ focus_area }) => {
        try {
          const tab = getTab(getActiveTab);
          const compressed = await tab.screenshotCompressed();
          return {
            type: "image" as const,
            image: compressed,
            focus_area: focus_area || "full page",
            note: "Analyze this screenshot for visual design quality: layout, spacing, typography, color usage, visual hierarchy, and consistency.",
          };
        } catch (error) {
          return { success: false, error: `Failed to execute analyze_visual_design: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    check_dom_quality: tool({
      description:
        "Analyze the DOM structure quality: heading hierarchy, nesting depth, element counts, landmark usage, and image alt text coverage.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const tab = getTab(getActiveTab);
          return await tab.runJs(`
            (function() {
              ${JS_BUILD_SELECTOR}
              var getSelector = buildSelector;

              var headings = [];
              document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function(h) {
                headings.push({ level: parseInt(h.tagName[1]), text: h.textContent.trim().substring(0, 80), selector: getSelector(h) });
              });

              var headingIssues = [];
              for (var i = 1; i < headings.length; i++) {
                if (headings[i].level > headings[i-1].level + 1) {
                  headingIssues.push({ issue: 'Skipped heading level: h' + headings[i-1].level + ' to h' + headings[i].level, selector: headings[i].selector });
                }
              }

              function maxDepth(el, depth) {
                var max = depth;
                for (var j = 0; j < el.children.length; j++) {
                  var d = maxDepth(el.children[j], depth + 1);
                  if (d > max) max = d;
                }
                return max;
              }
              var nestingDepth = maxDepth(document.body, 0);

              var landmarks = {
                header: document.querySelectorAll('header, [role="banner"]').length,
                nav: document.querySelectorAll('nav, [role="navigation"]').length,
                main: document.querySelectorAll('main, [role="main"]').length,
                footer: document.querySelectorAll('footer, [role="contentinfo"]').length,
                aside: document.querySelectorAll('aside, [role="complementary"]').length,
                search: document.querySelectorAll('[role="search"]').length
              };

              var images = document.querySelectorAll('img');
              var imagesWithAlt = 0, imagesWithEmptyAlt = 0, imagesMissingAlt = 0;
              var missingAltSelectors = [];
              images.forEach(function(img) {
                if (img.hasAttribute('alt')) {
                  if (img.alt.trim()) imagesWithAlt++;
                  else imagesWithEmptyAlt++;
                } else {
                  imagesMissingAlt++;
                  if (missingAltSelectors.length < 10) missingAltSelectors.push(getSelector(img));
                }
              });

              return {
                headings: headings, headingIssues: headingIssues, nestingDepth: nestingDepth,
                elementCount: document.querySelectorAll('*').length, landmarks: landmarks,
                images: { total: images.length, withAlt: imagesWithAlt, withEmptyAlt: imagesWithEmptyAlt, missingAlt: imagesMissingAlt, missingAltSelectors: missingAltSelectors },
                forms: document.querySelectorAll('form').length,
                links: document.querySelectorAll('a').length,
                buttons: document.querySelectorAll('button, [role="button"], input[type="submit"]').length
              };
            })()
          `);
        } catch (error) {
          return { success: false, error: `Failed to execute check_dom_quality: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    run_contrast_check: tool({
      description:
        "Check color contrast ratios of text elements against WCAG AA standards (4.5:1 for normal text, 3:1 for large text).",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const tab = getTab(getActiveTab);
          return await tab.runJs(`
            (function() {
              ${JS_COLOR_HELPERS}
              var getEffectiveBg = getEffBg;
              var failures = [];
              var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
              var checked = new Set();
              var node;
              while ((node = walker.nextNode()) && failures.length < 20) {
                var el = node.parentElement;
                if (!el || checked.has(el) || !node.textContent.trim()) continue;
                checked.add(el);
                var style = getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
                var fg = parseColor(style.color);
                if (!fg) continue;
                var bg = getEffectiveBg(el);
                var ratio = contrastRatio(luminance(fg.r, fg.g, fg.b), luminance(bg.r, bg.g, bg.b));
                var fontSize = parseFloat(style.fontSize);
                var fontWeight = parseInt(style.fontWeight) || 400;
                var isLargeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
                var required = isLargeText ? 3 : 4.5;
                if (ratio < required) {
                  var selector = '';
                  try {
                    var tag = el.tagName.toLowerCase();
                    if (el.id) {
                      selector = tag + '#' + el.id;
                    } else {
                      var cls = el.className ? '.' + String(el.className).split(' ').filter(Boolean).join('.') : '';
                      var nthIdx = 1;
                      var sib = el;
                      while ((sib = sib.previousElementSibling)) {
                        if (sib.tagName === el.tagName) nthIdx++;
                      }
                      selector = tag + cls + ':nth-of-type(' + nthIdx + ')';
                    }
                  } catch(e) {}
                  failures.push({ text: node.textContent.trim().substring(0, 60), foreground: style.color, background: 'rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ')', ratio: Math.round(ratio * 100) / 100, required: required, isLargeText: isLargeText, selector: selector, element: el.outerHTML.substring(0, 150) });
                }
              }
              return { failingElements: failures, totalChecked: checked.size, failCount: failures.length };
            })()
          `);
        } catch (error) {
          return { success: false, error: `Failed to execute run_contrast_check: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    check_seo: tool({
      description: "Check SEO basics: title, meta description, viewport, Open Graph tags, canonical URL, h1 count, and structured data.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const tab = getTab(getActiveTab);
          return await tab.runJs(`
            (function() {
              function getMeta(name) {
                var el = document.querySelector('meta[name="' + name + '"], meta[property="' + name + '"]');
                return el ? el.getAttribute('content') : null;
              }
              var title = document.title;
              var h1s = document.querySelectorAll('h1');
              return {
                title: { value: title, length: title.length, isGood: title.length >= 30 && title.length <= 60 },
                metaDescription: (function() { var desc = getMeta('description'); return { value: desc, length: desc ? desc.length : 0, isGood: desc && desc.length >= 120 && desc.length <= 160 }; })(),
                viewport: !!document.querySelector('meta[name="viewport"]'),
                canonical: (function() { var el = document.querySelector('link[rel="canonical"]'); return el ? el.getAttribute('href') : null; })(),
                openGraph: { title: getMeta('og:title'), description: getMeta('og:description'), image: getMeta('og:image'), type: getMeta('og:type'), url: getMeta('og:url') },
                twitter: { card: getMeta('twitter:card'), title: getMeta('twitter:title'), description: getMeta('twitter:description') },
                h1Count: h1s.length,
                h1Text: Array.from(h1s).map(function(h) { return h.textContent.trim().substring(0, 100); }),
                structuredData: document.querySelectorAll('script[type="application/ld+json"]').length,
                lang: document.documentElement.getAttribute('lang'),
                robots: getMeta('robots')
              };
            })()
          `);
        } catch (error) {
          return { success: false, error: `Failed to check SEO: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    analyze_forms: tool({
      description: "Analyze all forms on the page — both <form> elements and form-like groups of inputs without a wrapper. Detects labels, input types, autocomplete, required fields, validation, and submit buttons.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const tab = getTab(getActiveTab);
          return await tab.runJs(`
            (function() {
              function analyzeInput(input) {
                var id = input.id; var name = input.name || ''; var type = input.type || input.tagName.toLowerCase();
                var hasLabel = false;
                if (id) hasLabel = !!document.querySelector('label[for="' + id + '"]');
                if (!hasLabel) hasLabel = !!input.closest('label');
                if (!hasLabel) hasLabel = !!input.getAttribute('aria-label') || !!input.getAttribute('aria-labelledby');
                return { type: type, name: name, hasLabel: hasLabel, hasAutocomplete: input.hasAttribute('autocomplete'), autocomplete: input.getAttribute('autocomplete'), required: input.required || input.hasAttribute('aria-required'), placeholder: input.placeholder || null, selector: input.tagName.toLowerCase() + (input.id ? '#' + input.id : '') + (input.name ? '[name="' + input.name + '"]' : '') };
              }
              function findIssues(inputDetails) {
                var issues = [];
                inputDetails.forEach(function(inp) {
                  if (!inp.hasLabel) issues.push('Input "' + (inp.name || inp.type) + '" missing label');
                  if (['text','email','tel','url','password','search'].indexOf(inp.type) > -1 && !inp.hasAutocomplete) issues.push('Input "' + (inp.name || inp.type) + '" missing autocomplete');
                });
                return issues;
              }

              // 1. Analyze actual <form> elements
              var forms = document.querySelectorAll('form');
              var results = [];
              forms.forEach(function(form, fi) {
                var inputs = form.querySelectorAll('input, select, textarea');
                var inputDetails = [];
                inputs.forEach(function(input) { inputDetails.push(analyzeInput(input)); });
                results.push({ index: fi, isWrapped: true, action: form.action || null, method: form.method || 'get', inputCount: inputs.length, inputs: inputDetails, hasSubmitButton: !!form.querySelector('button[type="submit"], input[type="submit"], button:not([type])'), issues: findIssues(inputDetails) });
              });

              // 2. Detect form-like groups: standalone inputs not inside a <form>
              var standaloneInputs = document.querySelectorAll('input:not(form input), select:not(form select), textarea:not(form textarea)');
              var standaloneVisible = [];
              standaloneInputs.forEach(function(input) {
                if (input.type === 'hidden') return;
                var rect = input.getBoundingClientRect();
                if (rect.width === 0 && rect.height === 0) return;
                var style = window.getComputedStyle(input);
                if (style.display === 'none' || style.visibility === 'hidden') return;
                standaloneVisible.push(input);
              });

              // Group standalone inputs by their nearest common container
              if (standaloneVisible.length > 0) {
                var groups = new Map();
                standaloneVisible.forEach(function(input) {
                  // Walk up to find a reasonable container (section, div with multiple inputs, etc.)
                  var container = input.parentElement;
                  var depth = 0;
                  while (container && container !== document.body && depth < 5) {
                    var siblingInputs = container.querySelectorAll('input:not([type="hidden"]), select, textarea');
                    if (siblingInputs.length >= 2) break;
                    container = container.parentElement;
                    depth++;
                  }
                  if (!container || container === document.body) container = input.parentElement;
                  if (!groups.has(container)) groups.set(container, []);
                  groups.get(container).push(input);
                });
                var groupIndex = 0;
                groups.forEach(function(inputs, container) {
                  if (inputs.length < 1) return;
                  var inputDetails = [];
                  inputs.forEach(function(input) { inputDetails.push(analyzeInput(input)); });
                  // Check for nearby submit-like buttons
                  var hasSubmitButton = !!container.querySelector('button[type="submit"], input[type="submit"], button:not([type]), [role="button"]');
                  var issues = findIssues(inputDetails);
                  issues.unshift('Form-like group has no <form> wrapper element (hurts accessibility and prevents native validation)');
                  results.push({ index: forms.length + groupIndex, isWrapped: false, action: null, method: null, inputCount: inputs.length, inputs: inputDetails, hasSubmitButton: hasSubmitButton, containerSelector: container.tagName.toLowerCase() + (container.id ? '#' + container.id : '') + (container.className ? '.' + String(container.className).trim().split(/\\s+/).slice(0,2).join('.') : ''), issues: issues });
                  groupIndex++;
                });
              }

              return { formCount: results.length, wrappedForms: forms.length, unwrappedGroups: results.length - forms.length, forms: results, standaloneInputs: standaloneVisible.length };
            })()
          `);
        } catch (error) {
          return { success: false, error: `Failed to analyze forms: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    get_performance_metrics: tool({
      description: "Get page performance metrics: navigation timing, DOM size, resource counts, and web vitals.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const tab = getTab(getActiveTab);
          return await tab.runJs(`
            (function() {
              var nav = performance.getEntriesByType('navigation')[0] || {};
              var paint = {};
              performance.getEntriesByType('paint').forEach(function(e) { paint[e.name] = Math.round(e.startTime); });
              var resources = performance.getEntriesByType('resource');
              var resourceTypes = {};
              resources.forEach(function(r) { var type = r.initiatorType || 'other'; resourceTypes[type] = (resourceTypes[type] || 0) + 1; });
              var lcp = null;
              try { var lcpEntries = performance.getEntriesByType('largest-contentful-paint'); if (lcpEntries.length) lcp = Math.round(lcpEntries[lcpEntries.length - 1].startTime); } catch(e) {}
              return {
                timing: { domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime) || null, load: Math.round(nav.loadEventEnd - nav.startTime) || null, ttfb: Math.round(nav.responseStart - nav.startTime) || null, domInteractive: Math.round(nav.domInteractive - nav.startTime) || null },
                paint: paint, lcp: lcp,
                dom: { elementCount: document.querySelectorAll('*').length, maxDepth: (function() { var max = 0; function walk(el, d) { if (d > max) max = d; for (var i = 0; i < el.children.length; i++) walk(el.children[i], d+1); } walk(document.body, 0); return max; })() },
                resources: { total: resources.length, totalSize: Math.round(resources.reduce(function(sum, r) { return sum + (r.transferSize || 0); }, 0) / 1024), byType: resourceTypes }
              };
            })()
          `);
        } catch (error) {
          return { success: false, error: `Failed to get performance metrics: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),

    get_page_structure: tool({
      description: "Get the structural overview of the page: headings, landmarks, form count, link count, image count.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const tab = getTab(getActiveTab);
          return await tab.runJs(`
            (function() {
              var headings = [];
              document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function(h) { headings.push({ level: parseInt(h.tagName[1]), text: h.textContent.trim().substring(0, 80) }); });
              var landmarks = [];
              document.querySelectorAll('header,nav,main,footer,aside,[role="banner"],[role="navigation"],[role="main"],[role="contentinfo"],[role="complementary"],[role="search"]').forEach(function(el) {
                landmarks.push({ role: el.getAttribute('role') || el.tagName.toLowerCase(), label: el.getAttribute('aria-label') || '' });
              });
              return {
                headings: headings, landmarks: landmarks,
                formCount: document.querySelectorAll('form').length,
                linkCount: document.querySelectorAll('a[href]').length,
                imageCount: document.querySelectorAll('img').length,
                buttonCount: document.querySelectorAll('button, [role="button"]').length,
                iframeCount: document.querySelectorAll('iframe').length,
                tableCount: document.querySelectorAll('table').length
              };
            })()
          `);
        } catch (error) {
          return { success: false, error: `Failed to get page structure: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    }),
  };
}
