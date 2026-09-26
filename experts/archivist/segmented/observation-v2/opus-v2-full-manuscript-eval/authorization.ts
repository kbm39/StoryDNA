/**
 * Fail-closed authorization for the isolated Opus V2 full-manuscript eval.
 * Default authorized_to_run is false. Provider construction is refused.
 */

import { ARCHIVIST_CONSTITUTION } from "../../../constitution.ts";
import { isArchivistLiveExecutionAllowed } from "../../../live-flags.ts";
import { archivistRuntimeDefinition } from "../../../runtime-definition.ts";
import {
  OPUS_V2_EVAL_AUTHORIZED_TO_RUN,
  OPUS_V2_EVAL_CEILING_AUTHORIZED,
  OPUS_V2_EVAL_EFFORT,
  OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID,
  OPUS_V2_EVAL_MAX_TOKENS,
  OPUS_V2_EVAL_MODEL,
  OPUS_V2_EVAL_PROMPT_VERSION,
  OPUS_V2_EVAL_PROVIDER,
  OPUS_V2_EVAL_SCHEMA_VERSION,
  OPUS_V2_EVAL_SOURCE_PIN,
  OPUS_V2_EVAL_STAGING_PROJECT_REF,
  OPUS_V2_EVAL_WORKFLOW_KIND,
} from "./lock.ts";

export class OpusV2EvalUnauthorizedError extends Error {
  readonly code = "opus_v2_eval_unauthorized" as const;
  constructor(message: string) {
    super(message);
    this.name = "OpusV2EvalUnauthorizedError";
  }
}

export interface OpusV2EvalAuthorization {
  workflow_kind: typeof OPUS_V2_EVAL_WORKFLOW_KIND;
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  plan_fingerprint: string;
  prompt_version: string;
  schema_version: string;
  provider: string;
  model: string;
  effort: string;
  max_tokens: number;
  staging_project_ref: string;
  hard_cost_ceiling_usd: number;
  authorized_to_run: false;
}

export const OPUS_V2_EVAL_AUTHORIZATION: OpusV2EvalAuthorization = {
  workflow_kind: OPUS_V2_EVAL_WORKFLOW_KIND,
  manuscript_id: OPUS_V2_EVAL_SOURCE_PIN.manuscript_id,
  manuscript_version_id: OPUS_V2_EVAL_SOURCE_PIN.manuscript_version_id,
  content_hash: OPUS_V2_EVAL_SOURCE_PIN.content_hash,
  plan_fingerprint: OPUS_V2_EVAL_SOURCE_PIN.plan_fingerprint,
  prompt_version: OPUS_V2_EVAL_PROMPT_VERSION,
  schema_version: OPUS_V2_EVAL_SCHEMA_VERSION,
  provider: OPUS_V2_EVAL_PROVIDER,
  model: OPUS_V2_EVAL_MODEL,
  effort: OPUS_V2_EVAL_EFFORT,
  max_tokens: OPUS_V2_EVAL_MAX_TOKENS,
  staging_project_ref: OPUS_V2_EVAL_STAGING_PROJECT_REF,
  hard_cost_ceiling_usd: 0,
  authorized_to_run: false,
};

const providerConstructCount = 0;

export function opusV2EvalProviderConstructCount(): number {
  return providerConstructCount;
}

export function assertOpusV2EvalPublicGatesClosed(): void {
  if (isArchivistLiveExecutionAllowed() !== false) {
    throw new OpusV2EvalUnauthorizedError("public_live_must_remain_fail_closed");
  }
  if (ARCHIVIST_CONSTITUTION.execution_wired) {
    throw new OpusV2EvalUnauthorizedError("execution_wired_must_remain_false");
  }
  if (archivistRuntimeDefinition().enabled) {
    throw new OpusV2EvalUnauthorizedError("runtime_must_remain_disabled");
  }
  if (ARCHIVIST_CONSTITUTION.studio_selectable) {
    throw new OpusV2EvalUnauthorizedError("studio_must_remain_false");
  }
}

export function assertOpusV2EvalPaidExecutionForbidden(
  authorization: OpusV2EvalAuthorization = OPUS_V2_EVAL_AUTHORIZATION,
): void {
  assertOpusV2EvalPublicGatesClosed();
  if (authorization.authorized_to_run !== false || OPUS_V2_EVAL_AUTHORIZED_TO_RUN !== false) {
    throw new OpusV2EvalUnauthorizedError("authorized_to_run_must_remain_false");
  }
  if (OPUS_V2_EVAL_CEILING_AUTHORIZED) {
    throw new OpusV2EvalUnauthorizedError("future_ceiling_is_not_authorized");
  }
}

export function assertOpusV2EvalPins(args: {
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  plan_fingerprint: string;
  prompt_version?: string;
  schema_version?: string;
  provider?: string;
  model?: string;
  effort?: string;
}): void {
  if (args.manuscript_id !== OPUS_V2_EVAL_SOURCE_PIN.manuscript_id) {
    throw new OpusV2EvalUnauthorizedError("manuscript_id_mismatch");
  }
  if (args.manuscript_version_id !== OPUS_V2_EVAL_SOURCE_PIN.manuscript_version_id) {
    throw new OpusV2EvalUnauthorizedError("manuscript_version_id_mismatch");
  }
  if (args.content_hash !== OPUS_V2_EVAL_SOURCE_PIN.content_hash) {
    throw new OpusV2EvalUnauthorizedError("content_hash_mismatch");
  }
  if (args.plan_fingerprint !== OPUS_V2_EVAL_SOURCE_PIN.plan_fingerprint) {
    throw new OpusV2EvalUnauthorizedError("plan_fingerprint_mismatch");
  }
  if (args.prompt_version && args.prompt_version !== OPUS_V2_EVAL_PROMPT_VERSION) {
    throw new OpusV2EvalUnauthorizedError("prompt_version_mismatch");
  }
  if (args.schema_version && args.schema_version !== OPUS_V2_EVAL_SCHEMA_VERSION) {
    throw new OpusV2EvalUnauthorizedError("schema_version_mismatch");
  }
  if (args.provider && args.provider !== OPUS_V2_EVAL_PROVIDER) {
    throw new OpusV2EvalUnauthorizedError("provider_mismatch");
  }
  if (args.model && args.model !== OPUS_V2_EVAL_MODEL) {
    throw new OpusV2EvalUnauthorizedError("model_mismatch");
  }
  if (args.effort && args.effort !== OPUS_V2_EVAL_EFFORT) {
    throw new OpusV2EvalUnauthorizedError("effort_mismatch");
  }
}

export function assertNotHistoricalRevised13Workflow(workflowId: string): void {
  if (workflowId === OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID) {
    throw new OpusV2EvalUnauthorizedError("historical_revised_13_workflow_is_immutable");
  }
}

export function constructOpusV2EvalProvider(): never {
  assertOpusV2EvalPaidExecutionForbidden();
  throw new OpusV2EvalUnauthorizedError("provider_construction_is_not_authorized");
}
