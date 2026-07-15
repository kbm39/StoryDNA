"use client";

import type { Review, ReviewConcernAssessment } from "@/lib/types";
import { inferComparisonMode } from "@/lib/grading-explanation-display";

function evidenceList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "text" in item) {
        return String((item as { text: string }).text);
      }
      return null;
    })
    .filter((s): s is string => Boolean(s));
}

export function RevisionImpactPanel({
  review,
  assessments,
  priorScore,
}: {
  review: Review;
  assessments: ReviewConcernAssessment[];
  priorScore?: number | null;
}) {
  if (assessments.length === 0 && review.contrary_evidence_gate_status === "skipped") {
    return null;
  }

  const comparisonMode = inferComparisonMode(review);
  const sameVersion = comparisonMode === "SAME_VERSION_REASSESSMENT";
  const duplicateRemoved = review.duplicate_deduction_count ?? 0;
  const currentScore = review.manuscript_score;

  return (
    <div className="mb-4 rounded-lg border border-black/10 bg-black/[.02] p-3 text-sm dark:border-white/10 dark:bg-white/[.03]">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
        Revision Impact and Contrary Evidence
      </p>
      <p className="mb-3 text-xs text-black/55 dark:text-white/55">
        {assessments.length} concern assessment{assessments.length === 1 ? "" : "s"} recorded
        {sameVersion && " (same-version reassessment — no revision-restored points)"}.
      </p>

      {assessments.length === 0 ? (
        <p className="text-xs text-black/55 dark:text-white/55">
          No prior-concern assessments recorded for this review.
        </p>
      ) : (
        <ul className="space-y-3">
          {assessments.map((a) => (
            <li
              key={a.id}
              className="rounded-md border border-black/5 p-2 text-xs dark:border-white/10"
            >
              <p className="font-semibold">{a.prior_criticism.slice(0, 200)}</p>
              <p className="mt-1 capitalize text-black/55 dark:text-white/55">
                Status: <span className="font-medium text-black/75 dark:text-white/75">{a.status}</span>
                {" · "}
                Confidence: {a.confidence}
              </p>
              {evidenceList(a.current_supporting_evidence).length > 0 && (
                <div className="mt-1">
                  <p className="font-medium text-black/45 dark:text-white/45">Supporting evidence</p>
                  <ul className="list-disc pl-4 italic">
                    {evidenceList(a.current_supporting_evidence).slice(0, 2).map((t) => (
                      <li key={t.slice(0, 40)}>{t.slice(0, 160)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {evidenceList(a.current_contrary_evidence).length > 0 && (
                <div className="mt-1">
                  <p className="font-medium text-black/45 dark:text-white/45">Contrary evidence</p>
                  <ul className="list-disc pl-4 italic">
                    {evidenceList(a.current_contrary_evidence).slice(0, 2).map((t) => (
                      <li key={t.slice(0, 40)}>{t.slice(0, 160)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!sameVersion && (
                <p className="mt-1 tabular-nums">
                  Points restored: {a.points_restored} · Remaining deduction: {a.remaining_deduction}
                </p>
              )}
              {sameVersion && a.remaining_deduction > 0 && (
                <p className="mt-1 tabular-nums">
                  Valid remaining deduction: {a.remaining_deduction}
                </p>
              )}
              {a.narrowed_current_finding && (
                <p className="mt-1">
                  <span className="font-medium text-black/45 dark:text-white/45">Narrowed finding: </span>
                  {a.narrowed_current_finding}
                </p>
              )}
              <p className="mt-1 text-black/60 dark:text-white/60">{a.explanation}</p>
            </li>
          ))}
        </ul>
      )}

      {(priorScore != null || duplicateRemoved > 0 || currentScore != null) && (
        <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
            Score context
          </p>
          <dl className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
            {priorScore != null && (
              <div>
                <dt className="inline text-black/45 dark:text-white/45">Prior review score: </dt>
                <dd className="inline font-medium tabular-nums">{priorScore}</dd>
              </div>
            )}
            {!sameVersion && (review.restored_points_total ?? 0) > 0 && (
              <div>
                <dt className="inline text-black/45 dark:text-white/45">Points restored by revision: </dt>
                <dd className="inline font-medium tabular-nums">{review.restored_points_total}</dd>
              </div>
            )}
            {duplicateRemoved > 0 && (
              <div>
                <dt className="inline text-black/45 dark:text-white/45">Duplicate deductions removed: </dt>
                <dd className="inline font-medium tabular-nums">{duplicateRemoved}</dd>
              </div>
            )}
            {currentScore != null && (
              <div>
                <dt className="inline text-black/45 dark:text-white/45">Normalized score (authoritative): </dt>
                <dd className="inline font-medium tabular-nums">{currentScore}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
