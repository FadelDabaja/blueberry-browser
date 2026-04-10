import type { StopCondition, ToolSet, StepResult } from "ai";

/**
 * Stop condition that triggers when cumulative token usage exceeds a budget.
 * Uses the `usage` field from each step result.
 */
export function tokenBudgetExceeded(maxTokens: number): StopCondition<any> {
  return ({ steps }: { steps: Array<StepResult<ToolSet>> }) => {
    const totalTokens = steps.reduce((sum, step) => {
      const usage = step.usage;
      if (!usage) return sum;
      return sum + (usage.totalTokens || ((usage as any).inputTokens || 0) + ((usage as any).outputTokens || 0));
    }, 0);
    return totalTokens >= maxTokens;
  };
}

/**
 * Stop condition based on estimated API cost (input tokens cheaper than output).
 * More accurate than flat token count for cost control.
 */
export function costBudgetExceeded(
  maxCostDollars: number,
  inputCostPer1M: number = 3.0,  // $3 per million input (claude-sonnet-4)
  outputCostPer1M: number = 15.0  // $15 per million output
): StopCondition<any> {
  return ({ steps }: { steps: Array<StepResult<ToolSet>> }) => {
    const totals = steps.reduce(
      (acc, step) => {
        const usage = step.usage;
        if (!usage) return acc;
        return {
          input: acc.input + (usage.inputTokens ?? 0),
          output: acc.output + (usage.outputTokens ?? 0),
        };
      },
      { input: 0, output: 0 }
    );

    const cost = (totals.input * inputCostPer1M / 1_000_000) +
                 (totals.output * outputCostPer1M / 1_000_000);

    return cost >= maxCostDollars;
  };
}
