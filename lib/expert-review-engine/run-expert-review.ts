/**
 * Expert Review Engine orchestrator shell (P2-20).
 *
 * Validates and plans exact-version expert execution. Does not execute experts,
 * import runtime plugins, call models, Trigger, or publishing.
 */

import { deepFreeze } from "./deep-freeze.ts";
import {
  expertReviewEngineError,
  isExpertReviewExecutionMode,
  validateRequestedCapabilities,
  type ExpertReviewEngineResult,
  type ExpertReviewExecutionPlan,
  type ExpertReviewRequest,
} from "./execution-plan.ts";
import { readExpertReviewEngineEnabled } from "./feature-flags.ts";
import {
  isExpertRegistryError,
  type ExpertRegistryResult,
  type ExpertRuntimeRegistry,
  type ExpertRuntimeRegistryEntryV2,
} from "./registry/multi-version-contract.ts";
import { createInCodeExpertRuntimeRegistry } from "./registry/in-code-registry-adapter.ts";
import {
  EXPERT_RUNTIME_SCHEMA_VERSION,
  type ExpertCapability,
  type ReviewRuntimeVersionSet,
} from "./types.ts";
import { isExpertCapability } from "./validate-runtime-definition.ts";
import { validateExpertRuntimeDefinition } from "./validate-runtime-definition.ts";

export interface RunExpertReviewDependencies {
  registry?: ExpertRuntimeRegistry;
  featureFlagReader?: () => boolean;
  /** Test-only: bypass EXPERT_REVIEW_ENGINE_ENABLED when true. */
  bypassFeatureFlag?: boolean;
}

type ResolvedRegistryEntry = ExpertRuntimeRegistryEntryV2;

interface NormalizedSelector {
  expertKey?: string;
  expertVersion?: string;
  definitionHash?: string;
  expertVersionId?: string;
}

function nonEmpty(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapRegistryFailure(
  result: Extract<ExpertRegistryResult<ResolvedRegistryEntry>, { ok: false }>,
): ExpertReviewEngineResult {
  switch (result.code) {
    case "expert_not_found":
      return expertReviewEngineError("expert_not_found", result.message, result.context);
    case "version_not_found":
      return expertReviewEngineError("version_not_found", result.message, result.context);
    case "definition_hash_not_found":
      return expertReviewEngineError("definition_hash_not_found", result.message, result.context);
    default:
      return expertReviewEngineError("registry_failure", result.message, result.context);
  }
}

function validateManuscriptIds(request: ExpertReviewRequest): ExpertReviewEngineResult | null {
  const manuscriptId = nonEmpty(request.manuscriptId);
  const manuscriptVersionId = nonEmpty(request.manuscriptVersionId);
  if (!manuscriptId || !manuscriptVersionId) {
    return expertReviewEngineError(
      "invalid_request",
      "manuscriptId and manuscriptVersionId are required",
    );
  }
  return null;
}

function validateExecutionMode(mode: string): ExpertReviewEngineResult | null {
  if (!isExpertReviewExecutionMode(mode)) {
    return expertReviewEngineError(
      "invalid_request",
      `Unsupported execution mode: ${mode}`,
      { execution_mode: mode },
    );
  }
  return null;
}

function validateCapabilityTokens(
  capabilities: readonly ExpertCapability[] | undefined,
): ExpertReviewEngineResult | null {
  if (capabilities === undefined) return null;
  for (const capability of capabilities) {
    if (!isExpertCapability(capability)) {
      return expertReviewEngineError(
        "invalid_request",
        `Unknown requested capability: ${capability}`,
        { capability: String(capability) },
      );
    }
  }
  return null;
}

function normalizeSelector(request: ExpertReviewRequest): NormalizedSelector {
  return {
    expertKey: nonEmpty(request.expertKey) ?? undefined,
    expertVersion: nonEmpty(request.expertVersion) ?? undefined,
    definitionHash: nonEmpty(request.definitionHash)?.toLowerCase() ?? undefined,
    expertVersionId: nonEmpty(request.expertVersionId) ?? undefined,
  };
}

function validateSelectorShape(selector: NormalizedSelector): ExpertReviewEngineResult | null {
  const hasKey = Boolean(selector.expertKey);
  const hasVersion = Boolean(selector.expertVersion);
  const hasHash = Boolean(selector.definitionHash);
  const hasVersionId = Boolean(selector.expertVersionId);

  if (hasKey && !hasVersion && !hasHash && !hasVersionId) {
    return expertReviewEngineError(
      "invalid_request",
      "expert_key requires an exact version selector (expert_version, definition_hash, or expert_version_id)",
      { expert_key: selector.expertKey! },
    );
  }

  if (hasVersion && !hasKey && !hasHash && !hasVersionId) {
    return expertReviewEngineError(
      "invalid_request",
      "expert_version requires expert_key when definition_hash and expert_version_id are absent",
    );
  }

  if (!hasKey && !hasVersion && !hasHash && !hasVersionId) {
    return expertReviewEngineError(
      "invalid_request",
      "An exact expert selector is required (expert_key+expert_version, definition_hash, or expert_version_id)",
    );
  }

  return null;
}

async function resolveByVersionId(
  registry: ExpertRuntimeRegistry,
  expertVersionId: string,
  expertKey?: string,
  expertVersion?: string,
): Promise<ExpertReviewEngineResult | ResolvedRegistryEntry> {
  if (expertKey && expertVersion) {
    const resolvedId = registry.resolveExpertVersionId(expertKey, expertVersion);
    if (isExpertRegistryError(resolvedId)) {
      return mapRegistryFailure(resolvedId);
    }
    if (resolvedId.value === expertVersionId) {
      return resolveByKeyAndVersion(registry, expertKey, expertVersion);
    }
    if (resolvedId.value !== null) {
      return expertReviewEngineError(
        "selector_conflict",
        "expert_version_id does not match resolved registry expert_version_id",
        {
          expert_key: expertKey,
          expert_version: expertVersion,
          expert_version_id: expertVersionId,
          resolved_expert_version_id: resolvedId.value,
        },
      );
    }
  }

  return expertReviewEngineError(
    "version_not_found",
    "expert_version_id not found",
    { expert_version_id: expertVersionId },
  );
}

function resolveByKeyAndVersion(
  registry: ExpertRuntimeRegistry,
  expertKey: string,
  expertVersion: string,
): ExpertReviewEngineResult | ResolvedRegistryEntry {
  const resolved = registry.getExpertRuntimeByKeyAndVersion(expertKey, expertVersion, {
    includeDisabled: true,
  });
  if (resolved.ok) return resolved.value;
  return mapRegistryFailure(resolved);
}

function resolveByDefinitionHash(
  registry: ExpertRuntimeRegistry,
  definitionHash: string,
): ExpertReviewEngineResult | ResolvedRegistryEntry {
  const resolved = registry.getExpertRuntimeByDefinitionHash(definitionHash, {
    includeDisabled: true,
  });
  if (resolved.ok) return resolved.value;
  return mapRegistryFailure(resolved);
}

function entriesConflict(
  a: ResolvedRegistryEntry,
  b: ResolvedRegistryEntry,
): ExpertReviewEngineResult | null {
  if (a.definition.expert_key !== b.definition.expert_key) {
    return expertReviewEngineError(
      "selector_conflict",
      "Expert selectors resolve to different expert_key values",
      {
        first_expert_key: a.definition.expert_key,
        second_expert_key: b.definition.expert_key,
      },
    );
  }
  if (a.definition.expert_version !== b.definition.expert_version) {
    return expertReviewEngineError(
      "selector_conflict",
      "Expert selectors resolve to different expert_version values",
      {
        expert_key: a.definition.expert_key,
        first_expert_version: a.definition.expert_version,
        second_expert_version: b.definition.expert_version,
      },
    );
  }
  if (a.definitionHash !== b.definitionHash) {
    return expertReviewEngineError(
      "selector_conflict",
      "Expert selectors resolve to different definition_hash values",
      {
        expert_key: a.definition.expert_key,
        first_definition_hash: a.definitionHash,
        second_definition_hash: b.definitionHash,
      },
    );
  }
  return null;
}

async function resolveExactExpert(
  registry: ExpertRuntimeRegistry,
  selector: NormalizedSelector,
): Promise<ExpertReviewEngineResult | ResolvedRegistryEntry> {
  const resolutions: ResolvedRegistryEntry[] = [];

  if (selector.expertKey && selector.expertVersion) {
    const byKeyVersion = resolveByKeyAndVersion(
      registry,
      selector.expertKey,
      selector.expertVersion,
    );
    if (!("definition" in byKeyVersion)) return byKeyVersion;
    resolutions.push(byKeyVersion);
  }

  if (selector.definitionHash) {
    const byHash = resolveByDefinitionHash(registry, selector.definitionHash);
    if (!("definition" in byHash)) return byHash;
    resolutions.push(byHash);
    if (selector.expertKey && selector.expertKey !== byHash.definition.expert_key) {
      return expertReviewEngineError(
        "selector_conflict",
        "definition_hash resolves to a different expert_key than requested",
        {
          requested_expert_key: selector.expertKey,
          resolved_expert_key: byHash.definition.expert_key,
        },
      );
    }
    if (selector.expertVersion && selector.expertVersion !== byHash.definition.expert_version) {
      return expertReviewEngineError(
        "selector_conflict",
        "definition_hash resolves to a different expert_version than requested",
        {
          requested_expert_version: selector.expertVersion,
          resolved_expert_version: byHash.definition.expert_version,
        },
      );
    }
  }

  if (selector.expertVersionId) {
    const byVersionId = await resolveByVersionId(
      registry,
      selector.expertVersionId,
      selector.expertKey,
      selector.expertVersion,
    );
    if (!("definition" in byVersionId)) return byVersionId;
    resolutions.push(byVersionId);
    if (selector.expertKey && selector.expertKey !== byVersionId.definition.expert_key) {
      return expertReviewEngineError(
        "selector_conflict",
        "expert_version_id resolves to a different expert_key than requested",
        {
          requested_expert_key: selector.expertKey,
          resolved_expert_key: byVersionId.definition.expert_key,
        },
      );
    }
    if (
      selector.expertVersion &&
      selector.expertVersion !== byVersionId.definition.expert_version
    ) {
      return expertReviewEngineError(
        "selector_conflict",
        "expert_version_id resolves to a different expert_version than requested",
        {
          requested_expert_version: selector.expertVersion,
          resolved_expert_version: byVersionId.definition.expert_version,
        },
      );
    }
  }

  if (resolutions.length === 0) {
    return expertReviewEngineError(
      "invalid_request",
      "Unable to resolve expert selector",
    );
  }

  const primary = resolutions[0]!;
  for (let i = 1; i < resolutions.length; i++) {
    const conflict = entriesConflict(primary, resolutions[i]!);
    if (conflict) return conflict;
  }

  return primary;
}

function cloneAuditSnapshot(versions: ReviewRuntimeVersionSet): ReviewRuntimeVersionSet {
  return deepFreeze(structuredClone(versions));
}

function buildExecutionPlan(
  request: ExpertReviewRequest,
  entry: ResolvedRegistryEntry,
  requestedCapabilities: readonly ExpertCapability[],
): ExpertReviewExecutionPlan {
  const versions = entry.definition.runtime_versions;
  const plan: ExpertReviewExecutionPlan = {
    expertKey: entry.definition.expert_key,
    expertVersion: entry.definition.expert_version,
    definitionHash: entry.definitionHash,
    constitutionDefinitionHash: versions.constitution_definition_hash,
    workflowDefinitionVersion: versions.workflow_definition_version,
    runtimeSchemaVersion: EXPERT_RUNTIME_SCHEMA_VERSION,
    manuscriptId: request.manuscriptId.trim(),
    manuscriptVersionId: request.manuscriptVersionId.trim(),
    requestedCapabilities,
    executionMode: request.executionMode,
    executionPlanned: true,
    executionAllowed: false,
    blockers: ["execution_not_wired_in_p2_20"],
    diagnostics: ["plan_only_orchestrator_shell"],
    auditSnapshot: cloneAuditSnapshot(versions),
  };
  return deepFreeze(plan);
}

function validateResolvedDefinition(
  entry: ResolvedRegistryEntry,
): ExpertReviewEngineResult | null {
  const validation = validateExpertRuntimeDefinition(entry.definition);
  if (!validation.ok) {
    return expertReviewEngineError(
      "runtime_definition_invalid",
      validation.errors.join("; "),
      {
        expert_key: entry.definition.expert_key,
        expert_version: entry.definition.expert_version,
      },
    );
  }
  if (validation.definitionHash !== entry.definitionHash) {
    return expertReviewEngineError(
      "runtime_definition_invalid",
      "Registry definition_hash does not match validated runtime definition hash",
      {
        expert_key: entry.definition.expert_key,
        registry_definition_hash: entry.definitionHash,
        validated_definition_hash: validation.definitionHash,
      },
    );
  }
  return null;
}

/**
 * Plan an exact-version expert review execution without running it.
 */
export async function runExpertReview(
  request: ExpertReviewRequest,
  dependencies: RunExpertReviewDependencies = {},
): Promise<ExpertReviewEngineResult> {
  const registry = dependencies.registry ?? createInCodeExpertRuntimeRegistry();
  const featureFlagReader = dependencies.featureFlagReader ?? readExpertReviewEngineEnabled;

  if (!dependencies.bypassFeatureFlag && !featureFlagReader()) {
    return expertReviewEngineError(
      "engine_disabled",
      "Expert Review Engine is disabled (EXPERT_REVIEW_ENGINE_ENABLED is off)",
    );
  }

  const manuscriptError = validateManuscriptIds(request);
  if (manuscriptError) return manuscriptError;

  const modeError = validateExecutionMode(request.executionMode);
  if (modeError) return modeError;

  const capabilityTokenError = validateCapabilityTokens(request.requestedCapabilities);
  if (capabilityTokenError) return capabilityTokenError;

  const capabilityValidation = validateRequestedCapabilities(request.requestedCapabilities);
  if (!capabilityValidation.ok) {
    return expertReviewEngineError("invalid_request", capabilityValidation.message);
  }

  const selector = normalizeSelector(request);
  const selectorError = validateSelectorShape(selector);
  if (selectorError) return selectorError;

  if (request.executionMode === "shadow" || request.executionMode === "execute") {
    return expertReviewEngineError(
      "execution_mode_not_wired",
      `Execution mode "${request.executionMode}" is not wired in P2-20`,
      { execution_mode: request.executionMode },
    );
  }

  const resolved = await resolveExactExpert(registry, selector);
  if (!("definition" in resolved)) return resolved;

  const definitionError = validateResolvedDefinition(resolved);
  if (definitionError) return definitionError;

  return {
    ok: true,
    plan: buildExecutionPlan(request, resolved, capabilityValidation.capabilities),
  };
}

export type {
  ExpertReviewEngineResult,
  ExpertReviewExecutionPlan,
  ExpertReviewRequest,
} from "./execution-plan.ts";

export { readExpertReviewEngineEnabled, EXPERT_REVIEW_ENGINE_FLAG_NAME } from "./feature-flags.ts";
