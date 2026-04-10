import { tool } from "ai";
import { z } from "zod";
import { ipcMain } from "electron";
import type { BroadcastFn } from "../llm/streamProcessor";

const pendingResolvers = new Map<string, (response: string) => void>();
let ipcListenerRegistered = false;

function ensureIpcListener(): void {
  if (ipcListenerRegistered) return;
  ipcListenerRegistered = true;

  ipcMain.on("ask-user-response", (_event, data: { questionId: string; response: string }) => {
    const resolver = pendingResolvers.get(data.questionId);
    if (resolver) {
      pendingResolvers.delete(data.questionId);
      resolver(data.response);
    }
  });
}

function waitForResponse(questionId: string, abortSignal?: AbortSignal): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new Error("Question cancelled"));
      return;
    }

    let settled = false;

    const cleanup = () => {
      settled = true;
      pendingResolvers.delete(questionId);
      if (abortSignal) abortSignal.removeEventListener("abort", abortHandler);
    };

    const abortHandler = () => {
      if (settled) return;
      cleanup();
      reject(new Error("Question cancelled"));
    };

    pendingResolvers.set(questionId, (response: string) => {
      if (settled) return;
      cleanup();
      resolve(response);
    });

    if (abortSignal) {
      abortSignal.addEventListener("abort", abortHandler);
    }

    // 5-minute timeout
    setTimeout(() => {
      if (settled) return;
      cleanup();
      resolve("(no response after 5 min timeout)");
    }, 300_000);
  });
}

export function createPlannerTools(broadcast: BroadcastFn) {
  ensureIpcListener();

  return {
    ask_user: tool({
      description:
        "Ask the user a question and wait for their response. Use this when you need clarification, want to offer choices, or need user input before proceeding. The question appears as an interactive card in the chat.",
      inputSchema: z.object({
        question: z.string().describe("The question to ask the user"),
        type: z
          .enum(["select", "multiselect", "freeform"])
          .describe("The type of input: select (single choice), multiselect (multiple choices), or freeform (text input)"),
        options: z
          .array(
            z.object({
              label: z.string().describe("Option label"),
              description: z.string().nullable().describe("Description for the option"),
            })
          )
          .nullable()
          .describe("Options for select/multiselect types. Null for freeform."),
        placeholder: z
          .string()
          .nullable()
          .describe("Placeholder text for freeform input. Null if not needed."),
      }),
      execute: async ({ question, type, options, placeholder }, { toolCallId, abortSignal }) => {
        try {
          broadcast("ask-user-question", {
            id: toolCallId,
            question,
            type,
            options: options || [],
            placeholder: placeholder || "",
          });
          return await waitForResponse(toolCallId, abortSignal);
        } catch (error) {
          pendingResolvers.delete(toolCallId);
          throw error;
        }
      },
    }),
  };
}
