"use client";

import { useState } from "react";
import type { Review, ReviewConcernAssessment } from "@/lib/types";
import type { CommercialRubricPayload, RubricCategoryScore } from "@/lib/commercial-fiction-rubric";
import { CRAFT_MAX_TOTAL, ACQUISITION_MAX_TOTAL } from "@/lib/commercial-fiction-rubric";
import { buildGradingExplanationDisplay } from "@/lib/grading-explanation-display";
import { memoContentForDisplay } from "@/lib/review-display";
import { ExplainableGradingPanels } from "./ExplainableGradingPanels";

function isVerifiedGrade(review: Review): boolean {
  if (review.scoring_gate_valid === false) return false;
  if (
    review.contrary_evidence_gate_status === "required_not_run" ||
    review.contrary_evidence_gate_status === "failed"
  ) {
    return false;
  }
  return (
    review.grade_status === "VERIFIED" ||
    review.grade_status === "PROVISIONAL_PARTIAL_COVERAGE"
  );
}

function isGateIncomplete(review: Review): boolean {
  return (
    review.scoring_gate_valid === false ||
    review.contrary_evidence_gate_status === "required_not_run" ||
    review.contrary_evidence_gate_status === "failed"
  );
}

function isLegacyReview(review: Review): boolean {
  return review.manuscript_score == null && review.grade_status == null;
}

function StatusBadge({ label, tone }: { label: string; tone: "ok" | "warn" | "bad" | "muted" }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
      : tone === "warn"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
        : tone === "bad"
          ? "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300"
          : "bg-black/5 text-black/55 dark:bg-white/10 dark:text-white/55";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${cls}`}>{label}</span>;
}

function CategoryRow({ cat }: { cat: RubricCategoryScore }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="border-t border-black/5 dark:border-white/10">
        <td className="py-2 pr-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-left font-medium text-accent hover:underline"
          >
            {open ? "▼" : "▶"} {cat.category_name}
          </button>
        </td>
        <td className="py-2 text-center tabular-nums">{cat.maximum_points}</td>
        <td className="py-2 text-center tabular-nums font-semibold">{cat.points_earned}</td>
        <td className="py-2 text-center tabular-nums">{cat.deduction}</td>
        <td className="py-2 text-center capitalize">{cat.confidence}</td>
        <td className="py-2 text-center tabular-nums">{cat.examples.length}</td>
      </tr>
      {open && (
        <tr className="bg-black/[.02] dark:bg-white/[.03]">
          <td colSpan={6} className="px-3 py-3 text-xs leading-relaxed text-black/70 dark:text-white/70">
            {cat.insufficient_evidence && (
              <p className="mb-2 font-semibold text-red-600 dark:text-red-400">INSUFFICIENT EVIDENCE</p>
            )}
            {cat.strengths.length > 0 && (
              <div className="mb-2">
                <p className="font-semibold text-black/50 dark:text-white/50">Strengths</p>
                <ul className="list-disc pl-4">
                  {cat.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {cat.deductions.length > 0 && (
              <div className="mb-2">
                <p className="font-semibold text-black/50 dark:text-white/50">Deductions</p>
                <ul className="list-disc pl-4">
                  {cat.deductions.map((d, i) => (
                    <li key={d}>
                      {d}
                      {cat.deduction_reasons[i] ? ` — ${cat.deduction_reasons[i]}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {cat.examples.length > 0 && (
              <div className="mb-2">
                <p className="font-semibold text-black/50 dark:text-white/50">Manuscript evidence</p>
                <ul className="space-y-1">
                  {cat.examples.map((ex) => (
                    <li key={`${ex.location}-${ex.text.slice(0, 40)}`} className="italic">
                      {ex.location ? `[${ex.location}] ` : ""}
                      {ex.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {cat.revision_to_recover && (
              <p>
                <span className="font-semibold text-black/50 dark:text-white/50">Revision path: </span>
                {cat.revision_to_recover}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function ReviewGradingPanel({
  review,
  assessments = [],
}: {
  review: Review;
  assessments?: ReviewConcernAssessment[];
}) {
  const [showCalc, setShowCalc] = useState(false);
  const legacy = isLegacyReview(review);
  const gateIncomplete = isGateIncomplete(review);
  const withheld = review.grade_status?.startsWith("WITHHELD") || gateIncomplete;
  const provisional = review.grade_status === "PROVISIONAL_PARTIAL_COVERAGE" && !gateIncomplete;
  const verified = isVerifiedGrade(review);
  const rubric = review.rubric_breakdown as CommercialRubricPayload | null | undefined;
  const hasExplainable = Boolean(
    buildGradingExplanationDisplay({
      review,
      memoContent: memoContentForDisplay(review.content),
      assessments,
    }),
  );

  if (legacy) {
    return (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label="Unverified legacy grade" tone="warn" />
        </div>
        <p className="mt-2 text-xs text-black/60 dark:text-white/60">
          This review predates structured rubric grading. Any letter grade in the memo prose is not
          calculated or validated by StoryDNA. Regenerate the Literary Agent review to receive a
          verified grade.
        </p>
      </div>
    );
  }

  return (
    <>
      {!hasExplainable && (
        <div className="mb-4 rounded-lg border border-black/10 bg-black/[.02] p-3 text-sm dark:border-white/10 dark:bg-white/[.03]">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
                Commercial Grade
              </p>
              {withheld ? (
                <p className="mt-1 text-lg font-semibold text-red-700 dark:text-red-400">
                  {gateIncomplete
                    ? "Grade withheld — revision-aware validation incomplete."
                    : "Grade withheld"}
                </p>
              ) : (
                <p className="mt-1 font-serif text-2xl font-semibold">
                  {review.manuscript_letter_grade ?? "—"}
                  {review.manuscript_score != null && (
                    <span className="ml-2 text-base font-normal text-black/50 dark:text-white/50">
                      ({review.manuscript_score}/100)
                    </span>
                  )}
                </p>
              )}
              {provisional && <StatusBadge label="Provisional grade" tone="warn" />}
              {verified && <StatusBadge label="Verified" tone="ok" />}
            </div>
            <div className="text-right text-xs text-black/55 dark:text-white/55">
              {review.craft_score != null && (
                <p>Craft: {review.craft_score}/{CRAFT_MAX_TOTAL}</p>
              )}
              {review.acquisition_readiness_score != null && (
                <p>Acquisition: {review.acquisition_readiness_score}/{ACQUISITION_MAX_TOTAL}</p>
              )}
              {review.grading_formula_version && <p className="mt-1">{review.grading_formula_version}</p>}
            </div>
          </div>
        </div>
      )}

      {hasExplainable && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {provisional && <StatusBadge label="Provisional grade" tone="warn" />}
          {verified && <StatusBadge label="Verified" tone="ok" />}
          {withheld && <StatusBadge label="Grade withheld" tone="bad" />}
        </div>
      )}

      {hasExplainable && !withheld && (
        <ExplainableGradingPanels review={review} assessments={assessments} />
      )}

      <div className="mb-4 rounded-lg border border-black/10 bg-black/[.02] p-3 text-sm dark:border-white/10 dark:bg-white/[.03]">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {review.canonical_word_count != null && (
          <div>
            <dt className="inline text-black/45 dark:text-white/45">StoryDNA analytical count: </dt>
            <dd className="inline font-medium">{review.canonical_word_count.toLocaleString()} words</dd>
          </div>
        )}
        {review.words_analyzed != null && (
          <div>
            <dt className="inline text-black/45 dark:text-white/45">Words analyzed: </dt>
            <dd className="inline font-medium">{review.words_analyzed.toLocaleString()}</dd>
          </div>
        )}
        {review.statistics_validation_status && (
          <div>
            <dt className="inline text-black/45 dark:text-white/45">Statistics: </dt>
            <dd className="inline font-medium capitalize">{review.statistics_validation_status}</dd>
          </div>
        )}
        {review.evidence_completeness_status && (
          <div>
            <dt className="inline text-black/45 dark:text-white/45">Evidence: </dt>
            <dd className="inline font-medium capitalize">{review.evidence_completeness_status}</dd>
          </div>
        )}
        {review.review_reliability_status && (
          <div>
            <dt className="inline text-black/45 dark:text-white/45">Review reliability: </dt>
            <dd className="inline font-medium capitalize">{review.review_reliability_status}</dd>
          </div>
        )}
      </dl>

      {rubric && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowCalc((v) => !v)}
            className="text-xs font-semibold text-accent hover:underline"
          >
            {showCalc ? "Hide" : "Show"} how this grade was calculated
          </button>
          {showCalc && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead>
                  <tr className="text-black/45 dark:text-white/45">
                    <th className="pb-1 font-semibold">Category</th>
                    <th className="pb-1 text-center font-semibold">Max</th>
                    <th className="pb-1 text-center font-semibold">Earned</th>
                    <th className="pb-1 text-center font-semibold">Deduction</th>
                    <th className="pb-1 text-center font-semibold">Confidence</th>
                    <th className="pb-1 text-center font-semibold">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(rubric.craft_categories ?? []), ...(rubric.acquisition_categories ?? [])].map(
                    (cat) => (
                      <CategoryRow key={cat.category_key} cat={cat} />
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}
