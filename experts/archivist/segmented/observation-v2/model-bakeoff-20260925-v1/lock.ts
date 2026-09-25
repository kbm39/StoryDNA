/**
 * Isolated Haiku 4.5 vs Opus 5.5 Phase 2 bake-off lock.
 * Session: archivist-v2-model-bakeoff-20260925-v1
 * Not wired to the paid live path. Does not rewrite official scores.
 */

export const V2_MODEL_BAKEOFF_SESSION_ID = "archivist-v2-model-bakeoff-20260925-v1" as const;
export const V2_MODEL_BAKEOFF_PROMPT = "archivist_v2_extraction_prompt@v2" as const;
export const V2_MODEL_BAKEOFF_SCHEMA = "archivist_segment_observation@v2" as const;
export const V2_MODEL_BAKEOFF_ADAPTER = "archivist_v2_compact_adapter@v1" as const;
export const V2_MODEL_BAKEOFF_STATUS = "experimental_candidate" as const;
export const V2_MODEL_BAKEOFF_WIRED_TO_PAID_PATH = false;
export const V2_MODEL_BAKEOFF_MAX_PRIMARY_CALLS = 8 as const;
export const V2_MODEL_BAKEOFF_MAX_REPAIR_CALLS = 0 as const;
export const V2_MODEL_BAKEOFF_MAX_TOKENS = 4000 as const;
export const V2_MODEL_BAKEOFF_CEILING_USD = 0.6 as const;
export const V2_MODEL_BAKEOFF_PROVIDER = "anthropic" as const;
export const V2_MODEL_BAKEOFF_HAIKU_MODEL = "claude-haiku-4-5-20251001" as const;
export const V2_MODEL_BAKEOFF_OPUS_MODEL = "claude-opus-5-5" as const;
export const V2_MODEL_BAKEOFF_OPUS_EFFORT = "medium" as const;
export const V2_MODEL_BAKEOFF_FALLBACK_USED = false;
export const V2_MODEL_BAKEOFF_HAIKU_INPUT_USD_PER_MTOK = 1 as const;
export const V2_MODEL_BAKEOFF_HAIKU_OUTPUT_USD_PER_MTOK = 5 as const;
export const V2_MODEL_BAKEOFF_OPUS_INPUT_USD_PER_MTOK = 4 as const;
export const V2_MODEL_BAKEOFF_OPUS_OUTPUT_USD_PER_MTOK = 20 as const;
export const V2_MODEL_BAKEOFF_SYNTHETIC_SEGMENT_ID = "seg-v2-phase2-synthetic-stress" as const;

export const V2_MODEL_BAKEOFF_ORDER = [
  { scenario: "synthetic", arm: "haiku" },
  { scenario: "synthetic", arm: "opus" },
  { scenario: "R8-001", arm: "haiku" },
  { scenario: "R8-001", arm: "opus" },
  { scenario: "R8-016", arm: "haiku" },
  { scenario: "R8-016", arm: "opus" },
  { scenario: "R8-011", arm: "haiku" },
  { scenario: "R8-011", arm: "opus" },
] as const;

export const V2_MODEL_BAKEOFF_FROZEN_WINDOW_HASHES = {
  "R8-001": "451932e1277213bd12b35e727bc69d9ec7e3807d9e7344b474b8128de4eaa4d0",
  "R8-016": "30cc7bcfadad1ea5140203a5e33250c522a2b029bc961728b43c24cdfb3daa3e",
  "R8-011": "b88c28e12bc80b95b48c84bbb1cfc5e0dece87caccd9c20b04e95782bbcb3a90",
} as const;
