import type { ConcernStatus, SameVersionStatus } from "./types.ts";

/** Map revision concern status to allowed max deduction contract text. */
export function gateStatusDeductionContract(status: ConcernStatus, priorDeduction: number): string {
  switch (status) {
    case "RESOLVED":
    case "STALE_CRITIQUE":
      return "deduction MUST be 0";
    case "SUBSTANTIALLY_IMPROVED":
      return `max remaining deduction ${Math.max(0, Math.round(priorDeduction * 0.25 * 100) / 100)} (25% of prior)`;
    case "PARTIALLY_IMPROVED":
      return `max remaining deduction ${Math.max(0, Math.round(priorDeduction * 0.5 * 100) / 100)} (50% of prior); criticism MUST be narrowed`;
    case "UNCHANGED":
      return `may retain up to ${priorDeduction} ONLY with current manuscript evidence`;
    case "WORSENED":
      return `may increase slightly ONLY with new current evidence`;
    case "NOT_ASSESSABLE":
      return "no carry-forward; new deduction requires independent current evidence";
    default:
      return "follow gate assessment";
  }
}

/** Same-version reassessment contract for Call B prompt. */
export function sameVersionStatusDeductionContract(status: SameVersionStatus): string {
  switch (status) {
    case "SUPPORTED":
      return "may retain prior deduction ONLY with current supporting evidence";
    case "UNSUPPORTED":
      return "deduction MUST be 0 — no locatable evidence in this version";
    case "OVERBROAD":
      return "narrow finding and cap deduction (~50% of prior)";
    case "DUPLICATED":
      return "deduction MUST be 0 — duplicate root issue";
    case "NOT_ASSESSABLE":
      return "no carry-forward without new evidence";
    default:
      return "follow same-version assessment";
  }
}
