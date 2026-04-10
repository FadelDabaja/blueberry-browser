import { Experimental_Agent as Agent, stepCountIs, tool } from "ai";
import type { LanguageModel } from "ai";
import { z } from "zod";
import type { Tab } from "../core/tab";
import type { Window } from "../core/window";
import type { ModelTier } from "../config/models";
import type { BroadcastFn } from "../llm/streamProcessor";
import { createAuditTools, createNavigationTools, createInteractionTools, createExportTools, createIntegrationTools, createDiagnosticTools } from "../tools";
import {
  AGENT_REGISTRY,
  getAgentTypeValues,
  getAgentTypeDescription,
  isRecursiveAgent,
  resolveTools,
} from "../config/agents";
import { isReasoningModelName } from "../config/models";
import { SUBAGENT_SUMMARY_MAX_LENGTH } from "../config/constants";
// Lazy import to avoid circular dependency (parallelOrchestrator imports from us)
async function getCreateParallelTasksTool() {
  const mod = await import("./parallelOrchestrator");
  return mod.createParallelTasksTool;
}

export type GetModelForTier = (tier: ModelTier) => LanguageModel;
export type GetModelNameForTier = (tier: ModelTier) => string;

export function buildAllTools(
  getActiveTab: () => Tab | null,
  getWindow: () => Window | null,
  broadcast?: BroadcastFn
) {
  return {
    audit: createAuditTools(getActiveTab),
    navigation: createNavigationTools(getActiveTab, getWindow),
    interaction: createInteractionTools(getActiveTab),
    export: createExportTools(),
    integration: createIntegrationTools(),
    diagnostic: createDiagnosticTools(getActiveTab, getWindow),
  };
}

export function createSubagentTool(
  getModelForTier: GetModelForTier,
  getActiveTab: () => Tab | null,
  getWindow: () => Window | null,
  broadcast?: BroadcastFn,
  getMessageId?: () => string | null,
  getAbortSignal?: () => AbortSignal | undefined,
  getModelNameForTier?: GetModelNameForTier,
) {
  return tool({
    description:
      "Delegate a complex multi-step task to a specialized subagent. " +
      "Use this for audit requests, form testing, end-to-end flows, visual analysis, or page analysis. " +
      "The subagent runs autonomously with its own context and returns a summary.",
    inputSchema: z.object({
      task: z.string().describe("Detailed task description for the subagent to execute"),
      agentType: z.enum(getAgentTypeValues()).describe(getAgentTypeDescription()),
    }),
    execute: async ({ task, agentType }, { abortSignal }) => {
      const agentDef = AGENT_REGISTRY[agentType];
      if (!agentDef) {
        return { summary: `Unknown agent type: ${agentType}`, toolResults: [], stepsUsed: 0 };
      }

      const model = getModelForTier(agentDef.modelTier);
      const allTools = buildAllTools(getActiveTab, getWindow, broadcast);
      const tools = resolveTools(agentDef.toolNames, allTools);

      // Inject run_parallel_tasks for recursive agent types (e.g. crawler)
      if (isRecursiveAgent(agentType) && broadcast) {
        const createParallelTasks = await getCreateParallelTasksTool();
        tools.run_parallel_tasks = createParallelTasks(
          getModelForTier,
          getWindow,
          broadcast,
          0,
          getAbortSignal,
          getModelNameForTier,
        );
      }

      const toolStartTimes = new Map<string, number>();

      const agentOpts: any = {
        model,
        instructions: agentDef.instructions,
        tools,
        stopWhen: stepCountIs(agentDef.maxSteps),
        maxRetries: agentDef.maxRetries,
        // Tool lifecycle events are handled via fullStream chunks (tool-call, tool-result)
        // instead of onStepFinish, to avoid duplicate broadcasts.
      };

      // Only set temperature if defined and model is NOT a reasoning model
      const modelName = getModelNameForTier?.(agentDef.modelTier) || "";
      if (agentDef.temperature !== undefined && !isReasoningModelName(modelName)) {
        agentOpts.temperature = agentDef.temperature;
      }

      const subagent = new Agent(agentOpts);

      const signal = abortSignal || getAbortSignal?.();
      // Note: experimental_onToolCallStart is silently ignored on Agent.stream(),
      // so we handle tool-call-started via fullStream "tool-call" chunks instead.
      const streamResult = await subagent.stream({
        prompt: task,
        abortSignal: signal,
      });

      // Consume fullStream — must be fully consumed for result promises to resolve.
      // Broadcasts tool lifecycle events and text deltas to the sidebar UI.
      const messageId = getMessageId?.() || `subagent-${Date.now()}`;
      for await (const chunk of streamResult.fullStream) {
        if (broadcast) {
          switch (chunk.type) {
            case "text-delta":
              if (chunk.text) {
                broadcast("subagent-text-delta", { messageId, text: chunk.text, agentType });
              }
              break;
            case "tool-call": {
              const toolCallId = `sub-${chunk.toolCallId}`;
              toolStartTimes.set(toolCallId, Date.now());
              broadcast("tool-call-started", {
                messageId,
                toolCallId,
                toolName: chunk.toolName,
                args: chunk.input || {},
              });
              broadcast("audit-tool-progress", {
                messageId,
                toolName: chunk.toolName,
                status: "running",
              });
              break;
            }
            case "tool-result": {
              const toolCallId = `sub-${chunk.toolCallId}`;
              const startTime = toolStartTimes.get(toolCallId);
              const durationMs = startTime ? Date.now() - startTime : undefined;
              broadcast("tool-call-completed", {
                messageId,
                toolCallId,
                toolName: chunk.toolName,
                output: chunk.output,
                durationMs,
              });
              broadcast("audit-tool-progress", {
                messageId,
                toolName: chunk.toolName,
                status: "complete",
              });
              toolStartTimes.delete(toolCallId);
              break;
            }
          }
        }
      }

      // Await final results (promises resolve after stream is consumed)
      const [text, steps, totalUsage] = await Promise.all([
        streamResult.text,
        streamResult.steps,
        streamResult.totalUsage,
      ]);

      // Broadcast subagent token usage so sidebar can track total consumption
      if (broadcast && totalUsage) {
        const promptTokens = totalUsage.inputTokens || totalUsage.promptTokens || 0;
        const completionTokens = totalUsage.outputTokens || totalUsage.completionTokens || 0;
        const totalTokens = totalUsage.totalTokens || (promptTokens + completionTokens);
        if (totalTokens > 0) {
          broadcast("token-usage", {
            messageId,
            inputTokens: promptTokens,
            outputTokens: completionTokens,
            totalTokens,
          });
        }
      }

      // Extract tool results — AI SDK v5 uses .output on step toolResults
      const toolResults = steps.flatMap((s: any) =>
        (s.toolResults || []).map((tr: any) => ({
          toolName: tr.toolName,
          result: tr.output,
        }))
      );

      return {
        summary: text,
        toolResults,
        stepsUsed: steps.length,
        usage: totalUsage,
      };
    },
    toModelOutput: ({ output }) => {
      if (!output) {
        return { type: 'text' as const, value: 'Task completed.' };
      }
      return {
        type: 'text' as const,
        value: `Summary: ${output.summary?.slice(0, SUBAGENT_SUMMARY_MAX_LENGTH) || 'No summary'}. Steps: ${output.stepsUsed || 0}. Tools used: ${output.toolResults?.length || 0}.`,
      };
    },
  });
}

