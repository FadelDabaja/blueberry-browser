import { tool } from "ai";
import { z } from "zod";
import { app } from "electron";
import { join } from "path";
import { writeFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from "fs";
import { randomUUID } from "crypto";

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getReportsDir(): string {
  const dir = join(app.getPath("userData"), "reports");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function wrapMarkdownInHtml(title: string, markdown: string): string {
  const safeTitle = escapeHtml(title);

  // Process inline formatting
  const inlineFmt = (text: string): string =>
    text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">')
      .replace(/~~(.+?)~~/g, "<del>$1</del>");

  const lines = markdown.split("\n");
  const htmlParts: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockContent: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHasHeader = false;

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const parts = ['<table>'];
    tableRows.forEach((cells, i) => {
      if (i === 0 && tableHasHeader) {
        parts.push('<thead><tr>');
        cells.forEach(c => parts.push(`<th>${inlineFmt(c.trim())}</th>`));
        parts.push('</tr></thead><tbody>');
      } else if (i === 1 && tableHasHeader) {
        // separator row, skip
      } else {
        parts.push('<tr>');
        cells.forEach(c => parts.push(`<td>${inlineFmt(c.trim())}</td>`));
        parts.push('</tr>');
      }
    });
    if (tableHasHeader) parts.push('</tbody>');
    parts.push('</table>');
    htmlParts.push(parts.join(''));
    tableRows = [];
    tableHasHeader = false;
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (/^```/.test(line.trim())) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.trim().replace(/^```/, "").trim();
        codeBlockContent = [];
        continue;
      } else {
        inCodeBlock = false;
        const langClass = codeBlockLang ? ` class="language-${escapeHtml(codeBlockLang)}"` : "";
        htmlParts.push(`<pre><code${langClass}>${escapeHtml(codeBlockContent.join("\n"))}</code></pre>`);
        continue;
      }
    }
    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    const t = line.trim();

    // Table detection
    if (t.startsWith("|") && t.endsWith("|")) {
      if (!inTable) inTable = true;
      const cells = t.slice(1, -1).split("|");
      // Detect separator row
      if (cells.every(c => /^[\s:-]+$/.test(c))) {
        tableHasHeader = true;
        tableRows.push(cells);
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Empty lines
    if (!t) { continue; }

    // Headings
    if (/^#{1,6}\s/.test(t)) {
      const level = t.match(/^(#{1,6})\s/)![1].length;
      const text = t.replace(/^#{1,6}\s+/, "");
      htmlParts.push(`<h${level}>${inlineFmt(text)}</h${level}>`);
      continue;
    }

    // Blockquotes
    if (t.startsWith("> ")) {
      const quoteLines = [t.replace(/^>\s?/, "")];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith("> ")) {
        i++;
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
      }
      htmlParts.push(`<blockquote>${quoteLines.map(l => inlineFmt(l)).join("<br>")}</blockquote>`);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      htmlParts.push("<hr>");
      continue;
    }

    // Unordered list items (handle nesting by indent level)
    if (/^[-*+]\s/.test(t)) {
      const items: string[] = [];
      items.push(inlineFmt(t.replace(/^[-*+]\s+/, "")));
      while (i + 1 < lines.length && /^\s*[-*+]\s/.test(lines[i + 1])) {
        i++;
        items.push(inlineFmt(lines[i].trim().replace(/^[-*+]\s+/, "")));
      }
      htmlParts.push(`<ul>${items.map(it => `<li>${it}</li>`).join("")}</ul>`);
      continue;
    }

    // Ordered list items
    if (/^\d+\.\s/.test(t)) {
      const items: string[] = [];
      items.push(inlineFmt(t.replace(/^\d+\.\s+/, "")));
      while (i + 1 < lines.length && /^\s*\d+\.\s/.test(lines[i + 1])) {
        i++;
        items.push(inlineFmt(lines[i].trim().replace(/^\d+\.\s+/, "")));
      }
      htmlParts.push(`<ol>${items.map(it => `<li>${it}</li>`).join("")}</ol>`);
      continue;
    }

    // Regular paragraph
    htmlParts.push(`<p>${inlineFmt(t)}</p>`);
  }

  // Flush any remaining table
  if (inTable) flushTable();

  // Merge adjacent <ul>/<ol> tags
  const html = htmlParts.join("\n")
    .replace(/<\/ul>\n<ul>/g, "")
    .replace(/<\/ol>\n<ol>/g, "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6; color: #1a1a2e; background: #fafafa;
      max-width: 900px; margin: 0 auto; padding: 2rem;
    }
    h1 { font-size: 1.8rem; margin: 1.5rem 0 1rem; color: #6366f1; }
    h2 { font-size: 1.4rem; margin: 1.2rem 0 0.8rem; color: #1a1a2e; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.3rem; }
    h3 { font-size: 1.1rem; margin: 1rem 0 0.5rem; color: #374151; }
    h4 { font-size: 1rem; margin: 0.8rem 0 0.4rem; color: #4b5563; }
    p { margin: 0.5rem 0; }
    ul, ol { margin: 0.5rem 0 0.5rem 1.5rem; }
    li { margin: 0.25rem 0; }
    code { background: #f3f4f6; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.9em; font-family: 'SF Mono', Monaco, Consolas, monospace; }
    pre { background: #1e1e2e; color: #cdd6f4; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 0.75rem 0; }
    pre code { background: none; color: inherit; padding: 0; font-size: 0.85em; }
    strong { color: #1a1a2e; }
    a { color: #6366f1; text-decoration: underline; }
    blockquote { border-left: 3px solid #6366f1; padding: 0.5rem 1rem; margin: 0.75rem 0; color: #4b5563; background: #f9fafb; border-radius: 0 4px 4px 0; }
    table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.9em; }
    th { background: #f3f4f6; font-weight: 600; text-align: left; padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; }
    td { padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #f9fafb; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0; }
    img { max-width: 100%; border-radius: 8px; margin: 0.5rem 0; }
    del { opacity: 0.5; }
    .report-header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; }
    .report-header h1 { color: white; margin: 0; }
    .report-header .meta { opacity: 0.85; font-size: 0.85rem; margin-top: 0.5rem; }
    /* Severity badges */
    .severity-critical { display: inline-block; background: #fecaca; color: #991b1b; padding: 0.1rem 0.5rem; border-radius: 4px; font-size: 0.8em; font-weight: 600; }
    .severity-serious { display: inline-block; background: #fed7aa; color: #9a3412; padding: 0.1rem 0.5rem; border-radius: 4px; font-size: 0.8em; font-weight: 600; }
    .severity-moderate { display: inline-block; background: #fef08a; color: #854d0e; padding: 0.1rem 0.5rem; border-radius: 4px; font-size: 0.8em; font-weight: 600; }
    .severity-minor { display: inline-block; background: #bfdbfe; color: #1e40af; padding: 0.1rem 0.5rem; border-radius: 4px; font-size: 0.8em; font-weight: 600; }
    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      body { background: #1a1a2e; color: #e2e8f0; }
      h1 { color: #818cf8; }
      h2 { color: #e2e8f0; border-color: #374151; }
      h3, h4 { color: #cbd5e1; }
      strong { color: #e2e8f0; }
      code { background: #334155; color: #e2e8f0; }
      blockquote { background: #1e293b; color: #94a3b8; border-color: #818cf8; }
      th { background: #1e293b; border-color: #374151; }
      td { border-color: #374151; }
      tr:nth-child(even) { background: #1e293b; }
      a { color: #818cf8; }
      hr { border-color: #374151; }
    }
    /* Print */
    @media print {
      body { max-width: 100%; padding: 0; background: white; color: black; }
      .report-header { break-inside: avoid; }
      pre { white-space: pre-wrap; }
      a { color: #6366f1; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>${safeTitle}</h1>
    <div class="meta">Generated by Blueberry Browser &middot; ${new Date().toLocaleString()}</div>
  </div>
  ${html}
</body>
</html>`;
}

/** List all report metadata (for IPC/UI use) */
export function listAllReports(): { id: string; title: string; createdAt: string }[] {
  const dir = getReportsDir();
  const metaFiles = readdirSync(dir).filter((f) => f.endsWith(".meta.json"));
  return metaFiles
    .map((f) => {
      try { return JSON.parse(readFileSync(join(dir, f), "utf-8")); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/** Delete a report by ID (for IPC/UI use) */
export function deleteReport(id: string): boolean {
  if (!UUID_RE.test(id)) return false;
  const dir = getReportsDir();
  const htmlPath = join(dir, `${id}.html`);
  const metaPath = join(dir, `${id}.meta.json`);
  let deleted = false;
  if (existsSync(htmlPath)) { unlinkSync(htmlPath); deleted = true; }
  if (existsSync(metaPath)) { unlinkSync(metaPath); deleted = true; }
  return deleted;
}

export function createExportTools() {
  return {
    generate_report: tool({
      description:
        "Generate a report from content and save it as an HTML file. Returns a blueberry:// URL that can be opened in a new tab. Use this after audits, analyses, or any task that produces structured findings.",
      inputSchema: z.object({
        title: z.string().describe("Report title"),
        content: z.string().describe("Report content (markdown or HTML)"),
        format: z.enum(["html", "markdown"]).describe("Content format: 'markdown' will be converted to styled HTML, 'html' will be used directly"),
      }),
      execute: async ({ title, content, format }) => {
        const id = randomUUID();
        const dir = getReportsDir();
        const filePath = join(dir, `${id}.html`);

        const html = format === "markdown" ? wrapMarkdownInHtml(title, content) : content;
        writeFileSync(filePath, html, "utf-8");

        // Save metadata
        const metaPath = join(dir, `${id}.meta.json`);
        writeFileSync(metaPath, JSON.stringify({ id, title, createdAt: new Date().toISOString() }), "utf-8");

        return {
          url: `blueberry://report/${id}`,
          path: filePath,
          id,
          title,
        };
      },
    }),

    list_reports: tool({
      description: "List all saved reports generated by the browser agent.",
      inputSchema: z.object({}),
      execute: async () => {
        const dir = getReportsDir();
        const metaFiles = readdirSync(dir).filter((f) => f.endsWith(".meta.json"));
        const reports = metaFiles.map((f) => {
          try {
            return JSON.parse(readFileSync(join(dir, f), "utf-8"));
          } catch {
            return null;
          }
        }).filter(Boolean);

        return { reports, count: reports.length };
      },
    }),
  };
}
