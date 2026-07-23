import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ExpertRuntimeModuleReferenceFields } from "./types.ts";
import {
  RUNTIME_MODULE_REF_ROOT_COLLECTORS,
  collectAdvertisedModuleRefs,
  collectedModuleRefExportSections,
} from "./collect-module-refs.ts";
import { RUNTIME_MODULE_REF_EXPORT_SECTIONS } from "./module-ref-inventory.ts";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";

type CollectorRootKeys = keyof typeof RUNTIME_MODULE_REF_ROOT_COLLECTORS;
type SchemaModuleRefRootKeys = keyof ExpertRuntimeModuleReferenceFields;

type AssertCollectorMatchesSchemaRoots = SchemaModuleRefRootKeys extends CollectorRootKeys
  ? CollectorRootKeys extends SchemaModuleRefRootKeys
    ? true
    : never
  : never;

/** Compile-time proof: collector map is exhaustive over ExpertRuntimeModuleReferenceFields. */
const _collectorMatchesSchemaRoots: AssertCollectorMatchesSchemaRoots = true;
void _collectorMatchesSchemaRoots;

const SCHEMA_MODULE_REF_ROOTS = [
  "prompt_builder",
  "rubric_definition",
  "validation_plugins",
  "repair_plugins",
  "normalization_plugins",
  "contrary_evidence_policy",
  "revision_candidate_policy",
  "passage_verification_policy",
  "publishing_policy",
  "export_policy",
] as const satisfies readonly SchemaModuleRefRootKeys[];

describe("module reference schema exhaustiveness", () => {
  it("RUNTIME_MODULE_REF_ROOT_COLLECTORS covers every ExpertRuntimeModuleReferenceFields root", () => {
    const collectorRoots = Object.keys(RUNTIME_MODULE_REF_ROOT_COLLECTORS).sort();
    const schemaRoots = [...SCHEMA_MODULE_REF_ROOTS].sort();
    assert.deepEqual(collectorRoots, schemaRoots);
  });

  it("Literary Agent collected export sections match authoritative export section list", () => {
    const collected = collectedModuleRefExportSections(
      collectAdvertisedModuleRefs(literaryAgentRuntimeDefinition()),
    );
    assert.deepEqual(collected, [...RUNTIME_MODULE_REF_EXPORT_SECTIONS].sort());
  });

  it("documents how an omitted root would fail compilation", () => {
    assert.ok(_collectorMatchesSchemaRoots);
    // Adding a new key to ExpertRuntimeModuleReferenceFields without updating
    // runtimeModuleRefRootCollectors breaks the typed collector map at compile time.
  });
});
