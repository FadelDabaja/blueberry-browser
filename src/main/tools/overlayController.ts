import { escapeForJs } from "./helpers";

export interface HighlightItem {
  id: string;
  selector: string;
  category: string;
  severity: string;
  label: string;
  description: string;
  fix?: string;
  color: string;
}

/**
 * Returns JS that initializes the `window.__blueberry` overlay controller on the page.
 * Uses absolute positioning (scrolls with page), MutationObserver for DOM changes,
 * resize listener, click-to-inspect with tooltips, and filtering/scrollTo APIs.
 */
export function buildControllerScript(): string {
  return `(function() {
  if (window.__blueberry) return;

  var container = document.createElement('div');
  container.id = '__blueberry_overlay_container__';
  container.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483646;';
  document.body.appendChild(container);

  var highlights = [];
  var MAX_HIGHLIGHTS = 100;
  var observer = null;
  var debounceTimers = {};
  var activeTooltip = null;
  var addLock = false;

  function debounce(fn, ms, key) {
    return function() {
      if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
      debounceTimers[key] = setTimeout(fn, ms);
    };
  }

  function sanitizeSelector(sel) {
    if (sel.startsWith('[') && sel.endsWith(']')) {
      try {
        var parsed = JSON.parse(sel);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed[parsed.length - 1];
        }
      } catch(e) {}
    }
    return sel.trim();
  }

  function updatePositions() {
    for (var i = 0; i < highlights.length; i++) {
      var h = highlights[i];
      if (!h.target || !h.overlay) continue;
      var rect = h.target.getBoundingClientRect();
      h.overlay.style.left = (rect.left + window.scrollX) + 'px';
      h.overlay.style.top = (rect.top + window.scrollY) + 'px';
      h.overlay.style.width = rect.width + 'px';
      h.overlay.style.height = rect.height + 'px';
    }
  }

  var debouncedUpdateMutation = debounce(updatePositions, 200, 'mutation');
  var debouncedUpdateResize = debounce(updatePositions, 100, 'resize');
  var debouncedUpdateScroll = debounce(updatePositions, 80, 'scroll');

  function startObserving() {
    if (observer) return;
    observer = new MutationObserver(debouncedUpdateMutation);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    window.addEventListener('resize', debouncedUpdateResize);
    window.addEventListener('scroll', debouncedUpdateScroll, true);
  }

  function stopObserving() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    window.removeEventListener('resize', debouncedUpdateResize);
    window.removeEventListener('scroll', debouncedUpdateScroll, true);
    for (var key in debounceTimers) {
      clearTimeout(debounceTimers[key]);
    }
    debounceTimers = {};
  }

  function createTooltip(item) {
    var tooltip = document.createElement('div');
    tooltip.className = '__bb_tooltip__';
    tooltip.style.cssText =
      'position:absolute;bottom:calc(100% + 6px);left:0;' +
      'background:#1e1e2e;color:#cdd6f4;' +
      'font:12px/1.4 system-ui,sans-serif;' +
      'padding:8px 12px;border-radius:6px;' +
      'box-shadow:0 4px 12px rgba(0,0,0,0.4);' +
      'max-width:320px;min-width:160px;' +
      'pointer-events:none;z-index:2147483647;' +
      'opacity:0;transition:opacity 0.15s;' +
      'white-space:normal;word-wrap:break-word;';

    var sevColors = {
      critical: '#f38ba8', high: '#fab387',
      medium: '#f9e2af', low: '#a6e3a1', info: '#89b4fa'
    };
    var sevColor = sevColors[item.severity] || sevColors.info;

    var badge = document.createElement('span');
    badge.textContent = item.severity;
    badge.style.cssText =
      'display:inline-block;background:' + sevColor + ';color:#1e1e2e;' +
      'font-size:10px;font-weight:700;padding:1px 6px;border-radius:3px;' +
      'margin-right:6px;text-transform:uppercase;vertical-align:middle;';
    tooltip.appendChild(badge);

    var catSpan = document.createElement('span');
    catSpan.textContent = item.category;
    catSpan.style.cssText = 'font-size:10px;opacity:0.7;vertical-align:middle;';
    tooltip.appendChild(catSpan);

    var desc = document.createElement('div');
    desc.textContent = item.description;
    desc.style.cssText = 'margin-top:4px;font-size:12px;line-height:1.4;';
    tooltip.appendChild(desc);

    if (item.fix) {
      var fixDiv = document.createElement('div');
      fixDiv.style.cssText = 'margin-top:4px;padding-top:4px;border-top:1px solid #45475a;font-size:11px;color:#a6e3a1;';
      fixDiv.textContent = 'Fix: ' + item.fix;
      tooltip.appendChild(fixDiv);
    }

    return tooltip;
  }

  function addHighlights(items) {
    if (!items || !items.length) return { added: 0, failed: [] };
    if (addLock) return { added: 0, failed: [{ selector: '*', reason: 'concurrent call blocked' }] };
    addLock = true;

    var remaining = MAX_HIGHLIGHTS - highlights.length;
    var toAdd = items.slice(0, Math.max(0, remaining));
    var added = 0;
    var failed = [];

    for (var i = 0; i < toAdd.length; i++) {
      var item = toAdd[i];
      var sel = sanitizeSelector(item.selector);
      var target;
      try {
        target = document.querySelector(sel);
      } catch(e) {
        console.warn('[Blueberry] Invalid selector:', sel, e);
        failed.push({ selector: sel, reason: 'invalid selector' });
        continue;
      }
      if (!target) {
        failed.push({ selector: sel, reason: 'element not found' });
        continue;
      }

      added++;
      var rect = target.getBoundingClientRect();
      var overlay = document.createElement('div');
      overlay.className = '__bb_highlight__';
      overlay.setAttribute('data-bb-id', item.id);
      overlay.setAttribute('data-bb-category', item.category);
      overlay.style.cssText =
        'position:absolute;box-sizing:border-box;' +
        'border:2px solid ' + item.color + ';' +
        'background:' + item.color + '18;' +
        'left:' + (rect.left + window.scrollX) + 'px;' +
        'top:' + (rect.top + window.scrollY) + 'px;' +
        'width:' + rect.width + 'px;' +
        'height:' + rect.height + 'px;' +
        'pointer-events:auto;cursor:pointer;';

      var badge = document.createElement('span');
      badge.className = '__bb_badge__';
      badge.textContent = item.label;
      badge.title = item.label;
      badge.style.cssText =
        'position:absolute;top:-12px;left:0;' +
        'background:' + item.color + ';color:#fff;' +
        'font:bold 10px/1.2 system-ui,sans-serif;' +
        'padding:1px 6px;border-radius:3px;' +
        'white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis;' +
        'pointer-events:none;';
      overlay.appendChild(badge);

      var tooltip = createTooltip(item);
      overlay.appendChild(tooltip);

      // Click handler: emit event for IPC + toggle tooltip
      (function(ov, tt, it) {
        ov.addEventListener('click', function(e) {
          e.stopPropagation();
          e.preventDefault();
          console.log('__BB_HIGHLIGHT_CLICK__' + JSON.stringify({
            id: it.id,
            category: it.category,
            severity: it.severity,
            label: it.label,
            description: it.description,
            fix: it.fix || ''
          }));
          // Toggle tooltip visibility
          var isVisible = tt.style.opacity !== '0' && tt.style.display !== 'none';
          // Hide all other tooltips first
          if (activeTooltip && activeTooltip !== tt) {
            activeTooltip.style.opacity = '0';
            activeTooltip.style.pointerEvents = 'none';
          }
          if (!isVisible) {
            tt.style.display = 'block';
            tt.style.opacity = '1';
            tt.style.pointerEvents = 'auto';
            activeTooltip = tt;
            // Reposition if tooltip goes above viewport
            var ttRect = tt.getBoundingClientRect();
            if (ttRect.top < 0) {
              tt.style.bottom = 'auto';
              tt.style.top = 'calc(100% + 6px)';
            }
            // Reposition if tooltip goes beyond right edge
            if (ttRect.right > window.innerWidth) {
              tt.style.left = 'auto';
              tt.style.right = '0';
            }
            // Reposition if tooltip goes beyond left edge
            if (ttRect.left < 0) {
              tt.style.left = '0';
              tt.style.right = 'auto';
            }
          } else {
            tt.style.opacity = '0';
            tt.style.pointerEvents = 'none';
            activeTooltip = null;
          }
        });
      })(overlay, tooltip, item);

      container.appendChild(overlay);
      highlights.push({
        id: item.id,
        category: item.category,
        target: target,
        overlay: overlay,
        visible: true
      });
    }

    startObserving();
    addLock = false;
    return { added: added, failed: failed };
  }

  function clearAll() {
    stopObserving();
    for (var i = 0; i < highlights.length; i++) {
      if (highlights[i].overlay && highlights[i].overlay.parentNode) {
        highlights[i].overlay.parentNode.removeChild(highlights[i].overlay);
      }
    }
    highlights = [];
  }

  function filterByCategory(categories) {
    var showAll = !categories || categories.length === 0;
    for (var i = 0; i < highlights.length; i++) {
      var h = highlights[i];
      var show = showAll || categories.indexOf(h.category) > -1;
      h.overlay.style.display = show ? '' : 'none';
      h.visible = show;
    }
  }

  function scrollToHighlight(id) {
    for (var i = 0; i < highlights.length; i++) {
      var h = highlights[i];
      if (h.id === id && h.target) {
        h.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Flash animation: pulse border
        var overlay = h.overlay;
        var origBorder = overlay.style.border;
        var origBoxShadow = overlay.style.boxShadow;
        var count = 0;
        var flashInterval = setInterval(function() {
          count++;
          if (count % 2 === 1) {
            overlay.style.boxShadow = '0 0 0 4px rgba(255,255,255,0.8), 0 0 12px 4px rgba(100,149,237,0.6)';
            overlay.style.border = '3px solid #fff';
          } else {
            overlay.style.boxShadow = origBoxShadow || 'none';
            overlay.style.border = origBorder;
          }
          if (count >= 6) {
            clearInterval(flashInterval);
            overlay.style.boxShadow = origBoxShadow || 'none';
            overlay.style.border = origBorder;
          }
        }, 250);
        return true;
      }
    }
    return false;
  }

  function getHighlightCount() {
    return highlights.length;
  }

  // Close tooltips on click outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest || !e.target.closest('.__bb_highlight__')) {
      if (activeTooltip) {
        activeTooltip.style.opacity = '0';
        activeTooltip.style.pointerEvents = 'none';
        activeTooltip = null;
      }
    }
  });

  // Close tooltips on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && activeTooltip) {
      activeTooltip.style.opacity = '0';
      activeTooltip.style.pointerEvents = 'none';
      activeTooltip = null;
    }
  });

  window.__blueberry = {
    addHighlights: addHighlights,
    clearAll: clearAll,
    filterByCategory: filterByCategory,
    scrollToHighlight: scrollToHighlight,
    getHighlightCount: getHighlightCount
  };
})();`;
}

/**
 * Returns JS that ensures the controller is initialized, then adds highlights.
 * All string fields are escaped for safe injection.
 */
export function buildAddHighlightsScript(items: HighlightItem[]): string {
  const escaped = items.map((item) => ({
    id: escapeForJs(item.id),
    selector: escapeForJs(item.selector),
    category: escapeForJs(item.category),
    severity: escapeForJs(item.severity),
    label: escapeForJs(item.label),
    description: escapeForJs(item.description),
    fix: item.fix ? escapeForJs(item.fix) : undefined,
    color: escapeForJs(item.color),
  }));

  const initScript = buildControllerScript();
  const itemsJson = JSON.stringify(escaped);

  return `(function() {
  if (!window.__blueberry) {
    ${initScript}
  }
  return window.__blueberry.addHighlights(${itemsJson});
})();`;
}

/**
 * Returns JS that clears all highlights and removes the container as fallback.
 */
export function buildClearScript(): string {
  return `(function() {
  if (window.__blueberry) {
    window.__blueberry.clearAll();
  }
  // Fallback: remove container and cleanup legacy overlay
  var c = document.getElementById('__blueberry_overlay_container__');
  if (c && c.parentNode) c.parentNode.removeChild(c);
  // Also clean up legacy overlayInjector artifacts
  if (window.__blueberry_audit_cleanup) {
    window.__blueberry_audit_cleanup();
  }
  var old = document.getElementById('__blueberry_audit_overlay__');
  if (old && old.parentNode) old.parentNode.removeChild(old);
  // Remove audit container from highlight_audit_issues
  var ac = document.getElementById('bb-audit-container');
  if (ac && ac.parentNode) ac.parentNode.removeChild(ac);
  // Remove any data-attribute highlights
  document.querySelectorAll('[data-bb-audit-highlight]').forEach(function(el) { el.remove(); });
  // Reset controller reference
  delete window.__blueberry;
})();`;
}

/**
 * Returns JS that filters visible highlights by category.
 * Empty array = show all.
 */
export function buildFilterScript(categories: string[]): string {
  const escaped = categories.map(escapeForJs);
  return `(function() {
  if (window.__blueberry) {
    window.__blueberry.filterByCategory(${JSON.stringify(escaped)});
  }
})();`;
}

/**
 * Returns JS that scrolls to a highlight by id and flashes it.
 */
export function buildSelectHighlightScript(id: string): string {
  const escaped = escapeForJs(id);
  return `(function() {
  if (window.__blueberry) {
    window.__blueberry.scrollToHighlight('${escaped}');
  }
})();`;
}

// --- Backward compatibility exports ---

/**
 * Legacy wrapper: converts old {selector, color, label}[] format to HighlightItem[]
 * and delegates to buildAddHighlightsScript.
 */
export function buildHighlightScript(
  elements: { selector: string; color: string; label: string; id?: string }[]
): string {
  const items: HighlightItem[] = elements.map((el, i) => ({
    id: el.id || `manual-${i}-${Date.now()}`,
    selector: el.selector,
    category: "manual",
    severity: "info",
    label: el.label,
    description: el.label,
    color: el.color,
  }));
  return buildAddHighlightsScript(items);
}

/**
 * Legacy constant: clears all highlights (same as buildClearScript() output).
 */
export const CLEAR_HIGHLIGHTS_SCRIPT: string = buildClearScript();
