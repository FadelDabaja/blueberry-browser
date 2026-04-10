export interface AuditIssue {
  severity: "critical" | "serious" | "moderate" | "minor";
  title: string;
  description: string;
  helpUrl?: string;
  elements: { html: string; selector: string }[];
  suggestedFix?: string;
}

export interface AuditCategory {
  name: string;
  score: number;
  issues: AuditIssue[];
}

export interface AuditReport {
  messageId: string;
  overallScore: number;
  categories: AuditCategory[];
  timestamp: number;
}

type ToolResult = { toolName: string; result: any };

export function buildAuditReport(
  toolResults: ToolResult[],
  messageId: string
): AuditReport | null {
  const categories: AuditCategory[] = [];

  for (const { toolName, result } of toolResults) {
    if (toolName === "run_accessibility_audit" && result?.violations) {
      const issues: AuditIssue[] = result.violations.map((v: any) => ({
        severity: v.impact || "moderate",
        title: v.help || v.id,
        description: v.description,
        helpUrl: v.helpUrl,
        elements: (v.nodes || []).map((n: any) => ({
          html: n.html || "",
          selector: Array.isArray(n.target) ? String(n.target[n.target.length - 1] || "") : String(n.target || ""),
        })),
        suggestedFix: v.nodes?.[0]?.failureSummary || undefined,
      }));

      const totalViolations = result.totalViolations || issues.length;
      const passes = result.passes || 0;
      const total = passes + totalViolations;
      const score = total > 0 ? Math.round((passes / total) * 100) : 100;

      categories.push({ name: "Accessibility", score, issues });
    }

    if (toolName === "check_dom_quality" && result) {
      const issues: AuditIssue[] = [];
      if (result.headingIssues) {
        for (const item of result.headingIssues) {
          const text = typeof item === "string" ? item : item.issue || String(item);
          const selector = typeof item === "object" && item.selector ? item.selector : "";
          issues.push({
            severity: "moderate",
            title: "Heading Hierarchy Issue",
            description: text,
            elements: selector ? [{ html: "", selector }] : [],
          });
        }
      }
      if (result.images?.missingAlt > 0) {
        issues.push({
          severity: "serious",
          title: "Images Missing Alt Text",
          description: `${result.images.missingAlt} image(s) are missing alt attributes`,
          elements: [],
        });
      }
      if (!result.landmarks?.main) {
        issues.push({
          severity: "moderate",
          title: "Missing Main Landmark",
          description: "Page has no <main> element or role=\"main\"",
          elements: [],
        });
      }
      if (result.nestingDepth > 15) {
        issues.push({
          severity: "minor",
          title: "Deep DOM Nesting",
          description: `DOM nesting depth is ${result.nestingDepth} (recommended < 15)`,
          elements: [],
        });
      }

      const score = Math.max(0, 100 - issues.length * 12);
      categories.push({ name: "DOM Quality", score, issues });
    }

    if (toolName === "run_contrast_check" && result) {
      const issues: AuditIssue[] = (result.failingElements || []).map((f: any) => ({
        severity: f.ratio < 3 ? "critical" : "serious",
        title: `Low contrast: ${f.ratio}:1 (needs ${f.required}:1)`,
        description: `Text "${f.text}" has insufficient contrast`,
        elements: [{ html: f.element || "", selector: f.selector || "" }],
        suggestedFix: `Increase contrast between ${f.foreground} and ${f.background}`,
      }));

      const checked = result.totalChecked || 1;
      const failing = result.failCount || 0;
      const score = Math.round(((checked - failing) / checked) * 100);
      categories.push({ name: "Color Contrast", score, issues });
    }

    if (toolName === "check_seo" && result) {
      const issues: AuditIssue[] = [];
      if (!result.title?.isGood) {
        issues.push({
          severity: "moderate",
          title: "Title Length Issue",
          description: `Title is ${result.title?.length || 0} chars (recommended 30-60)`,
          elements: [],
        });
      }
      if (!result.metaDescription?.value) {
        issues.push({
          severity: "serious",
          title: "Missing Meta Description",
          description: "Page has no meta description",
          elements: [],
        });
      }
      if (!result.viewport) {
        issues.push({
          severity: "critical",
          title: "Missing Viewport Meta Tag",
          description: "No viewport meta tag found",
          elements: [],
        });
      }
      if (result.h1Count === 0) {
        issues.push({
          severity: "serious",
          title: "Missing H1",
          description: "Page has no H1 heading",
          elements: [],
        });
      }
      if (result.h1Count > 1) {
        issues.push({
          severity: "minor",
          title: "Multiple H1 Tags",
          description: `Page has ${result.h1Count} H1 tags (recommended: 1)`,
          elements: [],
        });
      }
      if (!result.openGraph?.title) {
        issues.push({
          severity: "minor",
          title: "Missing Open Graph Tags",
          description: "No OG title found",
          elements: [],
        });
      }

      const score = Math.max(0, 100 - issues.length * 15);
      categories.push({ name: "SEO", score, issues });
    }

    if (toolName === "analyze_forms" && result?.forms) {
      const issues: AuditIssue[] = [];
      for (const form of result.forms) {
        // Flag unwrapped form-like groups as a structural issue
        if (form.isWrapped === false) {
          issues.push({
            severity: "serious",
            title: "Form inputs without <form> wrapper",
            description: `Form group ${form.index + 1} has ${form.inputCount} input(s) without a <form> element — native validation and accessibility features won't work`,
            elements: form.containerSelector ? [{ html: "", selector: form.containerSelector }] : [],
            suggestedFix: "Wrap related inputs in a <form> element with appropriate action and method attributes",
          });
        }
        if (!form.hasSubmitButton) {
          issues.push({
            severity: "moderate",
            title: "Form missing submit button",
            description: `Form ${form.index + 1} has no submit button — users cannot submit via keyboard (Enter key)`,
            elements: [],
            suggestedFix: 'Add a <button type="submit"> element inside the form',
          });
        }
        for (const issue of form.issues || []) {
          issues.push({
            severity: issue.includes("label") ? "serious" : "moderate",
            title: issue,
            description: `Form ${form.index + 1}: ${issue}`,
            elements: [],
          });
        }
      }
      const score = Math.max(0, 100 - issues.length * 10);
      categories.push({ name: "Forms", score, issues });
    }

    if (toolName === "get_console_logs" && result?.entries) {
      const issues: AuditIssue[] = (result.entries as any[])
        .filter((e: any) => e.level === "error" || e.level === "warning")
        .map((e: any) => ({
          severity: (e.level === "error" ? "serious" : "moderate") as AuditIssue["severity"],
          title: `Console ${e.level}: ${(e.message || "").slice(0, 80)}`,
          description: e.message || "",
          elements: e.sourceId
            ? [{ html: "", selector: `${e.sourceId}:${e.line || 0}` }]
            : [],
        }));
      const errorCount = issues.filter((i) => i.severity === "serious").length;
      const score = Math.max(0, 100 - errorCount * 15 - (issues.length - errorCount) * 5);
      categories.push({ name: "JavaScript Errors", score, issues });
    }

    if (toolName === "get_network_errors" && result?.entries) {
      const issues: AuditIssue[] = (result.entries as any[]).map((e: any) => {
        const is5xx = e.statusCode >= 500;
        const isConnectionError = e.statusCode === 0 && !!e.error;
        const isCors = (e.error || "").toLowerCase().includes("cors");
        const severity: AuditIssue["severity"] =
          is5xx || isConnectionError || isCors ? "serious" : "moderate";
        const label = e.statusCode
          ? `${e.statusCode} ${e.method} ${e.url}`
          : `${e.error} ${e.method} ${e.url}`;
        return {
          severity,
          title: `Network error: ${label.slice(0, 80)}`,
          description: label,
          elements: [],
          suggestedFix: e.error || undefined,
        };
      });
      const seriousCount = issues.filter((i) => i.severity === "serious").length;
      const score = Math.max(0, 100 - seriousCount * 20 - (issues.length - seriousCount) * 10);
      categories.push({ name: "Network Errors", score, issues });
    }

    if (toolName === "get_performance_metrics" && result) {
      const issues: AuditIssue[] = [];
      if (result.timing?.load > 3000) {
        issues.push({
          severity: result.timing.load > 5000 ? "critical" : "serious",
          title: "Slow Page Load",
          description: `Page load time: ${result.timing.load}ms (recommended < 3000ms)`,
          elements: [],
        });
      }
      if (result.dom?.elementCount > 1500) {
        issues.push({
          severity: result.dom.elementCount > 3000 ? "serious" : "moderate",
          title: "Large DOM Size",
          description: `${result.dom.elementCount} elements (recommended < 1500)`,
          elements: [],
        });
      }
      if (result.lcp && result.lcp > 2500) {
        issues.push({
          severity: result.lcp > 4000 ? "critical" : "serious",
          title: "Slow Largest Contentful Paint",
          description: `LCP: ${result.lcp}ms (recommended < 2500ms)`,
          elements: [],
        });
      }
      const score = Math.max(0, 100 - issues.length * 20);
      categories.push({ name: "Performance", score, issues });
    }
  }

  if (categories.length === 0) return null;

  const overallScore = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length
  );

  return {
    messageId,
    overallScore,
    categories,
    timestamp: Date.now(),
  };
}
