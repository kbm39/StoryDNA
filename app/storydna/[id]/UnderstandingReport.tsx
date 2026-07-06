"use client";

import { useState, useTransition } from "react";
import {
  alignConclusion,
  saveUnderstandingFeedback,
  type AlignKey,
} from "@/app/actions/storydna";
import type {
  AlignmentResponse,
  EmotionalPromise,
  Evidence,
  StoryDnaData,
} from "@/lib/types";

const RESPONSES: { value: AlignmentResponse; label: string }[] = [
  { value: "confirmed", label: "Yes, that’s my intent" },
  { value: "refined", label: "Close, let me refine it" },
  { value: "augmented", label: "Something important is missing" },
  { value: "realigned", label: "That wasn’t my intent" },
];

const STATUS_CHIP: Record<AlignmentResponse, { label: string; cls: string }> = {
  confirmed: { label: "✓ Confirmed", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
  refined: { label: "✎ Refined", cls: "bg-accent/15 text-accent" },
  augmented: { label: "＋ Added", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200" },
  realigned: { label: "↺ Realigned", cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300" },
};

const EMO_STAGES: { key: keyof EmotionalPromise; label: string }[] = [
  { key: "beginning", label: "Beginning" },
  { key: "middle", label: "Middle" },
  { key: "ending", label: "Ending" },
  { key: "after_finishing", label: "After Finishing" },
];

function splitThemes(s: string): string[] {
  return s
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function emotionalToText(e: EmotionalPromise): string {
  return `Beginning: ${e.beginning}\nMiddle: ${e.middle}\nEnding: ${e.ending}\nAfter Finishing: ${e.after_finishing}`;
}

function parseEmotionalText(s: string, fallback: EmotionalPromise): EmotionalPromise {
  const grab = (label: string) => {
    const m = s.match(new RegExp(`${label}\\s*:\\s*(.*)`, "i"));
    return m ? m[1].trim() : "";
  };
  return {
    beginning: grab("Beginning") || fallback.beginning,
    middle: grab("Middle") || fallback.middle,
    ending: grab("Ending") || fallback.ending,
    after_finishing: grab("After Finishing") || grab("After") || fallback.after_finishing,
  };
}

type LocalAlign = {
  response: AlignmentResponse | null;
  finalText?: string;
  finalThemes?: string[];
  finalEmotional?: EmotionalPromise;
  note?: string;
};

function StatusChip({ response }: { response: AlignmentResponse | null }) {
  if (!response) {
    return (
      <span className="rounded-full border border-dashed border-black/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45 dark:border-white/25 dark:text-white/45">
        Proposed
      </span>
    );
  }
  const s = STATUS_CHIP[response];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${s.cls}`}>
      {s.label}
    </span>
  );
}

function EvidenceReveal({ evidence }: { evidence: Evidence[] }) {
  const [open, setOpen] = useState(false);
  if (evidence.length === 0) {
    return <span className="text-xs italic text-black/35 dark:text-white/35">Inferred — no verbatim evidence</span>;
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-accent hover:underline"
      >
        {open ? "Hide evidence" : `Why? (${evidence.length})`}
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5">
          {evidence.map((e, i) => (
            <li key={i} className="text-xs leading-relaxed">
              <span className={e.verified ? "text-emerald-600 dark:text-emerald-400" : "text-black/30 dark:text-white/30"}>
                {e.verified ? "✓" : "◦"}
              </span>{" "}
              <span className="italic text-black/65 dark:text-white/65">“{e.quote}”</span>
              {e.locator && <span className="text-black/40 dark:text-white/40"> — {e.locator}</span>}
              {!e.verified && (
                <span className="text-black/35 dark:text-white/35"> (not located in text)</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionHeading({ children, response }: { children: React.ReactNode; response: AlignmentResponse | null }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
        {children}
      </p>
      <StatusChip response={response} />
    </div>
  );
}

export default function UnderstandingReport({
  manuscriptId,
  data,
  initialFeedback,
}: {
  manuscriptId: string;
  data: StoryDnaData;
  initialFeedback: "yes" | "mostly" | "no" | null;
}) {
  const [align, setAlign] = useState<Record<AlignKey, LocalAlign>>({
    summary: { response: data.summary.response, finalText: data.summary.final ?? undefined, note: data.summary.note ?? undefined },
    about: { response: data.about.response, finalText: data.about.final ?? undefined, note: data.about.note ?? undefined },
    themes: { response: data.themes.response, finalThemes: data.themes.final ?? undefined, note: data.themes.note ?? undefined },
    emotional_promise: {
      response: data.emotional_promise.response,
      finalEmotional: data.emotional_promise.final ?? undefined,
      note: data.emotional_promise.note ?? undefined,
    },
  });
  const [editing, setEditing] = useState<{ key: AlignKey; response: AlignmentResponse } | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();

  const [feedback, setFeedback] = useState<"yes" | "mostly" | "no" | null>(initialFeedback);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [fbPending, startFb] = useTransition();

  // Canonical (author-preferred) display values.
  const summaryText = align.summary.finalText ?? data.summary.proposed;
  const aboutText = align.about.finalText ?? data.about.proposed;
  const themeNames = align.themes.finalThemes ?? data.themes.proposed.map((t) => t.name);
  const emo = align.emotional_promise.finalEmotional ?? data.emotional_promise.proposed;

  function seedDraft(key: AlignKey, response: AlignmentResponse): string {
    if (response === "augmented") return "";
    if (key === "summary") return summaryText;
    if (key === "about") return aboutText;
    if (key === "themes") return themeNames.join(", ");
    return emotionalToText(emo);
  }

  function choose(key: AlignKey, response: AlignmentResponse) {
    if (response === "confirmed") {
      persist(key, response, {});
      return;
    }
    setEditing({ key, response });
    setDraft(seedDraft(key, response));
  }

  function persist(
    key: AlignKey,
    response: AlignmentResponse,
    payload: { finalText?: string; finalThemes?: string[]; finalEmotional?: EmotionalPromise; note?: string },
  ) {
    setAlign((prev) => ({
      ...prev,
      [key]: {
        response,
        finalText: payload.finalText ?? prev[key].finalText,
        finalThemes: payload.finalThemes ?? prev[key].finalThemes,
        finalEmotional: payload.finalEmotional ?? prev[key].finalEmotional,
        note: payload.note ?? prev[key].note,
      },
    }));
    setEditing(null);
    start(async () => {
      await alignConclusion(manuscriptId, key, response, payload);
    });
  }

  function saveEdit() {
    if (!editing) return;
    const { key, response } = editing;
    const text = draft.trim();
    if (key === "themes") {
      if (response === "augmented") {
        persist(key, response, { finalThemes: [...themeNames, ...splitThemes(text)], note: text });
      } else {
        persist(key, response, { finalThemes: splitThemes(text) });
      }
    } else if (key === "emotional_promise") {
      if (response === "augmented") persist(key, response, { note: text });
      else persist(key, response, { finalEmotional: parseEmotionalText(text, emo) });
    } else {
      if (response === "augmented") persist(key, response, { note: text });
      else persist(key, response, { finalText: text });
    }
  }

  function renderAlignmentBar(keyName: AlignKey) {
    const current = align[keyName].response;
    const isEditingHere = editing?.key === keyName;
    return (
      <div className="mt-3">
        <div className="flex flex-wrap gap-1.5">
          {RESPONSES.map((r) => {
            const selected = current === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => choose(keyName, r.value)}
                disabled={pending}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:opacity-60 ${
                  selected
                    ? "border-accent bg-accent text-white"
                    : "border-black/15 hover:border-accent/50 hover:bg-accent/5 dark:border-white/20"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {isEditingHere && (
          <div className="mt-2">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={keyName === "emotional_promise" ? 4 : 3}
              placeholder={
                editing?.response === "augmented"
                  ? "What did StoryDNA miss? Add it here…"
                  : editing?.response === "realigned"
                    ? "Tell StoryDNA what you actually intended…"
                    : "Refine the wording…"
              }
              className="w-full rounded-lg border border-black/15 bg-transparent p-2 text-sm outline-none focus:border-accent dark:border-white/20"
            />
            <div className="mt-1.5 flex items-center gap-3">
              <button
                type="button"
                onClick={saveEdit}
                disabled={pending || !draft.trim()}
                className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-xs text-black/45 hover:underline dark:text-white/45"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const allAligned = (["summary", "themes", "about", "emotional_promise"] as AlignKey[]).every(
    (k) => align[k].response !== null,
  );

  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/[.07] via-paper to-paper p-6 shadow-md dark:from-accent/[.12] dark:via-white/5 dark:to-white/5">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-accent" aria-hidden>✦</span>
            <h2 className="font-serif text-xl font-semibold tracking-tight">
              Here’s the story I believe you wrote.
            </h2>
          </div>
          {allAligned && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              ✓ Aligned
            </span>
          )}
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/55 dark:text-white/55">
          Before I review your manuscript, I want to make sure I understand the story you’re trying
          to tell. Confirm or correct each interpretation below — the facts I found are already saved.
        </p>
      </div>

      <div className="space-y-6">
        {/* Story Summary */}
        <section>
          <SectionHeading response={align.summary.response}>Story Summary</SectionHeading>
          <p className="text-sm leading-relaxed text-black/80 dark:text-white/80">{summaryText}</p>
          <div className="mt-2">
            <EvidenceReveal evidence={data.summary.evidence} />
          </div>
          {renderAlignmentBar("summary")}
        </section>

        {/* Primary Themes */}
        <section className="border-t border-black/5 pt-5 dark:border-white/10">
          <SectionHeading response={align.themes.response}>Primary Themes</SectionHeading>
          <div className="flex flex-wrap gap-2">
            {themeNames.map((theme) => (
              <span
                key={theme}
                className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-sm font-medium text-accent"
              >
                {theme}
              </span>
            ))}
          </div>
          <div className="mt-2 space-y-1">
            {data.themes.proposed
              .filter((t) => t.evidence.length > 0)
              .map((t) => (
                <div key={t.name} className="text-xs">
                  <span className="font-medium text-black/55 dark:text-white/55">{t.name}: </span>
                  <span className="inline-block align-top">
                    <EvidenceReveal evidence={t.evidence} />
                  </span>
                </div>
              ))}
          </div>
          {renderAlignmentBar("themes")}
        </section>

        {/* What the story is about */}
        <section className="border-t border-black/5 pt-5 dark:border-white/10">
          <SectionHeading response={align.about.response}>
            StoryDNA Believes Your Story Is About
          </SectionHeading>
          <p className="text-sm leading-relaxed text-black/80 dark:text-white/80">{aboutText}</p>
          <div className="mt-2">
            <EvidenceReveal evidence={data.about.evidence} />
          </div>
          {renderAlignmentBar("about")}
        </section>

        {/* Emotional Promise */}
        <section className="border-t border-black/5 pt-5 dark:border-white/10">
          <SectionHeading response={align.emotional_promise.response}>Emotional Promise</SectionHeading>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {EMO_STAGES.map((stage) => (
              <div
                key={stage.key}
                className="rounded-xl border border-black/10 bg-white/50 p-3 dark:border-white/10 dark:bg-white/[.03]"
              >
                <p className="text-xs font-semibold text-black/70 dark:text-white/70">{stage.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-black/60 dark:text-white/60">
                  {emo[stage.key] || "—"}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-2">
            <EvidenceReveal evidence={data.emotional_promise.evidence} />
          </div>
          {renderAlignmentBar("emotional_promise")}
        </section>

        {/* StoryDNA Confidence — real, evidence-derived */}
        <section className="border-t border-black/5 pt-5 dark:border-white/10">
          <SectionHeading response={null}>StoryDNA Confidence</SectionHeading>
          <div className="space-y-3">
            {[
              { label: "Story Understanding", score: data.confidence.story },
              { label: "Theme Understanding", score: data.confidence.theme },
              { label: "Character Understanding", score: data.confidence.character },
              { label: "Message Understanding", score: data.confidence.message },
            ].map((row) => (
              <div key={row.label} title={row.score.rationale}>
                <div className="mb-1 flex items-center justify-between text-xs text-black/60 dark:text-white/60">
                  <span>{row.label}</span>
                  <span className="font-semibold tabular-nums text-accent">{row.score.value}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${row.score.value}%` }} />
                </div>
                {row.score.rationale && (
                  <p className="mt-1 text-[11px] leading-snug text-black/40 dark:text-white/40">
                    {row.score.rationale}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] italic text-black/40 dark:text-white/40">
            Derived from how much of each conclusion traces back to verbatim passages in your
            manuscript — not a self-assigned score.
          </p>
        </section>

        {/* Overall feedback */}
        <section className="border-t border-black/5 pt-5 text-center dark:border-white/10">
          <p className="text-base font-medium">Did StoryDNA understand your story?</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {(["yes", "mostly", "no"] as const).map((value) => {
              const selected = feedback === value;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={fbPending}
                  onClick={() => {
                    setFeedback(value);
                    startFb(async () => {
                      await saveUnderstandingFeedback(manuscriptId, value, feedbackNote);
                    });
                  }}
                  className={`rounded-xl border px-6 py-2.5 text-sm font-semibold uppercase tracking-wide transition disabled:opacity-60 ${
                    selected
                      ? "border-accent bg-accent text-white"
                      : "border-black/15 hover:border-accent/50 hover:bg-accent/5 dark:border-white/20"
                  }`}
                >
                  {value === "yes" ? "Yes" : value === "mostly" ? "Mostly" : "No"}
                </button>
              );
            })}
          </div>

          {(feedback === "mostly" || feedback === "no") && (
            <div className="mx-auto mt-4 max-w-md text-left">
              <textarea
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                rows={2}
                placeholder="What did I get wrong? (optional — helps the next pass)"
                className="w-full rounded-lg border border-black/15 bg-transparent p-2 text-sm outline-none focus:border-accent dark:border-white/20"
              />
              <button
                type="button"
                onClick={() =>
                  startFb(async () => {
                    await saveUnderstandingFeedback(manuscriptId, feedback, feedbackNote);
                  })
                }
                disabled={fbPending}
                className="mt-1.5 rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
              >
                Save note
              </button>
            </div>
          )}

          {feedback && (
            <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">
              ✓ Thanks — noted in StoryDNA’s memory.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
