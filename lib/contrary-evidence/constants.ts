/** Maximum characters for the contrary-evidence gate block injected into Call B. */
export const GATE_PROMPT_MAX_CHARS = 12_000;

/** Universal Contrary-Evidence Gate version persisted on reviews. */
export const CONTRARY_EVIDENCE_GATE_VERSION = "STORYDNA_CONTRARY_EVIDENCE_GATE_V2A";

/** Maximum total deduction points allowed per normalized root issue across all categories. */
export const DEFAULT_ROOT_ISSUE_DEDUCTION_CAP = 4;

/** Maximum categories that may carry separate penalties for the same root issue without justification. */
export const DEFAULT_ROOT_ISSUE_CATEGORY_CAP = 2;

/** Re-export positive-evidence ceiling fractions (configurable, tested). */
export {
  POSITIVE_EVIDENCE_CEILING_FRACTION,
  type PositiveEvidenceStrength,
} from "./positive-evidence-ceiling.ts";
