import type { CoreMessage } from "ai";
import { buildAuditReport } from "./auditReportBuilder";
import { FindingsStore } from "../agents/findingsStore";
import {
  TEXT_DELTA_THROTTLE_MS,
  IPC_SUBAGENT_SUMMARY_TRUNCATE_LEN,
  IPC_PARALLEL_RESULT_TRUNCATE_LEN,
} from "../config/constants";

interface StreamChunk {
  content: string;
  isComplete: boolean;
}

/** A function that sends an IPC message to one or more webContents */
export type BroadcastFn = (channel: string, ...args: any[]) => void;

// Tools whose output contains sensitive/large data that should be replaced in IPC
const SCREENSHOT_TOOLS = new Set(["take_screenshot", "analyze_visual_design"]);

export function truncateIpcOutput(toolName: string, output: any): unknown {
  if (SCREENSHOT_TOOLS.has(toolName)) {
    return { hasScreenshot: true };
  }
  if (toolName === "run_specialized_task") {
    return output?.summary
      ? { summary: String(output.summary).slice(0, IPC_SUBAGENT_SUMMARY_TRUNCATE_LEN), stepsUsed: output.stepsUsed }
      : output;
  }
  if (toolName === "run_parallel_tasks") {
    return {
      totalTasks: output?.totalTasks,
      results: (output?.results || []).map((r: any) => ({
        id: r.id,
        status: r.status,
        summary: r.summary?.slice(0, IPC_PARALLEL_RESULT_TRUNCATE_LEN),
        error: r.error,
      })),
    };
  }
  if (typeof output === "string" && output.length > IPC_SUBAGENT_SUMMARY_TRUNCATE_LEN) {
    return output.slice(0, IPC_SUBAGENT_SUMMARY_TRUNCATE_LEN) + "...";
  }
  return output;
}

export function unwrapToolResults(
  toolName: string,
  output: any,
  target: { toolName: string; result: any }[]
): void {
  if (toolName === "run_specialized_task" && output?.toolResults) {
    for (const inner of output.toolResults) {
      target.push({ toolName: inner.toolName, result: inner.result });
    }
  } else if (toolName === "run_parallel_tasks" && output?.results) {
    for (const subResult of output.results) {
      if (subResult.status === "success" && subResult.toolResults) {
        for (const inner of subResult.toolResults) {
          target.push({ toolName: inner.toolName, result: inner.result });
        }
      }
    }
  } else {
    target.push({ toolName, result: output });
  }
}

export function extractFindings(toolName: string, output: any, store: FindingsStore): void {
  if (!output || !store) return;

  if (toolName === "run_contrast_check" && output.failingElements) {
    for (const f of output.failingElements) {
      store.add({
        category: "contrast",
        severity: f.ratio < 3 ? "critical" : "serious",
        description: `Contrast ${f.ratio}:1 (need ${f.required}:1) on "${f.text}"`,
        selector: f.selector,
        suggestion: `Increase contrast between ${f.foreground} and ${f.background}`,
        sourceAgent: "main",
        toolName,
      });
    }
  }

  if (toolName === "run_accessibility_audit" && output.violations) {
    for (const v of output.violations) {
      store.add({
        category: "accessibility",
        severity: v.impact || "moderate",
        description: v.description || v.help || v.id,
        selector: v.nodes?.[0]?.target?.[0],
        suggestion: v.nodes?.[0]?.failureSummary,
        sourceAgent: "main",
        toolName,
      });
    }
  }

  if (toolName === "check_dom_quality" && output.headingIssues) {
    for (const item of output.headingIssues) {
      const text = typeof item === "string" ? item : item.issue || String(item);
      store.add({
        category: "dom-quality",
        severity: "moderate",
        description: text,
        selector: typeof item === "object" ? item.selector : undefined,
        sourceAgent: "main",
        toolName,
      });
    }
  }

  if (toolName === "check_seo") {
    if (!output.title?.isGood) {
      store.add({ category: "seo", severity: "moderate", description: `Title length: ${output.title?.length || 0} chars`, sourceAgent: "main", toolName });
    }
    if (!output.metaDescription?.value) {
      store.add({ category: "seo", severity: "serious", description: "Missing meta description", sourceAgent: "main", toolName });
    }
  }

  if (toolName === "get_console_logs" && output.entries) {
    for (const e of output.entries) {
      if (e.level === "error") {
        store.add({ category: "js-errors", severity: "serious", description: e.message, sourceAgent: "main", toolName });
      }
    }
  }

  if (toolName === "get_network_errors" && output.entries) {
    for (const e of output.entries) {
      store.add({
        category: "network-errors",
        severity: e.statusCode >= 500 ? "serious" : "moderate",
        description: `${e.statusCode || 'ERR'} ${e.url}`,
        sourceAgent: "main",
        toolName,
      });
    }
  }

  if (toolName === "get_performance_metrics") {
    if (output.timing?.load > 3000) {
      store.add({ category: "performance", severity: output.timing.load > 5000 ? "critical" : "serious", description: `Page load: ${output.timing.load}ms`, sourceAgent: "main", toolName });
    }
  }
}

export async function processFullStream(
  fullStream: AsyncIterable<any>,
  messageId: string,
  broadcast: BroadcastFn,
  messages: CoreMessage[],
  messageIndex: number,
  sendMessagesToRenderer: () => void,
  findingsStore?: FindingsStore,
): Promise<void> {
  let accumulatedText = "";
  const toolResults: { toolName: string; result: any }[] = [];
  const toolCallStartTimes = new Map<string, number>();
  const toolCallNames = new Map<string, string>();

  // Throttle text-delta IPC broadcasts to reduce overhead
  let pendingFlush: ReturnType<typeof setTimeout> | null = null;
  let pendingText = "";
  const THROTTLE_MS = TEXT_DELTA_THROTTLE_MS;

  const flushPendingText = () => {
    if (pendingText) {
      sendMessagesToRenderer();
      broadcast("chat-response", { messageId, content: pendingText, isComplete: false } as StreamChunk);
      pendingText = "";
    }
    if (pendingFlush) {
      clearTimeout(pendingFlush);
      pendingFlush = null;
    }
  };

  for await (const chunk of fullStream) {
    switch (chunk.type) {
      case "text-delta": {
        accumulatedText += chunk.text;
        pendingText += chunk.text;
        messages[messageIndex] = { role: "assistant", content: accumulatedText };
        if (!pendingFlush) {
          pendingFlush = setTimeout(flushPendingText, THROTTLE_MS);
        }
        break;
      }
      case "tool-call": {
        flushPendingText();
        // Always sync messages to renderer before tool executes — even if no
        // text was emitted yet.  Without this, the renderer never sees the
        // assistant message and interactive tool UIs (e.g. ask_user) won't render.
        sendMessagesToRenderer();
        const toolCallId = chunk.toolCallId || `tc-${Date.now()}-${chunk.toolName}`;
        toolCallStartTimes.set(toolCallId, Date.now());
        toolCallNames.set(toolCallId, chunk.toolName);

        console.log(`🔧 Tool calling: ${chunk.toolName}`);
        broadcast("audit-tool-progress", {
          messageId,
          toolName: chunk.toolName,
          status: "running",
        });
        broadcast("tool-call-started", {
          messageId,
          toolCallId,
          toolName: chunk.toolName,
          args: chunk.input || {},
        });
        break;
      }
      case "error": {
        flushPendingText();
        console.error("Stream error:", chunk.error);
        const errorMsg = chunk.error?.message || String(chunk.error) || "An error occurred";
        accumulatedText += `\n\n*Error: ${errorMsg}*`;
        messages[messageIndex] = { role: "assistant", content: accumulatedText };
        sendMessagesToRenderer();
        broadcast("chat-response", { messageId, content: errorMsg, isComplete: false } as StreamChunk);
        break;
      }
      case "tool-result": {
        flushPendingText();
        const resultToolCallId = chunk.toolCallId || `tc-${chunk.toolName}`;
        const startTime = toolCallStartTimes.get(resultToolCallId) || Date.now();
        const durationMs = Date.now() - startTime;

        unwrapToolResults(chunk.toolName, chunk.output, toolResults);

        if (findingsStore) {
          extractFindings(chunk.toolName, chunk.output, findingsStore);
        }

        broadcast("tool-call-completed", {
          messageId,
          toolCallId: resultToolCallId,
          toolName: chunk.toolName,
          output: truncateIpcOutput(chunk.toolName, chunk.output),
          durationMs,
        });
        break;
      }
      case "tool-error": {
        flushPendingText();
        const errorToolCallId = chunk.toolCallId || 'tc-unknown';
        const errorToolName = toolCallNames.get(errorToolCallId) || chunk.toolName || 'unknown';
        const errStartTime = toolCallStartTimes.get(errorToolCallId) || Date.now();
        const errDurationMs = Date.now() - errStartTime;
        const errorMessage = chunk.error?.message || String(chunk.error) || "Tool execution failed";

        console.error(`🔧 Tool error (${errorToolName}):`, errorMessage);

        broadcast("tool-call-completed", {
          messageId,
          toolCallId: errorToolCallId,
          toolName: errorToolName,
          output: errorMessage,
          durationMs: errDurationMs,
          isError: true,
        });
        break;
      }
      case "start-step": {
        flushPendingText();
        broadcast("step-started", { messageId, stepNumber: chunk.stepNumber });
        break;
      }
      case "finish-step": {
        flushPendingText();
        broadcast("step-finished", {
          messageId,
          stepNumber: chunk.stepNumber,
          usage: chunk.usage,
          finishReason: chunk.finishReason,
          isContinued: chunk.isContinued,
        });
        break;
      }
      case "finish": {
        flushPendingText();
        broadcast("stream-finished", {
          messageId,
          totalUsage: chunk.totalUsage,
          finishReason: chunk.finishReason,
        });
        break;
      }
      case "reasoning-delta": {
        broadcast("chat-reasoning", {
          messageId,
          text: chunk.text,
        });
        break;
      }
      case "source": {
        broadcast("chat-source", {
          messageId,
          source: chunk.source,
        });
        break;
      }
      case "start": {
        // Stream initialization - no action needed
        break;
      }
      case "tool-input-start":
      case "tool-input-delta":
      case "tool-input-end": {
        // Tool input streaming - these are already captured in tool-call args
        // Could broadcast for real-time arg typing UI, but not critical
        break;
      }
      default: {
        // Log unhandled chunk types for debugging
        if (process.env.NODE_ENV === 'development' &&
            chunk.type !== 'text-start' && chunk.type !== 'text-end' &&
            chunk.type !== 'reasoning-start' && chunk.type !== 'reasoning-end') {
          console.debug(`Unhandled stream chunk type: ${chunk.type}`);
        }
        break;
      }
    }
  }

  flushPendingText();

  // Final update
  messages[messageIndex] = { role: "assistant", content: accumulatedText };
  sendMessagesToRenderer();

  // Build and send audit report if any tools were used
  if (toolResults.length > 0) {
    const report = buildAuditReport(toolResults, messageId);
    if (report) {
      broadcast("audit-report-data", report);
    }
  }

  // Send the final complete signal
  broadcast("chat-response", { messageId, content: accumulatedText, isComplete: true } as StreamChunk);
}
