"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import {
  requestCommentSuggestions,
  insertCommentAsWordComment,
} from "@/app/actions/editorial";
import { deleteSuggestion } from "@/app/actions/suggestions";
import type {
  CommentAssessment,
  CommentStance,
  EditorialComment,
  Provider,
  Suggestion,
} from "@/lib/types";
import ApplyEditControl from "./ApplyEditControl";

const PROVIDER_LABEL: Record<string, string> = { openai: "OpenAI", anthropic: "Claude" };

const STANCE: Record<CommentStance, { label: string; cls: string }> = {
  agree: {
    label: "Agrees",
    cls: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
  },
  disagree: {
    label: "Disagrees",
    cls: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  },
  partial: {
    label: "Partly agrees",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
  },
};

function VerdictRow({
  provider,
  assessment,
}: {
  provider: Provider;
  assessment: CommentAssessment | undefined;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="w-14 shrink-0 pt-0.5 text-xs font-medium text-black/55 dark:text-white/55">
        {PROVIDER_LABEL[provider]}
      </span>
      {assessment ? (
        <span className="min-w-0">
          <span
            className={`mr-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STANCE[assessment.stance].cls}`}
          >
            {STANCE[assessment.stance].label}
          </span>
          <span className="text-black/70 dark:text-white/70">{assessment.reasoning}</span>
        </span>
      ) : (
        <span className="pt-0.5 text-xs text-black/40 dark:text-white/40">No verdict yet.</span>
      )}
    </div>
  );
}

export default function CommentItem({
  comment,
  assessments,
  suggestions,
  manuscriptId,
}: {
  comment: EditorialComment;
  assessments: CommentAssessment[];
  suggestions: Suggestion[];
  manuscriptId: string;
}) {
  const [reqPending, startReq] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [open, setOpen] = useState(suggestions.length > 0);

  // Word-comment insertion state.
  const [insertOpen, setInsertOpen] = useState(false);
  const [anchor, setAnchor] = useState(comment.quote ?? "");
  const [body, setBody] = useState(comment.comment);
  const [insertPending, startInsert] = useTransition();
  const [insertDone, setInsertDone] = useState(false);
  const [insertError, setInsertError] = useState<string | null>(null);

  const openai = assessments.find((a) => a.provider === "openai");
  const claude = assessments.find((a) => a.provider === "anthropic");

  function request(providers: Provider[]) {
    setErrors([]);
    setOpen(true);
    startReq(async () => {
      const result = await requestCommentSuggestions(comment.id, manuscriptId, providers);
      setErrors(result.errors ?? []);
    });
  }

  function removeSuggestion(id: string) {
    startReq(async () => {
      await deleteSuggestion(id, manuscriptId);
    });
  }

  function appendSuggestion(content: string) {
    setBody((b) => (b.trim() ? `${b}\n\nSuggestion:\n${content}` : content));
  }

  function insertComment() {
    setInsertError(null);
    setInsertDone(false);
    startInsert(async () => {
      const r = await insertCommentAsWordComment(manuscriptId, anchor, body);
      if (!r.ok) {
        setInsertError(r.error ?? "Could not insert the comment.");
        return;
      }
      setInsertDone(true);
    });
  }

  return (
    <li className="px-4 py-4">
      {comment.quote && (
        <blockquote className="mb-2 border-l-2 border-black/15 pl-3 text-sm italic text-black/60 dark:border-white/20 dark:text-white/60">
          “{comment.quote}”
        </blockquote>
      )}
      <p className="font-medium">{comment.comment}</p>
      {comment.category && (
        <span className="mt-1.5 inline-block rounded bg-black/[.06] px-1.5 py-0.5 text-xs text-black/60 dark:bg-white/10 dark:text-white/60">
          {comment.category}
        </span>
      )}

      <div className="mt-3 space-y-1.5 rounded-md border border-black/10 bg-black/[.02] p-3 dark:border-white/10 dark:bg-white/[.03]">
        <p className="text-xs font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
          Model verdicts
        </p>
        <VerdictRow provider="openai" assessment={openai} />
        <VerdictRow provider="anthropic" assessment={claude} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {open ? "Hide suggestions" : suggestions.length > 0 ? `Suggestions (${suggestions.length})` : "Suggest fixes"}
        </button>
        <span className="text-black/25 dark:text-white/25">·</span>
        <button
          type="button"
          onClick={() => setInsertOpen((v) => !v)}
          className="text-accent hover:underline"
        >
          {insertOpen ? "Hide Word comment" : "Insert as Word comment"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-black/50 dark:text-white/50">Request fixes from:</span>
            <button
              type="button"
              onClick={() => request(["openai"])}
              disabled={reqPending}
              className="rounded border border-emerald-600/60 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
            >
              OpenAI
            </button>
            <button
              type="button"
              onClick={() => request(["anthropic"])}
              disabled={reqPending}
              className="rounded border border-indigo-600/60 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
            >
              Claude
            </button>
            <button
              type="button"
              onClick={() => request(["openai", "anthropic"])}
              disabled={reqPending}
              className="rounded border border-black/20 px-2 py-1 text-xs font-medium hover:bg-black/[.04] disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
            >
              Both
            </button>
            {reqPending && <span className="text-xs text-black/50 dark:text-white/50">Thinking…</span>}
          </div>

          {errors.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-red-600">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}

          {suggestions.map((s) => (
            <div
              key={s.id}
              className="rounded-md border border-black/10 bg-black/[.02] p-3 dark:border-white/10 dark:bg-white/[.03]"
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">
                  {PROVIDER_LABEL[s.provider] ?? s.provider}
                  {s.model ? ` · ${s.model}` : ""}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setInsertOpen(true);
                      appendSuggestion(s.content);
                    }}
                    className="text-accent hover:underline"
                  >
                    Use in Word comment
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSuggestion(s.id)}
                    disabled={reqPending}
                    className="text-black/40 hover:text-red-600 disabled:opacity-50 dark:text-white/40"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-p:my-1.5">
                <ReactMarkdown>{s.content}</ReactMarkdown>
              </div>
              <p className="mt-2 text-xs font-medium text-black/45 dark:text-white/45">
                Apply as a text edit:
              </p>
              <ApplyEditControl suggestionId={s.id} manuscriptId={manuscriptId} applied={s.applied} />
            </div>
          ))}
        </div>
      )}

      {insertOpen && (
        <div className="mt-3 space-y-2 rounded-md border border-black/10 p-3 text-xs dark:border-white/10">
          <p className="text-black/55 dark:text-white/55">
            Drop this into the .docx as a margin comment. The prose isn’t changed — only a review
            bubble is added, anchored to the passage below.
          </p>
          <label className="block font-medium text-black/45 dark:text-white/45">
            Anchor passage (must match your manuscript exactly):
          </label>
          <textarea
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            rows={2}
            placeholder="Paste the exact sentence/passage to attach the comment to…"
            className="w-full rounded border border-black/15 bg-transparent p-1.5 font-mono text-[11px] dark:border-white/15"
          />
          <label className="block font-medium text-black/45 dark:text-white/45">Comment text:</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full rounded border border-black/15 bg-transparent p-1.5 text-[12px] dark:border-white/15"
          />
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={insertComment}
              disabled={insertPending || !anchor.trim() || !body.trim()}
              className="rounded-md bg-accent px-3 py-1 font-medium text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {insertPending ? "Inserting…" : "Insert into .docx & save"}
            </button>
            <button
              type="button"
              onClick={() => setInsertOpen(false)}
              className="text-black/45 hover:underline dark:text-white/45"
            >
              Cancel
            </button>
          </div>
          {insertDone && (
            <p className="text-green-700 dark:text-green-300">
              Inserted ✓{" "}
              <a
                href={`/manuscripts/${manuscriptId}/download`}
                className="text-accent hover:underline"
              >
                Download updated .docx
              </a>
            </p>
          )}
          {insertError && <p className="text-red-600">{insertError}</p>}
        </div>
      )}
    </li>
  );
}
