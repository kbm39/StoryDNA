"use client";

import { useState, useTransition } from "react";
import { runArchivistDryRunAction } from "@/app/actions/archivist-dry-run.ts";
import {
  ARCHIVIST_DRY_RUN_SCENARIO_OPTIONS,
} from "@/lib/archivist-dry-run/present.ts";
import { DEFAULT_ARCHIVIST_DRY_RUN_SCENARIO } from "@/lib/archivist-dry-run/types.ts";
import type {
  ArchivistDryRunUiResult,
  PresentedCanonCandidate,
  PresentedEntityAmbiguity,
  PresentedFinding,
} from "@/lib/archivist-dry-run/types.ts";

function classificationTone(classification: string): string {
  if (classification === "confirmed_contradiction") {
    return "border-red-300 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100";
  }
  if (classification === "possible_continuity_conflict") {
    return "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100";
  }
  return "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100";
}

function EvidenceBlock({
  heading,
  location,
  source,
  excerpts,
}: {
  heading: string;
  location: string;
  source?: string;
  excerpts: Array<{ excerpt: string; location: string }>;
}) {
  return (
    <div className="rounded-md border border-black/10 bg-white/70 p-3 dark:border-white/15 dark:bg-black/20">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        {heading}
      </p>
      <p className="mt-1 text-sm font-medium">
        {location}
        {source ? <span className="font-normal text-black/55 dark:text-white/55"> · {source}</span> : null}
      </p>
      {excerpts.length === 0 ? (
        <p className="mt-2 text-sm text-black/55 dark:text-white/55">No excerpt available.</p>
      ) : (
        excerpts.map((item, index) => (
          <blockquote
            key={`${item.location}-${index}`}
            className="mt-2 border-l-2 border-black/20 pl-3 text-sm leading-relaxed dark:border-white/25"
          >
            “{item.excerpt}”
          </blockquote>
        ))
      )}
    </div>
  );
}

function FindingCard({ finding }: { finding: PresentedFinding }) {
  return (
    <article className={`rounded-lg border p-4 ${classificationTone(finding.classification)}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold tracking-wide">{finding.classification_label}</p>
        <span className="text-xs text-black/60 dark:text-white/60">{finding.issue_type_label}</span>
        <span className="text-xs text-black/60 dark:text-white/60">Severity: {finding.severity}</span>
        <span className="text-xs text-black/60 dark:text-white/60">Confidence: {finding.confidence}</span>
      </div>

      {finding.is_confirmed_contradiction ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <EvidenceBlock
            heading="Current passage"
            location={finding.current_location}
            excerpts={finding.current_evidence}
          />
          <EvidenceBlock
            heading="Conflicting passage / canon"
            location={finding.conflicting_location}
            source={finding.conflicting_source}
            excerpts={finding.conflicting_evidence}
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <EvidenceBlock
            heading="Current location"
            location={finding.current_location}
            excerpts={finding.current_evidence}
          />
          <EvidenceBlock
            heading="Related passage / source"
            location={finding.conflicting_location}
            source={finding.conflicting_source}
            excerpts={finding.conflicting_evidence}
          />
        </div>
      )}

      <div className="mt-4 space-y-2 text-sm leading-relaxed">
        <p>
          <span className="font-semibold">Why this was raised: </span>
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
    </article>
  );
}

function CandidateCard({ candidate }: { candidate: PresentedCanonCandidate }) {
  return (
    <article className="rounded-lg border border-black/10 bg-paper p-4 dark:border-white/15 dark:bg-white/5">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        Status: candidate
      </p>
      <h4 className="mt-1 font-medium">{candidate.entity}</h4>
      <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-black/50 dark:text-white/50">Entity type</dt>
          <dd>{candidate.entity_type}</dd>
        </div>
        <div>
          <dt className="text-black/50 dark:text-white/50">Fact type</dt>
          <dd>{candidate.fact_type}</dd>
        </div>
        <div>
          <dt className="text-black/50 dark:text-white/50">Proposed value</dt>
          <dd>{candidate.proposed_value}</dd>
        </div>
        <div>
          <dt className="text-black/50 dark:text-white/50">Temporal scope</dt>
          <dd>{candidate.temporal_scope}</dd>
        </div>
        <div>
          <dt className="text-black/50 dark:text-white/50">Source location</dt>
          <dd>{candidate.source_location}</dd>
        </div>
        <div>
          <dt className="text-black/50 dark:text-white/50">Confidence</dt>
          <dd>{candidate.confidence}</dd>
        </div>
        <div>
          <dt className="text-black/50 dark:text-white/50">Proposed authority</dt>
          <dd>{candidate.proposed_authority}</dd>
        </div>
      </dl>
      {candidate.evidence.map((item, index) => (
        <blockquote
          key={`${item.location}-${index}`}
          className="mt-3 border-l-2 border-black/20 pl-3 text-sm dark:border-white/25"
        >
          “{item.excerpt}”
        </blockquote>
      ))}
    </article>
  );
}

function AmbiguityCard({ row }: { row: PresentedEntityAmbiguity }) {
  return (
    <article className="rounded-lg border border-black/10 bg-paper p-4 dark:border-white/15 dark:bg-white/5">
      <h4 className="font-medium">“{row.alias}”</h4>
      <p className="mt-1 text-sm text-black/70 dark:text-white/70">{row.context}</p>
      <p className="mt-2 text-sm">
        <span className="font-semibold">Possible matches: </span>
        {row.candidate_entities.length > 0 ? row.candidate_entities.join("; ") : "None listed"}
      </p>
      <p className="mt-1 text-sm">
        <span className="font-semibold">Confidence: </span>
        {row.confidence}
      </p>
      <p className="mt-1 text-sm">{row.recommended_author_verification}</p>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
        StoryDNA did not guess
      </p>
    </article>
  );
}

export default function ArchivistDryRunPanel({ manuscriptId }: { manuscriptId: string }) {
  const [pending, start] = useTransition();
  const [scenario, setScenario] = useState<string>(DEFAULT_ARCHIVIST_DRY_RUN_SCENARIO);
  const [result, setResult] = useState<ArchivistDryRunUiResult | null>(null);

  function run() {
    start(async () => {
      const next = await runArchivistDryRunAction(manuscriptId, scenario);
      setResult(next);
    });
  }

  return (
    <section
      id="archivist-dry-run"
      className="mb-8 scroll-mt-20 rounded-xl border border-black/10 bg-paper p-5 shadow-sm dark:border-white/15 dark:bg-white/5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-semibold tracking-tight">Archivist</h2>
          <p className="text-sm text-black/60 dark:text-white/60">Continuity &amp; Canon</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-500/20 dark:text-amber-100">
            Dry run
          </span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100">
            $0
          </span>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-black/70 dark:text-white/70">
        Uses deterministic test scenarios. No AI provider call. No canon changes are saved.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-black/55 dark:text-white/55">
            Fixture scenario
          </span>
          <select
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
            className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-black/30"
          >
            {ARCHIVIST_DRY_RUN_SCENARIO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Running dry run…" : "Run Archivist Dry Run — $0"}
        </button>
      </div>

      {result && !result.ok && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
          {result.error_message}
        </p>
      )}

      {result?.ok && (
        <div className="mt-5 space-y-5">
          <div className="rounded-lg border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            {result.banners.map((line) => (
              <p key={line} className="font-semibold tracking-wide">
                {line}
              </p>
            ))}
          </div>

          <div className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/15">
            <h3 className="font-semibold">Summary</h3>
            <dl className="mt-2 grid gap-1 sm:grid-cols-2">
              <div>
                <dt className="text-black/50 dark:text-white/50">Manuscript</dt>
                <dd>{result.pin.title}</dd>
              </div>
              <div>
                <dt className="text-black/50 dark:text-white/50">Version</dt>
                <dd>
                  {result.pin.version_number != null
                    ? `Version ${result.pin.version_number}`
                    : result.pin.manuscript_version_id}
                </dd>
              </div>
              <div>
                <dt className="text-black/50 dark:text-white/50">Analytical word count</dt>
                <dd>{result.pin.analytical_word_count.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-black/50 dark:text-white/50">Execution mode</dt>
                <dd>{result.summary.execution_mode}</dd>
              </div>
              <div>
                <dt className="text-black/50 dark:text-white/50">Status</dt>
                <dd>{result.summary.status}</dd>
              </div>
              <div>
                <dt className="text-black/50 dark:text-white/50">Runtime</dt>
                <dd>{result.summary.runtime_ms} ms</dd>
              </div>
              <div>
                <dt className="text-black/50 dark:text-white/50">Provider</dt>
                <dd>{result.summary.provider}</dd>
              </div>
              <div>
                <dt className="text-black/50 dark:text-white/50">Model</dt>
                <dd>{result.summary.model}</dd>
              </div>
              <div>
                <dt className="text-black/50 dark:text-white/50">Cost</dt>
                <dd>$0 exact</dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="font-semibold">Findings</h3>
            {result.findings.length === 0 ? (
              <p className="mt-2 text-sm text-black/60 dark:text-white/60">
                This fixture has no continuity findings.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {result.findings.map((finding) => (
                  <FindingCard key={finding.id} finding={finding} />
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-semibold">Candidate Canon</h3>
            <p className="mt-1 text-sm text-black/65 dark:text-white/65">
              These are proposed facts only. Nothing has been added to accepted canon.
            </p>
            {result.candidates.length === 0 ? (
              <p className="mt-2 text-sm text-black/60 dark:text-white/60">
                This fixture has no candidate canon facts.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {result.candidates.map((candidate) => (
                  <CandidateCard key={candidate.id} candidate={candidate} />
                ))}
              </div>
            )}
          </div>

          {result.ambiguities.length > 0 && (
            <div>
              <h3 className="font-semibold">Entity Ambiguities</h3>
              <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                StoryDNA did not guess which character these names belong to.
              </p>
              <div className="mt-3 space-y-3">
                {result.ambiguities.map((row) => (
                  <AmbiguityCard key={row.id} row={row} />
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold">Author actions</h3>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              Preview only. These do not save a decision.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {result.future_actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  disabled
                  title={action.note}
                  className="rounded-md border border-black/15 px-3 py-1.5 text-sm text-black/45 disabled:cursor-not-allowed dark:border-white/20 dark:text-white/40"
                >
                  {action.label}
                  <span className="ml-2 text-[10px] uppercase tracking-wide">{action.note}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
