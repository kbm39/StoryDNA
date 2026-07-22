/**
 * Dynamic import verification for Literary Agent runtime module references.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import type { ExpertRuntimeDefinition } from "../types.ts";

interface ModuleExportRef {
  label: string;
  moduleId: string;
  exportName: string;
  kind: "function" | "object";
}

function collectLiteraryAgentModuleRefs(def: ExpertRuntimeDefinition): ModuleExportRef[] {
  const refs: ModuleExportRef[] = [];

  const pb = def.prompt_builder;
  refs.push(
    { label: "prompt_builder.reviewerDefinition", moduleId: pb.reviewerDefinitionModuleId, exportName: pb.reviewerDefinitionExport, kind: "object" },
    { label: "prompt_builder.systemPrompt", moduleId: pb.reviewerDefinitionModuleId, exportName: pb.systemPromptExport, kind: "function" },
    { label: "prompt_builder.reviewPrompt", moduleId: pb.reviewerDefinitionModuleId, exportName: pb.reviewPromptExport, kind: "function" },
    { label: "prompt_builder.revisionCandidatesPrompt", moduleId: pb.reviewerDefinitionModuleId, exportName: pb.revisionCandidatesPromptExport, kind: "function" },
  );

  if (def.rubric_definition.moduleId && def.rubric_definition.exportName) {
    refs.push({
      label: "rubric_definition",
      moduleId: def.rubric_definition.moduleId,
      exportName: def.rubric_definition.exportName,
      kind: "function",
    });
  }

  for (const plugin of def.validation_plugins) {
    refs.push({ label: `validation:${plugin.id}`, moduleId: plugin.moduleId, exportName: plugin.exportName, kind: "function" });
  }

  for (const plugin of def.repair_plugins) {
    refs.push({ label: `repair:${plugin.id}`, moduleId: plugin.moduleId, exportName: plugin.exportName, kind: "function" });
  }

  for (const plugin of def.normalization_plugins) {
    refs.push({ label: `normalization:${plugin.id}`, moduleId: plugin.moduleId, exportName: plugin.exportName, kind: "function" });
  }

  if (def.passage_verification_policy.payloadBuilderModuleId) {
    refs.push({
      label: "passage_verification_policy",
      moduleId: def.passage_verification_policy.payloadBuilderModuleId,
      exportName: def.passage_verification_policy.payloadBuilderExport,
      kind: "function",
    });
  }

  if (def.export_policy.docxModuleId && def.export_policy.docxExportName) {
    refs.push({
      label: "export_policy.docx",
      moduleId: def.export_policy.docxModuleId,
      exportName: def.export_policy.docxExportName,
      kind: "function",
    });
  }

  return refs;
}

describe("Literary Agent runtime module ref parity — dynamic import", () => {
  const def = literaryAgentRuntimeDefinition();
  const refs = collectLiteraryAgentModuleRefs(def);

  it("collects every advertised module export reference", () => {
    assert.equal(refs.length, 13);
    const labels = refs.map((r) => r.label);
    assert.deepEqual(def.normalization_plugins.map((p) => p.id), ["memo_statistics"]);
    assert.ok(labels.includes("normalization:memo_statistics"));
    assert.ok(labels.includes("validation:post_scoring_rubric"));
    assert.equal(labels.some((l) => l.includes("narrow_broad")), false);
    assert.equal(labels.some((l) => l.includes("rubric_against_gate")), false);
  });

  for (const ref of refs) {
    it(`${ref.label} resolves ${ref.moduleId} → ${ref.exportName}`, async () => {
      const mod = (await import(`${ref.moduleId}.ts`)) as Record<string, unknown>;
      assert.ok(ref.exportName in mod, `missing export ${ref.exportName} on ${ref.moduleId}`);
      const value = mod[ref.exportName];
      if (ref.kind === "function") {
        assert.equal(typeof value, "function", `${ref.exportName} must be a function`);
      } else {
        assert.ok(value !== undefined && value !== null, `${ref.exportName} must be defined`);
      }
    });
  }
});
