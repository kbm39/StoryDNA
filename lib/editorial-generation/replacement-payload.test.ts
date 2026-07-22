import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { ParsedIssue } from "../ai/review-engine.ts";
import { locatePassage, manuscriptPassageLocated } from "../passage-locate.ts";
import {
  buildReplacementPayload,
  verifyOriginal,
} from "./replacement-payload.ts";

const ROOT = join(import.meta.dirname, "..");
const ORCHESTRATOR_PATH = join(ROOT, "editorial-generation/run-fresh-editorial-generation.ts");
const AGENT_REVISIONS_PATH = join(ROOT, "..", "app/actions/agent-revisions.ts");

const MANUSCRIPT = [
  "Chapter One",
  "",
  "The morning sun rose over the valley.",
  "",
  "She walked slowly toward the river bank.",
].join("\n");

const MISSING = "This fabricated passage does not appear anywhere in the manuscript.";

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

function candidate(payload: ReturnType<typeof buildReplacementPayload>) {
  return payload.issues[0].candidates[0] as {
    verified: boolean;
    type: string;
    original: string;
    export_mode?: string;
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

function assertImportsSharedPayloadBuilder(source: string) {
  assert.match(source, /from\s+"@\/lib\/editorial-generation\/replacement-payload"/);
  assert.match(source, /buildReplacementPayload/);
}

describe("replacement-payload single source of truth", () => {
  it("1. Trigger workflow orchestrator imports shared buildReplacementPayload", () => {
    const source = readFileSync(ORCHESTRATOR_PATH, "utf8");
    assertImportsSharedPayloadBuilder(source);
    assert.doesNotMatch(source, /function\s+buildReplacementPayload\s*\(/);
    assert.doesNotMatch(source, /function\s+verifyOriginal\s*\(/);
    assert.doesNotMatch(source, /verified:\s*COMMENT_TYPES\.has\(type\)\s*\?\s*true/);
  });

  it("2. agent-revisions imports shared buildReplacementPayload without local duplicate", () => {
    const source = readFileSync(AGENT_REVISIONS_PATH, "utf8");
    assertImportsSharedPayloadBuilder(source);
    assert.doesNotMatch(source, /function\s+buildReplacementPayload\s*\(/);
    assert.doesNotMatch(source, /function\s+verifyOriginal\s*\(/);
    assert.doesNotMatch(source, /verified:\s*COMMENT_TYPES\.has\(type\)\s*\?\s*true/);
  });

  it("3. comment_only with missing passage is verified=false", () => {
    assert.equal(candidate(buildReplacementPayload([issueWithCandidate("comment_only", MISSING)], MANUSCRIPT)).verified, false);
  });

  it("4. reorder with missing passage is verified=false", () => {
    assert.equal(candidate(buildReplacementPayload([issueWithCandidate("reorder", MISSING)], MANUSCRIPT)).verified, false);
  });

  it("5. move with missing passage is verified=false", () => {
    assert.equal(candidate(buildReplacementPayload([issueWithCandidate("move", MISSING)], MANUSCRIPT)).verified, false);
  });

  it("6. combine with missing passage is verified=false", () => {
    assert.equal(candidate(buildReplacementPayload([issueWithCandidate("combine", MISSING)], MANUSCRIPT)).verified, false);
  });

  it("7. split with missing passage is verified=false", () => {
    assert.equal(candidate(buildReplacementPayload([issueWithCandidate("split", MISSING)], MANUSCRIPT)).verified, false);
  });

  it("8. rewrite candidate with exact passage is verified=true", () => {
    const original = "The morning sun rose over the valley.";
    assert.equal(
      candidate(buildReplacementPayload([issueWithCandidate("rewrite", original, "Morning sun lit the valley.")], MANUSCRIPT))
        .verified,
      true,
    );
  });

  it("9. normalized full passage match is verified=true", () => {
    const manuscript = "She walked   slowly\n\ntoward the river bank.";
    const original = "She walked slowly toward the river bank.";
    assert.equal(verifyOriginal(original, manuscript), true);
  });

  it("10. prefix-only match remains verified=false", () => {
    const manuscript =
      "The morning sun rose over the valley. She walked slowly toward the bridge.";
    const aiOriginal =
      "The morning sun rose over the valley. She walked slowly toward the river bank and beyond.";
    assert.notEqual(locatePassage(manuscript, aiOriginal), null);
    assert.equal(verifyOriginal(aiOriginal, manuscript), false);
    assert.equal(
      candidate(buildReplacementPayload([issueWithCandidate("comment_only", aiOriginal)], manuscript)).verified,
      false,
    );
  });

  it("11. unverified comment candidate does not trigger publish rejection", () => {
    const payload = buildReplacementPayload([issueWithCandidate("comment_only", MISSING)], MANUSCRIPT);
    const c = candidate(payload);
    assert.equal(c.verified, false);
    assert.equal(publishRpcWouldRejectVerifiedPassage(c.verified, c.original, MANUSCRIPT), false);
  });

  it("12. verified missing passage still fails closed at publish check", () => {
    assert.equal(publishRpcWouldRejectVerifiedPassage(true, MISSING, MANUSCRIPT), true);
  });

  it("13. production certification reproduction no longer marks false verified comment types", () => {
    const payload = buildReplacementPayload(
      [
        issueWithCandidate("comment_only", MISSING),
        issueWithCandidate("reorder", MISSING),
        issueWithCandidate("move", MISSING),
      ],
      MANUSCRIPT,
    );
    for (const issue of payload.issues) {
      for (const raw of issue.candidates as Array<{ verified: boolean; type: string; original: string }>) {
        assert.equal(raw.verified, false, `${raw.type} must not auto-verify`);
        assert.equal(
          publishRpcWouldRejectVerifiedPassage(raw.verified, raw.original, MANUSCRIPT),
          false,
          `${raw.type} must not fail publish`,
        );
      }
    }
  });

  it("14. comment structural types keep comment export_mode without auto-verification", () => {
    const payload = buildReplacementPayload([issueWithCandidate("comment_only", MISSING)], MANUSCRIPT);
    const c = candidate(payload);
    assert.equal(c.export_mode, "comment");
    assert.equal(c.verified, false);
  });

  it("delete candidate with missing passage is verified=false", () => {
    assert.equal(candidate(buildReplacementPayload([issueWithCandidate("delete", MISSING)], MANUSCRIPT)).verified, false);
  });
});
