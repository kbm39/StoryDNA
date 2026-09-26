/**
 * Explicit one-shot grant for the isolated Opus V2 full-manuscript evaluation.
 * Derived from the frozen prepared authorization. Does not mutate that object.
 * Does not authorize execution in this file; authorize() applies the grant.
 */

import {
  OPUS_V2_EVAL_CACHE,
  OPUS_V2_EVAL_EFFORT,
  OPUS_V2_EVAL_FALLBACK,
  OPUS_V2_EVAL_FUTURE_HARD_CEILING_USD,
  OPUS_V2_EVAL_ID,
  OPUS_V2_EVAL_MAX_TOKENS,
  OPUS_V2_EVAL_MODEL,
  OPUS_V2_EVAL_PROMPT_VERSION,
  OPUS_V2_EVAL_PROVIDER,
  OPUS_V2_EVAL_SCHEMA_VERSION,
  OPUS_V2_EVAL_SOURCE_PIN,
  OPUS_V2_EVAL_STAGING_PROJECT_REF,
  OPUS_V2_EVAL_VERSION,
  OPUS_V2_EVAL_WORKFLOW_KIND,
} from "./lock.ts";

export const OPUS_V2_EVAL_EXPLICIT_GRANT = {
  grant_kind: "explicit_one_shot_opus_v2_full_manuscript_eval",
  authorization_id: "reckoning-revised-13-opus-v2-full-eval-20260925",
  granted_by: "Kevin Martin",
  granted_on: "2026-09-25",
  scope: "exactly_one_revised_13_opus_v2_full_manuscript_experimental_evaluation",
  hard_cost_ceiling_usd: OPUS_V2_EVAL_FUTURE_HARD_CEILING_USD,
  manuscript_id: OPUS_V2_EVAL_SOURCE_PIN.manuscript_id,
  manuscript_version_id: OPUS_V2_EVAL_SOURCE_PIN.manuscript_version_id,
  content_hash: OPUS_V2_EVAL_SOURCE_PIN.content_hash,
  analytical_word_count: OPUS_V2_EVAL_SOURCE_PIN.analytical_word_count,
  plan_fingerprint: OPUS_V2_EVAL_SOURCE_PIN.plan_fingerprint,
  workflow_kind: OPUS_V2_EVAL_WORKFLOW_KIND,
  runner_id: OPUS_V2_EVAL_ID,
  runner_version: OPUS_V2_EVAL_VERSION,
  prompt_version: OPUS_V2_EVAL_PROMPT_VERSION,
  schema_version: OPUS_V2_EVAL_SCHEMA_VERSION,
  provider: OPUS_V2_EVAL_PROVIDER,
  model: OPUS_V2_EVAL_MODEL,
  effort: OPUS_V2_EVAL_EFFORT,
  max_tokens: OPUS_V2_EVAL_MAX_TOKENS,
  cache: OPUS_V2_EVAL_CACHE,
  fallback: OPUS_V2_EVAL_FALLBACK,
  environment: "staging",
  staging_supabase_project_ref: OPUS_V2_EVAL_STAGING_PROJECT_REF,
  production_supabase_project_ref: "tumcpxklduhiigxjwlrp",
  does_not_authorize: [
    "another_manuscript",
    "another_model",
    "another_workflow_kind",
    "another_environment",
    "generic_archivist_live",
    "production",
    "no_mercy",
    "other_experts",
  ],
} as const;

export type OpusV2EvalExplicitGrant = typeof OPUS_V2_EVAL_EXPLICIT_GRANT;
