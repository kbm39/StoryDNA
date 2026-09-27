"use client";

import { useState, useTransition } from "react";
import { submitArchivistReviewDecision } from "@/app/actions/archivist-review-recommended.ts";
import type {
  ArchivistReviewAuthorAction,
  PresentedReviewRecommendedCard,
  PresentedReviewRecommendedModel,
} from "@/experts/archivist/segmented/observation-v2/review-recommended/index.ts";

function PassageActions({
  manuscriptId,
  manuscriptVersionId,
  sourceWorkflowId,
  clusterFingerprint,
  passages,
  reviewState,
  label,
}: {
  manuscriptId: string;
  manuscriptVersionId: string;
  sourceWorkflowId: string | null;
  clusterFingerprint: string;
  passages: ReadonlyArray<{ passageKey: string; evidenceIdentity: string }>;
  reviewState?: "pending" | "needs_fix" | "not_an_issue";
  label: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(action: ArchivistReviewAuthorAction) {
    setError(null);
    start(async () => {
      const result = await submitArchivistReviewDecision({
        manuscriptId,
        manuscriptVersionId,
        sourceWorkflowId,
        clusterFingerprint,
        action,
        passages,
      });
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        {label}
      </p>
      {reviewState === "needs_fix" ? (
        <p className="mt-1 text-sm">Marked as needs fix. StoryDNA will keep this passage for later editorial work.</p>
      ) : null}
      {reviewState === "not_an_issue" ? (
        <p className="mt-1 text-sm">Marked as not an issue for this passage.</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide("not_an_issue")}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:text-black/40 dark:border-white/20"
        >
          Not an issue
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide("needs_fix")}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:text-black/40 dark:border-white/20"
        >
          Needs fix
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
    </div>
  );
}

function ReviewCard({
  card,
  manuscriptId,
  manuscriptVersionId,
  sourceWorkflowId,
}: {
  card: PresentedReviewRecommendedCard;
  manuscriptId: string;
  manuscriptVersionId: string;
  sourceWorkflowId: string | null;
}) {
  return (
    <article className="rounded-lg border border-black/10 bg-paper p-4 dark:border-white/15 dark:bg-white/5">
      <p className="text-xs font-semibold uppercase tracking-wide">
        Potential continuity issue — review recommended
      </p>
      <h3 className="mt-2 font-medium">{card.title}</h3>
      <p className="mt-2 text-sm leading-relaxed">{card.noticed}</p>
      <p className="mt-3 text-sm font-medium">Review status: {card.status_summary}</p>
      <div className="mt-4 space-y-3">
        {card.passages.map((passage) => (
          <div
            key={passage.passage_key}
            className="rounded-md border border-black/10 bg-white/70 p-3 dark:border-white/15 dark:bg-black/20"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
              {passage.heading}
            </p>
            <p className="mt-1 text-sm font-medium">{passage.locator}</p>
            <blockquote className="mt-2 border-l-2 border-black/20 pl-3 text-sm leading-relaxed dark:border-white/25">
              “{passage.excerpt}”
            </blockquote>
            <PassageActions
              manuscriptId={manuscriptId}
              manuscriptVersionId={manuscriptVersionId}
              sourceWorkflowId={sourceWorkflowId}
              clusterFingerprint={card.fingerprint}
              passages={[
                {
                  passageKey: passage.passage_key,
                  evidenceIdentity: passage.evidence_identity,
                },
              ]}
              reviewState={passage.review_state}
              label="What do you want to do with this passage?"
            />
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm leading-relaxed">
        <span className="font-semibold">Why this might matter: </span>
        {card.why_it_may_matter}
      </p>
      <div className="mt-4 rounded-md border border-dashed border-black/15 p-3 dark:border-white/20">
        <PassageActions
          manuscriptId={manuscriptId}
          manuscriptVersionId={manuscriptVersionId}
          sourceWorkflowId={sourceWorkflowId}
          clusterFingerprint={card.fingerprint}
          passages={card.passages.map((passage) => ({
            passageKey: passage.passage_key,
            evidenceIdentity: passage.evidence_identity,
          }))}
          label="Mark all passages"
        />
        <p className="mt-2 text-xs text-black/55 dark:text-white/55">
          Individual passage choices can change this later.
        </p>
      </div>
      <details className="mt-4 rounded-md border border-black/10 bg-white/60 p-3 text-sm dark:border-white/15 dark:bg-black/20">
        <summary className="cursor-pointer font-medium">Analysis details</summary>
        <dl className="mt-2 space-y-1">
          <div>
            <dt className="text-black/50 dark:text-white/50">Engine result</dt>
            <dd>
              {card.analysis_details.engine_eligibility} / {card.analysis_details.engine_reason}
            </dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Clustered pairs</dt>
            <dd>{card.analysis_details.pair_count}</dd>
          </div>
        </dl>
      </details>
    </article>
  );
}

export default function ArchivistReviewRecommendedSection({
  model,
}: {
  model: PresentedReviewRecommendedModel;
}) {
  return (
    <section
      id="archivist-review-recommended"
      className="mb-8 scroll-mt-20 rounded-xl border border-black/10 bg-paper p-5 shadow-sm dark:border-white/15 dark:bg-white/5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-semibold tracking-tight">
            Potential continuity issues
          </h2>
          <p className="text-sm text-black/60 dark:text-white/60">Review recommended</p>
        </div>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-500/20 dark:text-amber-100">
          {model.cards.length} to review
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-black/70 dark:text-white/70">
        StoryDNA noticed these verified passages but cannot decide them from the
        manuscript evidence. You can mark each passage separately. Your choice does
        not change the book or accepted canon.
      </p>
      <div className="mt-5 space-y-4">
        {model.cards.length === 0 ? (
          <p className="text-sm text-black/65 dark:text-white/65">
            No potential continuity issues are waiting for review.
          </p>
        ) : (
          model.cards.map((card) => (
            <ReviewCard
              key={card.fingerprint}
              card={card}
              manuscriptId={model.manuscript_id}
              manuscriptVersionId={model.manuscript_version_id}
              sourceWorkflowId={model.source_workflow_id}
            />
          ))
        )}
      </div>
    </section>
  );
}
