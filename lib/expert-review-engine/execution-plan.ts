/**
 * Expert Review Engine execution plan types (P2-20).
 *
 * Plan-only contract — executionAllowed remains false until a later milestone.
 */

import type { ExpertCapability, ReviewRuntimeVersionSet } from "./types.ts";
import { EXPERT_RUNTIME_SCHEMA_VERSION } from "./types.ts";

export const EXPERT_REVIEW_EXECUTION_MODES = ["plan_only", "shadow", "execute"] as const;

export type ExpertReviewExecutionMode = (typeof EXPERT_REVIEW_EXECUTION_MODES)[number];

export interface ExpertReviewWorkflowContext {
  workflowId?: string;
}

export interface ExpertReviewRequest {
  manuscriptId: string;
  manuscriptVersionId: string;
  executionMode: ExpertReviewExecutionMode;
  /** Exact version selector — expert_key alone is invalid. */
  expertKey?: string;
  expertVersion?: string;
  definitionHash?: string;
  expertVersionId?: string;
  requestedCapabilities?: readonly ExpertCapability[];
  correlationId?: string;
  auditId?: string;
  workflowContext?: ExpertReviewWorkflowContext;
}

export interface ExpertReviewExecutionPlan {
  expertKey: string;
  expertVersion: string;
  definitionHash: string;
  constitutionDefinitionHash: string;
  workflowDefinitionVersion: string;
  runtimeSchemaVersion: typeof EXPERT_RUNTIME_SCHEMA_VERSION;
  manuscriptId: string;
  manuscriptVersionId: string;
  requestedCapabilities: readonly ExpertCapability[];
  executionMode: ExpertReviewExecutionMode;
  executionPlanned: true;
  executionAllowed: false;
  blockers: readonly string[];
  diagnostics: readonly string[];
  auditSnapshot: ReviewRuntimeVersionSet;
}

export type ExpertReviewEngineErrorCode =
  | "engine_disabled"
  | "invalid_request"
  | "expert_not_found"
  | "version_not_found"
  | "definition_hash_not_found"
  | "selector_conflict"
  | "runtime_definition_invalid"
  | "execution_mode_not_wired"
  | "registry_failure";

export interface ExpertReviewEngineError {
  ok: false;
  code: ExpertReviewEngineErrorCode;
  message: string;
  context?: Readonly<Record<string, string>>;
}

export interface ExpertReviewEngineSuccess {
  ok: true;
  plan: ExpertReviewExecutionPlan;
}

export type ExpertReviewEngineResult = ExpertReviewEngineSuccess | ExpertReviewEngineError;

export function isExpertReviewEngineError(
  result: ExpertReviewEngineResult,
): result is ExpertReviewEngineError {
  return !result.ok;
}

export function expertReviewEngineError(
  code: ExpertReviewEngineErrorCode,
  message: string,
  context?: Readonly<Record<string, string>>,
): ExpertReviewEngineError {
  return { ok: false, code, message, context };
}

export function isExpertReviewExecutionMode(value: string): value is ExpertReviewExecutionMode {
  return (EXPERT_REVIEW_EXECUTION_MODES as readonly string[]).includes(value);
}

/**
 * Duplicate requested capabilities are rejected (not silently deduplicated).
 * Keeps planning deterministic without repairing caller input.
 */
export function validateRequestedCapabilities(
  capabilities: readonly ExpertCapability[] | undefined,
): { ok: true; capabilities: readonly ExpertCapability[] } | { ok: false; message: string } {
  if (capabilities === undefined || capabilities.length === 0) {
    return { ok: true, capabilities: [] };
  }

  const seen = new Set<ExpertCapability>();
  for (const capability of capabilities) {
    if (seen.has(capability)) {
      return {
        ok: false,
        message: `Duplicate requested capability: ${capability}`,
      };
    }
    seen.add(capability);
  }

  return {
    ok: true,
    capabilities: [...capabilities].sort((a, b) => a.localeCompare(b)),
  };
}
