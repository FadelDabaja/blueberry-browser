import { Experimental_Agent as Agent, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { Tab } from "../core/tab";
import type { Window } from "../core/window";
import { buildAllTools, type GetModelForTier, type GetModelNameForTier } from "./subagentFactory";
import type { BroadcastFn } from "../llm/streamProcessor";
import {
  AGENT_REGISTRY,
  getAgentTypeValues,
  isRecursiveAgent,
  resolveTools,
} from "../config/agents";
import {
  MAX_PARALLEL_DEPTH,
  TAB_LOAD_TIMEOUT_MS,
  MAX_CONCURRENCY,
  DEFAULT_CONCURRENCY,
  MAX_PARALLEL_TASKS,
  PARALLEL_SUMMARY_MAX_LENGTH,
} from "../config/constants";
import { isReasoningModelName } from "../config/models";

class Semaphore {
  private permits: number;
  private queue: (() => void)[] = [];
  constructor(permits: number) {
    this.permits = permits;
  }
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }
  release(): void {
    this.queue.length > 0 ? this.queue.shift()!() : this.permits++;
  }
}

function waitForLoad(tab: Tab, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!tab.webContents.isLoading()) {
      resolve();
      return;
    }

    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      tab.webContents.removeListener("did-finish-load", onFinish);
      tab.webContents.removeListener("did-fail-load", onFail);
      tab.webContents.removeListener("did-stop-loading", onStop);
    };

    const onFinish = () => { cleanup(); resolve(); };
    const onStop = () => { cleanup(); resolve(); };
    const onFail = (_event: any, code: number, desc: string) => {
      cleanup();
      reject(new Error(`Tab load failed (${code}): ${desc}`));
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Tab load timeout"));
    }, timeoutMs);

    tab.webContents.once("did-finish-load", onFinish);
    tab.webContents.once("did-fail-load", onFail);
    tab.webContents.once("did-stop-loading", onStop);
  });
}

interface ParallelTask {
  id: string;
  task: string;
  agentType: string;
  url: string;
}

interface ParallelTaskResult {
  id: string;
  status: "success" | "error";
  summary?: string;
  toolResults?: { toolName: string; result: any }[];
  stepsUsed?: number;
  usage?: any;
  error?: string;
}

export function createParallelTasksTool(
  getModelForTier: GetModelForTier,
  getWindow: () => Window | null,
  broadcast: BroadcastFn,
  parentDepth: number = 0,
  getAbortSignal?: () => AbortSignal | undefined,
  getModelNameForTier?: GetModelNameForTier,
) {
  return tool({
    description:
      "Run multiple specialized agents in parallel, each in an isolated browser tab. " +
      "Use for multi-page audits, site-wide analysis, or any task spanning multiple URLs. " +
      "Each task gets its own hidden tab — no conflicts between agents.",
    inputSchema: z.object({
      tasks: z
        .array(
          z.object({
            id: z.string().describe("Unique task ID for tracking"),
            task: z.string().describe("Task description for the subagent"),
            agentType: z
              .enum(getAgentTypeValues())
              .describe("Type of specialist agent"),
            url: z.string().describe("URL to load in the isolated tab"),
          })
        )
        .min(1)
        .max(MAX_PARALLEL_TASKS),
      concurrency: z
        .number()
        .min(1)
        .max(MAX_CONCURRENCY)
        .default(DEFAULT_CONCURRENCY)
        .optional()
        .describe(`Max concurrent agents (default ${DEFAULT_CONCURRENCY}, max ${MAX_CONCURRENCY})`),
    }),
    execute: async ({ tasks, concurrency }, { abortSignal: parentSignal }) => {
      if (parentDepth >= MAX_PARALLEL_DEPTH) {
        return {
          results: [],
          totalTasks: tasks.length,
          error: `Max recursion depth (${MAX_PARALLEL_DEPTH}) reached. Cannot spawn more parallel tasks.`,
        };
      }

      const win = getWindow();
      if (!win) {
        return {
          results: [],
          totalTasks: tasks.length,
          error: "No browser window available.",
        };
      }

      const sem = new Semaphore(Math.min(concurrency ?? DEFAULT_CONCURRENCY, MAX_CONCURRENCY));

      // Pre-create all tabs upfront so they start loading in parallel
      // while tasks wait for the semaphore. This overlaps network I/O with agent processing.
      const preCreatedTabs = new Map<string, Tab>();
      for (const taskDef of tasks) {
        try {
          const tab = win.createTab(taskDef.url, { hidden: true, silent: true });
          preCreatedTabs.set(taskDef.id, tab);
        } catch {
          // Tab creation failure handled in runTask
        }
      }

      const runTask = async (
        taskDef: ParallelTask
      ): Promise<ParallelTaskResult> => {
        const signal = parentSignal || getAbortSignal?.();
        if (signal?.aborted) {
          return { id: taskDef.id, status: "error" as const, error: "Cancelled" };
        }

        await sem.acquire();
        let tab: Tab | null = preCreatedTabs.get(taskDef.id) || null;

        try {
          // Create tab if pre-creation failed
          if (!tab) {
            tab = win.createTab(taskDef.url, { hidden: true, silent: true });
          }

          // Wait for page to load (may already be loaded since tabs were pre-created)
          await waitForLoad(tab, TAB_LOAD_TIMEOUT_MS);

          // Emit progress: started
          broadcast("audit-tool-progress", {
            messageId: `parallel-${taskDef.id}`,
            toolName: `parallel:${taskDef.agentType}`,
            status: "running",
            meta: { taskId: taskDef.id, url: taskDef.url },
          });

          // Build tools for this agent type with isolated tab reference
          const isolatedTab = tab;
          const agentDef = AGENT_REGISTRY[taskDef.agentType];
          if (!agentDef) {
            return {
              id: taskDef.id,
              status: "error" as const,
              error: `Unknown agent type: ${taskDef.agentType}`,
            };
          }
          const allTools = buildAllTools(
            () => isolatedTab,
            getWindow,
            broadcast
          );
          const agentTools: Record<string, any> = resolveTools(agentDef.toolNames, allTools);

          // Inject run_parallel_tasks for recursive agent types
          if (isRecursiveAgent(taskDef.agentType)) {
            agentTools.run_parallel_tasks = createParallelTasksTool(
              getModelForTier,
              getWindow,
              broadcast,
              parentDepth + 1,
              getAbortSignal,
              getModelNameForTier,
            );
          }

          const model = getModelForTier(agentDef.modelTier);

          const toolStartTimes = new Map<string, number>();

          const subagentOpts: any = {
            model,
            instructions: agentDef.instructions,
            tools: agentTools,
            stopWhen: stepCountIs(agentDef.maxSteps),
            maxRetries: agentDef.maxRetries,
            // Tool lifecycle events handled via fullStream chunks below
          };

          // Only set temperature if defined and model is NOT a reasoning model
          const subModelName = getModelNameForTier?.(agentDef.modelTier) || "";
          if (agentDef.temperature !== undefined && !isReasoningModelName(subModelName)) {
            subagentOpts.temperature = agentDef.temperature;
          }

          const subagent = new Agent(subagentOpts);

          // Note: experimental_onToolCallStart is silently ignored on Agent.stream(),
          // so we handle tool-call-started via fullStream "tool-call" chunks instead.
          const streamResult = await subagent.stream({
            prompt: taskDef.task,
            abortSignal: signal,
          });

          // Consume fullStream — broadcasts tool lifecycle, text deltas, and progress
          const parallelMsgId = `parallel-${taskDef.id}`;
          for await (const chunk of streamResult.fullStream) {
            switch (chunk.type) {
              case "text-delta":
                if (chunk.text) {
                  broadcast("subagent-text-delta", {
                    messageId: parallelMsgId,
                    text: chunk.text,
                    agentType: taskDef.agentType,
                    taskId: taskDef.id,
                  });
                }
                break;
              case "tool-call": {
                const toolCallId = `parallel-${chunk.toolCallId}`;
                toolStartTimes.set(toolCallId, Date.now());
                broadcast("tool-call-started", {
                  messageId: parallelMsgId,
                  toolCallId,
                  toolName: chunk.toolName,
                  args: chunk.input || {},
                });
                broadcast("audit-tool-progress", {
                  messageId: parallelMsgId,
                  toolName: chunk.toolName,
                  status: "running",
                });
                break;
              }
              case "tool-result": {
                const toolCallId = `parallel-${chunk.toolCallId}`;
                const startTime = toolStartTimes.get(toolCallId);
                const durationMs = startTime ? Date.now() - startTime : undefined;
                broadcast("tool-call-completed", {
                  messageId: parallelMsgId,
                  toolCallId,
                  toolName: chunk.toolName,
                  output: chunk.output,
                  durationMs,
                });
                broadcast("audit-tool-progress", {
                  messageId: parallelMsgId,
                  toolName: chunk.toolName,
                  status: "complete",
                });
                toolStartTimes.delete(toolCallId);
                break;
              }
            }
          }

          // Await final results
          const [text, steps, totalUsage] = await Promise.all([
            streamResult.text,
            streamResult.steps,
            streamResult.totalUsage,
          ]);

          // Broadcast parallel task token usage so sidebar tracks total consumption
          if (totalUsage) {
            const promptTokens = totalUsage.inputTokens || totalUsage.promptTokens || 0;
            const completionTokens = totalUsage.outputTokens || totalUsage.completionTokens || 0;
            const totalTokens = totalUsage.totalTokens || (promptTokens + completionTokens);
            if (totalTokens > 0) {
              broadcast("token-usage", {
                messageId: parallelMsgId,
                inputTokens: promptTokens,
                outputTokens: completionTokens,
                totalTokens,
              });
            }
          }

          // Extract tool results — AI SDK v5 uses .output
          const toolResults = steps.flatMap((s: any) =>
            (s.toolResults || []).map((tr: any) => ({
              toolName: tr.toolName,
              result: tr.output,
            }))
          );

          // Emit progress: complete
          broadcast("audit-tool-progress", {
            messageId: `parallel-${taskDef.id}`,
            toolName: `parallel:${taskDef.agentType}`,
            status: "complete",
            meta: { taskId: taskDef.id, url: taskDef.url },
          });

          return {
            id: taskDef.id,
            status: "success",
            summary: text,
            toolResults,
            stepsUsed: steps.length,
            usage: totalUsage,
          };
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : String(err);

          // Emit progress: error
          broadcast("audit-tool-progress", {
            messageId: `parallel-${taskDef.id}`,
            toolName: `parallel:${taskDef.agentType}`,
            status: "error",
            meta: { taskId: taskDef.id, error: errorMsg },
          });

          return {
            id: taskDef.id,
            status: "error",
            error: errorMsg,
          };
        } finally {
          sem.release();
          // Always clean up the tab
          if (tab) {
            try {
              win.closeTab(tab.id);
            } catch {
              // Tab may already be destroyed
            }
          }
        }
      };

      // Run all tasks with allSettled — never short-circuits
      const settled = await Promise.allSettled(tasks.map(runTask));

      const results: ParallelTaskResult[] = settled.map((s, i) =>
        s.status === "fulfilled"
          ? s.value
          : {
              id: tasks[i].id,
              status: "error" as const,
              error: s.reason?.message || "Unknown error",
            }
      );

      return { results, totalTasks: tasks.length };
    },
    toModelOutput: ({ output }) => {
      if (!output) {
        return { type: 'text' as const, value: 'Parallel tasks completed.' };
      }
      return {
        type: 'text' as const,
        value: JSON.stringify({
          totalTasks: output.totalTasks || 0,
          results: (output.results || []).map((r: ParallelTaskResult) => ({
            id: r.id,
            status: r.status,
            summary: r.summary?.slice(0, PARALLEL_SUMMARY_MAX_LENGTH),
          })),
        }),
      };
    },
  });
}
