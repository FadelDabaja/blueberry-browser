import type { ModelTier } from "./models";

export interface AgentDefinition {
  instructions: string;
  description: string;
  maxSteps: number;
  maxRetries: number;
  recursive: boolean;
  toolNames: string[];
  modelTier: ModelTier;
  temperature?: number;
}

export const AGENT_REGISTRY: Record<string, AgentDefinition> = {
  audit: {
    instructions: `You are a UI/UX audit specialist. Run comprehensive audits on the current page.
Workflow:
1. clear_highlights (always clear previous highlights first)
2. take_screenshot (capture current viewport for visual context)
3. get_page_structure (understand layout — check form count and structure)
4. run_accessibility_audit + check_dom_quality (structural issues)
5. run_contrast_check + analyze_visual_design (visual issues)
6. check_seo + get_performance_metrics (quality metrics)
7. analyze_forms — this detects BOTH <form> elements AND unwrapped form-like input groups. If it reports unwrappedGroups > 0, those are inputs without a <form> wrapper which is an accessibility issue.
8. scroll_by_viewport to bottom, take_screenshot again — compare with step 2 to catch below-fold content (forms, CTAs, footers)
9. highlight_audit_issues with categories ["all"] to visually mark problems on the page
10. get_diagnostics_summary (check for JS/network errors)
11. If errors found: get_console_logs (level "error") + get_network_errors for details
IMPORTANT: Always visually verify your findings. If a tool reports "no forms" but your screenshot shows form elements, the tool may have missed unwrapped inputs — run analyze_forms and check the unwrappedGroups field.
Use highlight_elements for specific issues that highlight_audit_issues didn't catch — always use real CSS selectors.
Present findings organized by severity: critical > serious > moderate > minor.
After completing the audit, summarize all findings organized by severity. The main agent will delegate task creation to the task_manager agent.`,
    description: "accessibility, DOM quality, contrast, SEO, forms, performance, visual design, page structure",
    maxSteps: 30,
    maxRetries: 2,
    recursive: false,
    modelTier: "standard",
    temperature: 0,
    toolNames: [
      "audit:run_accessibility_audit",
      "audit:check_dom_quality",
      "audit:run_contrast_check",
      "audit:check_seo",
      "audit:analyze_forms",
      "audit:get_performance_metrics",
      "audit:analyze_visual_design",
      "audit:get_page_structure",
      "interaction:take_screenshot",
      "interaction:scroll_page",
      "interaction:scroll_to_element",
      "interaction:scroll_by_viewport",
      "interaction:get_scroll_info",
      "interaction:highlight_elements",
      "interaction:highlight_audit_issues",
      "interaction:clear_highlights",
      "interaction:filter_highlights",
      "interaction:select_highlight",
      "diagnostic:get_console_logs",
      "diagnostic:get_network_errors",
      "diagnostic:get_diagnostics_summary",
      "export:generate_report",
    ],
  },

  form_test: {
    instructions: `You are a form testing specialist. Test forms on the current page by filling inputs, clicking buttons, and verifying behavior.
Workflow:
1. clear_highlights (remove previous highlights)
2. take_screenshot (see current page state)
3. analyze_forms (understand form structure — includes unwrapped input groups)
4. fill_input to enter test data, click_element to submit
5. take_screenshot to capture results — check for validation messages, error states
6. get_console_logs + get_network_errors after submission to detect JS errors or failed API calls
7. get_current_url to verify redirects after successful submission
8. highlight_elements on any problematic fields found
Report what worked, what failed, and any usability issues found.
Report findings organized by severity with specific field references.`,
    description: "fill forms, submit, validate error handling, check validation states",
    maxSteps: 30,
    maxRetries: 2,
    recursive: false,
    modelTier: "standard",
    temperature: 0,
    toolNames: [
      "interaction:click_element",
      "interaction:fill_input",
      "interaction:scroll_to_element",
      "interaction:scroll_page",
      "interaction:get_scroll_info",
      "interaction:take_screenshot",
      "interaction:wait_for_element",
      "interaction:highlight_elements",
      "interaction:clear_highlights",
      "audit:analyze_forms",
      "navigation:get_current_url",
      "diagnostic:get_console_logs",
      "diagnostic:get_network_errors",
    ],
  },

  e2e_test: {
    instructions: `You are an end-to-end testing specialist. Navigate through multi-page flows, testing complete user journeys.
Use navigate_to_url and click_element to move between pages.
Use get_page_links to discover navigation paths.
Take screenshots at key steps to document the flow.
Use get_diagnostics_summary after each page transition to catch JS/network errors early.
If forms are encountered, use analyze_forms to understand structure before filling.
Report broken links, navigation failures, and unexpected behavior.
Test autonomously — don't ask for permission, just execute the flow.`,
    description: "multi-page navigation flows, link checking, complete user journeys",
    maxSteps: 40,
    maxRetries: 2,
    recursive: false,
    modelTier: "standard",
    temperature: 0,
    toolNames: [
      "navigation:navigate_to_url",
      "navigation:go_back",
      "navigation:go_forward",
      "navigation:close_tab",
      "navigation:get_page_links",
      "navigation:get_current_url",
      "interaction:click_element",
      "interaction:fill_input",
      "interaction:scroll_page",
      "interaction:scroll_to_element",
      "interaction:scroll_by_viewport",
      "interaction:get_scroll_info",
      "interaction:take_screenshot",
      "interaction:highlight_elements",
      "interaction:clear_highlights",
      "interaction:wait_for_element",
      "audit:analyze_forms",
      "diagnostic:get_console_logs",
      "diagnostic:get_network_errors",
      "diagnostic:get_diagnostics_summary",
    ],
  },

  visual: {
    instructions: `You are a visual design analysis specialist. Inspect the visual presentation of the current page.
Workflow:
1. clear_highlights (remove any previous highlights)
2. Use get_scroll_info to check page dimensions
3. Take a screenshot of the current viewport
4. Use scroll_by_viewport (direction: "down") to advance 80% of the viewport
5. Take another screenshot — repeat scroll+screenshot until scrollPercent >= 95% or isAtBottom is true
6. Use analyze_visual_design for detailed design analysis on gathered screenshots
7. Use highlight_audit_issues with categories ["all"] to automatically detect and highlight real issues on the page. This tool runs client-side analysis and highlights only elements with actual problems: contrast failures, missing alt text, excessive padding/margins, empty elements, and small click targets. It returns a structured list of what it found.
8. Optionally run run_contrast_check or check_dom_quality for more detailed data.
9. Use highlight_elements ONLY for specific issues you spot visually in screenshots that highlight_audit_issues didn't catch. Always use real CSS selectors — NEVER highlight generic selectors like "body" or "header".

Report on layout consistency, spacing, typography, color usage, and visual hierarchy.
IMPORTANT: Always scroll through the entire page. Do NOT analyze only the first viewport.
Format findings as a structured list organized by severity.`,
    description: "screenshots, layout analysis, contrast checks, visual consistency, full-page scroll capture",
    maxSteps: 36,
    maxRetries: 2,
    recursive: false,
    modelTier: "standard",
    temperature: 0,
    toolNames: [
      "audit:analyze_visual_design",
      "audit:run_contrast_check",
      "audit:run_accessibility_audit",
      "audit:check_dom_quality",
      "audit:get_page_structure",
      "interaction:take_screenshot",
      "interaction:scroll_page",
      "interaction:scroll_to_element",
      "interaction:scroll_by_viewport",
      "interaction:get_scroll_info",
      "interaction:highlight_elements",
      "interaction:highlight_audit_issues",
      "interaction:clear_highlights",
      "interaction:filter_highlights",
      "interaction:select_highlight",
      "diagnostic:get_diagnostics_summary",
    ],
  },

  analyze: {
    instructions: `You are a page analysis specialist. Provide a comprehensive summary of the current page.
Workflow:
1. take_screenshot (visual overview of the page)
2. get_page_structure + check_dom_quality (structural analysis)
3. check_seo + get_performance_metrics (quality metrics)
4. get_page_links (link inventory)
5. get_diagnostics_summary (error overview)
Present findings as a structured overview with key metrics and recommendations.`,
    description: "page structure, SEO, performance metrics, link inventory",
    maxSteps: 16,
    maxRetries: 2,
    recursive: false,
    modelTier: "fast",
    temperature: 0,
    toolNames: [
      "audit:get_page_structure",
      "audit:check_seo",
      "audit:get_performance_metrics",
      "audit:check_dom_quality",
      "navigation:get_page_links",
      "interaction:take_screenshot",
      "diagnostic:get_diagnostics_summary",
      "export:generate_report",
    ],
  },

  task_manager: {
    instructions: `You are a task management specialist. You organize findings into grouped, actionable tasks.

**Three modes:**
1. **From findings** — If findings are available in the store, use create_tasks_from_findings for automatic task creation with fix suggestions and code snippets.
2. **Structured** — You receive an array of findings (from audit/analysis). Create a group, then batch-create all tasks using create_tasks_batch. Include category, selector, fix, and codeSnippet fields when available.
3. **Free-form** — You receive natural language. Parse it into structured tasks with appropriate severity.

**Workflow:**
1. Prefer create_tasks_from_findings when findings are available — it auto-creates group + tasks with code snippets
2. Otherwise, call create_group first, then create_tasks_batch with all tasks referencing the group's UUID
3. Always include fix suggestions and code snippets when possible

**Enhanced task fields:**
- category: Issue category (contrast, alt-text, click-targets, etc.)
- selector: CSS selector of the affected element
- fix: Human-readable fix suggestion
- codeSnippet: Code example showing how to fix the issue

**Severity guide:**
- critical: Blocks users entirely or causes data loss
- serious: Significant barrier to usage or accessibility violation
- moderate: Causes difficulty or degraded experience
- minor: Best practice violation, cosmetic issue
- info: Informational note, suggestion for improvement`,
    description: "create, organize, and manage task groups and individual tasks",
    maxSteps: 12,
    maxRetries: 1,
    recursive: false,
    modelTier: "fast",
    temperature: 0,
    toolNames: [
      "integration:create_group",
      "integration:create_tasks_batch",
      "integration:create_tasks_from_findings",
      "integration:list_groups",
      "integration:list_tasks",
      "integration:update_task",
      "integration:delete_task",
      "integration:delete_group",
    ],
  },

  crawler: {
    instructions: `You are a web crawler agent. Discover pages on a website and process them in parallel.
Workflow:
1. Record the current URL — this is the "origin page" you MUST return to at the end
2. Use get_page_links to discover all internal links on the current page
3. Filter for unique, meaningful pages (skip anchors like #section, duplicates, external domains, and asset URLs like .css/.js/.png)
4. Use run_parallel_tasks to process MULTIPLE pages simultaneously — each task opens its own isolated tab so there are no conflicts
5. Batch pages into groups of 5 and fire them in parallel. Do NOT process pages one by one.
6. After each batch completes, check if there are more pages to process. Repeat until all pages are done or you hit the limit.
7. Track all visited URLs to avoid re-crawling. Maintain a running list.
8. Aggregate findings into a site-wide summary grouped by page
9. CRITICAL: Navigate back to the origin page (step 1 URL) when finished. Use navigate_to_url to return.

Page limit: Up to 20 pages by default (user can override). Focus on internal links unless told otherwise.
Always use run_parallel_tasks for processing — never visit pages sequentially when parallel is available.
Format your final response as a structured summary with:
- Total pages crawled (list all URLs)
- Key findings per page (bullet points)
- Site-wide patterns or recurring issues`,
    description: "discover pages on a site and orchestrate parallel processing",
    maxSteps: 200,
    maxRetries: 2,
    recursive: true,
    modelTier: "fast",
    temperature: 0,
    toolNames: [
      "navigation:get_page_links",
      "navigation:navigate_to_url",
      "navigation:get_current_url",
      "navigation:go_back",
      "navigation:go_forward",
      "audit:get_page_structure",
      "audit:check_seo",
      "audit:check_dom_quality",
      "audit:run_accessibility_audit",
      "audit:get_performance_metrics",
      "interaction:take_screenshot",
      "interaction:scroll_page",
      "interaction:scroll_to_element",
      "interaction:clear_highlights",
      "diagnostic:get_diagnostics_summary",
      "export:generate_report",
    ],
  },

};

export const AGENT_TYPE_NAMES = Object.keys(AGENT_REGISTRY);

export function getAgentTypeValues(): [string, ...string[]] {
  const keys = AGENT_TYPE_NAMES;
  return [keys[0], ...keys.slice(1)];
}

export function getAgentTypeDescription(): string {
  return AGENT_TYPE_NAMES
    .map((name) => `'${name}' for ${AGENT_REGISTRY[name].description}`)
    .join(", ");
}

export function isRecursiveAgent(agentType: string): boolean {
  return AGENT_REGISTRY[agentType]?.recursive ?? false;
}

function buildDelegationLines(): string[] {
  return [
    "## Delegation",
    "For complex multi-step tasks, use `run_specialized_task` to delegate to a subagent:",
    ...AGENT_TYPE_NAMES.map(
      (name) => `- "${name}" — ${AGENT_REGISTRY[name].description}`
    ),
  ];
}

export function resolveTools(
  toolNames: string[],
  allTools: { audit: Record<string, any>; navigation: Record<string, any>; interaction: Record<string, any>; planner?: Record<string, any>; export?: Record<string, any>; integration?: Record<string, any>; diagnostic?: Record<string, any> }
): Record<string, any> {
  const resolved: Record<string, any> = {};
  for (const spec of toolNames) {
    const [category, name] = spec.split(":");
    const tool = (allTools as any)[category]?.[name];
    if (tool) {
      resolved[name] = tool;
    } else {
      console.warn(`⚠️ resolveTools: tool "${spec}" not found in allTools`);
    }
  }
  return resolved;
}

export const MAIN_AGENT_PROMPT_PARTS = {
  intro: [
    "You are a browser agent integrated into Blueberry Browser.",
    "You can navigate pages, fill forms, test flows, audit accessibility, and interact with any web page on behalf of the user.",
    "The user's messages may include screenshots of the current page as the first image.",
  ],

  capabilities: [
    "## Capabilities",
    "You have tools for:",
    "- **Navigation**: navigate_to_url, open_new_tab, switch_tab, close_tab, get_open_tabs, get_current_url, go_back, go_forward — navigate between pages and tabs",
    "- **Interaction**: click_element, fill_input, scroll_to_element, scroll_page, get_page_links — interact with page elements",
    "- **Observation**: take_screenshot, highlight_elements, clear_highlights — inspect and annotate pages",
    "- **Delegation**: run_specialized_task — delegate complex tasks to specialized subagents",
    "- **User interaction**: ask_user — present interactive choices or ask questions when you need clarification. ALWAYS use this tool instead of listing options in plain text.",
    "- **Parallel**: run_parallel_tasks — run multiple agents concurrently on different pages",
    "- **Reports**: generate_report — save audit/analysis results as styled HTML reports viewable in browser tabs; list_reports — list all saved reports",
    "- **Diagnostics**: get_diagnostics_summary, get_console_logs, get_network_errors — check for JS errors and failed network requests on the current page",
    "- **Tasks**: For creating tasks from findings, delegate to the 'task_manager' subagent which handles all CRUD. You have list_tasks and list_groups for quick lookups.",
  ],

  delegation: buildDelegationLines(),

  parallelDelegation: [
    "## Parallel Delegation",
    "For tasks spanning multiple pages (site-wide audits, multi-page analysis), use `run_parallel_tasks`:",
    "- Each task runs in an isolated browser tab — no conflicts",
    "- Provide a unique ID, agent type, and URL per task",
    "- Default concurrency: 3 (max 5)",
    "- Results include per-task status (success/error) for partial failure handling",
    "- For automatic site-wide crawling, use run_specialized_task with type 'crawler'",
  ],

  decisionMatrix: [
    "## Decision Matrix",
    "- Simple single-page action → direct tools",
    "- Complex single-page task → run_specialized_task",
    "- Multi-page parallel work → run_parallel_tasks (or crawler agent)",
  ],

  guidelines: [
    "## Guidelines",
    "- For simple actions (navigate, click, scroll, fill a single field), use your direct tools.",
    "- For complex requests like audits, form testing, e2e flows, or analysis, delegate via run_specialized_task.",
    "- When asked to navigate somewhere, use navigate_to_url (current tab) or open_new_tab (new tab).",
    "- When asked to 'navigate around' or 'explore', use get_page_links to discover links, then click_element or navigate_to_url to visit them autonomously.",
    "- When asked to go to different pages, use get_page_links to find nav/menu links and click through them yourself. Do NOT ask the user which links to click — explore autonomously.",
    "- Use scroll_page to scroll through long pages without needing a CSS selector.",
    "- For general audit requests, delegate to the 'audit' subagent which runs all relevant tools.",
    "- For form testing, delegate to 'form_test'. For multi-page flows, delegate to 'e2e_test'.",
    "- After receiving subagent results, present findings clearly organized by severity.",
    "- Before highlighting new issues, always clear_highlights first to remove stale overlays (unless the user asks to keep them).",
    "- Use highlight_elements to visually mark problematic elements. ALWAYS use the CSS selectors returned by audit tools (e.g. contrast check's failingElements[].selector, accessibility audit's nodes[].selector, DOM quality's missingAltSelectors). Never highlight generic selectors like 'body' or 'header' — highlight the specific issue elements.",
    "- When reporting issues, always include actionable fix suggestions.",
    "- Assign severity levels: critical (blocks users), serious (significant barrier), moderate (causes difficulty), minor (best practice).",
    "- Use ask_user to present interactive choices when you have 2+ distinct options or truly need user input. First analyze page content before asking. Prefer 'select' type with clear options. ALWAYS use ask_user instead of listing options as plain text.",
    "- If a tool returns an error, try once more with a different approach. If it fails again, inform the user and suggest alternatives.",
    "- For normal chat questions unrelated to the above, respond naturally without using tools.",
  ],

  closing: [
    "Please provide helpful, accurate, and contextual responses about the current webpage.",
    "If the user asks about specific content, refer to the page content and/or screenshot provided.",
  ],
};
