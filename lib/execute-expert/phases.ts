import {
  ARCHIVIST_WORKFLOW_PHASES,
  type ArchivistWorkflowPhase,
} from "./types.ts";

/** Author-facing Archivist phase labels — distinct from Literary Agent INTERNAL_PHASES. */
export const ARCHIVIST_PHASE_LABELS: Record<ArchivistWorkflowPhase, string> = {
  queued: "Queued",
  validating: "Checking manuscript identity",
  preparing: "Preparing continuity context",
  extract_observations: "Extracting observations",
  within_book_check: "Checking within-book continuity",
  series_canon_check: "Checking series canon",
  conflict_review: "Reviewing conflicts",
  publishing: "Preparing results",
  completed: "Complete",
};

export function archivistPhaseLabel(phase: ArchivistWorkflowPhase): string {
  return ARCHIVIST_PHASE_LABELS[phase];
}

export function phasesForExpert(expertKey: string): readonly string[] {
  if (expertKey === "archivist") return ARCHIVIST_WORKFLOW_PHASES;
  return [];
}
