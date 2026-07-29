import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import { hashExpertRuntimeDefinition } from "@/lib/expert-review-engine/types.ts";
import { LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH } from "@/lib/expert-review-engine/literary-agent-constitution-hash.ts";
import {
  analyzeQualifyingUnresolvedFindings,
  evaluateProvisionalRelease,
  MAX_PROVISIONAL_CONTRARY_EVIDENCE_FINDINGS,
  MAX_PROVISIONAL_UNRESOLVED_FINDINGS,
} from "./provisional-release.ts";
import {
  buildProvisionalUnresolvedPayload,
  buildUnresolvedNegativeFinding,
  buildValidGenerationContractInput,
  buildValidGenerationPayload,
  FIXTURE_CONTRARY_EVIDENCE_REPAIR_FAILED,
  FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS,
  FIXTURE_MALFORMED_JSON,
  FIXTURE_MISSING_CONTRARY_EVIDENCE,
  FIXTURE_MISSING_EVIDENCE,
  FIXTURE_MULTIPLE_PAYLOADS,
  FIXTURE_NINE_UNRESOLVED,
  FIXTURE_ONE_UNRESOLVED,
  FIXTURE_TEN_UNRESOLVED,
  FIXTURE_TRAILING_CLOSING_FENCE,
  FIXTURE_UNSAFE_OPERATIONAL_DETAIL,
  baseRawResponse,
} from "./generation-fixtures.ts";
import {
  MILITARY_EXPERT_RUNTIME_DEFINITION_HASH,
  runMilitaryExpertGenerationContract,
} from "./generation-contract.ts";
import { parseMilitaryExpertGenerationResponse } from "./parsing.ts";
import { classifyMilitaryExpertRepairNeed } from "./repair-classification.ts";
import { extractStrictModelJsonObject } from "./model-json-extraction.ts";
import { prepareSavedMilitaryExpertReport } from "@/lib/studio/military-expert-report-persistence.ts";
import {
  buildMilitaryExpertBoardCandidates,
  partitionMilitaryExpertBoardCandidates,
} from "@/lib/studio/military-expert-revision-board.ts";
import { computeMilitaryExpertScoreSummary } from "@/lib/studio/military-expert-scoring.ts";
import { buildAuthorReviewRequiredSection } from "@/lib/studio/military-expert-display.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const WORKFLOW_SRC = readFileSync(
  join(ROOT, "lib/editorial-workflow/execute-military-expert-studio-workflow.ts"),
  "utf8",
);
const DISPLAY_SRC = readFileSync(
  join(ROOT, "app/studio/books/[bookId]/experts/MilitaryExpertAuthorReviewPanel.tsx"),
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

async function runFailedRepairContract(raw = FIXTURE_ONE_UNRESOLVED) {
  return runMilitaryExpertGenerationContract(
    {
      ...buildValidGenerationContractInput(),
      rawResponse: raw,
      repairResponse: FIXTURE_CONTRARY_EVIDENCE_REPAIR_FAILED,
      repairAlreadyAttempted: true,
    },
    { bypassFeatureFlag: true },
  );
}

describe("Military Expert provisional release", () => {
  it("1. zero unresolved findings releases normally", async () => {
    const result = await runMilitaryExpertGenerationContract(buildValidGenerationContractInput(), {
      bypassFeatureFlag: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.generationStatus, "success");
    assert.equal(result.review?.review_status, "complete");
    assert.equal(result.provisionalRelease?.used, undefined);
  });

  it("2. one unresolved finding releases provisionally after failed repair", async () => {
    const result = await runFailedRepairContract(FIXTURE_ONE_UNRESOLVED);
    assert.equal(result.ok, true);
    assert.equal(result.generationStatus, "provisional_success");
    assert.equal(result.review?.review_status, "completed_with_author_review_required");
    assert.equal(result.provisionalRelease?.unresolvedCount, 1);
  });

  it("3. nine unresolved findings release provisionally", async () => {
    const result = await runFailedRepairContract(FIXTURE_NINE_UNRESOLVED);
    assert.equal(result.ok, true);
    assert.equal(result.generationStatus, "provisional_success");
    assert.equal(result.provisionalRelease?.unresolvedCount, 9);
  });

  it("4. ten unresolved findings do not release normally", async () => {
    const result = await runFailedRepairContract(FIXTURE_TEN_UNRESOLVED);
    assert.equal(result.ok, false);
    assert.equal(result.parseFailureCode, "TOO_MANY_UNRESOLVED_CONTRARY_EVIDENCE_FINDINGS");
  });

  it("5. unresolved contrary_evidence qualifies only when rest of finding is valid", () => {
    const parsed = parsedRootFromRaw(FIXTURE_ONE_UNRESOLVED.responseText);
    const { qualifying } = analyzeQualifyingUnresolvedFindings(parsed);
    assert.equal(qualifying.length, 1);
    assert.deepEqual(qualifying[0]?.missingFields, ["contrary_evidence"]);
  });

  it("6. unresolved uncertainty_note qualifies only when rest of finding is valid", () => {
    const finding = buildUnresolvedNegativeFinding({
      findingId: "uncertainty-only",
      title: "Uncertainty only",
      missingFields: [],
    });
    finding.contrary_evidence = [];
    delete (finding as { uncertainty_note?: unknown }).uncertainty_note;
    const payload = {
      ...buildProvisionalUnresolvedPayload(0),
      findings: [buildValidGenerationPayload().findings[0], finding],
    };
    const { qualifying } = analyzeQualifyingUnresolvedFindings(payload);
    assert.equal(qualifying.length, 1);
    assert.ok(qualifying[0]?.missingFields.includes("uncertainty_note"));
  });

  it("7. missing supporting evidence does not qualify", () => {
    const result = evaluateProvisionalRelease({
      parsedRoot: parsedRootFromRaw(FIXTURE_MISSING_EVIDENCE.responseText),
      parseFailureCode: "evidence_missing",
      manuscriptVersionId: "mv-test",
      reviewScope: "full_manuscript",
      definitionHash: MILITARY_EXPERT_RUNTIME_DEFINITION_HASH,
      repairAttempted: true,
      repairSucceeded: false,
    });
    assert.equal(result, null);
  });

  it("8. truncated output does not qualify", () => {
    const truncated = {
      ...FIXTURE_ONE_UNRESOLVED,
      finishStatus: "truncated" as const,
    };
    const classification = classifyMilitaryExpertRepairNeed({ raw: truncated });
    assert.equal(classification.decision, "reject_output");
    const result = evaluateProvisionalRelease({
      parsedRoot: parsedRootFromRaw(FIXTURE_ONE_UNRESOLVED.responseText),
      parseFailureCode: "provider_output_truncated",
      manuscriptVersionId: "mv-test",
      reviewScope: "full_manuscript",
      definitionHash: MILITARY_EXPERT_RUNTIME_DEFINITION_HASH,
      repairAttempted: true,
      repairSucceeded: false,
    });
    assert.equal(result, null);
  });

  it("9. malformed JSON does not qualify", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_MALFORMED_JSON);
    assert.equal(parsed.ok, false);
    const classification = classifyMilitaryExpertRepairNeed({ raw: FIXTURE_MALFORMED_JSON });
    assert.ok(
      classification.decision === "reject_output" ||
        classification.decision === "provider_repair_required",
    );
  });

  it("10. multiple payloads do not qualify", () => {
    const classification = classifyMilitaryExpertRepairNeed({ raw: FIXTURE_MULTIPLE_PAYLOADS });
    assert.equal(classification.decision, "reject_output");
    assert.equal(classification.parseFailureCode, "multiple_payloads");
  });

  it("11. safety failure does not qualify", () => {
    const result = evaluateProvisionalRelease({
      parsedRoot: parsedRootFromRaw(FIXTURE_UNSAFE_OPERATIONAL_DETAIL.responseText),
      parseFailureCode: "evidence_missing",
      manuscriptVersionId: "mv-test",
      reviewScope: "full_manuscript",
      definitionHash: MILITARY_EXPERT_RUNTIME_DEFINITION_HASH,
      repairAttempted: true,
      repairSucceeded: false,
    });
    assert.equal(result, null);
  });

  it("12. fully validated findings save normally", async () => {
    const result = await runMilitaryExpertGenerationContract(buildValidGenerationContractInput(), {
      bypassFeatureFlag: true,
    });
    assert.ok(result.review);
    const saved = prepareSavedMilitaryExpertReport({
      review: result.review,
      parsedReviewHash: result.parsedReviewHash ?? "hash",
    });
    assert.equal(saved.validatedFindingCount, result.review.findings.length);
    assert.equal(saved.authorReviewRequiredCount, 0);
  });

  it("13. provisional findings save with author_review_required status", async () => {
    const result = await runFailedRepairContract(FIXTURE_ONE_UNRESOLVED);
    assert.ok(result.review);
    const saved = prepareSavedMilitaryExpertReport({
      review: result.review,
      parsedReviewHash: result.parsedReviewHash ?? "hash",
    });
    assert.equal(saved.authorReviewRequiredCount, 1);
    assert.equal(saved.findings.some((item) => item.findingStatus === "author_review_required"), true);
  });

  it("14. provisional findings create investigation candidates", async () => {
    const result = await runFailedRepairContract(FIXTURE_ONE_UNRESOLVED);
    assert.ok(result.review);
    const partitioned = partitionMilitaryExpertBoardCandidates(
      buildMilitaryExpertBoardCandidates(result.review),
    );
    assert.equal(partitioned.investigationCandidates.length, 1);
    assert.match(partitioned.investigationCandidates[0]?.taskLanguage ?? "", /Review the cited evidence/);
  });

  it("15. provisional findings do not create normal revision candidates", async () => {
    const result = await runFailedRepairContract(FIXTURE_ONE_UNRESOLVED);
    assert.ok(result.review);
    const partitioned = partitionMilitaryExpertBoardCandidates(
      buildMilitaryExpertBoardCandidates(result.review),
    );
    const provisionalFinding = result.review.findings.find(
      (item) => item.finding_status === "author_review_required",
    );
    assert.ok(provisionalFinding);
    assert.equal(
      partitioned.revisionCandidates.some((item) => item.findingId === provisionalFinding.finding_id),
      false,
    );
  });

  it("16. provisional findings do not affect scores or grades", async () => {
    const complete = await runMilitaryExpertGenerationContract(buildValidGenerationContractInput(), {
      bypassFeatureFlag: true,
    });
    const provisional = await runFailedRepairContract(FIXTURE_ONE_UNRESOLVED);
    assert.ok(complete.review && provisional.review);
    const completeScore = computeMilitaryExpertScoreSummary(complete.review);
    const provisionalScore = computeMilitaryExpertScoreSummary(provisional.review);
    assert.equal(provisionalScore.authorReviewRequiredCount, 1);
    assert.equal(provisionalScore.gradeEligible, false);
    assert.equal(provisionalScore.confirmedIssueCount, completeScore.confirmedIssueCount - 1);
    assert.equal(provisionalScore.scoreDeductionTotal, completeScore.scoreDeductionTotal);
    assert.match(provisionalScore.authorReviewRequiredLabel, /Author Review Required: 1/);
  });

  it("17. provisional findings appear in separate Author Review Required section", async () => {
    const result = await runFailedRepairContract(FIXTURE_ONE_UNRESOLVED);
    assert.ok(result.review);
    const section = buildAuthorReviewRequiredSection(result.review.findings);
    assert.equal(section.length, 1);
    assert.match(section[0]?.heading ?? "", /AUTHOR REVIEW REQUIRED/);
    assert.equal(section[0]?.authorResponseToolsAvailable, false);
    assert.match(section[0]?.recommendedAuthorAction ?? "", /Author response tools are not yet available/);
    assert.match(DISPLAY_SRC, /Author Review Required/);
  });

  it("18. each unresolved finding is individually identified", async () => {
    const result = await runFailedRepairContract(FIXTURE_NINE_UNRESOLVED);
    assert.ok(result.review);
    const indexes = result.provisionalRelease?.unresolvedFindingIndexes ?? [];
    assert.equal(indexes.length, 9);
    const section = buildAuthorReviewRequiredSection(result.review.findings);
    assert.equal(section.length, 9);
    assert.equal(new Set(section.map((item) => item.findingId)).size, 9);
  });

  it("19. repair success produces a normal validated finding", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    assert.equal(result.generationStatus, "success");
    assert.equal(result.review?.review_status, "complete");
  });

  it("20. repair failure with 1-9 qualifying findings uses provisional release", async () => {
    const result = await runFailedRepairContract(FIXTURE_ONE_UNRESOLVED);
    assert.equal(result.generationStatus, "provisional_success");
    assert.equal(result.provisionalRelease?.used, true);
  });

  it("21. repair failure with 10+ findings remains blocked", async () => {
    const result = await runFailedRepairContract(FIXTURE_TEN_UNRESOLVED);
    assert.equal(result.ok, false);
    assert.equal(result.parseFailureCode, "TOO_MANY_UNRESOLVED_CONTRARY_EVIDENCE_FINDINGS");
  });

  it("22. exactly one repair attempt remains enforced", async () => {
    const blocked = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_ONE_UNRESOLVED,
        repairAlreadyAttempted: true,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(blocked.ok, true);
    assert.equal(blocked.generationStatus, "provisional_success");
  });

  it("23. Literary Agent behavior remains unchanged", () => {
    assert.equal(
      hashExpertRuntimeDefinition(literaryAgentRuntimeDefinition()),
      EXPECTED_LA_RUNTIME_HASH,
    );
    assert.equal(LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH, EXPECTED_LA_CONSTITUTION_HASH);
  });

  it("24. no provider call occurs in unit tests", async () => {
    const result = await runFailedRepairContract(FIXTURE_ONE_UNRESOLVED);
    assert.equal(result.modelCalls, 0);
    assert.equal(result.productionExecutionOccurred, false);
  });

  it("threshold constant is authoritative", () => {
    assert.equal(MAX_PROVISIONAL_CONTRARY_EVIDENCE_FINDINGS, 9);
    assert.equal(MAX_PROVISIONAL_UNRESOLVED_FINDINGS, 9);
  });

  it("workflow wiring handles provisional completion and diagnostics", async () => {
    assert.match(WORKFLOW_SRC, /military_expert_provisional_release/);
    assert.match(WORKFLOW_SRC, /provisional_success/);
    assert.match(WORKFLOW_SRC, /TOO_MANY_UNRESOLVED_FINDINGS/);

    const result = await runFailedRepairContract(
      baseRawResponse(JSON.stringify(buildProvisionalUnresolvedPayload(3))),
    );
    assert.equal(result.ok, true);
    assert.equal(result.generationStatus, "provisional_success");
    assert.ok(result.review);
    assert.equal(result.review.findings.filter((f) => f.finding_status === "validated").length, 1);
    assert.equal(
      result.review.findings.filter((f) => f.finding_status === "author_review_required").length,
      3,
    );
    const saved = prepareSavedMilitaryExpertReport({
      review: result.review,
      parsedReviewHash: result.parsedReviewHash ?? "hash",
    });
    const candidates = partitionMilitaryExpertBoardCandidates(
      buildMilitaryExpertBoardCandidates(result.review),
    );
    const score = computeMilitaryExpertScoreSummary(result.review);
    assert.equal(saved.authorReviewRequiredCount, 3);
    assert.equal(candidates.investigationCandidates.length, 3);
    assert.equal(score.authorReviewRequiredCount, 3);
    assert.equal(score.gradeEligible, false);
    assert.ok(result.provisionalRelease?.eventPayload);
    assert.equal(result.provisionalRelease?.eventPayload.provisional_release_used, true);
    assert.equal(
      JSON.stringify(result.provisionalRelease?.eventPayload).includes("Corporal Hale"),
      false,
    );
  });

  it("trailing-fence complete report remains eligible baseline", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_CLOSING_FENCE);
    assert.equal(parsed.ok, true);
  });

  it("direct provisional evaluator validates review path", () => {
    const parsed = buildProvisionalUnresolvedPayload(2);
    const built = evaluateProvisionalRelease({
      parsedRoot: parsed,
      parseFailureCode: "evidence_missing",
      manuscriptVersionId: "mv-test",
      reviewScope: "full_manuscript",
      definitionHash: MILITARY_EXPERT_RUNTIME_DEFINITION_HASH,
      repairAttempted: true,
      repairSucceeded: false,
    });
    assert.ok(built?.ok);
    if (built?.ok) {
      assert.equal(built.review.review_status, "completed_with_author_review_required");
      assert.equal(built.qualifyingFindings.length, 2);
    }
  });

  it("26. primary report releases provisionally without provider repair when experiment enabled", async () => {
    const prior = { ...process.env };
    process.env.NODE_ENV = "development";
    process.env.STUDIO_ENABLED = "true";
    process.env.STUDIO_MILITARY_EXPERT_ENABLED = "1";

    try {
      const result = await runMilitaryExpertGenerationContract(
        {
          ...buildValidGenerationContractInput(),
          rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        },
        { bypassFeatureFlag: true },
      );
      assert.equal(result.ok, true);
      assert.equal(result.generationStatus, "provisional_success");
      assert.equal(result.review?.review_status, "completed_with_author_review_required");
      assert.equal(result.contraryEvidenceRepair?.attempted, undefined);
      assert.equal(result.provisionalRelease?.used, true);
    } finally {
      process.env = prior;
    }
  });

  it("27. primary provisional path does not run when experiment disabled", async () => {
    const prior = { ...process.env };
    process.env.NODE_ENV = "development";
    process.env.STUDIO_ENABLED = "true";
    delete process.env.STUDIO_MILITARY_EXPERT_ENABLED;

    try {
      const result = await runMilitaryExpertGenerationContract(
        {
          ...buildValidGenerationContractInput(),
          rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        },
        { bypassFeatureFlag: true },
      );
      assert.equal(result.ok, false);
      assert.notEqual(result.generationStatus, "provisional_success");
    } finally {
      process.env = prior;
    }
  });
});
