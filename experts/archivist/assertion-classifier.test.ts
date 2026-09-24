import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyPhraseAssertion,
  phraseIsAsserted,
  textHasAssertedPhrase,
} from "./assertion-classifier.ts";
import { hasSeparateInjuryExplanation } from "./injury-laterality.ts";
import { hasObjectTransferExplanation } from "./object-possession.ts";
import type { ArchivistFinding } from "./contracts.ts";

function finding(overrides: Partial<ArchivistFinding>): ArchivistFinding {
  return {
    id: "f1",
    issue_type: "injury",
    classification: "confirmed_contradiction",
    severity: "major",
    confidence: "high",
    current_location: { locator: "Chapter 11", chapter: "11" },
    conflicting_location: { locator: "Chapter 11", chapter: "11" },
    current_evidence: [],
    conflicting_evidence: [],
    temporal_analysis: {
      relation: "same_time",
      explanation: "",
      current_scope: { kind: "at", chapter: "11" },
      conflicting_scope: { kind: "at", chapter: "11" },
    },
    explanation: "",
    suggested_resolution: "Check continuity.",
    author_action: "pending",
    author_challenge_supported: true,
    ...overrides,
  };
}

describe("Archivist assertion classifier", () => {
  it("does not treat negated or hypothetical injury language as a transition", () => {
    assert.equal(phraseIsAsserted("no second injury", "second injury"), false);
    assert.equal(classifyPhraseAssertion("no second injury", "second injury")?.polarity, "negated");
    assert.equal(
      phraseIsAsserted("without evidence of another injury", "another injury"),
      false,
    );
    assert.equal(phraseIsAsserted("there was never another injury", "another injury"), false);
    assert.equal(phraseIsAsserted("she did not suffer another injury", "another injury"), false);
    assert.equal(phraseIsAsserted("if another injury occurred", "another injury"), false);
    assert.equal(phraseIsAsserted("unless another injury occurred", "another injury"), false);
    assert.equal(
      classifyPhraseAssertion("if another injury occurred", "another injury")?.polarity,
      "hypothetical",
    );
    assert.equal(phraseIsAsserted("perhaps another injury occurred", "another injury"), false);
    assert.equal(
      classifyPhraseAssertion("perhaps another injury occurred", "another injury")?.polarity,
      "speculative",
    );
    assert.equal(
      phraseIsAsserted(
        "Laterality changes require explicit justification (e.g., 'a second wound on the right side').",
        "second wound",
      ),
      false,
    );
    assert.equal(
      hasSeparateInjuryExplanation(
        finding({
          temporal_analysis: {
            relation: "same_time",
            explanation: "There is no intervening narrative that introduces a second injury.",
            current_scope: { kind: "at", chapter: "11" },
            conflicting_scope: { kind: "at", chapter: "11" },
          },
        }),
      ),
      false,
    );
  });

  it("treats explicit second, bilateral, or corrected-diagnosis language as asserted", () => {
    assert.equal(phraseIsAsserted("she injured the other shoulder later", "later"), true);
    assert.equal(phraseIsAsserted("she injured the other shoulder two weeks later", "later"), true);
    assert.equal(
      phraseIsAsserted("a second wound struck the right side", "second wound"),
      true,
    );
    assert.equal(
      phraseIsAsserted("corrected diagnosis identified the right shoulder", "corrected diagnosis"),
      true,
    );
    assert.equal(
      hasSeparateInjuryExplanation(
        finding({
          conflicting_evidence: [
            {
              excerpt: "A second wound struck his right arm.",
              locator: "Chapter 12",
              evidence_role: "conflicting_canon",
              verification_status: "located",
              source_kind: "manuscript",
            },
          ],
        }),
      ),
      true,
    );
    assert.equal(
      hasSeparateInjuryExplanation(
        finding({
          explanation: "The medic recorded bilateral shoulder injuries.",
        }),
      ),
      true,
    );
    assert.equal(
      hasSeparateInjuryExplanation(
        finding({
          explanation: "A corrected diagnosis placed the wound on the right shoulder.",
        }),
      ),
      true,
    );
  });

  it("does not treat negated or hypothetical loss as a transfer", () => {
    assert.equal(phraseIsAsserted("no evidence she lost it", "lost"), false);
    assert.equal(phraseIsAsserted("she may have lost it", "lost"), false);
    assert.equal(phraseIsAsserted("she may have transferred it", "transferred"), false);
    assert.equal(phraseIsAsserted("if she gave it away", "gave"), false);
    assert.equal(phraseIsAsserted("unless he gave it away", "gave"), false);
    assert.equal(phraseIsAsserted("maybe she lost it", "lost"), false);
    assert.equal(phraseIsAsserted("she could have transferred it", "transferred"), false);
    assert.equal(phraseIsAsserted("she could have given it away", "given"), false);
    assert.equal(
      hasObjectTransferExplanation(
        finding({
          issue_type: "possession",
          explanation: "There is no evidence Mara lost the compass.",
        }),
      ),
      false,
    );
  });

  it("treats explicit loss, handoff, and recovery chronology as asserted transfers", () => {
    assert.equal(phraseIsAsserted("she lost the compass at the station", "lost"), true);
    assert.equal(phraseIsAsserted("he handed the compass to Hale", "handed"), true);
    assert.equal(phraseIsAsserted("he handed the compass to Mara", "handed"), true);
    assert.equal(phraseIsAsserted("the object was transferred to Mara", "transferred"), true);
    assert.equal(phraseIsAsserted("the object was transferred to Hale", "transferred"), true);
    assert.equal(phraseIsAsserted("the compass was later recovered", "recovered"), true);
    assert.equal(
      hasObjectTransferExplanation(
        finding({
          issue_type: "possession",
          explanation: "She lost it at the station, then Calder found it and returned it the next morning.",
        }),
      ),
      true,
    );
    assert.equal(
      textHasAssertedPhrase("Mara handed Calder the silver compass.", ["handed", "lost", "gave"]),
      true,
    );
  });
});
