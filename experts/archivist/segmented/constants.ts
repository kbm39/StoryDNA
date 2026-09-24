/**
 * Segmented full-novel Archivist architecture constants.
 * Does not authorize a paid run or enable live/runtime/Studio gates.
 */

export const ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA =
  "archivist_segment_observation@v1" as const;

export const ARCHIVIST_SEGMENT_CONTRACT_VERSION =
  "archivist_segment_observation@v1" as const;

export const ARCHIVIST_BOOK_GRAPH_SCHEMA = "archivist_book_graph@v1" as const;

export const ARCHIVIST_COVERAGE_REPORT_SCHEMA =
  "archivist_full_novel_coverage@v1" as const;

export const ARCHIVIST_RECONCILIATION_SCHEMA =
  "archivist_global_reconciliation@v1" as const;

export const ARCHIVIST_SEGMENTED_PLANNER_VERSION =
  "archivist_segment_planner@v1" as const;

export const CERTIFIED_ARCHIVIST_PROVIDER = "anthropic" as const;

export const CERTIFIED_ARCHIVIST_MODEL = "claude-haiku-4-5-20251001" as const;

export const EXPECTED_RECKONING_UNIT_COUNT = 30 as const;

export const EXPECTED_RECKONING_CHAPTER_COUNT = 29 as const;

/** Soft target for observation-call manuscript words. Not a segment-count invariant. */
export const SEGMENT_TARGET_WORD_MIN = 8_000;
export const SEGMENT_TARGET_WORD_MAX = 12_000;
export const SEGMENT_TARGET_WORD_PREFERRED = 10_000;

/** Hard manuscript-word budget for one observation call before intra-chapter split. */
export const SEGMENT_MAX_MANUSCRIPT_WORDS = 12_000;

/** Manuscript-token budget equivalent (~1.35 tokens/word + prompt headroom). */
export const SEGMENT_MAX_INPUT_TOKENS = 20_000;

export const SEGMENT_PROMPT_OVERHEAD_TOKENS = 3_500;

export const TOKENS_PER_MANUSCRIPT_WORD = 1.35;

export const STRUCTURAL_OVERLAP_UNIT_WORD_CAP = 4_000;

export const STRUCTURAL_OVERLAP_FALLBACK_WORDS = 1_200;

export const RECONCILIATION_MAX_BATCH_SIZE = 8;

export const SEGMENT_REPAIR_ALLOWANCE = 1;

export const HAIKU_INPUT_USD_PER_MTOK = 1;
export const HAIKU_OUTPUT_USD_PER_MTOK = 5;

export const SEGMENTED_CALL_ROLES = [
  "segment_observation",
  "segment_repair",
  "global_reconciliation",
  "global_repair",
] as const;

export type SegmentedCallRole = (typeof SEGMENTED_CALL_ROLES)[number];

export const CHECKPOINT_STATES = ["pending", "running", "validated", "failed"] as const;

export type SegmentCheckpointState = (typeof CHECKPOINT_STATES)[number];

export const CHAPTER_WORD_NAMES = [
  "ONE",
  "TWO",
  "THREE",
  "FOUR",
  "FIVE",
  "SIX",
  "SEVEN",
  "EIGHT",
  "NINE",
  "TEN",
  "ELEVEN",
  "TWELVE",
  "THIRTEEN",
  "FOURTEEN",
  "FIFTEEN",
  "SIXTEEN",
  "SEVENTEEN",
  "EIGHTEEN",
  "NINETEEN",
  "TWENTY",
  "TWENTY-ONE",
  "TWENTY-TWO",
  "TWENTY-THREE",
  "TWENTY-FOUR",
  "TWENTY-FIVE",
  "TWENTY-SIX",
  "TWENTY-SEVEN",
  "TWENTY-EIGHT",
  "TWENTY-NINE",
] as const;
