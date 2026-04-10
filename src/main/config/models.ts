export type LLMProvider = "openai" | "anthropic";

export type ModelTier = "fast" | "standard" | "reasoning";

export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-sonnet-4-20250514",
};

export const MODEL_TIERS: Record<LLMProvider, Record<ModelTier, string>> = {
  openai: {
    fast: "gpt-5.4-nano",
    standard: "gpt-5.4-mini",
    reasoning: "gpt-5.4",
  },
  anthropic: {
    fast: "claude-haiku-4-5-20251001",
    standard: "claude-sonnet-4-20250514",
    reasoning: "claude-opus-4-6",
  },
};

export const REASONING_MODELS = [
  "o1", "o1-mini", "o1-preview", "o3", "o3-mini", "o4-mini",
  "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano",
  "claude-sonnet-4-5", "claude-opus-4",
];

/** Check if a model name is a reasoning model (doesn't support temperature). */
export function isReasoningModelName(name: string): boolean {
  const lower = name.toLowerCase();
  // Exact match first to avoid "gpt-5.4" matching "gpt-5.4-mini"
  return REASONING_MODELS.some(m => lower === m.toLowerCase() || lower.startsWith(m.toLowerCase() + "-"));
}

export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // OpenAI
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,
  "gpt-4-turbo": 128_000,
  "gpt-4": 8_192,
  "gpt-3.5-turbo": 16_385,
  "gpt-5.4-nano": 400_000,
  "gpt-5.4-mini": 400_000,
  "gpt-5.4": 400_000,
  "o1": 200_000,
  "o1-mini": 128_000,
  "o1-preview": 128_000,
  "o3": 200_000,
  "o3-mini": 200_000,
  "o4-mini": 200_000,
  // Anthropic
  "claude-3-5-sonnet-20241022": 200_000,
  "claude-3-5-haiku-20241022": 200_000,
  "claude-3-opus-20240229": 200_000,
  "claude-sonnet-4-5-20250929": 200_000,
  "claude-opus-4-6": 1_000_000,
  "claude-sonnet-4-6": 1_000_000,
  "claude-opus-4-20250514": 200_000,
  "claude-sonnet-4-20250514": 200_000,
  "claude-haiku-4-5-20251001": 200_000,
  "gpt-4.1": 1_000_000,
  "gpt-4.1-mini": 1_000_000,
  "gpt-4.1-nano": 1_000_000,
};

export const MAX_CONTEXT_LENGTH = 4000;
export const MAX_TOOL_STEPS = 20;
export const TOKEN_BUDGET_PER_REQUEST = 100_000;
export const COMPACTION_THRESHOLD = 0.7;
export const COMPACTION_KEEP_RECENT = 4;
export const DEFAULT_TEMPERATURE = 0;
export const MAX_RETRIES = 3;
export const ADAPTIVE_STEP_THRESHOLD = 5;

export const VERBOSITY_PROMPTS: Record<string, string> = {
  concise: "\n\n## Response Style\nBe extremely concise. Use short sentences, bullet points, and minimal explanation. No filler.",
  normal: "",
  detailed: "\n\n## Response Style\nProvide thorough, detailed explanations. Include examples, reasoning, and comprehensive coverage.",
};
