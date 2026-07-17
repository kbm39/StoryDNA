import type { InternalPhase } from "./types.ts";

/** Author-facing Publishing Workflow phase labels — no percentages or fake ETAs. */
export const AUTHOR_PHASE_LABELS: Record<InternalPhase, string> = {
  validating: "Checking your manuscript",
  preparing: "Preparing the manuscript",
  memo_generation: "Reading the manuscript",
  memo_repair: "Developing the assessment",
  contrary_evidence: "Checking the findings",
  rubric_generation: "Developing the assessment",
  rubric_validation: "Checking the findings",
  revision_candidates: "Developing the assessment",
  publishing: "Preparing your results",
  completed: "Complete",
};

export function authorPhaseLabel(phase: InternalPhase | null | undefined): string {
  if (!phase) return "Publishing Workflow";
  return AUTHOR_PHASE_LABELS[phase] ?? "Publishing Workflow";
}

export function workflowDisplayName(workflowType: string): string {
  if (workflowType === "literary_agent_review") return "Literary Agent Review";
  return "Publishing Workflow";
}
