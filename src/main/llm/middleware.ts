import { wrapLanguageModel, type LanguageModel, type LanguageModelMiddleware } from "ai";

const loggingMiddleware: LanguageModelMiddleware = {
  transformParams: async ({ type, params, model }) => {
    const messageCount = params.prompt?.length || 0;
    const toolCount = params.tools?.length || 0;
    console.log(`📤 LLM ${type} request [${(model as any).modelId}]: ${messageCount} messages, ${toolCount} tools`);
    return params;
  },
  wrapGenerate: async ({ doGenerate, params }) => {
    const start = Date.now();
    const result = await doGenerate();
    const ms = Date.now() - start;
    console.log(`📥 LLM response: ${ms}ms, finish=${result.finishReason}`);
    return result;
  },
  wrapStream: async ({ doStream, params }) => {
    const start = Date.now();
    const result = await doStream();
    // Log when stream is initiated (not when it completes)
    console.log(`📥 LLM stream started: ${Date.now() - start}ms to first chunk`);
    return result;
  },
};

export function withLogging(model: LanguageModel): LanguageModel {
  return wrapLanguageModel({ model, middleware: loggingMiddleware });
}
