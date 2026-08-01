/** Versioned contract: storydna_eic_independent_read@v1 */

export const EIC_INDEPENDENT_READ_CONTRACT_VERSION =
  "storydna_eic_independent_read@v1" as const;

export const INDEPENDENT_READ_STATUSES = [
  "not_started",
  "in_progress",
  "complete",
  "failed",
  "stale",
  "cancelled",
] as const;

export type IndependentReadStatus = (typeof INDEPENDENT_READ_STATUSES)[number];

/** Independent read is EIC orchestration metadata — not expert findings. */
export const INDEPENDENT_READ_IS_EXPERT_FINDING = false as const;
export const INDEPENDENT_READ_IS_MANUSCRIPT_EVIDENCE = false as const;

/** Minimum coverage before profile synthesis may proceed. */
export const MIN_INDEPENDENT_READ_COVERAGE_FOR_SYNTHESIS = 1 as const;
