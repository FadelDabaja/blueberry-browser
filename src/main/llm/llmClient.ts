import { WebContents } from "electron";
import {
  Experimental_Agent as Agent,
  type LanguageModel,
  type CoreMessage,
  stepCountIs,
} from "ai";
import { getModel } from "./providerRegistry";
import { withLogging } from "./middleware";
import * as dotenv from "dotenv";
import { join } from "path";
import type { Window } from "../core/window";
import { STEP_TIMEOUT_MS, TOTAL_TIMEOUT_MS, TOKEN_ESTIMATE_DIVISOR } from "../config/constants";
import { createNavigationTools, createInteractionTools, createExportTools, createIntegrationTools, createDiagnosticTools } from "../tools";
import { createPlannerTools } from "../tools/plannerTools";
import { FindingsStore } from "../agents/findingsStore";
import { createSubagentTool } from "../agents/subagentFactory";
import { createParallelTasksTool } from "../agents/parallelOrchestrator";
import { processFullStream } from "./streamProcessor";
import { buildSystemPrompt } from "./systemPromptBuilder";
import { getErrorMessage } from "./errorMessages";
import { tokenBudgetExceeded } from "./stopConditions";
import {
  type LLMProvider,
  type ModelTier,
  DEFAULT_MODELS,
  MODEL_TIERS,
  isReasoningModelName,
  MODEL_CONTEXT_LIMITS,
  MAX_TOOL_STEPS,
  COMPACTION_THRESHOLD,
  COMPACTION_KEEP_RECENT,
  DEFAULT_TEMPERATURE,
  MAX_RETRIES,
  ADAPTIVE_STEP_THRESHOLD,
  TOKEN_BUDGET_PER_REQUEST,
} from "../config/models";

// Load environment variables from .env file
dotenv.config({ path: join(__dirname, "../../.env") });

interface ChatRequest {
  message: string;
  messageId: string;
  verbosity?: "concise" | "normal" | "detailed";
}

export class LLMClient {
  private readonly webContents: WebContents;
  private window: Window | null = null;
  private provider: LLMProvider;
  private modelName: string;
  private model: LanguageModel | null;
  private userOverrideModel: boolean = false;
  private messages: CoreMessage[] = [];
  private tools: Record<string, any>;
  private extraWebContents: Set<WebContents> = new Set();
  private currentMessageId: string | null = null;
  private currentAbortController: AbortController | null = null;
  private findingsStore: FindingsStore = new FindingsStore();

  // Smart caching: skip re-capturing when page hasn't changed
  private lastScreenshotUrl: string | null = null;
  private lastScreenshotData: string | null = null;
  private lastPageTextUrl: string | null = null;
  private lastPageText: string | null = null;

  constructor(webContents: WebContents) {
    this.webContents = webContents;
    this.provider = this.getProvider();
    this.modelName = this.getModelName();
    this.model = this.initializeModel();

    const getActiveTab = () => this.window?.activeTab ?? null;
    const getWindow = () => this.window;
    // Main agent gets navigation, interaction, planner, export, diagnostic tools directly.
    // Integration tools: only list_tasks/list_groups for quick lookups.
    // Full task CRUD (create/update/delete) is handled by the task_manager subagent.
    const integrationTools = createIntegrationTools();
    const diagnosticTools = createDiagnosticTools(getActiveTab, getWindow);
    this.tools = {
      ...createNavigationTools(getActiveTab, getWindow),
      ...createInteractionTools(getActiveTab),
      ...createPlannerTools(this.broadcast.bind(this)),
      ...createExportTools(),
      ...diagnosticTools,
      list_tasks: integrationTools.list_tasks,
      list_groups: integrationTools.list_groups,
    };

    this.logInitializationStatus();
  }

  setWindow(window: Window): void {
    this.window = window;
  }

  /** Register an additional webContents to receive IPC broadcasts (e.g. chat page tabs). */
  addBroadcastTarget(wc: WebContents): void {
    this.extraWebContents.add(wc);
    wc.on("destroyed", () => this.extraWebContents.delete(wc));
  }

  /** Remove a broadcast target. */
  removeBroadcastTarget(wc: WebContents): void {
    this.extraWebContents.delete(wc);
  }

  /** Send an IPC message to the sidebar AND all registered broadcast targets. */
  private broadcast(channel: string, ...args: any[]): void {
    try { this.webContents.send(channel, ...args); } catch (e: any) {
      if (!e?.message?.includes('destroyed')) console.warn(`broadcast(${channel}) failed:`, e);
    }
    for (const wc of this.extraWebContents) {
      try { wc.send(channel, ...args); } catch (e: any) {
        if (!e?.message?.includes('destroyed')) console.warn(`broadcast(${channel}) to extra target failed:`, e);
      }
    }
  }

  reconfigure(provider: string, model: string, apiKey: string): void {
    const validProvider = (provider === "anthropic" ? "anthropic" : "openai") as LLMProvider;
    this.provider = validProvider;
    this.modelName = model || DEFAULT_MODELS[validProvider];
    this.userOverrideModel = !!model;

    if (validProvider === "anthropic") {
      process.env.ANTHROPIC_API_KEY = apiKey;
    } else {
      process.env.OPENAI_API_KEY = apiKey;
    }

    this.model = this.initializeModel();
    this.logInitializationStatus();
  }

  clearMessages(): void {
    this.messages = [];
    this.findingsStore.clear();
    this.lastScreenshotUrl = null;
    this.lastScreenshotData = null;
    this.lastPageTextUrl = null;
    this.lastPageText = null;
    this.sendMessagesToRenderer();
  }

  getMessages(): CoreMessage[] {
    return this.messages;
  }

  getContextLimit(): number | null {
    if (MODEL_CONTEXT_LIMITS[this.modelName]) {
      return MODEL_CONTEXT_LIMITS[this.modelName];
    }
    for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
      if (this.modelName.startsWith(key)) return limit;
    }
    return null;
  }

  getModelForTier(tier: ModelTier): LanguageModel {
    if (this.userOverrideModel) return this.model!;
    const modelName = MODEL_TIERS[this.provider][tier];
    console.log(`🔄 Model tier "${tier}" → ${modelName}`);
    return getModel(this.provider, modelName);
  }

  getModelNameForTier(tier: ModelTier): string {
    if (this.userOverrideModel) return this.modelName;
    return MODEL_TIERS[this.provider][tier];
  }

  // --- Chat entry point ---

  async sendChatMessage(request: ChatRequest): Promise<void> {
    const abortController = new AbortController();
    this.currentAbortController = abortController;

    try {
      this.currentMessageId = request.messageId;
      const screenshot = await this.captureScreenshot();
      const userMessage = this.buildUserMessage(request.message, screenshot);
      this.messages.push(userMessage);
      this.sendMessagesToRenderer();

      if (!this.model) {
        this.sendError(request.messageId, "LLM service is not configured. Please add your API key to the .env file.");
        return;
      }

      const messages = await this.prepareMessagesWithContext(request);
      this.compactIfNeeded();

      const agent = this.createMainAgent(messages[0].content as string, request.messageId);
      const result = await agent.stream({ messages: messages.slice(1), abortSignal: abortController.signal });

      // Insert placeholder assistant message
      const messageIndex = this.messages.length;
      this.messages.push({ role: "assistant", content: "" });

      await processFullStream(
        result.fullStream,
        request.messageId,
        this.broadcast.bind(this),
        this.messages,
        messageIndex,
        () => this.sendMessagesToRenderer(),
        this.findingsStore,
      );

      // Emit token usage after stream completes
      this.emitTokenUsage(request.messageId, result);
    } catch (error) {
      if (abortController.signal.aborted) {
        console.log("🛑 Chat request cancelled by user");
        this.broadcast("chat-response", { messageId: request.messageId, content: "", isComplete: true, cancelled: true });
        return;
      }
      console.error("Error in LLM request:", error);
      this.handleStreamError(error, request.messageId);
    } finally {
      this.currentAbortController = null;
    }
  }

  cancelCurrentRequest(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  // --- Private: Model initialization ---

  private getProvider(): LLMProvider {
    const provider = process.env.LLM_PROVIDER?.toLowerCase();
    return provider === "anthropic" ? "anthropic" : "openai";
  }

  private getModelName(): string {
    return process.env.LLM_MODEL || DEFAULT_MODELS[this.provider];
  }

  private initializeModel(): LanguageModel | null {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;
    return withLogging(getModel(this.provider, this.modelName));
  }

  private getApiKey(): string | undefined {
    return this.provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY;
  }

  private logInitializationStatus(): void {
    if (this.model) {
      console.log(`✅ LLM Client initialized with ${this.provider} provider using model: ${this.modelName}`);
    } else {
      const keyName = this.provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
      console.error(
        `❌ LLM Client initialization failed: ${keyName} not found in environment variables.\n` +
        `Please add your API key to the .env file in the project root.`
      );
    }
  }

  // --- Private: Message building ---

  private async captureScreenshot(): Promise<string | null> {
    if (!this.window) return null;
    const activeTab = this.window.activeTab;
    if (!activeTab) return null;

    const currentUrl = activeTab.url;

    // Reuse cached screenshot if page URL hasn't changed (saves ~1K+ tokens per message)
    if (currentUrl && currentUrl === this.lastScreenshotUrl && this.lastScreenshotData) {
      console.log("📸 Reusing cached screenshot (same URL)");
      return this.lastScreenshotData;
    }

    try {
      const screenshot = await activeTab.screenshotCompressed();
      if (screenshot && currentUrl) {
        this.lastScreenshotUrl = currentUrl;
        this.lastScreenshotData = screenshot;
      }
      return screenshot;
    } catch (error) {
      console.error("Failed to capture screenshot:", error);
      return null;
    }
  }

  private buildUserMessage(text: string, screenshot: string | null): CoreMessage {
    if (!screenshot) return { role: "user", content: text };
    return {
      role: "user",
      content: [
        { type: "image", image: screenshot },
        { type: "text", text },
      ],
    };
  }

  private async prepareMessagesWithContext(request: ChatRequest): Promise<CoreMessage[]> {
    let pageUrl: string | null = null;
    let pageText: string | null = null;

    if (this.window) {
      const activeTab = this.window.activeTab;
      if (activeTab) {
        pageUrl = activeTab.url;

        // Reuse cached page text if URL hasn't changed (saves expensive DOM extraction)
        if (pageUrl && pageUrl === this.lastPageTextUrl && this.lastPageText) {
          pageText = this.lastPageText;
          console.log("📄 Reusing cached page text (same URL)");
        } else {
          try {
            pageText = await activeTab.getTabText();
            if (pageText && pageUrl) {
              this.lastPageTextUrl = pageUrl;
              this.lastPageText = pageText;
            }
          } catch (error) {
            console.error("Failed to get page text:", error);
          }
        }
      }
    }

    const systemMessage: CoreMessage = {
      role: "system",
      content: this.buildSystemPrompt(pageUrl, pageText, request.verbosity || "normal"),
    };

    return [systemMessage, ...this.messages];
  }

  private buildSystemPrompt(url: string | null, pageText: string | null, verbosity: string = "normal"): string {
    return buildSystemPrompt(url, pageText, verbosity);
  }

  // --- Private: Agent creation ---

  private createMainAgent(system: string, messageId: string): Agent<any, any> {
    const isReasoning = isReasoningModelName(this.modelName);
    const getActiveTab = () => this.window?.activeTab ?? null;
    const getWindow = () => this.window;
    const getModelForTier = (tier: ModelTier) => this.getModelForTier(tier);
    const getAbortSignal = () => this.currentAbortController?.signal;

    const agentOpts: any = {
      model: this.model!,
      instructions: system,
      tools: {
        ...this.tools,
        run_specialized_task: createSubagentTool(getModelForTier, getActiveTab, getWindow, this.broadcast.bind(this), () => this.currentMessageId, getAbortSignal, (tier: ModelTier) => this.getModelNameForTier(tier)),
        run_parallel_tasks: createParallelTasksTool(getModelForTier, getWindow, this.broadcast.bind(this), 0, getAbortSignal, (tier: ModelTier) => this.getModelNameForTier(tier)),
      },
      stopWhen: [stepCountIs(MAX_TOOL_STEPS), tokenBudgetExceeded(TOKEN_BUDGET_PER_REQUEST)],
      maxRetries: MAX_RETRIES,
      timeout: { stepMs: STEP_TIMEOUT_MS, totalMs: TOTAL_TIMEOUT_MS },
      prepareStep: this.createPrepareStep(),
      onStepFinish: this.createOnStepFinish(messageId),
      // NOTE: experimental_onToolCallStart, experimental_onToolCallFinish, onFinish, onAbort
      // are NOT part of AgentSettings in AI SDK v5 — silently ignored by the Agent class.
      // Main agent tool calls are captured via fullStream processing in streamProcessor.ts.
    };
    if (!isReasoning) agentOpts.temperature = DEFAULT_TEMPERATURE;
    return new Agent(agentOpts);
  }

  private createPrepareStep() {
    return ({ stepNumber, messages }: { stepNumber: number; messages: any[] }) => {
      const limit = this.getContextLimit();
      if (!limit) return {};

      // Inject findings summary into system message
      const findingsSummary = this.findingsStore.getSummary();

      // Strip images from all but last 2 messages to save context
      // IMPORTANT: Only strip image parts — preserve tool-call and tool-result parts
      // to maintain the tool call chain that OpenAI requires
      const cleaned = messages.map((msg: any, i: number) => {
        if (i >= messages.length - 2) return msg;
        if (Array.isArray(msg.content)) {
          const withoutImages = msg.content.filter((p: any) => p.type !== "image");
          if (withoutImages.length < msg.content.length) {
            return withoutImages.length ? { ...msg, content: withoutImages } : msg;
          }
        }
        return msg;
      });

      const estimatedTokens = cleaned.reduce((sum: number, msg: any) => {
        const content = typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
        return sum + Math.ceil(content.length / TOKEN_ESTIMATE_DIVISOR);
      }, 0);

      if (estimatedTokens > limit * COMPACTION_THRESHOLD) {
        const systemMsg = cleaned[0];

        // Find safe trim boundary — don't split tool-call/tool-result pairs.
        // Walk backward from the trim point to ensure we don't leave orphaned tool results.
        let trimEnd = cleaned.length - COMPACTION_KEEP_RECENT;
        // If the first "recent" message is a tool-result referencing a tool-call in trimmed,
        // pull it into the recent section by moving trimEnd back
        while (trimEnd > 1) {
          const msg = cleaned[trimEnd];
          if (!msg || !Array.isArray(msg.content)) break;
          const hasToolResult = msg.content.some((p: any) => p.type === "tool-result");
          if (!hasToolResult) break;
          // This message has tool results — check if prior message has matching tool calls
          const prior = cleaned[trimEnd - 1];
          if (prior && Array.isArray(prior.content) && prior.content.some((p: any) => p.type === "tool-call")) {
            trimEnd--; // Include the tool-call message in recent
          } else {
            break;
          }
        }

        const trimmed = cleaned.slice(1, trimEnd);
        const recent = cleaned.slice(trimEnd);

        // Extract tool call summaries from trimmed messages to preserve continuity
        const toolHistory: string[] = [];
        for (const msg of trimmed) {
          if (Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (part.type === "tool-result" && part.toolName) {
                const output = typeof part.result === "string"
                  ? part.result.slice(0, 80)
                  : JSON.stringify(part.result)?.slice(0, 80) || "";
                toolHistory.push(`${part.toolName}: ${output}`);
              }
            }
          }
        }

        const summaryContent = toolHistory.length > 0
          ? `[Earlier context trimmed. Tools already used: ${toolHistory.join("; ")}]`
          : "[Earlier context trimmed for context limit]";

        const compactedSystemMsg = findingsSummary && systemMsg.role === 'system'
          ? { ...systemMsg, content: systemMsg.content + '\n\n' + findingsSummary }
          : systemMsg;

        return {
          messages: [
            compactedSystemMsg,
            { role: "assistant" as const, content: summaryContent },
            ...recent,
          ],
        };
      }

      // Inject findings summary into system message
      if (findingsSummary && cleaned.length > 0 && cleaned[0].role === 'system') {
        cleaned[0] = { ...cleaned[0], content: cleaned[0].content + '\n\n' + findingsSummary };
      }

      // After ADAPTIVE_STEP_THRESHOLD steps, downgrade to fast tier to save tokens on tool loops
      if (stepNumber > ADAPTIVE_STEP_THRESHOLD && !this.userOverrideModel) {
        console.log(`⚡ Step ${stepNumber} > ${ADAPTIVE_STEP_THRESHOLD}: switching to fast model for tool loop`);
        return { messages: cleaned, model: this.getModelForTier("fast") };
      }

      return { messages: cleaned };
    };
  }

  private createOnStepFinish(messageId: string) {
    return (event: { stepNumber: number; usage: any; toolCalls: any[]; finishReason: string }) => {
      const toolCalls = event.toolCalls || [];
      for (const tc of toolCalls) {
        console.log(`🔧 Tool completed: ${tc.toolName}`);
        this.broadcast("audit-tool-progress", {
          messageId,
          toolName: tc.toolName,
          status: "complete",
        });
      }
      // Emit step-level progress
      this.broadcast("step-progress", {
        messageId,
        stepNumber: event.stepNumber,
        toolCalls: toolCalls.map((tc: any) => tc.toolName),
        usage: event.usage,
      });
    };
  }

  // --- Private: Compaction ---

  private compactIfNeeded(): void {
    const limit = this.getContextLimit();
    if (!limit || this.messages.length <= COMPACTION_KEEP_RECENT) return;

    const estimatedTokens = this.messages.reduce((sum, msg) => {
      const content = typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
      return sum + Math.ceil(content.length / TOKEN_ESTIMATE_DIVISOR);
    }, 0);

    if (estimatedTokens < limit * COMPACTION_THRESHOLD) return;

    console.log(`🗜️ Compacting context: ~${estimatedTokens} tokens (limit: ${limit})`);

    // Find safe trim boundary — don't orphan tool results from their tool calls
    let keepStart = this.messages.length - COMPACTION_KEEP_RECENT;
    while (keepStart > 1) {
      const msg = this.messages[keepStart];
      if (!msg || !Array.isArray(msg.content)) break;
      const hasToolResult = (msg.content as any[]).some((p: any) => p.type === "tool-result");
      if (!hasToolResult) break;
      const prior = this.messages[keepStart - 1];
      if (prior && Array.isArray(prior.content) && (prior.content as any[]).some((p: any) => p.type === "tool-call")) {
        keepStart--;
      } else {
        break;
      }
    }
    const toCompact = this.messages.slice(0, keepStart);
    const toKeep = this.messages.slice(keepStart);

    const summaryParts: string[] = [];
    const toolSummaries: string[] = [];

    for (const msg of toCompact) {
      if (msg.role === "user") {
        const text = typeof msg.content === "string"
          ? msg.content
          : (msg.content as any[]).find((p: any) => p.type === "text")?.text || "";
        if (text) {
          summaryParts.push(`User: "${text.slice(0, 120)}${text.length > 120 ? "..." : ""}"`);
        }
      } else if (msg.role === "assistant") {
        const text = typeof msg.content === "string"
          ? msg.content
          : (msg.content as any[]).find((p: any) => p.type === "text")?.text || "";
        if (text) {
          summaryParts.push(`Assistant: "${text.slice(0, 120)}${text.length > 120 ? "..." : ""}"`);
        }
        // Extract tool-call results from content array (AI SDK stores them there)
        if (Array.isArray(msg.content)) {
          for (const part of msg.content as any[]) {
            if (part.type === "tool-result" && part.toolName) {
              const output = typeof part.result === "string"
                ? part.result.slice(0, 100)
                : JSON.stringify(part.result)?.slice(0, 100) || "";
              toolSummaries.push(`${part.toolName}: ${output}`);
            }
          }
        }
      }
    }

    const parts = [`[Earlier conversation summary: ${summaryParts.join(". ")}]`];
    if (toolSummaries.length > 0) {
      parts.push(`[Tool results from earlier: ${toolSummaries.join("; ")}]`);
    }

    const summaryMessage: CoreMessage = {
      role: "assistant",
      content: parts.join("\n"),
    };

    this.messages = [summaryMessage, ...toKeep];
    this.sendMessagesToRenderer();

    // Estimate remaining tokens and reset the UI progress bar
    const remainingTokens = this.messages.reduce((sum, msg) => {
      const content = typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
      return sum + Math.ceil(content.length / TOKEN_ESTIMATE_DIVISOR);
    }, 0);
    this.broadcast("token-usage", {
      messageId: "compaction",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      contextLimit: limit,
      modelName: this.modelName,
      resetTotal: remainingTokens,
    });

    console.log(`🗜️ Compacted ${toCompact.length} messages → ${this.messages.length} remaining (~${remainingTokens} tokens)`);
  }

  // --- Private: Token usage ---

  private async emitTokenUsage(messageId: string, streamResult: any): Promise<void> {
    try {
      const usage = await streamResult.totalUsage;
      if (usage) {
        const promptTokens = usage.inputTokens || usage.promptTokens || 0;
        const completionTokens = usage.outputTokens || usage.completionTokens || 0;
        const totalTokens = usage.totalTokens || (promptTokens + completionTokens);
        console.log(`📊 Token usage: prompt=${promptTokens}, completion=${completionTokens}, total=${totalTokens}`);
        this.broadcast("token-usage", {
          messageId,
          inputTokens: promptTokens,
          outputTokens: completionTokens,
          totalTokens,
          contextLimit: this.getContextLimit(),
          modelName: this.modelName,
        });
      }
    } catch (err) {
      console.warn("Token usage not available:", err);
    }
  }

  // --- Private: IPC helpers ---

  private sendMessagesToRenderer(): void {
    this.broadcast("chat-messages-updated", this.messages);
  }

  private sendError(messageId: string, message: string): void {
    this.broadcast("chat-response", { messageId, content: message, isComplete: true });
  }

  private handleStreamError(error: unknown, messageId: string): void {
    console.error("Error streaming from LLM:", error);
    this.sendError(messageId, this.getErrorMessage(error));
  }

  private getErrorMessage(error: unknown): string {
    return getErrorMessage(error);
  }
}
