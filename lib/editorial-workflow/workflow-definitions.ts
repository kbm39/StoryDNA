import type { WorkflowType } from "./types.ts";

/** Generic row-level metadata — nullable in M1, populated per workflow type. */
export interface WorkflowRowMetadata {
  department: string | null;
  owner_type: string | null;
  owner_label: string | null;
  purpose: string | null;
  participating_experts: string[] | null;
  next_best_action: string | null;
}

export function workflowMetadataForType(workflowType: WorkflowType): WorkflowRowMetadata {
  switch (workflowType) {
    case "literary_agent_review":
      return {
        department: "Publishing",
        owner_type: "platform",
        owner_label: "StoryDNA",
        purpose:
          "Generate a Literary Agent commercial review and linked revision candidates for author review.",
        participating_experts: ["Literary Agent"],
        next_best_action: null,
      };
    default:
      return {
        department: null,
        owner_type: null,
        owner_label: null,
        purpose: null,
        participating_experts: null,
        next_best_action: null,
      };
  }
}

export function nextBestActionForCompletedWorkflow(workflowType: WorkflowType): string {
  switch (workflowType) {
    case "literary_agent_review":
      return "View your Literary Agent review in the Reviews section below.";
    default:
      return "Review your Publishing Workflow results.";
  }
}
