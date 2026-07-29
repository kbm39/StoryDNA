import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FIXTURE_COMMUNICATIONS_TERMINOLOGY } from "@/experts/military-expert/fixtures.ts";
import {
  serializeMilitaryExpertFindingContent,
  parsePersistedMilitaryExpertFindingContent,
} from "@/lib/studio/military-expert-finding-content.ts";
import {
  MILITARY_EXPERT_INVESTIGATE_BEFORE_REVISING,
  MILITARY_EXPERT_NOT_PROVIDED,
  buildMilitaryExpertFindingDisplayItem,
  buildMilitaryExpertFindingDisplayItems,
} from "@/lib/studio/military-expert-finding-display.ts";

const CONFIRMED_CONTENT = serializeMilitaryExpertFindingContent(
  FIXTURE_COMMUNICATIONS_TERMINOLOGY,
  [],
);

const AUTHOR_REVIEW_CONTENT = serializeMilitaryExpertFindingContent(
  {
    ...FIXTURE_COMMUNICATIONS_TERMINOLOGY,
    finding_status: "author_review_required",
    uncertainty_note: "Could not verify whether informal chatter was intentional characterization.",
  },
  ["contrary_evidence", "uncertainty_note"],
);

describe("military expert finding display", () => {
  it("1. confirmed finding displays full persisted prose", () => {
    const item = buildMilitaryExpertFindingDisplayItem({
      findingId: "confirmed-1",
      findingIndex: 0,
      findingStatus: "validated",
      category: "communications_and_terminology",
      severity: "moderate",
      confidence: "medium",
      findingContent: CONFIRMED_CONTENT,
    });

    assert.equal(item.status, "confirmed");
    assert.equal(item.statusLabel, "Confirmed Finding");
    assert.equal(item.title, FIXTURE_COMMUNICATIONS_TERMINOLOGY.title);
    assert.equal(item.concern, FIXTURE_COMMUNICATIONS_TERMINOLOGY.observation);
    assert.match(item.whyItMatters, /operational|credibility|trust/i);
    assert.equal(item.recommendedAction, FIXTURE_COMMUNICATIONS_TERMINOLOGY.recommendation);
    assert.equal(item.contentPersisted, true);
  });

  it("2. author-review-required finding displays persisted prose", () => {
    const item = buildMilitaryExpertFindingDisplayItem({
      findingId: "review-1",
      findingIndex: 1,
      findingStatus: "author_review_required",
      category: "communications_and_terminology",
      severity: "moderate",
      confidence: "medium",
      findingContent: AUTHOR_REVIEW_CONTENT,
    });

    assert.equal(item.status, "author_review_required");
    assert.equal(item.statusLabel, "AUTHOR REVIEW REQUIRED");
    assert.equal(item.recommendedAction, MILITARY_EXPERT_INVESTIGATE_BEFORE_REVISING);
    assert.match(item.uncertaintyExplanation, /Could not verify/i);
    assert.deepEqual(item.couldNotVerify, [
      "contrary evidence not verified",
      "uncertainty explanation not completed",
    ]);
  });

  it("3. finding order preserved in batch display items", () => {
    const items = buildMilitaryExpertFindingDisplayItems([
      {
        findingId: "first",
        findingIndex: 0,
        findingStatus: "validated",
        category: "command_and_organization",
        severity: "minor",
        confidence: "medium",
        findingContent: CONFIRMED_CONTENT,
      },
      {
        findingId: "second",
        findingIndex: 1,
        findingStatus: "author_review_required",
        category: "logistics_and_timing",
        severity: "major",
        confidence: "high",
        findingContent: AUTHOR_REVIEW_CONTENT,
      },
    ]);

    assert.deepEqual(
      items.map((item) => item.findingId),
      ["first", "second"],
    );
  });

  it("4. supporting evidence displays under correct heading", () => {
    const item = buildMilitaryExpertFindingDisplayItem({
      findingId: "confirmed-1",
      findingIndex: 0,
      findingStatus: "validated",
      category: "communications_and_terminology",
      severity: "moderate",
      confidence: "medium",
      findingContent: CONFIRMED_CONTENT,
    });

    assert.equal(item.supportingEvidence.heading, "Supporting evidence");
    assert.ok(item.supportingEvidence.items.length > 0);
    assert.match(item.supportingEvidence.summary, /Chapter 6/i);
  });

  it("5. contrary evidence displays separately when present", () => {
    const content = serializeMilitaryExpertFindingContent(
      {
        ...FIXTURE_COMMUNICATIONS_TERMINOLOGY,
        contrary_evidence: [{ excerpt: "They used standard brevity codes earlier.", locator: "Chapter 5" }],
      },
      [],
    );
    const item = buildMilitaryExpertFindingDisplayItem({
      findingId: "confirmed-contrary",
      findingIndex: 0,
      findingStatus: "validated",
      category: "communications_and_terminology",
      severity: "moderate",
      confidence: "medium",
      findingContent: content,
    });

    assert.ok(item.contraryEvidence);
    assert.equal(item.contraryEvidence.heading, "Contrary evidence");
    assert.match(item.contraryEvidence.summary, /Chapter 5/i);
  });

  it("6. missing contrary evidence is not invented", () => {
    const item = buildMilitaryExpertFindingDisplayItem({
      findingId: "review-1",
      findingIndex: 0,
      findingStatus: "author_review_required",
      category: "communications_and_terminology",
      severity: "moderate",
      confidence: "medium",
      findingContent: AUTHOR_REVIEW_CONTENT,
    });

    assert.equal(item.contraryEvidence, null);
    assert.ok(item.couldNotVerify.includes("contrary evidence not verified"));
  });

  it("7. uncertainty notes display for provisional findings", () => {
    const item = buildMilitaryExpertFindingDisplayItem({
      findingId: "review-1",
      findingIndex: 0,
      findingStatus: "author_review_required",
      category: "communications_and_terminology",
      severity: "moderate",
      confidence: "medium",
      findingContent: AUTHOR_REVIEW_CONTENT,
    });

    assert.match(item.uncertaintyExplanation, /Could not verify/i);
  });

  it("8. recommendations display for confirmed findings", () => {
    const item = buildMilitaryExpertFindingDisplayItem({
      findingId: "confirmed-1",
      findingIndex: 0,
      findingStatus: "validated",
      category: "communications_and_terminology",
      severity: "moderate",
      confidence: "medium",
      findingContent: CONFIRMED_CONTENT,
    });

    assert.equal(item.recommendedAction, FIXTURE_COMMUNICATIONS_TERMINOLOGY.recommendation);
  });

  it("9. confirmed findings are not mislabeled as provisional", () => {
    const item = buildMilitaryExpertFindingDisplayItem({
      findingId: "confirmed-1",
      findingIndex: 0,
      findingStatus: "validated",
      category: "communications_and_terminology",
      severity: "moderate",
      confidence: "medium",
      findingContent: CONFIRMED_CONTENT,
    });

    assert.equal(item.status, "confirmed");
    assert.notEqual(item.statusLabel, "AUTHOR REVIEW REQUIRED");
  });

  it("10. provisional findings are not mislabeled as confirmed", () => {
    const item = buildMilitaryExpertFindingDisplayItem({
      findingId: "review-1",
      findingIndex: 0,
      findingStatus: "author_review_required",
      category: "communications_and_terminology",
      severity: "moderate",
      confidence: "medium",
      findingContent: AUTHOR_REVIEW_CONTENT,
    });

    assert.equal(item.status, "author_review_required");
    assert.equal(item.statusLabel, "AUTHOR REVIEW REQUIRED");
  });

  it("11. legacy rows without content show honest placeholders", () => {
    const item = buildMilitaryExpertFindingDisplayItem({
      findingId: "legacy-1",
      findingIndex: 0,
      findingStatus: "validated",
      category: "command_and_organization",
      severity: "moderate",
      confidence: "medium",
      findingContent: null,
    });

    assert.equal(item.contentPersisted, false);
    assert.equal(item.concern, MILITARY_EXPERT_NOT_PROVIDED);
    assert.equal(item.whyItMatters, MILITARY_EXPERT_NOT_PROVIDED);
    assert.equal(item.supportingEvidence.summary, MILITARY_EXPERT_NOT_PROVIDED);
  });

  it("12. serialized content round-trips through parse", () => {
    const parsed = parsePersistedMilitaryExpertFindingContent(CONFIRMED_CONTENT);
    assert.ok(parsed);
    assert.equal(parsed.title, CONFIRMED_CONTENT.title);
    assert.equal(parsed.observation, CONFIRMED_CONTENT.observation);
    assert.equal(parsed.manuscript_evidence.length, CONFIRMED_CONTENT.manuscript_evidence.length);
  });
});
