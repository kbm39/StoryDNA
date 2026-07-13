"use client";

import { useState, useTransition } from "react";
import { setCandidateStatus } from "@/app/actions/agent-revisions";
import type { RevisionStatus } from "@/lib/types";

/**
 * Editorial lifecycle controls for revision_candidates.status.
 * Distinct from the author's accept/reject/modify/skip workflow in Suggested Edits
 * (author_edit_responses.disposition). These buttons do not record author decisions.
 */
export default function CandidateStatusControl({
  candidateId,
  manuscriptId,
  status,
  verified,
}: {
  candidateId: string;
  manuscriptId: string;
  status: RevisionStatus;
  verified: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = (s: RevisionStatus) => {
    const next = status === s ? "proposed" : s;
    setError(null);
    start(async () => {
      const result = await setCandidateStatus(candidateId, manuscriptId, next);
      if (!result.ok) setError(result.error ?? "Could not update editorial status.");
    });
  };

  const base = "rounded px-2 py-0.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="mt-2 space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        Editorial lifecycle
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={pending || !verified}
          onClick={() => set("accepted")}
          title={
            verified
              ? "Mark editorially accepted for export prep"
              : "Passage not located — editorial accept blocked"
          }
          className={`${base} ${
            status === "accepted"
              ? "bg-emerald-600 text-white"
              : "border border-emerald-600/50 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
          }`}
        >
          {status === "accepted" ? "✓ Editorial accept" : "Editorial accept"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => set("rejected")}
          className={`${base} ${
            status === "rejected"
              ? "bg-red-600 text-white"
              : "border border-black/15 hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/10"
          }`}
        >
          {status === "rejected" ? "✗ Editorial reject" : "Editorial reject"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => set("deferred")}
          className={`${base} ${
            status === "deferred"
              ? "bg-amber-500 text-white"
              : "border border-black/15 hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/10"
          }`}
        >
          {status === "deferred" ? "Deferred" : "Defer"}
        </button>
        {status !== "proposed" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => set("proposed")}
            className={`${base} border border-black/15 hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/10`}
          >
            Return to proposed
          </button>
        )}
        {pending && (
          <span className="text-[11px] text-black/45 dark:text-white/45">Saving…</span>
        )}
        {!verified && (
          <span className="text-[11px] text-black/40 dark:text-white/40">
            Passage not located — editorial accept blocked
          </span>
        )}
      </div>
      {error && (
        <p className="text-[11px] text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
