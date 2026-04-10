import type { LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import type { LLMProvider } from "../config/models";

type ProviderFn = (modelName: string) => LanguageModel;

const providers: Record<LLMProvider, ProviderFn> = {
  openai: (model) => openai(model),
  anthropic: (model) => anthropic(model),
};

export function getModel(provider: LLMProvider, modelName: string): LanguageModel {
  const providerFn = providers[provider];
  if (!providerFn) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  return providerFn(modelName);
}
