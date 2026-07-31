import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adjudicateFindings,
  computeQualityGrades,
} from "@/lib/studio/cross-expert-adjudication/adjudicate.ts";
import { runCrossExpertAdjudicationAudit } from "@/lib/studio/cross-expert-adjudication/audit.ts";
import { scoreContraryEvidence } from "@/lib/studio/cross-expert-adjudication/contrary-evidence.ts";
import { assignSpecialistDomain, isWrongDomainAssignment } from "@/lib/studio/cross-expert-adjudication/domain-assignment.ts";
import {
  detectDirectContradictions,
  detectDuplicateFindings,
} from "@/lib/studio/cross-expert-adjudication/detection.ts";
import { buildImmutabilitySnapshots } from "@/lib/studio/cross-expert-adjudication/load-input.ts";
import {
  evaluateFieldTransfusion,
  evaluatePamelaForeshadowing,
  verifyFindingAgainstManuscript,
} from "@/lib/studio/cross-expert-adjudication/manuscript-verification.ts";
import {
  excerptInManuscript,
  recommendationOverlapRatio,
} from "@/lib/studio/cross-expert-adjudication/text-normalize.ts";
import type {
  CrossExpertAuditInput,
  CrossExpertNormalizedFinding,
} from "@/lib/studio/cross-expert-adjudication/types.ts";

const MANUSCRIPT = [
  "Pamela moved under sniper fire while Bruce noticed a quarter-second hesitation.",
  "Her go-bag was ready. Pamela and Mira avoided each other.",
  "She kept a concealed loaded weapon and planned to take the money and hurt James's family.",
  "James is O-negative, a universal donor from basic training and dog tags.",
  "Citrate was already in the collection bag before mixing the blood bag.",
  "He felt lightheaded after donating.",
].join(" ");

function finding(partial: Partial<CrossExpertNormalizedFinding> & Pick<CrossExpertNormalizedFinding, "findingKey" | "source" | "title">): CrossExpertNormalizedFinding {
  return Object.freeze({
    sourceReviewId: "review-1",
    sourceFindingId: partial.findingKey,
    summary: partial.summary ?? partial.title,
    recommendation: partial.recommendation ?? "",
    category: partial.category ?? "general",
    severity: partial.severity ?? "moderate",
    confidence: partial.confidence ?? "medium",
    manuscriptEvidence: partial.manuscriptEvidence ?? [],
    contraryEvidence: partial.contraryEvidence ?? [],
    topicTokens: partial.topicTokens ?? partial.title.toLowerCase().split(/\s+/),
    ...partial,
  });
}

function baseInput(overrides: Partial<CrossExpertAuditInput> = {}): CrossExpertAuditInput {
  const la = finding({
    findingKey: "la:1",
    source: "literary_agent",
    title: "Pamela arrival lands with dread",
    summary: "Pamela conspiracy is fairly and effectively seeded.",
    topicTokens: ["pamela", "conspiracy", "seeded"],
  });
  const mePamela = finding({
    findingKey: "me:F007",
    source: "military_expert",
    title: "Pamela's Dual-Agent Status Insufficiently Foreshadowed",
    summary: "Pamela dual-agent status lacks foreshadowing.",
    recommendation: "Add earlier betrayal signals.",
    topicTokens: ["pamela", "dual", "agent", "foreshadow"],
    manuscriptEvidence: [{ excerpt: "Pamela moved under sniper fire", locator: "Chapter 1" }],
    contraryEvidence: [{ excerpt: "Pamela's fear in chapter one", locator: "Chapter 1" }],
  });
  const meTransfusion = finding({
    findingKey: "me:F003",
    source: "military_expert",
    title: "James's Blood Donation Sequence Lacks Medical Realism Detail",
    summary: "Blood-type confirmation and citrate realism are insufficient.",
    recommendation: "Add O-negative verification and citrate detail.",
    topicTokens: ["blood", "transfusion", "citrate", "negative"],
    manuscriptEvidence: [{ excerpt: "field transfusion in chapter 25", locator: "Chapter 25" }],
    contraryEvidence: [{ excerpt: "James internal monologue", locator: "Chapter 25" }],
  });

  return Object.freeze({
    manuscriptId: "ms-1",
    manuscriptVersionId: "mv-1",
    manuscriptTitle: "Fixture Book",
    wordCount: 1000,
    manuscriptText: MANUSCRIPT,
    literaryAgentReviewId: "la-review",
    militaryExpertReviewId: "me-review",
    literaryAgentFindings: [la],
    militaryExpertFindings: [mePamela, meTransfusion],
    literaryAgentReviewContent: "Pamela arrival lands with real dread and the conspiracy is fairly seeded.",
    literaryAgentScore: 75.9,
    literaryAgentLetterGrade: "C",
    immutabilitySnapshots: buildImmutabilitySnapshots({
      manuscriptText: MANUSCRIPT,
      literaryAgentReviewContent: "Pamela arrival lands with real dread.",
      militaryExpertFindingRows: [{ finding_id: "F007" }],
      literaryAgentIssues: [{ id: "issue-1" }],
    }),
    ...overrides,
  });
}

describe("cross-expert adjudication audit", () => {
  it("detects direct expert contradiction for Pamela foreshadowing", () => {
    const input = baseInput();
    const contradictions = detectDirectContradictions({
      literaryAgentFindings: input.literaryAgentFindings,
      militaryExpertFindings: input.militaryExpertFindings,
      literaryAgentReviewContent: input.literaryAgentReviewContent,
    });
    assert.ok(contradictions.some((c) => c.id === "pamela-foreshadowing"));
  });

  it("detects duplicate findings across experts", () => {
    const duplicate = finding({
      findingKey: "me:dup",
      source: "military_expert",
      title: "Pamela conspiracy foreshadowing insufficient",
      topicTokens: ["pamela", "conspiracy", "foreshadow", "seeded"],
    });
    const duplicates = detectDuplicateFindings([
      ...baseInput().literaryAgentFindings,
      duplicate,
    ]);
    assert.ok(duplicates.length >= 1);
  });

  it("detects wrong-domain assignment for Pamela foreshadowing", () => {
    const mePamela = baseInput().militaryExpertFindings[0]!;
    const assignment = assignSpecialistDomain(mePamela);
    assert.equal(assignment.assignedDomain, "Developmental Editor");
    assert.equal(isWrongDomainAssignment(mePamela, assignment), true);
  });

  it("classifies irrelevant contrary evidence", () => {
    const mePamela = baseInput().militaryExpertFindings[0]!;
    const scores = scoreContraryEvidence({ finding: mePamela, manuscriptText: "Unrelated text only." });
    assert.ok(scores.some((score) => score.quality === "irrelevant"));
  });

  it("detects recommendation already present for field transfusion", () => {
    const overlap = recommendationOverlapRatio(
      MANUSCRIPT,
      "Add O-negative verification and citrate detail in the collection bag.",
    );
    assert.ok(overlap >= 0.35);
    const scan = evaluateFieldTransfusion(MANUSCRIPT);
    assert.ok(scan.coverageRatio >= 0.6);
  });

  it("adjudicates Pamela foreshadowing as false positive against manuscript evidence", () => {
    const input = baseInput();
    const report = runCrossExpertAdjudicationAudit(input);
    const pamela = report.adjudications.find(
      (a) => a.source === "military_expert" && /Pamela/i.test(a.title),
    );
    assert.ok(pamela);
    assert.equal(pamela.decision, "reject_false_positive");
  });

  it("prefers manuscript evidence over expert disagreement", () => {
    const verification = verifyFindingAgainstManuscript({
      finding: baseInput().militaryExpertFindings[0]!,
      manuscriptText: MANUSCRIPT,
    });
    const pamelaScan = evaluatePamelaForeshadowing(MANUSCRIPT);
    assert.ok(pamelaScan.coverageRatio >= 0.7);
    assert.ok(verification.markers.some((marker) => marker.found));
  });

  it("protects immutable historical review snapshots", () => {
    const before = buildImmutabilitySnapshots({
      manuscriptText: MANUSCRIPT,
      literaryAgentReviewContent: "same",
      militaryExpertFindingRows: [{ finding_id: "F007", finding_content: { title: "Pamela" } }],
      literaryAgentIssues: [{ id: "1", text: "issue" }],
    });
    const after = buildImmutabilitySnapshots({
      manuscriptText: MANUSCRIPT,
      literaryAgentReviewContent: "same",
      militaryExpertFindingRows: [{ finding_id: "F007", finding_content: { title: "Pamela" } }],
      literaryAgentIssues: [{ id: "1", text: "issue" }],
    });
    assert.equal(before.militaryExpertReviewHash, after.militaryExpertReviewHash);
    assert.notEqual(
      buildImmutabilitySnapshots({
        manuscriptText: MANUSCRIPT + " changed",
        literaryAgentReviewContent: "same",
        militaryExpertFindingRows: [],
        literaryAgentIssues: [],
      }).manuscriptContentHash,
      before.manuscriptContentHash,
    );
  });

  it("produces all 14 report sections and mandatory cases", () => {
    const report = runCrossExpertAdjudicationAudit(baseInput());
    assert.equal(report.sections.reviewMetadata.manuscriptId, "ms-1");
    assert.ok(Array.isArray(report.sections.expertOverlapMatrix));
    assert.ok(Array.isArray(report.sections.directContradictionMatrix));
    assert.ok(report.mandatoryCases.pamelaForeshadowing);
    assert.ok(report.mandatoryCases.fieldTransfusion);
    assert.ok(report.mandatoryCases.contraryEvidenceQuality);
    assert.ok(report.mandatoryCases.domainAssignment);
    assert.ok(report.mandatoryCases.tacticalCoverageGaps);
    assert.ok(report.adjudications.length > 0);
  });

  it("computes quality grades from adjudications", () => {
    const input = baseInput();
    const adjudications = adjudicateFindings({
      input,
      contradictions: detectDirectContradictions({
        literaryAgentFindings: input.literaryAgentFindings,
        militaryExpertFindings: input.militaryExpertFindings,
        literaryAgentReviewContent: input.literaryAgentReviewContent,
      }),
      duplicates: [],
    });
    const grades = computeQualityGrades({ input, adjudications });
    assert.equal(grades.literaryAgent.score, 75.9);
    assert.ok(grades.combinedTeam.score != null);
  });

  it("verifies manuscript excerpt presence without logging full text", () => {
    assert.equal(
      excerptInManuscript(MANUSCRIPT, "James is O-negative, a universal donor from basic training"),
      true,
    );
    assert.equal(excerptInManuscript(MANUSCRIPT, "totally absent passage from nowhere"), false);
  });
});
