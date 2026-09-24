import type {
  ArchivistCandidateReviewUiModel,
  PresentedCandidateFinding,
  PresentedEvidenceSide,
} from "@/lib/archivist-candidate-review/types.ts";

function formatWords(value: number): string {
  return value.toLocaleString("en-US");
}

function formatUsd(value: number): string {
  return `$${value.toFixed(3)}`;
}

function EvidenceSide({
  heading,
  side,
}: {
  heading: string;
  side: PresentedEvidenceSide;
}) {
  return (
    <div className="rounded-md border border-black/10 bg-white/70 p-3 dark:border-white/15 dark:bg-black/20">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        {heading}
      </p>
      <p className="mt-1 text-sm font-medium">{side.location}</p>
      {side.kind === "quoted" ? (
        <blockquote className="mt-2 border-l-2 border-black/20 pl-3 text-sm leading-relaxed dark:border-white/25">
          “{side.excerpt}”
        </blockquote>
      ) : (
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">{side.message}</p>
      )}
    </div>
  );
}

function FindingCard({ finding }: { finding: PresentedCandidateFinding }) {
  return (
    <article className="rounded-lg border border-black/10 bg-paper p-4 dark:border-white/15 dark:bg-white/5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide">{finding.classification_label}</p>
        <span className="text-xs text-black/60 dark:text-white/60">{finding.issue_type_label}</span>
        <span className="text-xs text-black/60 dark:text-white/60">Severity: {finding.severity}</span>
        <span className="text-xs text-black/60 dark:text-white/60">Confidence: {finding.confidence}</span>
      </div>
      <h4 className="mt-2 font-medium">{finding.subject}</h4>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <EvidenceSide heading="Current passage" side={finding.current_evidence} />
        <EvidenceSide heading="Conflicting passage" side={finding.conflicting_evidence} />
      </div>
      <div className="mt-4 space-y-2 text-sm leading-relaxed">
        <p>
          <span className="font-semibold">Why StoryDNA thinks this may conflict: </span>
          {finding.explanation}
        </p>
        <p>
          <span className="font-semibold">Temporal analysis: </span>
          {finding.temporal_analysis}
        </p>
        <p>
          <span className="font-semibold">Suggested resolution: </span>
          {finding.suggested_resolution}
        </p>
      </div>
      {finding.classification_changed ? (
        <details className="mt-4 rounded-md border border-black/10 bg-white/60 p-3 text-sm dark:border-white/15 dark:bg-black/20">
          <summary className="cursor-pointer font-medium">Why did StoryDNA change this?</summary>
          <dl className="mt-2 space-y-1">
            <div>
              <dt className="text-black/50 dark:text-white/50">Model assessment</dt>
              <dd>{finding.model_classification_label}</dd>
            </div>
            <div>
              <dt className="text-black/50 dark:text-white/50">StoryDNA final assessment</dt>
              <dd>{finding.final_classification_label}</dd>
            </div>
            <div>
              <dt className="text-black/50 dark:text-white/50">Why StoryDNA changed it</dt>
              <dd>{finding.classification_adjustment_reason}</dd>
            </div>
          </dl>
        </details>
      ) : null}
    </article>
  );
}

export default function ArchivistCandidateReviewPanel({
  model,
}: {
  model: ArchivistCandidateReviewUiModel;
}) {
  return (
    <section
      id="archivist-candidate-review"
      className="mb-8 scroll-mt-20 rounded-xl border border-black/10 bg-paper p-5 shadow-sm dark:border-white/15 dark:bg-white/5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-semibold tracking-tight">Archivist</h2>
          <p className="text-sm text-black/60 dark:text-white/60">Continuity &amp; Canon</p>
          <p className="mt-1 text-sm font-medium">{model.source_label}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100">
            Validated Candidate Review
          </span>
          <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-900 dark:bg-sky-500/20 dark:text-sky-100">
            {model.coverage.percentage}% manuscript coverage
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-500/20 dark:text-amber-100">
            Canon not yet approved
          </span>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-black/70 dark:text-white/70">
        {model.audit.note}
      </p>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <dt className="text-black/50 dark:text-white/50">Segments</dt>
          <dd className="font-medium">
            {model.coverage.segments_completed} / {model.coverage.segments_total}
          </dd>
        </div>
        <div>
          <dt className="text-black/50 dark:text-white/50">Structural units</dt>
          <dd className="font-medium">
            {model.coverage.units_completed} / {model.coverage.units_total}
          </dd>
        </div>
        <div>
          <dt className="text-black/50 dark:text-white/50">Words</dt>
          <dd className="font-medium">
            {formatWords(model.coverage.words_covered)} / {formatWords(model.coverage.words_total)}
          </dd>
        </div>
        <div>
          <dt className="text-black/50 dark:text-white/50">Historical analysis</dt>
          <dd className="font-medium">{formatUsd(model.cost.historical_paid_usd)}</dd>
        </div>
        <div>
          <dt className="text-black/50 dark:text-white/50">Remediation</dt>
          <dd className="font-medium">{formatUsd(model.cost.remediation_usd)}</dd>
        </div>
      </dl>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/15">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Confirmed contradictions
          </p>
          <p className="mt-1 font-serif text-3xl">{model.summary.confirmed_contradiction_count}</p>
        </div>
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/15">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Possible continuity conflicts
          </p>
          <p className="mt-1 font-serif text-3xl">{model.summary.possible_conflict_count}</p>
        </div>
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/15">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Author verification needed
          </p>
          <p className="mt-1 font-serif text-3xl">{model.summary.author_verification_count}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-black/65 dark:text-white/65">
        Zero confirmed does not mean the manuscript has no continuity issues. StoryDNA requires
        verified evidence and sufficient identity/temporal support before calling a contradiction
        confirmed.
      </p>

      <div className="mt-8 space-y-6">
        {model.findings.confirmed_contradiction.length > 0 ? (
          <section>
            <h3 className="mb-3 font-serif text-lg">Confirmed contradictions</h3>
            <div className="space-y-3">
              {model.findings.confirmed_contradiction.map((finding) => (
                <FindingCard key={finding.id} finding={finding} />
              ))}
            </div>
          </section>
        ) : null}
        <section>
          <h3 className="mb-3 font-serif text-lg">Possible continuity conflicts</h3>
          <div className="space-y-3">
            {model.findings.possible_continuity_conflict.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
        </section>
        <section>
          <h3 className="mb-3 font-serif text-lg">Author verification needed</h3>
          <div className="space-y-3">
            {model.findings.author_verification_needed.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h3 className="font-serif text-lg">Candidate canon</h3>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          {model.candidate_canon_count} candidate facts. Nothing has been accepted into canon.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {model.future_actions.map((action) => (
            <button
              key={action.key}
              type="button"
              disabled
              title={action.note}
              className="cursor-not-allowed rounded-md border border-black/15 px-3 py-1.5 text-xs text-black/40 dark:border-white/20 dark:text-white/35"
            >
              {action.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs uppercase tracking-wide text-black/45 dark:text-white/45">
          Author controls coming next
        </p>
        <div className="mt-4 space-y-5">
          {model.candidate_canon.map((group) => (
            <article key={group.entity} className="rounded-lg border border-black/10 p-4 dark:border-white/15">
              <h4 className="font-medium">{group.entity}</h4>
              <ul className="mt-3 space-y-3">
                {group.facts.map((fact) => (
                  <li key={fact.id} className="border-t border-black/5 pt-3 text-sm dark:border-white/10">
                    <p className="font-semibold">{fact.fact_type}</p>
                    <p>{fact.proposed_value}</p>
                    <p className="text-black/55 dark:text-white/55">
                      {fact.source_location}
                      {fact.temporal_scope !== "Not specified" ? ` · ${fact.temporal_scope}` : ""}
                      {` · ${fact.confidence} · Candidate`}
                    </p>
                    {fact.evidence.kind === "quoted" ? (
                      <blockquote className="mt-2 border-l-2 border-black/20 pl-3 dark:border-white/25">
                        “{fact.evidence.excerpt}”
                      </blockquote>
                    ) : (
                      <p className="mt-2 text-black/55 dark:text-white/55">{fact.evidence.message}</p>
                    )}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {model.ambiguities.length > 0 ? (
        <section className="mt-8">
          <h3 className="font-serif text-lg">Ambiguities</h3>
          <div className="mt-3 space-y-3">
            {model.ambiguities.map((row) => (
              <article key={row.id} className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/15">
                <h4 className="font-medium">“{row.alias}”</h4>
                <p className="mt-1">{row.context}</p>
                <p className="mt-2">Possible matches: {row.candidate_entities.join("; ")}</p>
                <p className="mt-1">{row.recommended_author_verification}</p>
              </article>
            ))}
          </div>
        </section>
      ) : model.withheld_graph_ambiguity_count > 0 ? (
        <p className="mt-6 text-sm text-black/55 dark:text-white/55">
          {model.withheld_graph_ambiguity_count} unresolved graph ambiguity rows were withheld
          because they did not satisfy the published ambiguity contract.
        </p>
      ) : null}

      <details className="mt-8 rounded-md border border-black/10 p-3 text-sm dark:border-white/15">
        <summary className="cursor-pointer font-medium">Analysis details</summary>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-black/50 dark:text-white/50">Workflow</dt>
            <dd className="break-all">{model.workflow_id}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Manuscript / version</dt>
            <dd className="break-all">
              {model.manuscript_id} / {model.manuscript_version_id}
            </dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Content hash</dt>
            <dd className="break-all">{model.audit.content_hash}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Provider / model</dt>
            <dd>
              {model.cost.provider} / {model.cost.model}
            </dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Paid calls</dt>
            <dd>{model.cost.paid_calls}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Historical paid cost</dt>
            <dd>{formatUsd(model.cost.historical_paid_usd)}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Remediation cost</dt>
            <dd>{formatUsd(model.cost.remediation_usd)}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Original workflow status</dt>
            <dd>{model.audit.original_workflow_status}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Candidate review</dt>
            <dd>{model.audit.candidate_review_validation_status}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Fabricated evidence</dt>
            <dd>{model.audit.fabricated_evidence}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Model-vs-final</dt>
            <dd>
              {model.model_vs_final.downgrades} downgrades · {model.model_vs_final.promotions} promotions
            </dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
