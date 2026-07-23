/**
 * Dynamic import verification for advertised module references (P2-03).
 *
 * Test/validation infrastructure only — does not execute exported functions.
 */

import { collectAdvertisedModuleRefs, type AdvertisedModuleRef } from "./collect-module-refs.ts";
import type { ExpertRuntimeDefinition } from "./types.ts";
import type { ModuleExportKind } from "./module-ref-inventory.ts";

export interface ModuleRefVerificationFailure {
  expertKey: string;
  fieldPath: string;
  moduleId: string;
  exportName: string;
  reason: string;
}

export type ModuleRefVerificationResult =
  | { ok: true; refs: AdvertisedModuleRef[] }
  | { ok: false; failures: ModuleRefVerificationFailure[] };

/** Test-only module importer — NOT the future production resolver. */
export type TestModuleImporter = (moduleId: string) => Promise<Record<string, unknown>>;

function failure(
  ref: AdvertisedModuleRef,
  reason: string,
): ModuleRefVerificationFailure {
  return {
    expertKey: ref.expertKey,
    fieldPath: ref.fieldPath,
    moduleId: ref.moduleId,
    exportName: ref.exportName,
    reason,
  };
}

function checkExportKind(
  value: unknown,
  expected: ModuleExportKind,
): string | null {
  if (expected === "function") {
    return typeof value === "function"
      ? null
      : `export_type_mismatch: expected function export, got ${typeof value}`;
  }
  if (value === undefined || value === null) {
    return "export_type_mismatch: expected object export to be defined";
  }
  return null;
}

/**
 * Test-only dynamic import helper.
 *
 * Resolves `@/` paths via Node's test loader (`scripts/test-path-alias.mjs`) by appending `.ts`.
 * This behavior is intentionally narrow and must not be reused as the production module resolver.
 */
export async function testOnlyModuleImporter(moduleId: string): Promise<Record<string, unknown>> {
  return (await import(`${moduleId}.ts`)) as Record<string, unknown>;
}

/** Verify every advertised module reference without invoking exported functions. */
export async function verifyAdvertisedModuleRefs(
  def: ExpertRuntimeDefinition,
  options?: { importModule?: TestModuleImporter },
): Promise<ModuleRefVerificationResult> {
  const importModule = options?.importModule ?? testOnlyModuleImporter;
  const refs = collectAdvertisedModuleRefs(def);
  const failures: ModuleRefVerificationFailure[] = [];

  for (const ref of refs) {
    let mod: Record<string, unknown>;
    try {
      mod = await importModule(ref.moduleId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(failure(ref, `module_resolution_failed: ${message}`));
      continue;
    }

    if (!(ref.exportName in mod)) {
      failures.push(failure(ref, `named_export_missing: ${ref.exportName}`));
      continue;
    }

    const exportValue = mod[ref.exportName];
    const kindError = checkExportKind(exportValue, ref.expectedExportKind);
    if (kindError) {
      failures.push(failure(ref, kindError));
    }
  }

  return failures.length === 0 ? { ok: true, refs } : { ok: false, failures };
}
