/**
 * Phase 1 V2 remediaiton lock.
 * A0 truncated-prefix recovery + B0 evidence fixtures + C historical/held-out locks.
 * $0. No provider. No prompt change. Does not switch V2 live.
 */

export const V2_REMEDIATION_PHASE1_ID = "archivist-v2-remediation-phase1-20260925" as const;
export const V2_REMEDIATION_PHASE1_COST_USD = 0 as const;
export const V2_REMEDIATION_PHASE1_PROVIDER_CALLS = 0 as const;
export const V2_REMEDIATION_PHASE1_STATUS = "experimental_candidate" as const;
export const V2_REMEDIATION_PHASE1_WIRED_TO_PAID_PATH = false;
export const V2_REMEDIATION_PHASE1_PROMPT_CHANGED = false;
export const V2_REMEDIATION_PHASE1_EVIDENCE_GATE_CHANGED = false;

export const V2_REMEDIATION_PHASE1_CONSUMED_IDS = [
  "R8-001",
  "R8-007",
  "R8-010",
  "R8-011",
  "R8-012",
  "R8-016",
  "R8-023",
  "R8-025",
  "R8-029",
] as const;

export const V2_REMEDIATION_PHASE1_HELD_OUT_IDS = [
  "R8-004",
  "R8-005",
  "R8-006",
  "R8-013",
  "R8-014",
  "R8-015",
  "R8-018",
  "R8-019",
  "R8-020",
  "R8-021",
  "R8-026",
  "R8-027",
  "R8-031",
  "R8-038",
  "R8-042",
] as const;

export const V2_REMEDIATION_PHASE1_SUFFICIENT_NONREGRESSION_IDS = [
  "R8-007",
  "R8-016",
  "R8-023",
  "R8-025",
  "R8-029",
] as const;

export const V2_REMEDIATION_PHASE1_IMPLEMENTATION_SHA =
  "c55ffe2389cb457bfc806769872595e855ae061e" as const;
export const V2_REMEDIATION_PHASE1_BREADTH_FREEZE_SHA =
  "1cdcd57fddc0831484478a44e7d436fde4160274" as const;
