/**
 * Isolated Opus 5.5 full-manuscript eval @v3 configuration.
 * Prompt @v4 + hard observation cap 16 + max_tokens 6000. Same 14-segment plan.
 * Not authorized to run. Does not overwrite eval @v1 or @v2. Not wired to public live.
 */

import { createHash } from "node:crypto";
import { RECKONING_REVISED_13_SOURCE_PIN } from "../../../reckoning-revised-13-source-pin.ts";
import { STAGING_SUPABASE_PROJECT_REF } from "../../paid-pilot-authorization.ts";
import { RECKONING_REVISED_13_SEGMENT_PLAN } from "../../reckoning-revised-13-segment-plan.ts";
import { ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2 } from "../constants.ts";
import { V2_PHASE2_HELD_OUT_IDS } from "../phase-2/index.ts";
import { V2_EXTRACTION_PROMPT_VERSION, V2_PROMPT_MAX_TOKENS } from "../prompt.ts";
import {
  V3_EXTRACTION_PROMPT_VERSION,
  V3_PROMPT_MAX_TOKENS,
} from "../prompt-v3.ts";
import {
  V4_EXTRACTION_PROMPT_VERSION,
  V4_OBSERVATION_HARD_CAP,
  V4_ORGANIZATION_AFFILIATION_MAPPING,
  V4_OUTPUT_ORDER_INSTRUCTION,
  V4_PROMPT_MAX_TOKENS,
  V4_PROMPT_SCHEMA_VERSION,
} from "../prompt-v4.ts";
import {
  OPUS_V2_EVAL_EFFORT,
  OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID,
  OPUS_V2_EVAL_ID,
  OPUS_V2_EVAL_MAX_TOKENS,
  OPUS_V2_EVAL_MODEL,
  OPUS_V2_EVAL_PROMPT_VERSION,
  OPUS_V2_EVAL_VERSION,
} from "../opus-v2-full-manuscript-eval/lock.ts";
import {
  OPUS_V2_EVAL_V2_ID,
  OPUS_V2_EVAL_V2_MAX_TOKENS,
  OPUS_V2_EVAL_V2_PROMPT_VERSION,
  OPUS_V2_EVAL_V2_VERSION,
} from "../opus-v2-full-manuscript-eval-v2/lock.ts";

export const OPUS_V2_EVAL_V3_ID = "archivist-opus-v2-full-manuscript-eval-v3" as const;
export const OPUS_V2_EVAL_V3_VERSION = "archivist_opus_v2_full_manuscript_eval@v3" as const;
export const OPUS_V2_EVAL_V3_WORKFLOW_KIND = "experimental_opus_v2_full_manuscript_eval" as const;
export const OPUS_V2_EVAL_V3_STATUS = "experimental_candidate" as const;
export const OPUS_V2_EVAL_V3_WIRED_TO_PAID_PATH = false;
export const OPUS_V2_EVAL_V3_WIRED_TO_PUBLIC_LIVE = false;
export const OPUS_V2_EVAL_V3_AUTHORIZED_TO_RUN = false;
export const OPUS_V2_EVAL_V3_PROVIDER_CALLS = 0 as const;
export const OPUS_V2_EVAL_V3_COST_USD = 0 as const;
export const OPUS_V2_EVAL_V3_SPEND_AUTHORIZED = false;
export const OPUS_V2_EVAL_V3_CEILING_AUTHORIZED = false;

export const OPUS_V2_EVAL_V3_PROVIDER = "anthropic" as const;
export const OPUS_V2_EVAL_V3_MODEL = "claude-opus-5-5" as const;
export const OPUS_V2_EVAL_V3_EFFORT = "medium" as const;
export const OPUS_V2_EVAL_V3_MAX_TOKENS = V4_PROMPT_MAX_TOKENS;
export const OPUS_V2_EVAL_V3_OBSERVATION_HARD_CAP = V4_OBSERVATION_HARD_CAP;
export const OPUS_V2_EVAL_V3_CACHE = "off" as const;
export const OPUS_V2_EVAL_V3_FALLBACK = "none" as const;
export const OPUS_V2_EVAL_V3_PROMPT_VERSION = V4_EXTRACTION_PROMPT_VERSION;
export const OPUS_V2_EVAL_V3_SCHEMA_VERSION = V4_PROMPT_SCHEMA_VERSION;
export const OPUS_V2_EVAL_V3_OUTPUT_ORDER = V4_OUTPUT_ORDER_INSTRUCTION;
export const OPUS_V2_EVAL_V3_ORGANIZATION_MAPPING = V4_ORGANIZATION_AFFILIATION_MAPPING;

export const OPUS_V2_EVAL_V3_STAGING_PROJECT_REF = STAGING_SUPABASE_PROJECT_REF;
export const OPUS_V2_EVAL_V3_HISTORICAL_REVISED_13_WORKFLOW_ID = OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID;
export const OPUS_V2_EVAL_V3_COMPLETED_OPUS_V1_WORKFLOW_ID =
  "8911acab-2ea0-44a7-b5ad-b677c57e185b" as const;
export const OPUS_V2_EVAL_V3_COMPLETED_OPUS_V2_WORKFLOW_ID =
  "b30594ca-c56f-4379-b40b-6a2349f259ed" as const;
export const OPUS_V2_EVAL_V3_CONSUMED_AUTHORIZATION_IDS = [
  "reckoning-revised-13-opus-v2-full-eval-20260925",
  "reckoning-revised-13-opus-v2-full-eval-v2-20260926",
] as const;
export const OPUS_V2_EVAL_V3_SUPERSEDED_RUNNER_VERSION = OPUS_V2_EVAL_V2_VERSION;
export const OPUS_V2_EVAL_V3_SUPERSEDED_RUNNER_ID = OPUS_V2_EVAL_V2_ID;

export const OPUS_V2_EVAL_V3_INPUT_USD_PER_MTOK = 4 as const;
export const OPUS_V2_EVAL_V3_OUTPUT_USD_PER_MTOK = 20 as const;
export const OPUS_V2_EVAL_V3_FUTURE_LOW_USD = 2.0 as const;
export const OPUS_V2_EVAL_V3_FUTURE_EXPECTED_USD_MIN = 2.6 as const;
export const OPUS_V2_EVAL_V3_FUTURE_EXPECTED_USD_MAX = 3.0 as const;
export const OPUS_V2_EVAL_V3_FUTURE_HIGH_USD_MIN = 3.2 as const;
export const OPUS_V2_EVAL_V3_FUTURE_HIGH_USD_MAX = 3.6 as const;
export const OPUS_V2_EVAL_V3_RECOMMENDED_HARD_CEILING_USD = 5 as const;

export const OPUS_V2_EVAL_V3_SOURCE_PIN = {
  manuscript_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_id,
  manuscript_version_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_version_id,
  content_hash: RECKONING_REVISED_13_SOURCE_PIN.content_hash,
  analytical_word_count: RECKONING_REVISED_13_SOURCE_PIN.analytical_word_count,
  plan_fingerprint: RECKONING_REVISED_13_SEGMENT_PLAN.plan_fingerprint,
} as const;

export const OPUS_V2_EVAL_V3_PLAN_FINGERPRINT_UNCHANGED =
  RECKONING_REVISED_13_SEGMENT_PLAN.plan_fingerprint;

export const OPUS_V2_EVAL_V3_EXECUTION_FINGERPRINT = createHash("sha256")
  .update(
    JSON.stringify({
      runner_id: OPUS_V2_EVAL_V3_ID,
      runner_version: OPUS_V2_EVAL_V3_VERSION,
      prompt_version: OPUS_V2_EVAL_V3_PROMPT_VERSION,
      schema_version: OPUS_V2_EVAL_V3_SCHEMA_VERSION,
      max_tokens: OPUS_V2_EVAL_V3_MAX_TOKENS,
      observation_hard_cap: OPUS_V2_EVAL_V3_OBSERVATION_HARD_CAP,
      effort: OPUS_V2_EVAL_V3_EFFORT,
      model: OPUS_V2_EVAL_V3_MODEL,
      plan_fingerprint: OPUS_V2_EVAL_V3_PLAN_FINGERPRINT_UNCHANGED,
    }),
    "utf8",
  )
  .digest("hex");

export const OPUS_V2_EVAL_V3_RAW_ARCHIVE_KIND = "experimental_local_calibration_artifact" as const;
export const OPUS_V2_EVAL_V3_RAW_ARCHIVE_RELATIVE_DIR =
  ".calibration-results/archivist-opus-v2-full-manuscript-eval-v3/raw" as const;
export const OPUS_V2_EVAL_V3_RAW_GITIGNORED = true;
export const OPUS_V2_EVAL_V3_RAW_PUBLIC = false;
export const OPUS_V2_EVAL_V3_RAW_PRODUCTION = false;

export const OPUS_V2_EVAL_V3_SUCCESS_BAR = {
  normal_parse_rate_min: "8/14",
  max_tokens_rate_max: "6/14",
  timestamp_share_max: 0.35,
  observation_hard_cap: V4_OBSERVATION_HARD_CAP,
  injury_min: 4,
  travel_leg_min: 3,
  relationship_min: 6,
  identity_min: 4,
  location_presence_min: 6,
  repeated_object_continuity_min: 1,
  fabricated_evidence: 0,
  raw_outputs_persisted: "all_calls",
  candidate_count_is_success_metric: false,
  comparable_pairs_min: 5,
  consumed_rule8_retain: ["R8-001", "R8-012", "R8-025"],
  consumed_rule8_improve_correct_kind: ["R8-007", "R8-010", "R8-011", "R8-029"],
} as const;

export const OPUS_V2_EVAL_V3_HELD_OUT_IDS = V2_PHASE2_HELD_OUT_IDS;

export function assertHistoricalEvalsUnchangedByV3(): boolean {
  return (
    OPUS_V2_EVAL_VERSION === "archivist_opus_v2_full_manuscript_eval@v1" &&
    OPUS_V2_EVAL_PROMPT_VERSION === V2_EXTRACTION_PROMPT_VERSION &&
    V2_EXTRACTION_PROMPT_VERSION === "archivist_v2_extraction_prompt@v2" &&
    OPUS_V2_EVAL_MAX_TOKENS === V2_PROMPT_MAX_TOKENS &&
    V2_PROMPT_MAX_TOKENS === 4000 &&
    OPUS_V2_EVAL_EFFORT === "medium" &&
    OPUS_V2_EVAL_MODEL === "claude-opus-5-5" &&
    OPUS_V2_EVAL_V2_VERSION === "archivist_opus_v2_full_manuscript_eval@v2" &&
    OPUS_V2_EVAL_V2_PROMPT_VERSION === V3_EXTRACTION_PROMPT_VERSION &&
    V3_EXTRACTION_PROMPT_VERSION === "archivist_v2_extraction_prompt@v3" &&
    OPUS_V2_EVAL_V2_MAX_TOKENS === V3_PROMPT_MAX_TOKENS &&
    V3_PROMPT_MAX_TOKENS === 6000 &&
    OPUS_V2_EVAL_V3_MAX_TOKENS === 6000 &&
    OPUS_V2_EVAL_V3_PROMPT_VERSION === "archivist_v2_extraction_prompt@v4" &&
    OPUS_V2_EVAL_V3_OBSERVATION_HARD_CAP === 16 &&
    OPUS_V2_EVAL_V3_SCHEMA_VERSION === ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2 &&
    OPUS_V2_EVAL_V3_AUTHORIZED_TO_RUN === false &&
    OPUS_V2_EVAL_V3_CEILING_AUTHORIZED === false &&
    OPUS_V2_EVAL_V3_SPEND_AUTHORIZED === false
  );
}
