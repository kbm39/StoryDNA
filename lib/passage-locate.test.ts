import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  locatePassage,
  manuscriptPassageLocated,
} from "./passage-locate.ts";
import {
  buildReplacementPayload,
  verifyOriginal,
} from "./editorial-generation/replacement-payload.ts";
import type { ParsedIssue } from "./ai/review-engine.ts";

/** Mirrors publish RPC rejection rule for verified candidates. */
function publishRpcWouldRejectVerifiedPassage(
  verified: boolean,
  original: string,
  manuscriptText: string,
): boolean {
  if (!verified) return false;
  return !manuscriptPassageLocated(manuscriptText, original);
}

function issueWithCandidate(original: string, revised = ""): ParsedIssue {
  return {
    key: "test-issue",
    text: "Test issue",
    area: "prose",
    severity: "medium",
    source_section: "memo",
    success_criterion: "fixed",
    candidates: [
      {
        type: "tighten",
        original,
        revised,
        locator: "Chapter One",
        word_savings: 0,
        reason: "test",
        confidence: 80,
        confidence_reason: "test",
        difficulty: "easy",
        story_risk: "low",
        voice_risk: "low",
        commercial_impact: "medium",
        reader_impact: "medium",
        grade_delta: 1,
        consequence_if_unchanged: "unchanged",
        dependencies: "",
        impacts: {
          pacing: 0,
          clarity: 1,
          commercial_readiness: 0,
          emotional_impact: 0,
          voice_preservation: 0,
          submission_readiness: 0,
        },
      },
    ],
  };
}

const HOLD_FAST_OPENING = [
  "\n\n\n\n\n\n\n\n\n\nHOLD FAST",
  "",
  "The morning sun rose over the valley.",
  "",
  "She walked slowly toward the river bank.",
].join("\n");

describe("manuscriptPassageLocated (publish-time SQL parity)", () => {
  it("1. production Hold Fast opening: full located passage verifies", () => {
    const original = "The morning sun rose over the valley.";
    assert.equal(manuscriptPassageLocated(HOLD_FAST_OPENING, original), true);
    assert.equal(verifyOriginal(original, HOLD_FAST_OPENING), true);
  });

  it("2. verified passage survives publishing check", () => {
    const manuscript = "Alpha beta gamma delta epsilon zeta.";
    const original = "beta gamma delta";
    const payload = buildReplacementPayload([issueWithCandidate(original)], manuscript);
    const candidate = payload.issues[0].candidates[0] as { verified: boolean; original: string };
    assert.equal(candidate.verified, true);
    assert.equal(
      publishRpcWouldRejectVerifiedPassage(candidate.verified, candidate.original, manuscript),
      false,
    );
  });

  it("3. whitespace differences: collapsed match succeeds", () => {
    const manuscript = "She walked   slowly\n\ntoward the river bank.";
    const original = "She walked slowly toward the river bank.";
    assert.equal(manuscriptPassageLocated(manuscript, original), true);
  });

  it("4. smart quotes: both sides must match literally (fail closed)", () => {
    const manuscript = "He said \u201chello\u201d to her.";
    const original = 'He said "hello" to her.';
    assert.equal(manuscriptPassageLocated(manuscript, original), false);
    assert.equal(verifyOriginal(original, manuscript), false);
  });

  it("5. unicode normalization: no NFC/NFD bridging", () => {
    const manuscript = "caf\u00e9 au lait tomorrow morning";
    const original = "cafe\u0301 au lait tomorrow";
    assert.equal(manuscriptPassageLocated(manuscript, original), false);
  });

  it("6. paragraph boundary changes via whitespace collapse", () => {
    const manuscript = "First paragraph ends here.\n\nSecond paragraph begins now.";
    const original = "First paragraph ends here. Second paragraph begins now.";
    assert.equal(manuscriptPassageLocated(manuscript, original), true);
  });

  it("7. repeated identical sentences: full needle must match", () => {
    const manuscript = "Repeat line here. Repeat line here. Repeat line here.";
    const original = "Repeat line here. Repeat line here.";
    assert.equal(manuscriptPassageLocated(manuscript, original), true);
  });

  it("8. very long paragraph: full passage required (no prefix probe)", () => {
    const base = "word ".repeat(200);
    const manuscript = base + "unique tail marker.";
    const hallucinated = base + "unique tail marker and extra invented words beyond manuscript.";
    assert.notEqual(locatePassage(manuscript, hallucinated), null);
    assert.equal(manuscriptPassageLocated(manuscript, hallucinated), false);
    assert.equal(verifyOriginal(hallucinated, manuscript), false);
  });

  it("9. leading/trailing punctuation: direct mismatch fails", () => {
    const manuscript = "Hello, world!";
    const original = "Hello world";
    assert.equal(manuscriptPassageLocated(manuscript, original), false);
  });

  it("10. exact production VERIFIED_PASSAGE_NOT_LOCATED reproduction (prefix probe false positive)", () => {
    const manuscript =
      "The morning sun rose over the valley. She walked slowly toward the bridge.";
    const aiOriginal =
      "The morning sun rose over the valley. She walked slowly toward the river bank and beyond.";
    assert.notEqual(locatePassage(manuscript, aiOriginal), null);
    const payload = buildReplacementPayload([issueWithCandidate(aiOriginal)], manuscript);
    const candidate = payload.issues[0].candidates[0] as { verified: boolean; original: string };
    assert.equal(candidate.verified, false);
    assert.equal(
      publishRpcWouldRejectVerifiedPassage(candidate.verified, candidate.original, manuscript),
      false,
    );
  });

  it("11. publishing succeeds after fix when passage is genuinely located", () => {
    const manuscript = HOLD_FAST_OPENING;
    const original = "She walked slowly toward the river bank.";
    const payload = buildReplacementPayload([issueWithCandidate(original)], manuscript);
    const candidate = payload.issues[0].candidates[0] as { verified: boolean; original: string };
    assert.equal(candidate.verified, true);
    assert.equal(
      publishRpcWouldRejectVerifiedPassage(candidate.verified, candidate.original, manuscript),
      false,
    );
  });

  it("12. genuine missing passage still fails closed", () => {
    const original = "This sentence was never written in the manuscript at all.";
    assert.equal(manuscriptPassageLocated(HOLD_FAST_OPENING, original), false);
    assert.equal(verifyOriginal(original, HOLD_FAST_OPENING), false);
    const payload = buildReplacementPayload([issueWithCandidate(original)], HOLD_FAST_OPENING);
    const candidate = payload.issues[0].candidates[0] as { verified: boolean };
    assert.equal(candidate.verified, false);
  });

  it("leading newlines: uses raw DB text like SQL (PG trim is space-only)", () => {
    const manuscript = "\n\n\nChapter body with enough length to verify here.";
    const original = "Chapter body with enough length to verify here.";
    assert.equal(manuscriptPassageLocated(manuscript, original), true);
  });
});
