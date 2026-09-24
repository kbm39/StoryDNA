import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { persistAcceptedBibleRevisionFromDryRun, persistAcceptedCanonFromDryRun } from "@/experts/archivist/execute-adapter.ts";
import { RECKONING_REVISED_13_SOURCE_PIN } from "@/experts/archivist/reckoning-revised-13-source-pin.ts";
import { getLiveProviderInvocationCount, resetLiveProviderInvocationCountForTests } from "@/lib/execute-expert/dry-run-guard.ts";
import { isArchivistCandidateReviewUiAllowed } from "./allow.ts";
import { assertNoCandidateReviewMutation } from "./load.ts";
import { presentCandidateReview, presentEvidenceSide } from "./present.ts";
import { ARCHIVIST_CANDIDATE_REVIEW_WORKFLOW_ID } from "./types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const HASH = "d1e3fb40bb864399c1459414e5286e7d3806740dd0788343c298620676602a8f";

function locatedEvidence(excerpt: string, locator: string) {
  return [{
    excerpt,
    locator,
    evidence_role: "current_observation",
    verification_status: "located",
    source_kind: "manuscript",
    manuscript_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_id,
    manuscript_version_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_version_id,
    content_hash: HASH,
  }];
}

function persistedReview() {
  return {
    schema: "archivist_review@v1",
    expert_key: "archivist",
    expert_version: "v1.0.0-draft",
    manuscript_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_id,
    manuscript_version_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_version_id,
    content_hash: HASH,
    summary: {
      confirmed_contradiction_count: 0,
      possible_conflict_count: 1,
      author_verification_count: 1,
      narrative: "Original paid assembly failed. Later $0 remediator assembled this candidate review.",
    },
    findings: [
      {
        id: "seg-finding-possible",
        issue_type: "alive_status",
        classification: "possible_continuity_conflict",
        model_classification: "confirmed_contradiction",
        final_classification: "possible_continuity_conflict",
        confirmation_eligibility: "ineligible",
        classification_adjustment_reason: "Continuity compatibility is a compatible change or insufficient evidence, so confirmation cannot stand.",
        severity: "major",
        confidence: "high",
        current_location: { locator: "CHAPTER TWENTY-SIX", chapter: "CHAPTER TWENTY-SIX" },
        current_evidence: locatedEvidence("No body, no confirmation. We remain vigilant.", "CHAPTER TWENTY-SIX"),
        conflicting_location: { locator: "CHAPTER TWO", chapter: "CHAPTER TWO" },
        conflicting_evidence: locatedEvidence("Internal security is already drafting a warrant.", "CHAPTER TWO"),
        temporal_analysis: { relation: "earlier_later", explanation: "Alive/dead chronology differs." },
        explanation: "Alive/dead chronology differs.",
        suggested_resolution: "Author should reconcile the two observations.",
      },
      {
        id: "seg-finding-avn",
        issue_type: "rank_title",
        classification: "author_verification_needed",
        model_classification: "confirmed_contradiction",
        final_classification: "author_verification_needed",
        confirmation_eligibility: "insufficient_evidence",
        classification_adjustment_reason: "Deterministic confirmation gates failed: unresolved_entity.",
        severity: "major",
        confidence: "high",
        current_location: { locator: "CHAPTER SEVEN" },
        current_evidence: locatedEvidence("Navy SEAL, assigned to a Quick Reaction Team, twenty years of service", "CHAPTER SEVEN"),
        conflicting_location: { locator: "PROLOGUE" },
        conflicting_evidence: [],
        temporal_analysis: { relation: "earlier_later", explanation: "Rank/title history differs." },
        explanation: "Rank/title history differs.",
        suggested_resolution: "Author should reconcile the two observations.",
      },
    ],
    canon_delta: [
      {
        id: "f1",
        entity: { alias: "Cole", resolution: "not_found", entity_type: "person" },
        entity_type: "person",
        fact_type: "appearance",
        proposed_fact_value: { mark: "HOLD FAST tattoo" },
        temporal_scope: { kind: "at", chapter: "CHAPTER NINE" },
        source_location: { locator: "CHAPTER NINE" },
        evidence: locatedEvidence("HOLD FAST, the old sailor’s tattoo, two words inked up the inside of his wrist in heavy black letters.", "CHAPTER NINE"),
        confidence: "high",
        proposed_authority: "current_observation",
        status: "candidate",
        inferred: false,
      },
    ],
    entity_ambiguities: [],
    metrics: {
      finding_count: 2,
      confirmed_contradiction_count: 0,
      possible_conflict_count: 1,
      author_verification_count: 1,
      canon_delta_count: 1,
      entity_ambiguity_count: 0,
      evidence_record_count: 3,
    },
    generation: {
      provider: "none",
      model: "none",
      prompt_version: "archivist_prompt@v1-draft",
      validator_version: "archivist_validators@v1-draft",
      normalization_version: "archivist_normalization@v1-draft",
      definition_hash: "x",
    },
    author_challenge_supported: true,
  };
}

function presentValid() {
  return presentCandidateReview({
    review: persistedReview(),
    workflow: {
      id: ARCHIVIST_CANDIDATE_REVIEW_WORKFLOW_ID,
      status: "failed",
      manuscript_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_id,
      manuscript_version_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_version_id,
      content_hash: HASH,
    },
    coverage: {
      unique_words_covered: 109887,
      canonical_manuscript_words: 109887,
      coverage_percentage: 100,
      complete: true,
      unit_count: 30,
      units_represented: 30,
      segment_count: 14,
      uncovered_ranges: [],
    },
    cost: {
      historical_paid_usd: 0.468,
      paid_calls: 17,
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
    },
    withheld_graph_ambiguity_count: 9,
  });
}

describe("Archivist persisted candidate review UI", () => {
  it("loads a persisted review even when the historical workflow is failed", () => {
    const model = presentValid();
    assert.ok(model);
    assert.equal(model.review_status, "candidate_review_validated");
    assert.equal(model.historical_workflow_status, "failed");
    assert.equal(model.audit.original_workflow_status, "failed");
    assert.match(model.audit.note, /failed strict evidence verification/);
  });

  it("renders 100% coverage and grouped findings from persisted data", () => {
    const model = presentValid()!;
    assert.equal(model.coverage.percentage, 100);
    assert.equal(model.coverage.words_covered, 109887);
    assert.equal(model.coverage.gaps, 0);
    assert.equal(model.summary.confirmed_contradiction_count, 0);
    assert.equal(model.findings.confirmed_contradiction.length, 0);
    assert.equal(model.findings.possible_continuity_conflict.length, 1);
    assert.equal(model.findings.author_verification_needed.length, 1);
  });

  it("quotes only located both-side evidence and never quotes quarantined text", () => {
    const model = presentValid()!;
    const possible = model.findings.possible_continuity_conflict[0]!;
    assert.equal(possible.current_evidence.kind, "quoted");
    assert.equal(possible.conflicting_evidence.kind, "quoted");
    const avn = model.findings.author_verification_needed[0]!;
    assert.equal(avn.conflicting_evidence.kind, "unverified");
    assert.match(avn.conflicting_evidence.message, /could not be verified/);
    const paraphrased = presentEvidenceSide(
      [{
        excerpt: "Mara lingered near the entrance with striking azure irises.",
        locator: "PROLOGUE",
        verification_status: "unverified",
        source_kind: "manuscript",
      }],
      "PROLOGUE",
    );
    assert.equal(paraphrased.kind, "unverified");
  });

  it("shows model-vs-final downgrades without treating the model as authoritative", () => {
    const model = presentValid()!;
    assert.equal(model.model_vs_final.promotions, 0);
    assert.equal(model.model_vs_final.downgrades, 2);
    const finding = model.findings.possible_continuity_conflict[0]!;
    assert.equal(finding.model_classification, "confirmed_contradiction");
    assert.equal(finding.final_classification, "possible_continuity_conflict");
    assert.match(finding.classification_adjustment_reason, /Continuity compatibility/);
  });

  it("renders candidate canon as candidate-only and keeps mutation paths closed", () => {
    const model = presentValid()!;
    assert.equal(model.candidate_canon_count, 1);
    assert.equal(model.candidate_canon[0]?.entity, "Cole");
    assert.equal(model.candidate_canon[0]?.facts[0]?.status, "candidate");
    assert.equal(model.future_actions.every((action) => action.disabled === true), true);
    assert.throws(assertNoCandidateReviewMutation, /read-only/);
    assert.throws(persistAcceptedCanonFromDryRun);
    assert.throws(persistAcceptedBibleRevisionFromDryRun);
  });

  it("pins REVISED-13 identity and withholds invalid ambiguities", () => {
    const model = presentValid()!;
    assert.equal(model.manuscript_id, RECKONING_REVISED_13_SOURCE_PIN.manuscript_id);
    assert.equal(model.manuscript_version_id, RECKONING_REVISED_13_SOURCE_PIN.manuscript_version_id);
    assert.equal(model.source_label, "REVISED-13");
    assert.equal(model.ambiguities.length, 0);
    assert.equal(model.withheld_graph_ambiguity_count, 9);
  });

  it("fails closed on a missing or malformed persisted review", () => {
    const missing = presentCandidateReview({
      review: {},
      workflow: {
        id: "x",
        status: "failed",
        manuscript_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_id,
        manuscript_version_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_version_id,
      },
    });
    assert.equal(missing, null);
    const wrongManuscript = presentCandidateReview({
      review: { ...persistedReview(), manuscript_id: "other" },
      workflow: {
        id: ARCHIVIST_CANDIDATE_REVIEW_WORKFLOW_ID,
        status: "failed",
        manuscript_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_id,
        manuscript_version_id: RECKONING_REVISED_13_SOURCE_PIN.manuscript_version_id,
      },
    });
    assert.equal(wrongManuscript, null);
  });

  it("does not import a provider or call one on the read path", () => {
    resetLiveProviderInvocationCountForTests();
    const before = getLiveProviderInvocationCount();
    presentValid();
    assert.equal(getLiveProviderInvocationCount(), before);
    const load = readFileSync(join(ROOT, "lib/archivist-candidate-review/load.ts"), "utf8");
    const panel = readFileSync(join(ROOT, "app/manuscripts/[id]/ArchivistCandidateReviewPanel.tsx"), "utf8");
    for (const source of [load, panel]) {
      assert.doesNotMatch(source, /@anthropic-ai\/sdk|from "openai"|executeExpert|runPaidSegmentedPilot/);
    }
  });

  it("mounts the real candidate review above the distinct dry-run panel", () => {
    const page = readFileSync(join(ROOT, "app/manuscripts/[id]/page.tsx"), "utf8");
    const dryRun = readFileSync(join(ROOT, "app/manuscripts/[id]/ArchivistDryRunPanel.tsx"), "utf8");
    assert.match(page, /ArchivistCandidateReviewPanel/);
    assert.match(page, /LiteraryAgentPublishingSection/);
    assert.match(dryRun, /Archivist Dry Run/);
    assert.match(dryRun, /not the real candidate review/);
    assert.equal(isArchivistCandidateReviewUiAllowed({ NODE_ENV: "production" }), false);
  });
});
