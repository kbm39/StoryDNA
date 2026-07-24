/**
 * Multi-version Expert Runtime Registry API contract (P2-10).
 *
 * Design-only types — not wired to in-code.ts. Defines the future registry
 * interface for multi-version coexistence and DB parity without changing
 * Phase 1 runtime behavior.
 */

import type {
  ExpertRuntimeDefinition,
  ExpertRuntimeRegistryEntry,
  ReviewRuntimeVersionSet,
} from "../types.ts";

/** Lifecycle aligned with lib/expert-registry/types.ts ExpertLifecycleStatus. */
export type ExpertRuntimeLifecycleStatus =
  | "draft"
  | "active"
  | "deprecated"
  | "archived";

export type ExpertRegistryErrorCode =
  | "expert_not_found"
  | "version_not_found"
  | "definition_hash_not_found"
  | "duplicate_version"
  | "conflicting_definition_hash"
  | "no_active_version"
  | "invalid_lookup";

export interface ExpertRegistryError {
  ok: false;
  code: ExpertRegistryErrorCode;
  message: string;
  context?: Readonly<Record<string, string>>;
}

export interface ExpertRegistrySuccess<T> {
  ok: true;
  value: T;
}

export type ExpertRegistryResult<T> = ExpertRegistrySuccess<T> | ExpertRegistryError;

export interface ExpertRegistryReadOptions {
  includeDisabled?: boolean;
  lifecycleFilter?: readonly ExpertRuntimeLifecycleStatus[];
}

export interface ExpertRegistryListOptions extends ExpertRegistryReadOptions {
  includeHistorical?: boolean;
}

export interface ExpertRegistryRegisterOptions {
  lifecycleStatus?: "draft" | "active";
  expertVersionId?: string | null;
  /** When true, deprecate prior active version (mirrors activate_expert_version RPC). */
  activate?: boolean;
}

export interface ExpertRuntimeExistsQuery {
  expertKey: string;
  expertVersion?: string;
  definitionHash?: string;
  lifecycleStatus?: ExpertRuntimeLifecycleStatus;
}

/** Summary for list operations — lighter than full registry entry. */
export interface ExpertRuntimeVersionSummary {
  expertKey: string;
  expertVersion: string;
  definitionHash: string;
  lifecycleStatus: ExpertRuntimeLifecycleStatus;
  enabled: boolean;
  registeredAt: string;
  /** Null when entry is in-code-only and not yet persisted to expert_versions. */
  expertVersionId: string | null;
}

/** Future registry entry — extends Phase 1 entry with lifecycle and DB bridge. */
export interface ExpertRuntimeRegistryEntryV2 extends ExpertRuntimeRegistryEntry {
  expertVersionId: string | null;
  lifecycleStatus: ExpertRuntimeLifecycleStatus;
  isActive: boolean;
}

/** Composite lookup key for in-memory indexes. */
export type ExpertRuntimeVersionKey = `${string}@${string}`;

export function expertRuntimeVersionKey(
  expertKey: string,
  expertVersion: string,
): ExpertRuntimeVersionKey {
  return `${expertKey}@${expertVersion}`;
}

/** Persisted audit record for a review execution (contract only — not wired). */
export interface ExpertReviewExecutionAuditRecord {
  expert_version_id: string | null;
  expert_key: string;
  expert_version: string;
  runtime_definition_hash: string;
  review_runtime_version_set: ReviewRuntimeVersionSet;
  engine_version: string;
  executed_at: string;
  workflow_definition_version: string;
  manuscript_id?: string;
  review_id?: string;
}

/**
 * Future multi-version registry interface.
 *
 * Implementations: in-code (P2-12+), DB-backed cache (later).
 * Phase 1 in-code.ts implements a subset implicitly via single-version maps.
 */
export interface ExpertRuntimeRegistry {
  getActiveExpertRuntime(
    expertKey: string,
    options?: ExpertRegistryReadOptions,
  ): ExpertRegistryResult<ExpertRuntimeRegistryEntryV2>;

  getExpertRuntimeByKeyAndVersion(
    expertKey: string,
    expertVersion: string,
    options?: ExpertRegistryReadOptions,
  ): ExpertRegistryResult<ExpertRuntimeRegistryEntryV2>;

  getExpertRuntimeByDefinitionHash(
    definitionHash: string,
    options?: ExpertRegistryReadOptions,
  ): ExpertRegistryResult<ExpertRuntimeRegistryEntryV2>;

  listExpertRuntimeVersions(
    expertKey: string,
    options?: ExpertRegistryListOptions,
  ): ExpertRegistryResult<readonly ExpertRuntimeVersionSummary[]>;

  existsExpertRuntime(
    query: ExpertRuntimeExistsQuery,
  ): ExpertRegistryResult<boolean>;

  registerExpertRuntimeDefinition(
    def: ExpertRuntimeDefinition,
    options?: ExpertRegistryRegisterOptions,
  ): ExpertRegistryResult<ExpertRuntimeRegistryEntryV2>;

  resolveExpertVersionId(
    expertKey: string,
    expertVersion: string,
  ): ExpertRegistryResult<string | null>;
}

/** Type guard for registry errors. */
export function isExpertRegistryError<T>(
  result: ExpertRegistryResult<T>,
): result is ExpertRegistryError {
  return !result.ok;
}

/** Helper to construct typed errors (for future implementations). */
export function expertRegistryError(
  code: ExpertRegistryErrorCode,
  message: string,
  context?: Readonly<Record<string, string>>,
): ExpertRegistryError {
  return { ok: false, code, message, context };
}
