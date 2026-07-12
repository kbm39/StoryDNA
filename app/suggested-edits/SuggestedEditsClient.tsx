"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { submitAuthorResponse } from "@/app/actions/suggested-edits";
import {
  nextPendingCandidateId,
  suggestedEditsHref,
  type SuggestedEditStatus,
} from "@/lib/author-response-status";
import type { AuthorEditDisposition } from "@/lib/types";
import type { SuggestedEditView } from "@/lib/suggested-edits";

const STATUS_LABEL: Record<SuggestedEditStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  modified: "Modified",
  skipped: "Skipped",
};

const STATUS_CLS: Record<SuggestedEditStatus, string> = {
  pending: "bg-black/[.06] text-black/60 dark:bg-white/10 dark:text-white/60",
  accepted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300",
  modified: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300",
  skipped: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
};

const FILTERS: Array<SuggestedEditStatus | "all"> = [
  "all",
  "pending",
  "accepted",
  "rejected",
  "modified",
  "skipped",
];

type DraftDisposition = AuthorEditDisposition | null;

function ContextBlock({ text }: { text: string }) {
  return text.split("\n\n").map((para, i) => (
    <p key={i} className="font-serif text-[16px] leading-relaxed text-black/65 dark:text-white/70">
      {para}
    </p>
  ));
}

function StatusBadge({ status }: { status: SuggestedEditStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 font-sans text-xs font-semibold uppercase tracking-wide ${STATUS_CLS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function Reply({
  children,
  onClick,
  primary,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  const cls = active
    ? "border-accent bg-accent text-white"
    : primary
      ? "border-accent/50 text-accent hover:bg-accent/5"
      : "border-black/15 hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/10";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-4 py-2 font-serif text-[15px] transition disabled:cursor-not-allowed disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}

export default function SuggestedEditsClient({
  manuscriptId,
  manuscriptTitle,
  edits: initialEdits,
  statusFilter,
  initialCandidateId,
}: {
  manuscriptId: string;
  manuscriptTitle: string;
  edits: SuggestedEditView[];
  statusFilter: SuggestedEditStatus | "all";
  initialCandidateId?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCandidateId = searchParams.get("candidate") ?? initialCandidateId ?? null;

  const [edits, setEdits] = useState(initialEdits);
  const [draftDisposition, setDraftDisposition] = useState<DraftDisposition>(null);
  const [modifiedText, setModifiedText] = useState("");
  const [authorNote, setAuthorNote] = useState("");
  const [noteFieldKey, setNoteFieldKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [revising, setRevising] = useState(false);
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const lastSyncedCandidateRef = useRef<string | null>(null);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return edits;
    return edits.filter((e) => e.disposition === statusFilter);
  }, [edits, statusFilter]);

  const index = useMemo(() => {
    if (!activeCandidateId) return 0;
    const i = filtered.findIndex((e) => e.id === activeCandidateId);
    return i >= 0 ? i : 0;
  }, [filtered, activeCandidateId]);

  const current = filtered[index];
  const total = filtered.length;

  useEffect(() => {
    if (!current) return;
    const candidateKey = `${current.id}:${current.updatedAt ?? ""}`;
    if (lastSyncedCandidateRef.current === candidateKey) return;
    lastSyncedCandidateRef.current = candidateKey;
    setDraftDisposition(null);
    setModifiedText(current.authorModifiedText ?? current.revised);
    setAuthorNote(current.authorNote ?? "");
    setNoteFieldKey((k) => k + 1);
    setSubmitError(null);
    setSubmitSuccess(false);
    setRevising(false);
    setSubmittedOnce(false);
  }, [current]);

  const counts = useMemo(() => {
    const c = { accepted: 0, rejected: 0, modified: 0, skipped: 0, pending: 0 };
    for (const e of edits) c[e.disposition] += 1;
    return c;
  }, [edits]);

  const hasPersistedResponse = current?.disposition !== "pending" && !revising;
  const canSubmit =
    draftDisposition !== null &&
    !submitting &&
    !submittedOnce &&
    (draftDisposition !== "modified" || modifiedText.trim().length > 0);

  function navigateToCandidate(candidateId: string | null) {
    router.replace(suggestedEditsHref(manuscriptId, statusFilter, candidateId));
  }

  function resetDraftFromCurrent(edit: SuggestedEditView) {
    setDraftDisposition(null);
    setModifiedText(edit.authorModifiedText ?? edit.revised);
    setAuthorNote(edit.authorNote ?? "");
    setNoteFieldKey((k) => k + 1);
    setSubmitError(null);
    setSubmitSuccess(false);
    setRevising(false);
    setSubmittedOnce(false);
  }

  function selectDisposition(d: AuthorEditDisposition) {
    setDraftDisposition(d);
    setSubmitError(null);
    setSubmitSuccess(false);
    setSubmittedOnce(false);
    if (d === "modified" && !modifiedText.trim()) {
      setModifiedText(current?.revised ?? "");
    }
  }

  function startRevise() {
    if (!current) return;
    setRevising(true);
    setDraftDisposition(current.disposition === "pending" ? null : current.disposition);
    setModifiedText(current.authorModifiedText ?? current.revised);
    setAuthorNote(current.authorNote ?? "");
    setNoteFieldKey((k) => k + 1);
    setSubmitError(null);
    setSubmitSuccess(false);
    setSubmittedOnce(false);
  }

  async function handleSubmit() {
    if (!current || !draftDisposition || submitting) return;
    const wasFirstTime = current.disposition === "pending";
    const candidateId = current.id;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    const trimmedNote = authorNote.trim();
    const result = await submitAuthorResponse({
      candidateId,
      manuscriptId,
      disposition: draftDisposition,
      authorModifiedText: draftDisposition === "modified" ? modifiedText : null,
      authorNote: trimmedNote || null,
    });

    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error ?? "Submission failed. Please try again.");
      return;
    }

    const now = new Date().toISOString();
    const updated: SuggestedEditView = {
      ...current,
      disposition: draftDisposition,
      authorModifiedText: draftDisposition === "modified" ? modifiedText.trim() : null,
      authorNote: trimmedNote || null,
      respondedAt: current.respondedAt ?? now,
      updatedAt: now,
    };

    const nextEdits = edits.map((e) => (e.id === candidateId ? updated : e));
    setEdits(nextEdits);
    setSubmitSuccess(true);
    setRevising(false);
    setSubmittedOnce(true);
    setAuthorNote(trimmedNote);

    if (wasFirstTime) {
      const nextId = nextPendingCandidateId(nextEdits, candidateId);
      navigateToCandidate(nextId ?? candidateId);
    } else {
      navigateToCandidate(candidateId);
    }
  }

  function goTo(candidateId: string) {
    navigateToCandidate(candidateId);
    const next = filtered.find((e) => e.id === candidateId) ?? edits.find((e) => e.id === candidateId);
    if (next) resetDraftFromCurrent(next);
  }

  if (edits.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <Greeting title={manuscriptTitle} />
        <p className="font-serif text-[17px] leading-relaxed text-black/70 dark:text-white/75">
          No suggested edits are available for this manuscript yet. Run the Literary Agent review
          and generate revision candidates first.
        </p>
        <Link
          href={`/manuscripts/${manuscriptId}`}
          className="mt-4 inline-block text-sm text-accent hover:underline"
        >
          ← Back to manuscript
        </Link>
      </main>
    );
  }

  if (!current) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <Greeting title={manuscriptTitle} />
        <p className="font-serif text-[17px] text-black/70 dark:text-white/75">
          No edits match this filter.
        </p>
        <Link
          href={suggestedEditsHref(manuscriptId, "all")}
          className="mt-4 inline-block text-sm text-accent hover:underline"
        >
          Show all edits
        </Link>
      </main>
    );
  }

  const ordinals = ["first", "second", "third", "fourth", "fifth", "sixth"];
  const prevCandidate = index > 0 ? filtered[index - 1] : null;
  const nextCandidate = index < total - 1 ? filtered[index + 1] : null;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <Greeting title={manuscriptTitle} />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const href = suggestedEditsHref(
            manuscriptId,
            f,
            f === statusFilter ? activeCandidateId : null,
          );
          const active = statusFilter === f;
          return (
            <Link
              key={f}
              href={href}
              className={`rounded-full border px-3 py-1 font-sans text-xs font-medium transition ${
                active
                  ? "border-accent bg-accent text-white"
                  : "border-black/15 text-black/55 hover:border-accent/50 dark:border-white/20 dark:text-white/55"
              }`}
            >
              {f === "all" ? "All" : STATUS_LABEL[f]}
              {f !== "all" && (
                <span className="ml-1 opacity-70">
                  ({f === "pending" ? counts.pending : counts[f]})
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <p className="mb-6 text-sm text-black/45 dark:text-white/45">
        The {ordinals[index] ?? `${index + 1}th`} of {total}
        {current.locator ? ` — ${current.locator}` : ""}
        {prevCandidate && (
          <button
            type="button"
            onClick={() => goTo(prevCandidate.id)}
            className="ml-2 text-accent hover:underline"
          >
            back
          </button>
        )}
      </p>

      <article className="space-y-4 font-serif text-[17px] leading-relaxed text-black/80 dark:text-white/85">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={current.disposition} />
          <span className="rounded bg-accent/10 px-2 py-0.5 font-sans text-xs font-medium text-accent">
            {current.type.replace(/_/g, " ")}
          </span>
          <span className="font-sans text-xs text-black/45 dark:text-white/45">
            {current.owningReviewer}
          </span>
        </div>

        {current.issueText && (
          <p className="text-[16px] text-black/70 dark:text-white/75">{current.issueText}</p>
        )}

        <section aria-label="Passage in Context">
          <h2 className="mb-3 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-black/45 dark:text-white/45">
            Passage in Context
          </h2>
          <div className="space-y-3 rounded-xl border border-black/10 bg-black/[.02] p-5 dark:border-white/10 dark:bg-white/[.03]">
            {!current.contextAvailable && (
              <p className="font-serif text-[15px] italic text-black/50 dark:text-white/50">
                Context unavailable — this passage could not be located in the manuscript text.
              </p>
            )}
            {current.contextBefore && <ContextBlock text={current.contextBefore} />}
            <p className="border-l-[3px] border-accent/60 py-1 pl-4 font-serif text-[19px] leading-relaxed text-black/90 dark:text-white/95">
              “{current.original}”
            </p>
            {current.contextAfter && <ContextBlock text={current.contextAfter} />}
          </div>
        </section>

        {current.reason && <p>{current.reason}</p>}

        <div>
          <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-black/45 dark:text-white/45">
            Proposed revision
          </p>
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 p-4 font-serif text-[18px] leading-relaxed text-black/90 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-white/95">
            “{current.revised || "—"}”
          </p>
        </div>

        {hasPersistedResponse && (
          <div className="rounded-xl border border-black/10 bg-black/[.02] p-4 dark:border-white/10 dark:bg-white/[.03]">
            <p className="font-sans text-sm font-medium text-black/70 dark:text-white/75">
              Your response: {STATUS_LABEL[current.disposition]}
            </p>
            {current.disposition === "modified" && current.authorModifiedText && (
              <p className="mt-1 text-black/65 dark:text-white/70">
                Your version: “{current.authorModifiedText}”
              </p>
            )}
            {current.authorNote && (
              <p className="mt-1 text-[15px] italic text-black/55 dark:text-white/55">
                Note: {current.authorNote}
              </p>
            )}
            {current.updatedAt && (
              <p className="mt-2 font-sans text-xs text-black/40 dark:text-white/40">
                Last updated {new Date(current.updatedAt).toLocaleString()}
              </p>
            )}
            {!revising && (
              <button
                type="button"
                onClick={startRevise}
                className="mt-3 text-sm font-medium text-accent hover:underline"
              >
                Revise this response
              </button>
            )}
          </div>
        )}

        {revising && (
          <p className="rounded-lg border border-amber-300/60 bg-amber-50/80 px-3 py-2 font-sans text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            You are updating a previous response. Submit again to replace it.
          </p>
        )}

        {(!hasPersistedResponse || revising) && (
          <>
            <p className="mt-2 font-serif text-[17px]">How would you like to respond?</p>
            <div className="flex flex-wrap gap-2.5">
              <Reply
                onClick={() => selectDisposition("accepted")}
                primary
                active={draftDisposition === "accepted"}
              >
                Accept
              </Reply>
              <Reply
                onClick={() => selectDisposition("rejected")}
                active={draftDisposition === "rejected"}
              >
                Reject
              </Reply>
              <Reply
                onClick={() => selectDisposition("modified")}
                active={draftDisposition === "modified"}
              >
                Modify
              </Reply>
              <Reply
                onClick={() => selectDisposition("skipped")}
                active={draftDisposition === "skipped"}
              >
                Skip for Now
              </Reply>
            </div>

            {draftDisposition === "modified" && (
              <div className="mt-4 rounded-xl border border-black/10 p-4 dark:border-white/10">
                <p className="mb-2 font-serif text-[15px] text-black/60 dark:text-white/60">
                  Your replacement text (the original suggestion is preserved):
                </p>
                <textarea
                  value={modifiedText}
                  onChange={(e) => setModifiedText(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-black/15 bg-transparent p-3 font-serif text-[16px] outline-none focus:border-accent dark:border-white/20"
                />
              </div>
            )}

            <div className="mt-4">
              <label
                htmlFor="author-note"
                className="mb-2 block font-serif text-[15px] text-black/60 dark:text-white/60"
              >
                Optional note to StoryDNA
              </label>
              <textarea
                key={`author-note-${current.id}-${noteFieldKey}`}
                id="author-note"
                value={authorNote}
                onChange={(e) => setAuthorNote(e.target.value)}
                rows={2}
                placeholder="Share tone, intention, or anything the suggestion missed."
                className="w-full rounded-lg border border-black/15 bg-transparent p-3 font-serif text-[16px] outline-none focus:border-accent dark:border-white/20"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit Response"}
              </button>
              {draftDisposition === null && (
                <span className="font-sans text-xs text-black/45 dark:text-white/45">
                  Select a response to enable submission.
                </span>
              )}
            </div>

            {submitError && (
              <p className="mt-2 font-sans text-sm text-red-600 dark:text-red-400" role="alert">
                {submitError}
              </p>
            )}
            {submitSuccess && (
              <p className="mt-2 font-sans text-sm text-emerald-700 dark:text-emerald-400" role="status">
                Response saved. Your choice has been recorded.
              </p>
            )}
          </>
        )}
      </article>

      {hasPersistedResponse && nextCandidate && (
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={() => goTo(nextCandidate.id)}
            className="rounded-xl border border-accent/40 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/5"
          >
            Next suggestion →
          </button>
        </div>
      )}

      {hasPersistedResponse && !nextCandidate && (
        <div className="mt-10 space-y-4 border-t border-black/10 pt-8 dark:border-white/10">
          <p className="font-serif text-[17px] leading-relaxed text-black/80 dark:text-white/85">
            That’s the lot for this filter. You accepted {counts.accepted}, modified {counts.modified},
            rejected {counts.rejected}, and set {counts.skipped} aside for now.
          </p>
          <Link
            href={`/manuscripts/${manuscriptId}`}
            className="inline-block text-sm text-accent hover:underline"
          >
            ← Return to manuscript
          </Link>
        </div>
      )}
    </main>
  );
}

function Greeting({ title }: { title: string }) {
  return (
    <header className="mb-10">
      <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-accent">
        StoryDNA · Editorial Review
      </p>
      <h1 className="mt-3 font-serif text-[26px] leading-snug text-black/90 dark:text-white/95">
        Let’s Strengthen <em>{title}</em>
      </h1>
      <p className="mt-4 max-w-xl font-serif text-[18px] leading-relaxed text-black/75 dark:text-white/80">
        Review each suggested edit in context, then record your response. Nothing here changes your
        manuscript — these choices capture your intent for a later, controlled revision workflow.
      </p>
    </header>
  );
}
