"use client";

import { useMemo, useState, useTransition } from "react";
import type { StudioActionItem, StudioRevisionBoardSummary } from "@/lib/studio/types.ts";
import type { StudioRevisionFilter } from "@/lib/studio/decisions.ts";
import { MANUSCRIPT_NOT_MODIFIED_MESSAGE, matchesRevisionFilter } from "@/lib/studio/decisions.ts";
import {
  acceptModifiedRevision,
  acceptRevisionSuggestion,
  deferRevisionSuggestion,
  rejectRevisionSuggestion,
  reopenRevisionDecision,
  updateRevisionAuthorNote,
} from "@/app/studio/actions/revision-decisions.ts";

const FILTERS: { value: StudioRevisionFilter | "expert" | "chapter" | "severity"; label: string }[] =
  [
    { value: "all", label: "All" },
    { value: "not_reviewed", label: "Not Reviewed" },
    { value: "accepted", label: "Accepted" },
    { value: "accepted_modified", label: "Accepted With Changes" },
    { value: "rejected", label: "Rejected" },
    { value: "deferred", label: "Saved for Later" },
  ];

function DecisionBadge({ item }: { item: StudioActionItem }) {
  return (
    <span
      className="rounded-full border border-black/15 bg-black/[0.03] px-2 py-0.5 text-xs font-medium dark:border-white/15"
      aria-label={`Current decision: ${item.decisionLabel}`}
    >
      {item.decisionLabel}
    </span>
  );
}

function RevisionCard({
  bookId,
  item,
}: {
  bookId: string;
  item: StudioActionItem;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editText, setEditText] = useState(item.suggestedRewrite);
  const [noteText, setNoteText] = useState(item.authorNotes ?? "");

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Unable to save your decision.");
        return;
      }
      setMessage(MANUSCRIPT_NOT_MODIFIED_MESSAGE);
      setShowEditor(false);
    });
  }

  return (
    <article className="rounded-xl border border-black/10 bg-paper p-5 shadow-sm dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-black/45">
            {item.sourceExpert} · {item.category ?? "General"}
          </p>
          <h3 className="font-serif text-lg font-semibold">{item.issueTitle}</h3>
        </div>
        <DecisionBadge item={item} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section aria-labelledby={`original-${item.id}`}>
          <h4 id={`original-${item.id}`} className="text-xs font-semibold uppercase tracking-wide text-black/45">
            Original
          </h4>
          <p className="mt-1 rounded-lg bg-black/[0.03] p-3 text-sm italic dark:bg-white/5">
            {item.quotedEvidence || "—"}
          </p>
          {item.chapterOrLocation ? (
            <p className="mt-1 text-xs text-black/45">Location: {item.chapterOrLocation}</p>
          ) : null}
        </section>
        <section aria-labelledby={`rewrite-${item.id}`}>
          <h4 id={`rewrite-${item.id}`} className="text-xs font-semibold uppercase tracking-wide text-black/45">
            Suggested rewrite
          </h4>
          <p className="mt-1 rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30">
            {item.suggestedRewrite || "—"}
          </p>
          {item.rewriteRationale ? (
            <p className="mt-1 text-xs text-black/45">{item.rewriteRationale}</p>
          ) : null}
        </section>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div>
          <span className="font-medium">Expert concern: </span>
          {item.explanation}
        </div>
        {item.whyItMatters ? (
          <div>
            <span className="font-medium">Why it matters: </span>
            {item.whyItMatters}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3 text-xs text-black/50">
          <span>Severity: {item.severity ?? "—"}</span>
          <span>Confidence: {item.confidence ?? "—"}</span>
        </div>
      </div>

      <section className="mt-5 border-t border-black/10 pt-4 dark:border-white/10" aria-labelledby={`decision-${item.id}`}>
        <h4 id={`decision-${item.id}`} className="text-xs font-semibold uppercase tracking-wide text-black/45">
          Author decision
        </h4>

        {showEditor ? (
          <div className="mt-3 space-y-2">
            <label htmlFor={`edit-${item.id}`} className="text-sm font-medium">
              Edit &amp; accept — your final text
            </label>
            <textarea
              id={`edit-${item.id}`}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-black/10 bg-white p-3 text-sm dark:border-white/10 dark:bg-black/20"
            />
            <p className="text-xs text-black/45">
              The expert suggestion is preserved separately. This decision does not modify the manuscript.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    acceptModifiedRevision({
                      candidateId: item.id,
                      manuscriptId: bookId,
                      authorFinalText: editText,
                      authorNote: noteText || null,
                    }),
                  )
                }
                className="rounded-lg bg-accent px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                Save edited acceptance
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setShowEditor(false)}
                className="rounded-lg border border-black/10 px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  acceptRevisionSuggestion({
                    candidateId: item.id,
                    manuscriptId: bookId,
                    authorNote: noteText || null,
                  }),
                )
              }
              className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:border-accent disabled:opacity-50"
            >
              Accept
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setEditText(item.suggestedRewrite);
                setShowEditor(true);
              }}
              className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:border-accent disabled:opacity-50"
            >
              Edit &amp; Accept
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  rejectRevisionSuggestion({
                    candidateId: item.id,
                    manuscriptId: bookId,
                    authorNote: noteText || null,
                  }),
                )
              }
              className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:border-accent disabled:opacity-50"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  deferRevisionSuggestion({
                    candidateId: item.id,
                    manuscriptId: bookId,
                    authorNote: noteText || null,
                  }),
                )
              }
              className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:border-accent disabled:opacity-50"
            >
              Save for Later
            </button>
            {item.studioDisposition !== "pending" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    reopenRevisionDecision({
                      candidateId: item.id,
                      manuscriptId: bookId,
                    }),
                  )
                }
                className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:border-accent disabled:opacity-50"
              >
                Reopen Decision
              </button>
            ) : null}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <label htmlFor={`note-${item.id}`} className="text-sm font-medium">
            Author note
          </label>
          <textarea
            id={`note-${item.id}`}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-black/10 bg-white p-3 text-sm dark:border-white/10 dark:bg-black/20"
          />
          <button
            type="button"
            disabled={pending || !noteText.trim()}
            onClick={() =>
              run(() =>
                updateRevisionAuthorNote({
                  candidateId: item.id,
                  manuscriptId: bookId,
                  authorNote: noteText,
                }),
              )
            }
            className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:border-accent disabled:opacity-50"
          >
            Add Note
          </button>
        </div>

        {pending ? <p className="mt-2 text-sm text-black/55">Saving…</p> : null}
        {message ? (
          <p className="mt-2 text-sm text-emerald-800" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </article>
  );
}

export function RevisionBoardClient({
  bookId,
  items,
  summary,
}: {
  bookId: string;
  items: readonly StudioActionItem[];
  summary: StudioRevisionBoardSummary;
}) {
  const [filter, setFilter] = useState<StudioRevisionFilter>("all");
  const [expertFilter, setExpertFilter] = useState<string>("all");
  const [chapterFilter, setChapterFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const experts = useMemo(
    () => [...new Set(items.map((i) => i.sourceExpert))].sort(),
    [items],
  );
  const chapters = useMemo(
    () =>
      [...new Set(items.map((i) => i.chapterOrLocation).filter(Boolean) as string[])].sort(),
    [items],
  );
  const severities = useMemo(
    () => [...new Set(items.map((i) => i.severity).filter(Boolean) as string[])].sort(),
    [items],
  );

  const filtered = items.filter((item) => {
    if (!matchesRevisionFilter(item.studioDisposition, filter)) return false;
    if (expertFilter !== "all" && item.sourceExpert !== expertFilter) return false;
    if (chapterFilter !== "all" && item.chapterOrLocation !== chapterFilter) return false;
    if (severityFilter !== "all" && item.severity !== severityFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Total", summary.total],
          ["Not Reviewed", summary.notReviewed],
          ["Accepted", summary.accepted],
          ["With Changes", summary.acceptedModified],
          ["Rejected", summary.rejected],
          ["Saved for Later", summary.deferred],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-black/10 bg-paper p-3 text-center dark:border-white/10"
          >
            <p className="text-xs uppercase tracking-wide text-black/45">{label}</p>
            <p className="mt-1 font-serif text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value as StudioRevisionFilter)}
            className={`rounded-full px-3 py-1 text-xs ${
              filter === f.value ? "bg-accent text-white" : "border border-black/10"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <label>
          Expert{" "}
          <select
            value={expertFilter}
            onChange={(e) => setExpertFilter(e.target.value)}
            className="ml-1 rounded border border-black/10 px-2 py-1"
          >
            <option value="all">All</option>
            {experts.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label>
          Chapter{" "}
          <select
            value={chapterFilter}
            onChange={(e) => setChapterFilter(e.target.value)}
            className="ml-1 rounded border border-black/10 px-2 py-1"
          >
            <option value="all">All</option>
            {chapters.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Severity{" "}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="ml-1 rounded border border-black/10 px-2 py-1"
          >
            <option value="all">All</option>
            {severities.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-black/55">No recommendations match the current filters.</p>
        ) : (
          filtered.map((item) => <RevisionCard key={item.id} bookId={bookId} item={item} />)
        )}
      </div>
    </div>
  );
}
