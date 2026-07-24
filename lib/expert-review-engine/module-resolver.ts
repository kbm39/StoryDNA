/**
 * Production-safe expert module resolver (P2-21).
 *
 * Resolves advertised runtime module references through an explicit static import
 * map. Verifies named exports and export kinds without invoking exports.
 */

import { collectAdvertisedModuleRefs, type AdvertisedModuleRef } from "./collect-module-refs.ts";
import {
  EXPERT_MODULE_IMPORTERS,
  type ExpertModuleImportMapKey,
} from "./module-import-map.ts";
import type { ModuleExportKind } from "./module-ref-inventory.ts";
import {
  readExpertModuleResolverEnabled,
  EXPERT_MODULE_RESOLVER_FLAG_NAME,
} from "./feature-flags.ts";
import type { ExpertRuntimeDefinition } from "./types.ts";

/** Internal handle for future P2-22 executor — not serialized or exposed as callable. */
export const EXPERT_MODULE_EXPORT_HANDLE = Symbol.for("storydna.expertModuleExportHandle");

export type ExpertModuleExpectedExportKind = ModuleExportKind | "unknown";

export interface ExpertModuleReferenceInput {
  expertKey: string;
  fieldPath: string;
  logicalId: string;
  moduleId: string;
  exportName: string;
  expectedExportKind: ExpertModuleExpectedExportKind;
}

export type ExpertModuleResolutionErrorCode =
  | "invalid_module_reference"
  | "module_resolution_failed"
  | "named_export_missing"
  | "export_type_mismatch"
  | "unsupported_module_namespace"
  | "resolver_disabled"
  | "unexpected_resolver_failure";

export interface ExpertModuleResolutionProvenance {
  expertKey: string;
  fieldPath: string;
  logicalId: string;
}

export interface ExpertModuleExportDescriptor {
  expertKey: string;
  fieldPath: string;
  logicalId: string;
  moduleId: string;
  exportName: string;
  exportKind: ModuleExportKind;
  readonly [EXPERT_MODULE_EXPORT_HANDLE]: unknown;
}

export interface ExpertModuleResolutionSuccess {
  ok: true;
  provenance: ExpertModuleResolutionProvenance;
  moduleId: string;
  exportName: string;
  actualExportKind: ModuleExportKind;
  descriptor: ExpertModuleExportDescriptor;
}

export interface ExpertModuleResolutionFailure {
  ok: false;
  code: ExpertModuleResolutionErrorCode;
  message: string;
  provenance: ExpertModuleResolutionProvenance;
  context?: Readonly<Record<string, string>>;
}

export type ExpertModuleResolutionResult =
  | ExpertModuleResolutionSuccess
  | ExpertModuleResolutionFailure;

export type ExpertModuleImportMap = typeof EXPERT_MODULE_IMPORTERS;

export interface ExpertModuleResolverDependencies {
  importMap?: ExpertModuleImportMap;
  moduleNamespaceCache?: Map<string, Record<string, unknown>>;
  importPromiseCache?: Map<string, Promise<Record<string, unknown>>>;
  featureFlagReader?: () => boolean;
  /** Test-only: bypass EXPERT_MODULE_RESOLVER_ENABLED when true. */
  bypassFeatureFlag?: boolean;
}

const EXPORT_NAME_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const defaultModuleNamespaceCache = new Map<string, Record<string, unknown>>();
const defaultImportPromiseCache = new Map<string, Promise<Record<string, unknown>>>();

function provenanceFromRef(ref: ExpertModuleReferenceInput): ExpertModuleResolutionProvenance {
  return {
    expertKey: ref.expertKey,
    fieldPath: ref.fieldPath,
    logicalId: ref.logicalId,
  };
}

function failure(
  ref: ExpertModuleReferenceInput,
  code: ExpertModuleResolutionErrorCode,
  message: string,
  context?: Readonly<Record<string, string>>,
): ExpertModuleResolutionFailure {
  return {
    ok: false,
    code,
    message,
    provenance: provenanceFromRef(ref),
    ...(context ? { context } : {}),
  };
}

function classifyExportKind(value: unknown): ModuleExportKind {
  return typeof value === "function" ? "function" : "object";
}

function checkExpectedExportKind(
  value: unknown,
  expected: ExpertModuleExpectedExportKind,
): string | null {
  if (expected === "unknown") return null;
  if (expected === "function") {
    return typeof value === "function"
      ? null
      : `expected function export, got ${typeof value}`;
  }
  if (value === undefined || value === null) {
    return "expected object export to be defined";
  }
  return null;
}

function isApprovedModuleId(
  moduleId: string,
  importMap: ExpertModuleImportMap,
): moduleId is ExpertModuleImportMapKey {
  return Object.prototype.hasOwnProperty.call(importMap, moduleId);
}

/**
 * Validate moduleId and exportName before any import attempt.
 *
 * Rejects relative, absolute, URL, node:, package, and traversal paths.
 */
export function validateExpertModuleReferenceInput(
  ref: ExpertModuleReferenceInput,
  importMap: ExpertModuleImportMap = EXPERT_MODULE_IMPORTERS,
): ExpertModuleResolutionFailure | null {
  const provenance = provenanceFromRef(ref);

  if (
    ref.moduleId.startsWith("./") ||
    ref.moduleId.startsWith("../") ||
    ref.moduleId.startsWith("/") ||
    /^[A-Za-z]:\\/.test(ref.moduleId)
  ) {
    return {
      ok: false,
      code: "invalid_module_reference",
      message: "Module ID must use an approved internal alias",
      provenance,
      context: { module_id: ref.moduleId },
    };
  }

  if (
    ref.moduleId.startsWith("file:") ||
    ref.moduleId.startsWith("data:") ||
    ref.moduleId.startsWith("http:") ||
    ref.moduleId.startsWith("https:") ||
    ref.moduleId.startsWith("node:")
  ) {
    return {
      ok: false,
      code: "invalid_module_reference",
      message: "Module ID URL schemes are not allowed",
      provenance,
      context: { module_id: ref.moduleId },
    };
  }

  if (ref.moduleId.includes("..")) {
    return {
      ok: false,
      code: "invalid_module_reference",
      message: "Module ID path traversal is not allowed",
      provenance,
      context: { module_id: ref.moduleId },
    };
  }

  if (!ref.moduleId.startsWith("@/")) {
    return {
      ok: false,
      code: "invalid_module_reference",
      message: "Module ID must use an approved @/ internal alias",
      provenance,
      context: { module_id: ref.moduleId },
    };
  }

  if (!EXPORT_NAME_PATTERN.test(ref.exportName)) {
    return {
      ok: false,
      code: "invalid_module_reference",
      message: "Export name must be a valid JavaScript identifier",
      provenance,
      context: { export_name: ref.exportName },
    };
  }

  if (!isApprovedModuleId(ref.moduleId, importMap)) {
    return {
      ok: false,
      code: "unsupported_module_namespace",
      message: "Module ID is not in the approved expert module import map",
      provenance,
      context: { module_id: ref.moduleId },
    };
  }

  return null;
}

async function loadModuleNamespace(
  moduleId: ExpertModuleImportMapKey,
  dependencies: ExpertModuleResolverDependencies,
): Promise<Record<string, unknown>> {
  const importMap = dependencies.importMap ?? EXPERT_MODULE_IMPORTERS;
  const namespaceCache = dependencies.moduleNamespaceCache ?? defaultModuleNamespaceCache;
  const promiseCache = dependencies.importPromiseCache ?? defaultImportPromiseCache;

  const cached = namespaceCache.get(moduleId);
  if (cached) return cached;

  let pending = promiseCache.get(moduleId);
  if (!pending) {
    pending = importMap[moduleId]()
      .then((mod) => mod as Record<string, unknown>)
      .then((mod) => {
        namespaceCache.set(moduleId, mod);
        promiseCache.delete(moduleId);
        return mod;
      })
      .catch((error) => {
        promiseCache.delete(moduleId);
        throw error;
      });
    promiseCache.set(moduleId, pending);
  }

  return pending;
}

function buildDescriptor(
  ref: ExpertModuleReferenceInput,
  exportKind: ModuleExportKind,
  handle: unknown,
): ExpertModuleExportDescriptor {
  return Object.freeze({
    expertKey: ref.expertKey,
    fieldPath: ref.fieldPath,
    logicalId: ref.logicalId,
    moduleId: ref.moduleId,
    exportName: ref.exportName,
    exportKind,
    [EXPERT_MODULE_EXPORT_HANDLE]: handle,
  });
}

/**
 * Resolve a single advertised expert module reference without invoking the export.
 */
export async function resolveExpertModuleReference(
  ref: ExpertModuleReferenceInput,
  dependencies: ExpertModuleResolverDependencies = {},
): Promise<ExpertModuleResolutionResult> {
  const featureFlagReader = dependencies.featureFlagReader ?? readExpertModuleResolverEnabled;
  if (!dependencies.bypassFeatureFlag && !featureFlagReader()) {
    return failure(
      ref,
      "resolver_disabled",
      `Expert module resolver is disabled (${EXPERT_MODULE_RESOLVER_FLAG_NAME} is off)`,
    );
  }

  const importMap = dependencies.importMap ?? EXPERT_MODULE_IMPORTERS;

  const validationError = validateExpertModuleReferenceInput(ref, importMap);
  if (validationError) return validationError;

  const moduleId = ref.moduleId as ExpertModuleImportMapKey;

  let mod: Record<string, unknown>;
  try {
    mod = await loadModuleNamespace(moduleId, dependencies);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failure(ref, "module_resolution_failed", "Module import failed", {
      module_id: ref.moduleId,
      detail: message.split("\n")[0] ?? message,
    });
  }

  if (!(ref.exportName in mod)) {
    return failure(ref, "named_export_missing", `Named export not found: ${ref.exportName}`, {
      module_id: ref.moduleId,
      export_name: ref.exportName,
    });
  }

  const exportValue = mod[ref.exportName];
  const kindError = checkExpectedExportKind(exportValue, ref.expectedExportKind);
  if (kindError) {
    return failure(ref, "export_type_mismatch", kindError, {
      module_id: ref.moduleId,
      export_name: ref.exportName,
      expected_export_kind: ref.expectedExportKind,
    });
  }

  const actualExportKind = classifyExportKind(exportValue);

  try {
    return {
      ok: true,
      provenance: provenanceFromRef(ref),
      moduleId: ref.moduleId,
      exportName: ref.exportName,
      actualExportKind,
      descriptor: buildDescriptor(ref, actualExportKind, exportValue),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failure(ref, "unexpected_resolver_failure", "Unexpected resolver failure", {
      detail: message.split("\n")[0] ?? message,
    });
  }
}

export interface ExpertModulePreflightResult {
  ok: true;
  refs: readonly AdvertisedModuleRef[];
  resolvedCount: number;
}

export interface ExpertModulePreflightFailure {
  ok: false;
  refs: readonly AdvertisedModuleRef[];
  resolvedCount: number;
  failures: readonly ExpertModuleResolutionFailure[];
}

export type ExpertModulePreflightResolutionResult =
  | ExpertModulePreflightResult
  | ExpertModulePreflightFailure;

/**
 * Diagnostics-only preflight: resolve every advertised module ref on a definition.
 *
 * Does not invoke exports, alter runtime hashes, or enable execution.
 */
export async function preflightResolveExpertRuntimeModules(
  definition: ExpertRuntimeDefinition,
  dependencies: ExpertModuleResolverDependencies = {},
): Promise<ExpertModulePreflightResolutionResult> {
  const refs = collectAdvertisedModuleRefs(definition);
  const failures: ExpertModuleResolutionFailure[] = [];
  let resolvedCount = 0;

  for (const advertised of refs) {
    const result = await resolveExpertModuleReference(
      {
        expertKey: advertised.expertKey,
        fieldPath: advertised.fieldPath,
        logicalId: advertised.logicalId,
        moduleId: advertised.moduleId,
        exportName: advertised.exportName,
        expectedExportKind: advertised.expectedExportKind,
      },
      dependencies,
    );
    if (result.ok) {
      resolvedCount += 1;
    } else {
      failures.push(result);
    }
  }

  if (failures.length === 0) {
    return { ok: true, refs, resolvedCount };
  }
  return { ok: false, refs, resolvedCount, failures };
}

/** Clear resolver module namespace and in-flight import caches (tests). */
export function clearExpertModuleResolverCache(
  dependencies: ExpertModuleResolverDependencies = {},
): void {
  const namespaceCache = dependencies.moduleNamespaceCache ?? defaultModuleNamespaceCache;
  const promiseCache = dependencies.importPromiseCache ?? defaultImportPromiseCache;
  namespaceCache.clear();
  promiseCache.clear();
}

export {
  EXPERT_MODULE_IMPORTERS,
  approvedExpertModuleIds,
  type ExpertModuleImportMapKey,
} from "./module-import-map.ts";

export {
  EXPERT_MODULE_RESOLVER_FLAG_NAME,
  readExpertModuleResolverEnabled,
} from "./feature-flags.ts";
