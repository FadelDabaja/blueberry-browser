/**
 * Shared inline JS helper functions for browser-injected scripts.
 *
 * These are JS **string constants** (not TS functions) that get interpolated
 * into `tab.runJs()` template literals. They run in the page context.
 */

/** sRGB relative luminance (WCAG 2.x formula) */
export const JS_LUMINANCE = `function luminance(r, g, b) {
  var a = [r, g, b].map(function(v) {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}`;

/** Parse an rgb/rgba CSS color string into {r, g, b} or null */
export const JS_PARSE_COLOR = `function parseColor(color) {
  var m = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
  if (m) return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
  return null;
}`;

/** Walk up the DOM to find the effective (non-transparent) background color */
export const JS_GET_EFF_BG = `function getEffBg(el) {
  var cur = el;
  while (cur) {
    var bg = getComputedStyle(cur).backgroundColor;
    var p = parseColor(bg);
    if (p && !(p.r === 0 && p.g === 0 && p.b === 0 && bg.includes('0)'))) return p;
    cur = cur.parentElement;
  }
  return { r: 255, g: 255, b: 255 };
}`;

/** WCAG contrast ratio between two luminance values */
export const JS_CONTRAST_RATIO = `function contrastRatio(l1, l2) {
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}`;

/** Build a reasonably unique CSS selector for an element (with nth-of-type) */
export const JS_BUILD_SELECTOR = `function buildSelector(el) {
  var tag = el.tagName.toLowerCase();
  if (el.id) return tag + '#' + el.id;
  var cls = el.className && typeof el.className === 'string'
    ? '.' + el.className.trim().split(/\\s+/).filter(Boolean).slice(0, 2).join('.')
    : '';
  var nthIdx = 1;
  var sib = el;
  while ((sib = sib.previousElementSibling)) { if (sib.tagName === el.tagName) nthIdx++; }
  return tag + cls + ':nth-of-type(' + nthIdx + ')';
}`;

/** All contrast/color helpers bundled together (for scripts that need all of them) */
export const JS_COLOR_HELPERS = [JS_LUMINANCE, JS_PARSE_COLOR, JS_GET_EFF_BG, JS_CONTRAST_RATIO].join('\n');
