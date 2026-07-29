import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EditorialWorkflowRow } from "@/lib/editorial-workflow/types.ts";
import {
  MILITARY_EXPERT_AUTHOR_RESPONSE_UNAVAILABLE,
  MILITARY_EXPERT_CONCERNS_REQUIRING_ATTENTION_LABEL,
  MILITARY_EXPERT_COUNT_EXPLANATION,
  MILITARY_EXPERT_FULLY_VALIDATED_FINDINGS_HEADING,
  MILITARY_EXPERT_NEED_YOUR_REVIEW_LABEL,
  MILITARY_EXPERT_NO_EVIDENCE_EXCERPT_SUMMARY,
  MILITARY_EXPERT_REVISION_BOARD_UNAVAILABLE,
  buildMilitaryExpertCountExplanation,
} from "@/lib/studio/military-expert-display.ts";
import {
  buildCompletedReportStatusLabel,
  buildMilitaryExpertReportDisplayModel,
  getLatestCompletedMilitaryExpertDraftReview,
  getMilitaryExpertDraftReviewById,
  isDisplayableMilitaryExpertReviewStatus,
  loadMilitaryExpertReportDisplayModel,
  militaryExpertReportHref,
  resolveMilitaryExpertReviewFromAuthoritativeResultId,
  resolveMilitaryExpertTeamRunStatus,
  type MilitaryExpertDraftFindingRow,
  type MilitaryExpertDraftReviewRow,
} from "@/lib/studio/military-expert-draft-review-view.ts";

const MANUSCRIPT_ID = "e63c07fa-634d-4d32-8052-6194ff965d91";
const OTHER_MANUSCRIPT_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const REVIEW_UUID = "de5504c0-ec1c-4a77-bd66-1d5a43781be8";
const OLDER_REVIEW_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WORKFLOW_ID = "cb62530c-296c-4a75-9954-aab11b9e91ab";

function reviewRow(
  overrides: Partial<MilitaryExpertDraftReviewRow> = {},
): MilitaryExpertDraftReviewRow {
  return Object.freeze({
    id: REVIEW_UUID,
    workflow_id: WORKFLOW_ID,
    manuscript_id: MANUSCRIPT_ID,
    manuscript_version_id: VERSION_ID,
    review_status: "completed_with_author_review_required",
    generation_status: "provisional_success",
    provisional_release_used: true,
    author_review_required_count: 3,
    validated_finding_count: 4,
    created_at: "2026-07-29T12:00:00.000Z",
    ...overrides,
  });
}

function findingRow(
  overrides: Partial<MilitaryExpertDraftFindingRow> = {},
): MilitaryExpertDraftFindingRow {
  return Object.freeze({
    finding_index: 0,
    finding_id: "finding-001",
    finding_status: "validated",
    category: "command_and_organization",
    severity: "moderate",
    realism_status: "probable_concern",
    confidence: "medium",
    board_candidate_kind: "revision_candidate",
    ...overrides,
  });
}

function createMockSupabase(options: {
  reviews?: MilitaryExpertDraftReviewRow[];
  findingsByReviewId?: Record<string, MilitaryExpertDraftFindingRow[]>;
} = {}) {
  const reviews = options.reviews ?? [reviewRow()];
  const findingsByReviewId = options.findingsByReviewId ?? {
    [REVIEW_UUID]: [
      findingRow({ finding_index: 0, finding_id: "confirmed-1", finding_status: "validated" }),
      findingRow({
        finding_index: 1,
        finding_id: "confirmed-2",
        finding_status: "validated",
        realism_status: "confirmed_error",
      }),
      findingRow({
        finding_index: 2,
        finding_id: "provisional-1",
        finding_status: "author_review_required",
        board_candidate_kind: "investigation_candidate",
      }),
      findingRow({
        finding_index: 3,
        finding_id: "provisional-2",
        finding_status: "author_review_required",
        board_candidate_kind: "investigation_candidate",
      }),
      findingRow({
        finding_index: 4,
        finding_id: "provisional-3",
        finding_status: "author_review_required",
        board_candidate_kind: "investigation_candidate",
      }),
      findingRow({
        finding_index: 5,
        finding_id: "accurate-1",
        finding_status: "validated",
        realism_status: "accurate",
        board_candidate_kind: null,
      }),
      findingRow({
        finding_index: 6,
        finding_id: "confirmed-3",
        finding_status: "validated",
        realism_status: "context_dependent",
      }),
    ],
  };

  const from = (table: string) => {
    if (table === "studio_military_expert_draft_reviews") {
      return {
        select: (_cols: string) => ({
          eq: (col: string, value: string) => {
            if (col === "id") {
              const match = reviews.find((row) => row.id === value) ?? null;
              return {
                maybeSingle: async () => ({ data: match, error: null }),
              };
            }
            if (col === "manuscript_id") {
              return {
                in: (_c: string, statuses: string[]) => ({
                  order: (_c2: string, _opts: { ascending: boolean }) => ({
                    limit: (_n: number) => ({
                      maybeSingle: async () => {
                        const match =
                          reviews
                            .filter(
                              (row) =>
                                row.manuscript_id === value &&
                                statuses.includes(row.review_status),
                            )
                            .sort(
                              (a, b) =>
                                new Date(b.created_at).getTime() -
                                new Date(a.created_at).getTime(),
                            )[0] ?? null;
                        return { data: match, error: null };
                      },
                    }),
                  }),
                }),
              };
            }
            throw new Error(`Unexpected eq column ${col}`);
          },
        }),
      };
    }

    if (table === "studio_military_expert_draft_findings") {
      return {
        select: (_cols: string) => ({
          eq: (_col: string, reviewId: string) => ({
            order: async () => ({
              data: findingsByReviewId[reviewId] ?? [],
              error: null,
            }),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table ${table}`);
  };

  return { supabase: { from } as never };
}

describe("military-expert report display", () => {
  it("1. fully completed ME review appears as displayable", () => {
    assert.equal(isDisplayableMilitaryExpertReviewStatus("complete"), true);
    const model = buildMilitaryExpertReportDisplayModel({
      review: reviewRow({ review_status: "complete", provisional_release_used: false }),
      findings: [findingRow()],
    });
    assert.equal(model.reviewStatus, "complete");
    assert.equal(model.isProvisional, false);
  });

  it("2. completed_with_author_review_required appears as displayable", () => {
    assert.equal(isDisplayableMilitaryExpertReviewStatus("completed_with_author_review_required"), true);
    const model = buildMilitaryExpertReportDisplayModel({
      review: reviewRow(),
      findings: [findingRow({ finding_status: "author_review_required" })],
    });
    assert.equal(model.reviewStatus, "completed_with_author_review_required");
    assert.equal(model.isProvisional, true);
  });

  it("3. newest review selected correctly for manuscript", async () => {
    const mock = createMockSupabase({
      reviews: [
        reviewRow({ id: OLDER_REVIEW_UUID, created_at: "2026-07-28T12:00:00.000Z" }),
        reviewRow({ id: REVIEW_UUID, created_at: "2026-07-29T12:00:00.000Z" }),
      ],
    });

    const latest = await getLatestCompletedMilitaryExpertDraftReview(MANUSCRIPT_ID, mock);
    assert.equal(latest?.id, REVIEW_UUID);
  });

  it("4. review UUID resolved from authoritative_result_id", async () => {
    const mock = createMockSupabase();
    const resolved = await resolveMilitaryExpertReviewFromAuthoritativeResultId(
      REVIEW_UUID,
      MANUSCRIPT_ID,
      mock,
    );
    assert.equal(resolved?.id, REVIEW_UUID);
  });

  it("5. rejects review when manuscript does not match", async () => {
    const mock = createMockSupabase();
    const byId = await getMilitaryExpertDraftReviewById(REVIEW_UUID, OTHER_MANUSCRIPT_ID, mock);
    assert.equal(byId, null);

    const report = await loadMilitaryExpertReportDisplayModel(REVIEW_UUID, OTHER_MANUSCRIPT_ID, mock);
    assert.equal(report, null);
  });

  it("6. confirmed vs author-review findings separated", () => {
    const model = buildMilitaryExpertReportDisplayModel({
      review: reviewRow(),
      findings: [
        findingRow({ finding_id: "a", finding_status: "validated" }),
        findingRow({ finding_id: "b", finding_status: "author_review_required" }),
      ],
    });
    assert.equal(model.confirmedFindings.length, 1);
    assert.equal(model.authorReviewRequiredFindings.length, 1);
    assert.equal(model.confirmedFindings[0]?.finding_id, "a");
    assert.equal(model.authorReviewRequiredFindings[0]?.finding_id, "b");
  });

  it("7. provisional findings excluded from confirmed issue count", () => {
    const model = buildMilitaryExpertReportDisplayModel({
      review: reviewRow(),
      findings: [
        findingRow({
          finding_id: "confirmed",
          finding_status: "validated",
          realism_status: "confirmed_error",
        }),
        findingRow({
          finding_id: "provisional",
          finding_status: "author_review_required",
          realism_status: "probable_concern",
        }),
      ],
    });
    assert.equal(model.scoreSummary.confirmedIssueCount, 1);
    assert.equal(model.scoreSummary.authorReviewRequiredCount, 1);
  });

  it("8. investigation candidates display from board kind", () => {
    const model = buildMilitaryExpertReportDisplayModel({
      review: reviewRow(),
      findings: [
        findingRow({
          finding_id: "investigate-me",
          finding_status: "author_review_required",
          board_candidate_kind: "investigation_candidate",
        }),
      ],
    });
    assert.equal(model.investigationCandidates.length, 1);
    assert.equal(model.investigationCandidates[0]?.findingId, "investigate-me");
  });

  it("9. route href and loader resolve report for matching book", async () => {
    const href = militaryExpertReportHref(MANUSCRIPT_ID, REVIEW_UUID);
    assert.equal(
      href,
      `/studio/books/${MANUSCRIPT_ID}/experts/military-expert/reports/${REVIEW_UUID}`,
    );

    const mock = createMockSupabase();
    const report = await loadMilitaryExpertReportDisplayModel(REVIEW_UUID, MANUSCRIPT_ID, mock);
    assert.ok(report);
    assert.equal(report.reviewId, REVIEW_UUID);
    assert.equal(report.manuscriptId, MANUSCRIPT_ID);
  });

  it("10. loader returns null (route 404) for missing review", async () => {
    const mock = createMockSupabase({ reviews: [] });
    const report = await loadMilitaryExpertReportDisplayModel(REVIEW_UUID, MANUSCRIPT_ID, mock);
    assert.equal(report, null);
  });

  it("11. page model handles provisional status wording", () => {
    const label = buildCompletedReportStatusLabel(reviewRow());
    assert.match(label, /3 Findings Need Author Review/);

    const model = buildMilitaryExpertReportDisplayModel({
      review: reviewRow(),
      findings: [findingRow({ finding_status: "author_review_required" })],
    });
    assert.equal(model.generationStatus, "provisional_success");
    assert.equal(model.authorReviewRequiredItems.length, 1);
  });

  it("12. failed active workflow does not replace successful completed report", async () => {
    const mock = createMockSupabase();
    const status = await resolveMilitaryExpertTeamRunStatus(
      MANUSCRIPT_ID,
      "failed",
      null,
      mock,
    );
    assert.equal(status.runStatus, "failed");
    assert.equal(status.latestReviewId, null);

    const completedStatus = await resolveMilitaryExpertTeamRunStatus(
      MANUSCRIPT_ID,
      null,
      null,
      mock,
    );
    assert.equal(completedStatus.runStatus, "completed");
    assert.equal(completedStatus.latestReviewId, REVIEW_UUID);
    assert.match(completedStatus.completedReportStatusLabel ?? "", /Need Author Review/);
  });

  it("13. literary agent path unchanged — ME href distinct from manuscripts path", () => {
    const meHref = militaryExpertReportHref(MANUSCRIPT_ID, REVIEW_UUID);
    assert.doesNotMatch(meHref, /^\/manuscripts\//);
    assert.match(meHref, /\/experts\/military-expert\/reports\//);
  });

  it("14. summary labels are accurate and non-conflicting", () => {
    assert.equal(MILITARY_EXPERT_CONCERNS_REQUIRING_ATTENTION_LABEL, "Concerns requiring attention");
    assert.equal(MILITARY_EXPERT_FULLY_VALIDATED_FINDINGS_HEADING, "Fully validated findings");
    assert.equal(MILITARY_EXPERT_NEED_YOUR_REVIEW_LABEL, "Need your review");
  });

  it("15. count labels match what they actually measure", () => {
    const findings = [
      findingRow({ finding_id: "concern-1", finding_status: "validated", realism_status: "confirmed_error" }),
      findingRow({ finding_id: "concern-2", finding_status: "validated", realism_status: "probable_concern" }),
      findingRow({ finding_id: "concern-3", finding_status: "validated", realism_status: "context_dependent" }),
      findingRow({ finding_id: "concern-4", finding_status: "validated", realism_status: "plausible_but_unusual" }),
      findingRow({ finding_id: "accurate-1", finding_status: "validated", realism_status: "accurate" }),
      findingRow({ finding_id: "accurate-2", finding_status: "validated", realism_status: "accurate" }),
      findingRow({ finding_id: "accurate-3", finding_status: "validated", realism_status: "accurate" }),
      findingRow({ finding_id: "review-1", finding_status: "author_review_required" }),
      findingRow({ finding_id: "review-2", finding_status: "author_review_required" }),
      findingRow({ finding_id: "review-3", finding_status: "author_review_required" }),
    ];
    const model = buildMilitaryExpertReportDisplayModel({
      review: reviewRow({ validated_finding_count: 7, author_review_required_count: 3 }),
      findings,
    });

    assert.equal(model.scoreSummary.confirmedIssueCount, 4);
    assert.equal(model.confirmedFindings.length, 7);
    assert.equal(model.authorReviewRequiredFindings.length, 3);
  });

  it("16. count explanation appears when counts measure different concepts", () => {
    const explanation = buildMilitaryExpertCountExplanation(7, 4);
    assert.equal(explanation, MILITARY_EXPERT_COUNT_EXPLANATION);

    const model = buildMilitaryExpertReportDisplayModel({
      review: reviewRow({ validated_finding_count: 7, author_review_required_count: 3 }),
      findings: [
        findingRow({ finding_id: "c1", finding_status: "validated", realism_status: "confirmed_error" }),
        findingRow({ finding_id: "c2", finding_status: "validated", realism_status: "probable_concern" }),
        findingRow({ finding_id: "c3", finding_status: "validated", realism_status: "context_dependent" }),
        findingRow({ finding_id: "c4", finding_status: "validated", realism_status: "plausible_but_unusual" }),
        findingRow({ finding_id: "a1", finding_status: "validated", realism_status: "accurate" }),
        findingRow({ finding_id: "a2", finding_status: "validated", realism_status: "accurate" }),
        findingRow({ finding_id: "a3", finding_status: "validated", realism_status: "accurate" }),
        findingRow({ finding_id: "r1", finding_status: "author_review_required" }),
        findingRow({ finding_id: "r2", finding_status: "author_review_required" }),
        findingRow({ finding_id: "r3", finding_status: "author_review_required" }),
      ],
    });
    assert.ok(model.countExplanation);
    assert.match(model.countExplanation ?? "", /concerns count/i);
  });

  it("17. author review items omit interactive actions and include honest instruction", () => {
    const model = buildMilitaryExpertReportDisplayModel({
      review: reviewRow(),
      findings: [findingRow({ finding_status: "author_review_required" })],
    });
    const item = model.authorReviewRequiredItems[0];
    assert.ok(item);
    assert.equal(item.authorResponseToolsAvailable, false);
    assert.equal(item.recommendedAuthorAction, MILITARY_EXPERT_AUTHOR_RESPONSE_UNAVAILABLE);
    assert.doesNotMatch(item.concern, /Structural finding/i);
    assert.doesNotMatch(item.supportingEvidenceSummary, /Supporting evidence recorded/i);
  });

  it("18. placeholder stub copy is absent from display model", () => {
    const model = buildMilitaryExpertReportDisplayModel({
      review: reviewRow(),
      findings: [
        findingRow({ finding_id: "validated-1", finding_status: "validated" }),
        findingRow({ finding_id: "review-1", finding_status: "author_review_required" }),
      ],
    });
    const validatedObservation = model.revisionCandidates[0]?.taskLanguage ?? "";
    const investigationLanguage = model.investigationCandidates[0]?.taskLanguage ?? "";
    const authorItem = model.authorReviewRequiredItems[0];

    assert.doesNotMatch(validatedObservation, /Investigate whether/i);
    assert.doesNotMatch(investigationLanguage, /Investigate whether/i);
    assert.equal(authorItem?.supportingEvidenceSummary, MILITARY_EXPERT_NO_EVIDENCE_EXCERPT_SUMMARY);
  });

  it("19. revision board integration is deferred with honest wording", () => {
    const model = buildMilitaryExpertReportDisplayModel({
      review: reviewRow(),
      findings: [findingRow()],
    });
    assert.equal(model.revisionBoardIntegrationAvailable, false);
    assert.match(MILITARY_EXPERT_REVISION_BOARD_UNAVAILABLE, /not yet available/i);
  });

  it("20. seven validated and three author-review findings remain visible", () => {
    const findings = [
      ...Array.from({ length: 7 }, (_, index) =>
        findingRow({
          finding_index: index,
          finding_id: `validated-${index}`,
          finding_status: "validated",
          realism_status: index < 4 ? "probable_concern" : "accurate",
        }),
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        findingRow({
          finding_index: 7 + index,
          finding_id: `review-${index}`,
          finding_status: "author_review_required",
        }),
      ),
    ];
    const model = buildMilitaryExpertReportDisplayModel({
      review: reviewRow({ validated_finding_count: 7, author_review_required_count: 3 }),
      findings,
    });
    assert.equal(model.confirmedFindings.length, 7);
    assert.equal(model.authorReviewRequiredFindings.length, 3);
    assert.equal(model.authorReviewRequiredItems.length, 3);
  });
});

describe("military-expert report display — workflow authoritative resolution", () => {
  it("resolves review from completed workflow authoritative_result_id", async () => {
    const mock = createMockSupabase();
    const workflow = {
      id: WORKFLOW_ID,
      workflow_type: "military_expert_review",
      manuscript_id: MANUSCRIPT_ID,
      authoritative_result_id: REVIEW_UUID,
    } as EditorialWorkflowRow;

    const status = await resolveMilitaryExpertTeamRunStatus(
      MANUSCRIPT_ID,
      "completed",
      workflow.authoritative_result_id,
      {
        ...mock,
        getWorkflow: async () => workflow,
      },
    );

    assert.equal(status.runStatus, "completed");
    assert.equal(status.latestReviewId, REVIEW_UUID);
  });
});
