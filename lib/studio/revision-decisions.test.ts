import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  countAcceptedRevisions,
  isSameAuthorResponse,
  mapDbDispositionToStudio,
  mapStudioDispositionToDb,
  matchesRevisionFilter,
  STUDIO_DECISION_LABELS,
} from "@/lib/studio/decisions.ts";
import { buildStudioActionItems, summarizeRevisionBoard } from "@/lib/studio/revision-board.ts";
import {
  EXPERT_CATALOG_ENTRIES,
  getExpertCatalogEntry,
} from "@/lib/expert-catalog.ts";
import type { AuthorEditResponse, RevisionCandidate } from "@/lib/types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const sampleCandidate: RevisionCandidate = {
  id: "cand-1",
  manuscript_id: "ms-1",
  issue_id: "issue-1",
  phase_id: null,
  type: "line_edit",
  original: "He ran fast.",
  revised: "He sprinted.",
  locator: "Ch 3",
  word_savings: 0,
  reason: "Stronger verb",
  confidence: 0.8,
  confidence_reason: null,
  difficulty: null,
  story_risk: null,
  voice_risk: null,
  commercial_impact: null,
  reader_impact: null,
  grade_delta: null,
  consequence_if_unchanged: "Weaker beat",
  dependencies: null,
  impacts: null,
  export_mode: "inline",
  verified: false,
  status: "proposed",
  created_at: "2026-01-01T00:00:00.000Z",
};

function response(
  disposition: AuthorEditResponse["disposition"],
  overrides: Partial<AuthorEditResponse> = {},
): AuthorEditResponse {
  return {
    id: "resp-1",
    candidate_id: "cand-1",
    manuscript_id: "ms-1",
    disposition,
    author_modified_text: disposition === "modified" ? "He dashed." : null,
    author_note: null,
    responded_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Studio revision decisions", () => {
  it("1. server actions invoke requireStudioAccess", () => {
    const src = readFileSync(
      join(ROOT, "app/studio/actions/revision-decisions.ts"),
      "utf8",
    );
    assert.match(src, /requireStudioAccess/);
    assert.match(src, /acceptRevisionSuggestion/);
    assert.match(src, /reopenRevisionDecision/);
  });

  it("2. disposition mapping is explicit and distinct", () => {
    assert.equal(mapDbDispositionToStudio("accepted"), "accepted");
    assert.equal(mapDbDispositionToStudio("modified"), "accepted_modified");
    assert.equal(mapDbDispositionToStudio("rejected"), "rejected");
    assert.equal(mapDbDispositionToStudio("skipped"), "deferred");
    assert.equal(mapDbDispositionToStudio(undefined), "pending");
    assert.equal(mapStudioDispositionToDb("deferred"), "skipped");
    assert.notEqual(mapStudioDispositionToDb("rejected"), mapStudioDispositionToDb("deferred"));
  });

  it("3. UI labels avoid raw database terminology", () => {
    assert.equal(STUDIO_DECISION_LABELS.pending, "Not Reviewed");
    assert.equal(STUDIO_DECISION_LABELS.deferred, "Saved for Later");
    assert.equal(STUDIO_DECISION_LABELS.accepted_modified, "Accepted With Changes");
  });

  it("4. accept and modified count toward acceptedRevisionCount", () => {
    const count = countAcceptedRevisions([
      response("accepted"),
      response("modified"),
      response("rejected"),
      response("skipped"),
    ]);
    assert.equal(count, 2);
  });

  it("5. deferred is not counted as accepted", () => {
    const items = buildStudioActionItems({
      issues: [],
      candidates: [sampleCandidate],
      responses: [response("skipped")],
    });
    const summary = summarizeRevisionBoard(items);
    assert.equal(summary.deferred, 1);
    assert.equal(summary.acceptedRevisionCount, 0);
  });

  it("6. idempotent same response detection", () => {
    const existing = response("accepted", { author_note: "ok" });
    assert.equal(
      isSameAuthorResponse({
        existing,
        disposition: "accepted",
        authorModifiedText: null,
        authorNote: "ok",
      }),
      true,
    );
    assert.equal(
      isSameAuthorResponse({
        existing,
        disposition: "rejected",
        authorModifiedText: null,
        authorNote: "ok",
      }),
      false,
    );
  });

  it("7. filters distinguish decision states", () => {
    assert.equal(matchesRevisionFilter("pending", "not_reviewed"), true);
    assert.equal(matchesRevisionFilter("deferred", "rejected"), false);
    assert.equal(matchesRevisionFilter("accepted_modified", "accepted"), false);
    assert.equal(matchesRevisionFilter("accepted_modified", "accepted_modified"), true);
  });

  it("8. action items expose decision labels", () => {
    const accepted = buildStudioActionItems({
      issues: [],
      candidates: [sampleCandidate],
      responses: [response("modified", { author_modified_text: "He dashed." })],
    })[0]!;
    assert.equal(accepted.decisionLabel, "Accepted With Changes");
    assert.equal(accepted.acceptedText, "He dashed.");
  });

  it("9. commercial suggested-edits action unchanged", () => {
    const src = readFileSync(join(ROOT, "app/actions/suggested-edits.ts"), "utf8");
    assert.doesNotMatch(src, /requireStudioAccess/);
    assert.match(src, /submitAuthorResponse/);
  });

  it("10. expert catalog and military expert unchanged", () => {
    assert.equal(EXPERT_CATALOG_ENTRIES.length, 6);
    assert.equal(getExpertCatalogEntry("military_expert")!.selectionEnabled, false);
  });

  it("11. revision board client includes decision controls", () => {
    const src = readFileSync(
      join(ROOT, "app/studio/books/[bookId]/revisions/RevisionBoardClient.tsx"),
      "utf8",
    );
    assert.match(src, /Accept/);
    assert.match(src, /Edit &amp; Accept/);
    assert.match(src, /Save for Later/);
    assert.match(src, /Reopen Decision/);
    assert.match(src, /MANUSCRIPT_NOT_MODIFIED_MESSAGE/);
  });

  it("12. summarize revision board counts", () => {
    const items = buildStudioActionItems({
      issues: [],
      candidates: [
        sampleCandidate,
        { ...sampleCandidate, id: "c2" },
        { ...sampleCandidate, id: "c3" },
        { ...sampleCandidate, id: "c4" },
      ],
      responses: [
        response("accepted", { candidate_id: "cand-1" }),
        response("modified", { candidate_id: "c2" }),
        response("rejected", { candidate_id: "c3" }),
        response("skipped", { candidate_id: "c4" }),
      ],
    });
    const summary = summarizeRevisionBoard(items);
    assert.equal(summary.accepted, 1);
    assert.equal(summary.acceptedModified, 1);
    assert.equal(summary.rejected, 1);
    assert.equal(summary.deferred, 1);
    assert.equal(summary.acceptedRevisionCount, 2);
  });
});
