"use client";

import type { Review, ReviewConcernAssessment } from "@/lib/types";
import {
  buildAuthoritativeReviewDisplay,
} from "@/lib/authoritative-review-display";
import {
  formatRecommendationLabel,
  type GradingExplanationDisplay,
  type RetainedDeductionDisplay,
} from "@/lib/grading-explanation-display";

function fmt(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

function ComparisonModeBanner({ mode }: { mode: GradingExplanationDisplay["comparison_mode"] }) {
  if (mode === "NONE") return null;
  if (mode === "SAME_VERSION_REASSESSMENT") {
    return (
      <div className="mb-3 rounded-md border border-indigo-200 bg-indigo-50/80 px-3 py-2 text-xs text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
        <p className="font-semibold">Assessment mode: Same-version reassessment</p>
        <p className="mt-1 text-indigo-800/90 dark:text-indigo-200/90">
          This review reassessed prior deductions against evidence already present in the same
          manuscript version. It is not a before-and-after revision comparison.
        </p>
      </div>
    );
  }
  return (
    <div className="mb-3 rounded-md border border-black/10 px-3 py-2 text-xs dark:border-white/10">
      <p className="font-semibold">Assessment mode: Revision comparison</p>
      <p className="mt-1 text-black/60 dark:text-white/60">
        Prior concerns were compared against a different manuscript version.
      </p>
    </div>
  );
}

function DeductionCard({ d }: { d: RetainedDeductionDisplay }) {
  return (
    <li className="rounded-md border border-black/5 p-3 text-xs dark:border-white/10">
      <p className="font-semibold text-black/80 dark:text-white/85">{d.root_issue}</p>
      <p className="mt-1 text-black/55 dark:text-white/55">
        {d.category_name} ·{" "}
        <span className="tabular-nums font-medium">{fmt(d.points_deducted)} pts deducted</span>
        {" · "}
        Confidence: {d.confidence}
      </p>
      <p className="mt-2">
        <span className="font-medium text-black/45 dark:text-white/45">Criticism: </span>
        {d.criticism}
      </p>
      {d.current_evidence.length > 0 && (
        <div className="mt-2">
          <p className="font-medium text-black/45 dark:text-white/45">Current manuscript evidence</p>
          <ul className="list-disc pl-4 italic">
            {d.current_evidence.slice(0, 3).map((t) => (
              <li key={t.slice(0, 48)}>{t.slice(0, 280)}</li>
            ))}
          </ul>
        </div>
      )}
      {d.contrary_evidence.length > 0 && (
        <div className="mt-2">
          <p className="font-medium text-black/45 dark:text-white/45">Contrary evidence considered</p>
          <ul className="list-disc pl-4 italic">
            {d.contrary_evidence.slice(0, 3).map((t) => (
              <li key={t.slice(0, 48)}>{t.slice(0, 280)}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2">
        <span className="font-medium text-black/45 dark:text-white/45">Why this remains: </span>
        {d.why_remains}
      </p>
      <p className="mt-1">
        <span className="font-medium text-black/45 dark:text-white/45">Improvement action: </span>
        {d.improvement_action}
      </p>
      {d.recoverable_points != null && d.recoverable_points > 0 && (
        <p className="mt-1 tabular-nums">
          <span className="font-medium text-black/45 dark:text-white/45">
            Estimated recoverable in category:{" "}
          </span>
          up to {fmt(d.recoverable_points)} pts
        </p>
      )}
    </li>
  );
}

export function ExplainableGradingPanels({
  review,
  assessments = [],
  manuscriptTitle = "Manuscript",
  fallbackWordCount,
}: {
  review: Review;
  assessments?: ReviewConcernAssessment[];
  manuscriptTitle?: string;
  fallbackWordCount?: number | null;
}) {
  const authoritative = buildAuthoritativeReviewDisplay({
    review,
    manuscriptTitle,
    assessments,
    fallbackWordCount,
  });
  if (!authoritative) return null;

  const display = authoritative.grading;
  const adj = display.adjustments;

  return (
    <div className="mb-4 space-y-4">
      <ComparisonModeBanner mode={display.comparison_mode} />

      <div className="rounded-lg border border-black/10 bg-black/[.02] p-3 dark:border-white/10 dark:bg-white/[.03]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
          Primary assessment
        </p>
        <p className="mt-1 font-serif text-xl font-semibold">
          {fmt(display.total_score)} / {display.total_max} — {display.descriptive_band}
        </p>
        {display.letter_grade_secondary && (
          <p className="mt-1 text-xs text-black/50 dark:text-white/50">
            Academic-style equivalent: {display.letter_grade_secondary} — not a publishing-industry
            standard.
          </p>
        )}
        <p className="mt-2 text-xs italic text-black/50 dark:text-white/50">
          {authoritative.methodology_disclaimer}
        </p>
      </div>

      {adj && (
        <div className="rounded-lg border border-black/10 bg-black/[.02] p-3 dark:border-white/10 dark:bg-white/[.03]">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
            Adjustments made by StoryDNA validation
          </p>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            <div>
              <dt className="inline text-black/45 dark:text-white/45">Raw model score: </dt>
              <dd className="inline font-medium tabular-nums">{fmt(adj.raw_model_score ?? 0)}</dd>
            </div>
            <div>
              <dt className="inline text-black/45 dark:text-white/45">Normalized application score: </dt>
              <dd className="inline font-medium tabular-nums">
                {fmt(adj.normalized_application_score ?? display.total_score)}
              </dd>
            </div>
            <div>
              <dt className="inline text-black/45 dark:text-white/45">Duplicate deductions removed: </dt>
              <dd className="inline font-medium tabular-nums">{adj.duplicate_deductions_removed}</dd>
            </div>
            <div>
              <dt className="inline text-black/45 dark:text-white/45">Duplicate points removed: </dt>
              <dd className="inline font-medium tabular-nums">{fmt(adj.duplicate_points_removed)}</dd>
            </div>
            <div>
              <dt className="inline text-black/45 dark:text-white/45">Repeated evidence removed: </dt>
              <dd className="inline font-medium tabular-nums">{adj.repeated_evidence_removed}</dd>
            </div>
            <div>
              <dt className="inline text-black/45 dark:text-white/45">Valid deductions retained: </dt>
              <dd className="inline font-medium tabular-nums">{fmt(adj.valid_deductions_retained)}</dd>
            </div>
            <div>
              <dt className="inline text-black/45 dark:text-white/45">Mechanically recoverable: </dt>
              <dd className="inline font-medium tabular-nums">
                {fmt(adj.mechanically_recoverable_points)} pts
              </dd>
            </div>
            <div>
              <dt className="inline text-black/45 dark:text-white/45">Evidence-ceiling reductions: </dt>
              <dd className="inline font-medium tabular-nums">
                {fmt(adj.evidence_ceiling_reductions)} pts
              </dd>
            </div>
            <div>
              <dt className="inline text-black/45 dark:text-white/45">Unsupported in final Call B rubric: </dt>
              <dd className="inline font-medium tabular-nums">{adj.unsupported_deductions_removed}</dd>
            </div>
            <div>
              <dt className="inline text-black/45 dark:text-white/45">Root-issue cap reductions: </dt>
              <dd className="inline font-medium tabular-nums">{adj.root_issue_cap_reductions}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs font-medium text-black/65 dark:text-white/65">
            {authoritative.normalization_authority_note}
          </p>
        </div>
      )}

      <div className="rounded-lg border border-black/10 bg-black/[.02] p-3 dark:border-white/10 dark:bg-white/[.03]">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
          Why this manuscript received this assessment
        </p>

        <dl className="mb-3 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          <div>
            <dt className="inline text-black/45 dark:text-white/45">Craft subtotal: </dt>
            <dd className="inline font-medium tabular-nums">
              {fmt(display.craft_score)} / {display.craft_max}
            </dd>
          </div>
          <div>
            <dt className="inline text-black/45 dark:text-white/45">Acquisition subtotal: </dt>
            <dd className="inline font-medium tabular-nums">
              {fmt(display.acquisition_score)} / {display.acquisition_max}
            </dd>
          </div>
          <div>
            <dt className="inline text-black/45 dark:text-white/45">Overall total: </dt>
            <dd className="inline font-medium tabular-nums">
              {fmt(display.total_score)} / {display.total_max}
            </dd>
          </div>
          <div>
            <dt className="inline text-black/45 dark:text-white/45">Recommendation: </dt>
            <dd className="inline font-medium">
              {formatRecommendationLabel(display.recommendation)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="inline text-black/45 dark:text-white/45">Descriptive band: </dt>
            <dd className="inline font-medium">{display.descriptive_band}</dd>
          </div>
        </dl>

        {display.strongest_categories.length > 0 && (
          <div className="mb-3 text-xs">
            <p className="font-semibold text-black/50 dark:text-white/50">Strongest categories</p>
            <ul className="mt-1 list-disc pl-4">
              {display.strongest_categories.map((c) => (
                <li key={c.name}>
                  {c.name}: {fmt(c.earned)} / {c.max}
                </li>
              ))}
            </ul>
          </div>
        )}

        {display.weakest_categories.length > 0 && (
          <div className="mb-3 text-xs">
            <p className="font-semibold text-black/50 dark:text-white/50">
              Categories needing the most revision
            </p>
            <ul className="mt-1 list-disc pl-4">
              {display.weakest_categories.map((c) => (
                <li key={c.name}>
                  {c.name}: {fmt(c.earned)} / {c.max} ({fmt(c.deduction)} pts deducted)
                </li>
              ))}
            </ul>
          </div>
        )}

        {display.retained_deductions.length > 0 ? (
          <ul className="space-y-2">
            {display.retained_deductions.map((d) => (
              <DeductionCard key={`${d.category_key}-${d.criticism.slice(0, 32)}`} d={d} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-black/55 dark:text-white/55">
            No scored deductions remain after StoryDNA validation.
          </p>
        )}
      </div>
    </div>
  );
}
