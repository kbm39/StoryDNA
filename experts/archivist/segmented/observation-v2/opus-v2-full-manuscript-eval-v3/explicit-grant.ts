/**
 * Explicit one-shot grant for the isolated Opus eval @v3 full-manuscript rerun.
 * Derived from the prepared 20260926-v3 authorization. Does not mutate that object.
 * Does not execute the run. Does not reuse the historical 20260925 or 20260926 grants.
 */

import {
  OPUS_V2_EVAL_V3_CACHE,
  OPUS_V2_EVAL_V3_EFFORT,
  OPUS_V2_EVAL_V3_EXECUTION_FINGERPRINT,
  OPUS_V2_EVAL_V3_FALLBACK,
  OPUS_V2_EVAL_V3_ID,
  OPUS_V2_EVAL_V3_MAX_TOKENS,
  OPUS_V2_EVAL_V3_MODEL,
  OPUS_V2_EVAL_V3_OBSERVATION_HARD_CAP,
  OPUS_V2_EVAL_V3_PROMPT_VERSION,
  OPUS_V2_EVAL_V3_PROVIDER,
  OPUS_V2_EVAL_V3_RECOMMENDED_HARD_CEILING_USD,
  OPUS_V2_EVAL_V3_SCHEMA_VERSION,
  OPUS_V2_EVAL_V3_SOURCE_PIN,
  OPUS_V2_EVAL_V3_STAGING_PROJECT_REF,
  OPUS_V2_EVAL_V3_VERSION,
  OPUS_V2_EVAL_V3_WORKFLOW_KIND,
} from "./lock.ts";

export const OPUS_V2_EVAL_V3_EXPLICIT_GRANT = {
  grant_kind: "explicit_one_shot_opus_v2_full_manuscript_eval_v3",
  authorization_id: "reckoning-revised-13-opus-v2-full-eval-v3-20260926",
  granted_by: "Kevin Martin",
  granted_on: "2026-09-26",
  scope: "exactly_one_revised_13_opus_v2_full_manuscript_eval_v3_rerun",
  hard_cost_ceiling_usd: OPUS_V2_EVAL_V3_RECOMMENDED_HARD_CEILING_USD,
  manuscript_id: OPUS_V2_EVAL_V3_SOURCE_PIN.manuscript_id,
  manuscript_version_id: OPUS_V2_EVAL_V3_SOURCE_PIN.manuscript_version_id,
  content_hash: OPUS_V2_EVAL_V3_SOURCE_PIN.content_hash,
  analytical_word_count: OPUS_V2_EVAL_V3_SOURCE_PIN.analytical_word_count,
  plan_fingerprint: OPUS_V2_EVAL_V3_SOURCE_PIN.plan_fingerprint,
  execution_fingerprint: OPUS_V2_EVAL_V3_EXECUTION_FINGERPRINT,
  workflow_kind: OPUS_V2_EVAL_V3_WORKFLOW_KIND,
  runner_id: OPUS_V2_EVAL_V3_ID,
  runner_version: OPUS_V2_EVAL_V3_VERSION,
  prompt_version: OPUS_V2_EVAL_V3_PROMPT_VERSION,
  schema_version: OPUS_V2_EVAL_V3_SCHEMA_VERSION,
  provider: OPUS_V2_EVAL_V3_PROVIDER,
  model: OPUS_V2_EVAL_V3_MODEL,
  effort: OPUS_V2_EVAL_V3_EFFORT,
  max_tokens: OPUS_V2_EVAL_V3_MAX_TOKENS,
  observation_hard_cap: OPUS_V2_EVAL_V3_OBSERVATION_HARD_CAP,
  cache: OPUS_V2_EVAL_V3_CACHE,
  fallback: OPUS_V2_EVAL_V3_FALLBACK,
  environment: "staging",
  staging_supabase_project_ref: OPUS_V2_EVAL_V3_STAGING_PROJECT_REF,
  production_supabase_project_ref: "tumcpxklduhiigxjwlrp",
  does_not_authorize: [
    "another_manuscript",
    "another_model",
    "another_workflow_kind",
    "another_environment",
    "historical_20260925_authorization",
    "historical_20260926_authorization",
    "historical_8911acab_workflow",
    "historical_b30594ca_workflow",
    "generic_archivist_live",
    "production",
    "no_mercy",
    "other_experts",
  ],
} as const;

export type OpusV2EvalV3ExplicitGrant = typeof OPUS_V2_EVAL_V3_EXPLICIT_GRANT;
