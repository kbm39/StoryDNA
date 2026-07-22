import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ParsedIssue } from "../ai/review-engine.ts";
import {
  buildReplacementPayload,
  verifyOriginal,
} from "./replacement-payload.ts";
import { manuscriptPassageLocated } from "../passage-locate.ts";

const MANUSCRIPT = [
  "Chapter One",
  "",
  "The morning sun rose over the valley.",
  "",
  "She walked slowly toward the river bank.",
].join("\n");

function issueWithCandidate(type: string, original: string, revised = ""): ParsedIssue {
  return {
    key: "test-issue",
    text: "Test issue",
    area: "prose",
    severity: "medium",
    source_section: "memo",
    success_criterion: "fixed",
    candidates: [
      {
        type,
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

/** Mirrors publish RPC: reject only when payload verified=true and passage not located. */
function publishRpcWouldRejectVerifiedPassage(
  verified: boolean,
  original: string,
  manuscriptText: string,
): boolean {
  if (!verified) return false;
  return !manuscriptPassageLocated(manuscriptText, original);
}

describe("buildReplacementPayload passage verification", () => {
  it("structural candidate with unlocatable original has verified=false", () => {
    const payload = buildReplacementPayload(
      [issueWithCandidate("reorder", "This passage is not in the manuscript at all.")],
      MANUSCRIPT,
    );
    const candidate = payload.issues[0].candidates[0] as { verified: boolean; type: string };
    assert.equal(candidate.type, "reorder");
    assert.equal(candidate.verified, false);
  });

  it("comment candidate with unlocatable original has verified=false", () => {
    const payload = buildReplacementPayload(
      [issueWithCandidate("comment_only", "Fabricated anchor text never written by author.")],
      MANUSCRIPT,
    );
    const candidate = payload.issues[0].candidates[0] as { verified: boolean; type: string };
    assert.equal(candidate.type, "comment_only");
    assert.equal(candidate.verified, false);
  });

  it("replacement candidate with located original has verified=true", () => {
    const original = "The morning sun rose over the valley.";
    const payload = buildReplacementPayload(
      [issueWithCandidate("tighten", original, "Morning sun lit the valley.")],
      MANUSCRIPT,
    );
    const candidate = payload.issues[0].candidates[0] as { verified: boolean; type: string };
    assert.equal(candidate.type, "tighten");
    assert.equal(candidate.verified, true);
    assert.equal(verifyOriginal(original, MANUSCRIPT), true);
  });

  it("unmatched passage is not falsely labeled verified and is not rejected by publish RPC", () => {
    const original = "Completely invented sentence not present anywhere.";
    const payload = buildReplacementPayload(
      [issueWithCandidate("comment_only", original)],
      MANUSCRIPT,
    );
    const candidate = payload.issues[0].candidates[0] as { verified: boolean; original: string };
    assert.equal(candidate.verified, false);
    assert.equal(
      publishRpcWouldRejectVerifiedPassage(candidate.verified, candidate.original, MANUSCRIPT),
      false,
    );
  });
});
