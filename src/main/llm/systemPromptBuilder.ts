import { MAIN_AGENT_PROMPT_PARTS } from "../config/agents";
import { MAX_CONTEXT_LENGTH, VERBOSITY_PROMPTS } from "../config/models";

export const buildSystemPrompt = (
  url: string | null,
  pageText: string | null,
  verbosity: string = "normal",
  diagnosticsSummary?: string,
): string => {
  const p = MAIN_AGENT_PROMPT_PARTS;
  const parts: string[] = [
    ...p.intro,
    "",
    ...p.capabilities,
    "",
    ...p.delegation,
    "",
    ...p.parallelDelegation,
    "",
    ...p.decisionMatrix,
    "",
    ...p.guidelines,
  ];

  if (url) {
    parts.push(`\nCurrent page URL: ${url}`);
  }

  if (pageText) {
    const truncated =
      pageText.length > MAX_CONTEXT_LENGTH
        ? pageText.substring(0, MAX_CONTEXT_LENGTH) + "..."
        : pageText;
    parts.push(`\nPage content (text):\n${truncated}`);
  }

  if (diagnosticsSummary) {
    parts.push(`\n## Active Diagnostics\n${diagnosticsSummary}`);
  }

  parts.push("", ...p.closing);

  const verbosityPrompt = VERBOSITY_PROMPTS[verbosity] || "";
  if (verbosityPrompt) {
    parts.push(verbosityPrompt);
  }

  return parts.join("\n");
};
