import type { StudioEditorialTeamMember, StudioRoundtableShell } from "./types.ts";

/**
 * Roundtable shell — summarizes multi-expert editorial round.
 * NOT a review engine; display-only synthesis placeholder.
 */
export function buildRoundtableShell(input: {
  readonly team: readonly StudioEditorialTeamMember[];
  readonly issueCount: number;
  readonly candidateCount: number;
}): StudioRoundtableShell | null {
  const completed = input.team.filter((m) => m.runStatus === "completed");
  if (completed.length < 1) return null;

  const recruited = input.team.length;
  const waiting = input.team.filter((m) => m.runStatus === "waiting" || m.runStatus === "blocked").length;

  return Object.freeze({
    title: "Roundtable Discussion",
    subtitle: "Editorial synthesis across your recruited experts",
    agreement: completed.length > 0
      ? `${completed.length} expert review(s) completed with ${input.issueCount} issues identified.`
      : "No completed expert reviews yet.",
    disagreement:
      waiting > 0
        ? `${waiting} recruited expert(s) awaiting execution paths or review completion.`
        : "No outstanding expert disagreements surfaced in completed reviews.",
    priority: input.candidateCount > 0
      ? `Address ${input.candidateCount} revision candidate(s) on the Revision Board.`
      : "No revision candidates yet — launch a Literary Agent review first.",
    recommendedOrder: Object.freeze([
      "Literary Agent commercial positioning and revision priorities",
      "Developmental structure and pacing (when available)",
      "Line-level prose and dialogue (when available)",
      "Subject-matter realism experts (experimental, advisory only)",
    ]),
    consensus:
      recruited > 1
        ? "Multi-expert round in progress — Literary Agent provides the authoritative commercial review."
        : "Single-expert round — recruit additional specialists to broaden editorial coverage.",
    showShell: true,
  });
}
