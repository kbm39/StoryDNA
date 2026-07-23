import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import {
  RUNTIME_MODULE_REF_EXPORT_SECTIONS,
  RUNTIME_MODULE_ONLY_FIELD_PATHS,
} from "./module-ref-inventory.ts";
import {
  RUNTIME_MODULE_REF_ROOT_COLLECTORS,
  collectAdvertisedModuleRefs,
  collectedModuleRefExportSections,
} from "./collect-module-refs.ts";
import type { ExpertRuntimeDefinition } from "./types.ts";

function minimalRuntimeDefinition(
  overrides: Partial<ExpertRuntimeDefinition>,
): ExpertRuntimeDefinition {
  const base = literaryAgentRuntimeDefinition();
  return { ...base, ...overrides };
}

describe("collectAdvertisedModuleRefs", () => {
  it("returns deterministic ordering for Literary Agent", () => {
    const def = literaryAgentRuntimeDefinition();
    const first = collectAdvertisedModuleRefs(def);
    const second = collectAdvertisedModuleRefs(def);
    assert.deepEqual(first, second);
    for (let i = 1; i < first.length; i++) {
      const prev = first[i - 1]!;
      const curr = first[i]!;
      const ordered =
        prev.fieldPath.localeCompare(curr.fieldPath) <= 0 &&
        (prev.fieldPath !== curr.fieldPath ||
          prev.logicalId.localeCompare(curr.logicalId) <= 0);
      assert.ok(ordered, `refs out of order: ${prev.fieldPath} then ${curr.fieldPath}`);
    }
  });

  it("invokes every root collector exactly once per definition", () => {
    const def = literaryAgentRuntimeDefinition();
    const rootCount = Object.keys(RUNTIME_MODULE_REF_ROOT_COLLECTORS).length;
    assert.equal(rootCount, 10);
    const refs = collectAdvertisedModuleRefs(def);
    assert.ok(refs.length > 0);
    assert.deepEqual(
      collectedModuleRefExportSections(refs),
      [...RUNTIME_MODULE_REF_EXPORT_SECTIONS].sort(),
    );
  });

  it("includes provenance on every collected ref", () => {
    const refs = collectAdvertisedModuleRefs(literaryAgentRuntimeDefinition());
    assert.ok(refs.length > 0);
    for (const ref of refs) {
      assert.equal(ref.expertKey, "literary_agent");
      assert.ok(ref.fieldPath.length > 0);
      assert.ok(ref.logicalId.length > 0);
      assert.ok(ref.moduleId.startsWith("@/"));
      assert.ok(ref.exportName.length > 0);
      assert.ok(RUNTIME_MODULE_REF_EXPORT_SECTIONS.includes(ref.sectionId));
    }
  });

  it("preserves distinct provenance for repeated moduleId values", () => {
    const refs = collectAdvertisedModuleRefs(literaryAgentRuntimeDefinition());
    const reviewEngineRefs = refs.filter((r) => r.moduleId === "@/lib/ai/review-engine");
    assert.ok(reviewEngineRefs.length >= 4);
    const fieldPaths = new Set(reviewEngineRefs.map((r) => r.fieldPath));
    assert.equal(fieldPaths.size, reviewEngineRefs.length);
  });

  it("documents module-only field paths excluded from export verification", () => {
    const def = literaryAgentRuntimeDefinition();
    assert.ok(def.contrary_evidence_policy.moduleId);
    assert.ok(def.publishing_policy.rpcModuleId);
    assert.ok(def.revision_candidate_policy.commentExportTypesModuleId);
    const refs = collectAdvertisedModuleRefs(def);
    const moduleIds = refs.map((r) => r.moduleId);
    assert.equal(moduleIds.includes(def.publishing_policy.rpcModuleId), false);
    assert.equal(RUNTIME_MODULE_ONLY_FIELD_PATHS.length, 3);
  });

  it("omits optional rubric and export refs when both pair members are absent", () => {
    const def = minimalRuntimeDefinition({
      rubric_definition: { kind: "none" },
      export_policy: { reportSections: [] },
    });
    const refs = collectAdvertisedModuleRefs(def);
    assert.equal(refs.some((r) => r.sectionId === "rubric_definition.export"), false);
    assert.equal(refs.some((r) => r.sectionId === "export_policy.docx"), false);
  });

  it("collects optional rubric pair when both members are present", () => {
    const def = literaryAgentRuntimeDefinition();
    const refs = collectAdvertisedModuleRefs(def);
    assert.ok(refs.some((r) => r.sectionId === "rubric_definition.export"));
    assert.ok(refs.some((r) => r.sectionId === "export_policy.docx"));
  });
});
