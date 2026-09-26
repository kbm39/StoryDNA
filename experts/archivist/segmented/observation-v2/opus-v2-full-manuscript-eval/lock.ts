/**
 * Isolated experimental Opus 5.5 full-manuscript Archivist V2 evaluation lock.
 * Not wired to public live, paid-pilot, or archivist-segmented-pilot.
 * authorized_to_run remains false. No provider construction in this module.
 */

import { RECKONING_REVISED_13_SOURCE_PIN } from "../../../reckoning-revised-13-source-pin.ts";
import { STAGING_SUPABASE_PROJECT_REF } from "../../paid-pilot-authorization.ts";
import { RECKONING_REVISED_13_SEGMENT_PLAN } from "../../reckoning-revised-13-segment-plan.ts";
import { V2_PHASE2_HELD_OUT_IDS } from "../phase-2/index.ts";
import { ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2 } from "../constants.ts";
import { V2_EXTRACTION_PROMPT_VERSION, V2_PROMPT_MAX_TOKENS } from "../prompt.ts";

export const OPUS_V2_EVAL_ID = "archivist-opus-v2-full-manuscript-eval" as const;
export const OPUS_V2_EVAL_VERSION = "archivist_opus_v2_full_manuscript_eval@v1" as const;
export const OPUS_V2_EVAL_WORKFLOW_KIND = "experimental_opus_v2_full_manuscript_eval" as const;
export const OPUS_V2_EVAL_STATUS = "experimental_candidate" as const;
export const OPUS_V2_EVAL_WIRED_TO_PAID_PATH = false;
export const OPUS_V2_EVAL_WIRED_TO_PUBLIC_LIVE = false;
export const OPUS_V2_EVAL_AUTHORIZED_TO_RUN = false;
export const OPUS_V2_EVAL_PROVIDER_CALLS = 0 as const;
export const OPUS_V2_EVAL_COST_USD = 0 as const;

export const OPUS_V2_EVAL_PROVIDER = "anthropic" as const;
export const OPUS_V2_EVAL_MODEL = "claude-opus-5-5" as const;
export const OPUS_V2_EVAL_EFFORT = "medium" as const;
export const OPUS_V2_EVAL_MAX_TOKENS = V2_PROMPT_MAX_TOKENS;
export const OPUS_V2_EVAL_CACHE = "off" as const;
export const OPUS_V2_EVAL_FALLBACK = "none" as const;

export const OPUS_V2_EVAL_PROMPT_VERSION = V2_EXTRACTION_PROMPT_VERSION;
export const OPUS_V2_EVAL_SCHEMA_VERSION = ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2;

export const OPUS_V2_EVAL_STAGING_PROJECT_REF = STAGING_SUPABASE_PROJECT_REF;
export const OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID = "293c23d7-2793-4f79-bb97-5eb3ab8ae7fc" as const;

export const OPUS_V2_EVAL_DEFAULT_REPAIR_ALLOWANCE = 0 as const;
export const OPUS_V2_EVAL_EMERGENCY_REPAIR_MAX = 3 as const;
export const OPUS_V2_EVAL_REPAIRS_AUTHORIZED = false;
export const OPUS_V2_EVAL_RECONCILIATION_BATCH_SIZE = 8 as const;
export const OPUS_V2_EVAL_RECONCILIATION_BATCH_CAP = 8 as const;

export const OPUS_V2_EVAL_INPUT_USD_PER_MTOK = 4 as const;
export const OPUS_V2_EVAL_OUTPUT_USD_PER_MTOK = 20 as const;
export const OPUS_V2_EVAL_FUTURE_LOW_USD = 1.47 as const;
export const OPUS_V2_EVAL_FUTURE_EXPECTED_USD = 2.18 as const;
export const OPUS_V2_EVAL_FUTURE_HIGH_USD = 3.1 as const;
export const OPUS_V2_EVAL_FUTURE_HARD_CEILING_USD = 6 as const;
export const OPUS_V2_EVAL_CEILING_AUTHORIZED = false;

export const OPUS_V2_EVAL_SOURCE_PIN = {
  manuscript_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_id,
  manuscript_version_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_version_id,
  content_hash: RECKONING_REVISED_13_SOURCE_PIN.content_hash,
  analytical_word_count: RECKONING_REVISED_13_SOURCE_PIN.analytical_word_count,
  plan_fingerprint: RECKONING_REVISED_13_SEGMENT_PLAN.plan_fingerprint,
} as const;

export const OPUS_V2_EVAL_HELD_OUT_IDS = V2_PHASE2_HELD_OUT_IDS;
