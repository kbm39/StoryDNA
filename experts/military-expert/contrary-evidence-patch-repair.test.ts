import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  analyzeContraryEvidenceViolations,
  buildContraryEvidenceSchemaRepairPrompt,
  MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING,
} from "./contrary-evidence-schema-repair.ts";
import {
  applyContraryEvidencePatches,
  buildContraryEvidencePatchRepairPrompt,
  buildRequiredContraryEvidencePatches,
  parseContraryEvidencePatchResponse,
} from "./contrary-evidence-patch-repair.ts";
import {
  baseRawResponse,
  buildValidGenerationContractInput,
  buildValidGenerationJson,
  buildValidGenerationPayload,
  FIXTURE_CONTRARY_EVIDENCE_REPAIR_FAILED,
  FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS,
  FIXTURE_CONTRARY_EVIDENCE_UNCERTAINTY_PATCH_SUCCESS,
  FIXTURE_CORRELATION_ID,
  FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY,
  FIXTURE_MANUSCRIPT_TEXT,
  FIXTURE_MISSING_CONTRARY_EVIDENCE,
} from "./generation-fixtures.ts";
import { runMilitaryExpertGenerationContract } from "./generation-contract.ts";
import { extractStrictModelJsonObject } from "./model-json-extraction.ts";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import { hashExpertRuntimeDefinition } from "@/lib/expert-review-engine/types.ts";
import { LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH } from "@/lib/expert-review-engine/literary-agent-constitution-hash.ts";

const WORKFLOW_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../lib/editorial-workflow/execute-military-expert-studio-workflow.ts"),
  "utf8",
);

const EXPECTED_LA_RUNTIME_HASH =
  "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b";
const EXPECTED_LA_CONSTITUTION_HASH =
  "8f8b56a9de6c7d68f96fd7913645905ee2afb8ce7d0c066faba2c28106fe94f5";

function parsedRootFromRaw(responseText: string): unknown {
  const extraction = extractStrictModelJsonObject(responseText);
  return JSON.parse(extraction.jsonText) as unknown;
}

describe("Military Expert patch-only contrary-evidence repair", () => {
  it("1. missing uncertainty_note on one finding produces a small patch request", () => {
    const parsed = parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText);
    const violations = analyzeContraryEvidenceViolations(parsed).violations;
    const prompt = buildContraryEvidencePatchRepairPrompt({ parsed, violations });
    assert.equal(violations.length, 1);
    assert.match(prompt.userPrompt, /uncertainty_note/);
    assert.ok(prompt.userPrompt.length < 4_000);
  });

  it("2. missing contrary_evidence on several findings produces only those patches", () => {
    const parsed = parsedRootFromRaw(FIXTURE_MISSING_CONTRARY_EVIDENCE.responseText);
    const violations = analyzeContraryEvidenceViolations(parsed).violations;
    const required = buildRequiredContraryEvidencePatches(violations);
    assert.deepEqual(
      required.map((item) => `${item.findingIndex}:${item.field}`),
      ["0:contrary_evidence", "0:uncertainty_note"],
    );
  });

  it("3. full report is not included in the repair prompt", () => {
    const parsed = parsedRootFromRaw(FIXTURE_MISSING_CONTRARY_EVIDENCE.responseText);
    const violations = analyzeContraryEvidenceViolations(parsed).violations;
    const prompt = buildContraryEvidenceSchemaRepairPrompt({ parsed, violations });
    assert.doesNotMatch(prompt.userPrompt, /"category_assessments"/);
    assert.doesNotMatch(prompt.userPrompt, /"overall_realism_assessment"/);
  });

  it("4. manuscript is not included in the repair prompt", () => {
    const parsed = parsedRootFromRaw(FIXTURE_MISSING_CONTRARY_EVIDENCE.responseText);
    const violations = analyzeContraryEvidenceViolations(parsed).violations;
    const prompt = buildContraryEvidencePatchRepairPrompt({ parsed, violations });
    assert.doesNotMatch(prompt.userPrompt, /Chapter One\n/);
    assert.doesNotMatch(prompt.userPrompt, /Captain Reyes signed the op order/);
  });

  it("5. unaffected findings are not sent to the provider", () => {
    const parsed = parsedRootFromRaw(FIXTURE_MISSING_CONTRARY_EVIDENCE.responseText);
    const violations = analyzeContraryEvidenceViolations(parsed).violations;
    const prompt = buildContraryEvidencePatchRepairPrompt({ parsed, violations });
    assert.doesNotMatch(prompt.userPrompt, /accurate-command-chain/);
    assert.doesNotMatch(prompt.userPrompt, /Company commander issues orders/);
  });

  it("6. valid patch is applied to the correct finding", () => {
    const parsed = parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText);
    const violations = analyzeContraryEvidenceViolations(parsed).violations;
    const patch = JSON.parse(FIXTURE_CONTRARY_EVIDENCE_UNCERTAINTY_PATCH_SUCCESS.responseText);
    const applied = applyContraryEvidencePatches({ parsedRoot: parsed, patch, violations });
    assert.equal(applied.ok, true);
    if (applied.ok) {
      const findings = (applied.patched as { findings: Array<{ uncertainty_note?: string }> }).findings;
      assert.match(findings[0]?.uncertainty_note ?? "", /No contrary evidence was found/);
    }
  });

  it("7. full report passes validation after a valid patch", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    assert.equal(result.contraryEvidenceRepair?.eventPayload?.repair_mode, "patch_only");
  });

  it("8. unknown finding index is rejected", () => {
    const parsed = parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText);
    const violations = analyzeContraryEvidenceViolations(parsed).violations;
    const applied = applyContraryEvidencePatches({
      parsedRoot: parsed,
      patch: {
        repairs: [{ finding_index: 99, field: "uncertainty_note", value: "No contrary evidence was found in the supplied scope." }],
      },
      violations,
    });
    assert.equal(applied.ok, false);
    if (!applied.ok) assert.equal(applied.code, "patch_unknown_finding_index");
  });

  it("9. unrequested field change is rejected", () => {
    const parsed = parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText);
    const violations = analyzeContraryEvidenceViolations(parsed).violations;
    const applied = applyContraryEvidencePatches({
      parsedRoot: parsed,
      patch: {
        repairs: [{ finding_index: 0, field: "contrary_evidence", value: [] }],
      },
      violations,
    });
    assert.equal(applied.ok, false);
    if (!applied.ok) assert.equal(applied.code, "patch_unrequested_field");
  });

  it("10. duplicate patch is rejected", () => {
    const parsed = parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText);
    const violations = analyzeContraryEvidenceViolations(parsed).violations;
    const note = "No contrary evidence was found in the supplied scope.";
    const applied = applyContraryEvidencePatches({
      parsedRoot: parsed,
      patch: {
        repairs: [
          { finding_index: 0, field: "uncertainty_note", value: note },
          { finding_index: 0, field: "uncertainty_note", value: note },
        ],
      },
      violations,
    });
    assert.equal(applied.ok, false);
    if (!applied.ok) assert.equal(applied.code, "patch_duplicate");
  });

  it("11. missing requested repair is rejected", () => {
    const parsed = parsedRootFromRaw(FIXTURE_MISSING_CONTRARY_EVIDENCE.responseText);
    const violations = analyzeContraryEvidenceViolations(parsed).violations;
    const applied = applyContraryEvidencePatches({
      parsedRoot: parsed,
      patch: FIXTURE_CONTRARY_EVIDENCE_REPAIR_FAILED.responseText
        ? JSON.parse(FIXTURE_CONTRARY_EVIDENCE_REPAIR_FAILED.responseText)
        : { repairs: [] },
      violations,
    });
    assert.equal(applied.ok, false);
    if (!applied.ok) assert.equal(applied.code, "patch_missing_repair");
  });

  it("12. patch that changes severity is rejected via extra field", () => {
    const parsedPatch = parseContraryEvidencePatchResponse({
      responseText: JSON.stringify({
        repairs: [{ finding_index: 0, field: "severity", value: "critical" }],
      }),
      maxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
    });
    assert.equal(parsedPatch.ok, false);
    if (!parsedPatch.ok) assert.equal(parsedPatch.code, "patch_extra_field");
  });

  it("13. patch that changes recommendation is rejected via extra field", () => {
    const parsed = parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText);
    const violations = analyzeContraryEvidenceViolations(parsed).violations;
    const parsedPatch = parseContraryEvidencePatchResponse({
      responseText: JSON.stringify({
        repairs: [{ finding_index: 0, field: "recommendation", value: "Rewrite everything." }],
      }),
      maxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
    });
    assert.equal(parsedPatch.ok, false);
    if (!parsedPatch.ok) assert.equal(parsedPatch.code, "patch_extra_field");
  });

  it("14. patch that adds a new finding is rejected because full report is not returned", () => {
    const parsed = parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText);
    const violations = analyzeContraryEvidenceViolations(parsed).violations;
    const parsedPatch = parseContraryEvidencePatchResponse({
      responseText: JSON.stringify({
        repairs: [],
        findings: [{ finding_id: "new-finding" }],
      }),
      maxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
    });
    assert.equal(parsedPatch.ok, true);
    const applied = applyContraryEvidencePatches({
      parsedRoot: parsed,
      patch: parsedPatch.ok ? parsedPatch.patch : { repairs: [] },
      violations,
    });
    assert.equal(applied.ok, false);
  });

  it("15. malformed patch JSON is rejected", () => {
    const parsedPatch = parseContraryEvidencePatchResponse({
      responseText: "{repairs: broken}",
      maxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
    });
    assert.equal(parsedPatch.ok, false);
    if (!parsedPatch.ok) assert.equal(parsedPatch.code, "patch_malformed_json");
  });

  it("16. multiple JSON payloads are rejected", () => {
    const parsedPatch = parseContraryEvidencePatchResponse({
      responseText: '{"repairs":[]}\n{"second":true}',
      maxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
    });
    assert.equal(parsedPatch.ok, false);
    if (!parsedPatch.ok) assert.equal(parsedPatch.code, "patch_multiple_payloads");
  });

  it("17. trailing prose is rejected", () => {
    const parsedPatch = parseContraryEvidencePatchResponse({
      responseText: '{"repairs":[]}\nHere is the corrected patch.',
      maxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
    });
    assert.equal(parsedPatch.ok, false);
    if (!parsedPatch.ok) assert.equal(parsedPatch.code, "patch_trailing_content");
  });

  it("18. repair truncation remains detected", () => {
    const parsedPatch = parseContraryEvidencePatchResponse({
      responseText: '{"repairs":[{"finding_index":0,"field":"uncertainty_note","value":"No meaningful contrary evidence was identified in the supplied manuscript evidence."}]}',
      finishStatus: "truncated",
      outputTokens: 4096,
      maxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
    });
    assert.equal(parsedPatch.ok, false);
    if (!parsedPatch.ok) assert.equal(parsedPatch.code, "provider_output_truncated");
  });

  it("19. a failed patch cannot trigger a second repair", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: FIXTURE_CONTRARY_EVIDENCE_REPAIR_FAILED,
        repairAlreadyAttempted: true,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, false);
    assert.equal(result.contraryEvidenceRepair?.attempted, true);
  });

  it("20. exactly one provider repair call remains enforced in workflow source", () => {
    assert.match(WORKFLOW_SRC, /planMilitaryExpertContraryEvidenceRepair/);
    assert.doesNotMatch(WORKFLOW_SRC, /repairAlreadyAttempted:\s*true/);
  });

  it("21. original unrelated report content remains unchanged except patched fields", () => {
    const parsed = parsedRootFromRaw(FIXTURE_MISSING_CONTRARY_EVIDENCE.responseText);
    const violations = analyzeContraryEvidenceViolations(parsed).violations;
    const before = JSON.parse(JSON.stringify(parsed)) as {
      findings: Array<Record<string, unknown>>;
      summary: string;
    };
    const applied = applyContraryEvidencePatches({
      parsedRoot: parsed,
      patch: JSON.parse(FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS.responseText),
      violations,
    });
    assert.equal(applied.ok, true);
    if (!applied.ok) return;
    const after = applied.patched as { findings: Array<Record<string, unknown>>; summary: string };
    assert.equal(after.summary, before.summary);
    assert.equal(after.findings[0].observation, before.findings[0].observation);
    assert.equal(after.findings[0].recommendation, before.findings[0].recommendation);
    assert.deepEqual(after.findings[0].contrary_evidence, []);
  });

  it("22. full validation runs after patch application", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY,
        repairResponse: FIXTURE_CONTRARY_EVIDENCE_UNCERTAINTY_PATCH_SUCCESS,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    assert.equal(result.contraryEvidenceRepair?.eventPayload?.patch_application_result, "ok");
    assert.equal(result.contraryEvidenceRepair?.eventPayload?.repair_validation_result, "ok");
  });

  it("23. workflow sequence primary fail → patch call → apply → revalidate → save path", async () => {
    const primary = FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY;
    const primaryEval = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: primary,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(primaryEval.ok, false);
    assert.equal(primaryEval.repairDecision, "schema_repair_required");

    const reEval = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: primary,
        repairResponse: FIXTURE_CONTRARY_EVIDENCE_UNCERTAINTY_PATCH_SUCCESS,
        repairMaxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(reEval.ok, true);
    assert.equal(reEval.contraryEvidenceRepair?.eventPayload?.repair_mode, "patch_only");
    assert.equal(reEval.contraryEvidenceRepair?.eventPayload?.applied_patch_count, 1);
  });

  it("24. no real provider call occurs in patch repair tests", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.modelCalls, 0);
    assert.equal(result.productionExecutionOccurred, false);
    assert.equal(result.ok, true);
  });

  it("25. Literary Agent behavior remains unchanged", () => {
    assert.equal(
      hashExpertRuntimeDefinition(literaryAgentRuntimeDefinition()),
      EXPECTED_LA_RUNTIME_HASH,
    );
    assert.equal(LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH, EXPECTED_LA_CONSTITUTION_HASH);
  });
});
