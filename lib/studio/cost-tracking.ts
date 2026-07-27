import type { StudioCostSummary } from "./types.ts";

export function buildStudioCostSummary(input: {
  readonly workflowType: string;
}): StudioCostSummary {
  return Object.freeze({
    estimatedCost:
      input.workflowType === "literary_agent_review"
        ? "Varies by manuscript length"
        : "Unavailable",
    actualCost: null,
    runtime: null,
    tokens: null,
    provider: "anthropic",
    model: "Unavailable",
    costAvailable: false,
  });
}

export function formatCostField(value: string | number | null): string {
  if (value === null || value === undefined) return "Unavailable";
  return String(value);
}
