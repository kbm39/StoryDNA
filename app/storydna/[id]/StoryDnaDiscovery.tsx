"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { runStoryDnaDiscovery, saveInterviewAnswer } from "@/app/actions/storydna";
import type { InterviewAnswer, StoryDnaData } from "@/lib/types";

const REVEAL_MS = 620;

const STEP_DEFS: { label: string; count: (d: StoryDnaData) => number }[] = [
  { label: "Chapters discovered", count: (d) => d.chapters_count },
  { label: "Major characters discovered", count: (d) => d.major_characters.length },
  { label: "Supporting characters discovered", count: (d) => d.supporting_characters.length },
  { label: "Locations discovered", count: (d) => d.locations.length },
  { label: "Organizations discovered", count: (d) => d.organizations.length },
  { label: "Timeline anchors discovered", count: (d) => d.timeline_anchors.length },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function StoryDnaDiscovery({
  manuscriptId,
  initialData,
  answerMap,
}: {
  manuscriptId: string;
  initialData: StoryDnaData | null;
  answerMap: Record<string, InterviewAnswer>;
}) {
  const [data, setData] = useState<StoryDnaData | null>(initialData);
  const [reading, setReading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(initialData ? STEP_DEFS.length : 0);
  const [cardShown, setCardShown] = useState(Boolean(initialData));

  const [interviewOpen, setInterviewOpen] = useState(false);
  const [continued, setContinued] = useState(false);
  const [saving, startSaving] = useTransition();
  const savedKey = data?.first_question.key;
  const [answer, setAnswer] = useState<InterviewAnswer | null>(
    savedKey ? answerMap[savedKey] ?? null : null,
  );

  const started = useRef(false);

  function animateReveal() {
    STEP_DEFS.forEach((_, i) => {
      setTimeout(() => setRevealed(i + 1), (i + 1) * REVEAL_MS);
    });
    setTimeout(() => setCardShown(true), (STEP_DEFS.length + 1) * REVEAL_MS);
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (initialData) return; // already analyzed — everything shows immediately

    runStoryDnaDiscovery(manuscriptId).then((r) => {
      setReading(false);
      if (!r.ok || !r.data) {
        setError(r.error ?? "StoryDNA could not read this manuscript.");
        return;
      }
      setData(r.data);
      setAnswer(answerMap[r.data.first_question.key] ?? null);
      animateReveal();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(a: InterviewAnswer) {
    if (!data) return;
    setAnswer(a);
    startSaving(async () => {
      await saveInterviewAnswer(manuscriptId, {
        characterName: data.protagonist.name,
        questionKey: data.first_question.key,
        question: data.first_question.text,
        answer: a,
      });
    });
  }

  const headline = cardShown ? "Story DNA extracted" : "Reading manuscript…";

  return (
    <div className="space-y-8">
      {/* Discovery panel */}
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-paper shadow-sm dark:border-white/15 dark:bg-white/5">
        <div className="flex items-center gap-3 border-b border-black/10 px-6 py-4 dark:border-white/10">
          <span
            className={`relative flex h-2.5 w-2.5 ${cardShown ? "" : "animate-pulse"}`}
            aria-hidden
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${cardShown ? "bg-emerald-500" : "bg-accent"}`}
            />
          </span>
          <p className="font-medium">{headline}</p>
          {reading && (
            <span className="ml-auto text-xs text-black/45 dark:text-white/45">
              analyzing the full text — this can take a minute
            </span>
          )}
        </div>

        <ul className="divide-y divide-black/5 dark:divide-white/5">
          {STEP_DEFS.map((step, i) => {
            const done = i < revealed;
            const count = done && data ? step.count(data) : null;
            return (
              <li
                key={step.label}
                className={`flex items-center gap-3 px-6 py-3 transition-all duration-500 ${
                  done ? "opacity-100" : "opacity-45"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm ${
                    done
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                      : "bg-black/[.06] text-transparent dark:bg-white/10"
                  }`}
                >
                  {done ? "✓" : ""}
                  {!done && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black/25 dark:bg-white/25" />
                  )}
                </span>
                <span className="flex-1 text-sm">{step.label}</span>
                {count != null && (
                  <span className="rounded-full bg-black/[.06] px-2 py-0.5 text-xs font-medium tabular-nums text-black/60 dark:bg-white/10 dark:text-white/60">
                    {count}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300/60 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Character Discovery card */}
      {cardShown && data && (() => {
        const name = data.protagonist.name;
        const first = name.split(/\s+/)[0] || name;
        const poss = (n: string) => (/s$/i.test(n) ? `${n}'` : `${n}'s`);
        const pct = Math.round(data.protagonist.confidence * 100);
        const bullets = [
          `The narrative follows ${poss(first)} decisions throughout the novel.`,
          `The emotional consequences primarily belong to ${first}.`,
          `Other point-of-view characters illuminate or challenge ${poss(first)} journey.`,
          `${poss(first)} internal conflict drives the central story.`,
        ];
        const q = data.first_question.text;
        const qIdx = q.search(/\bIs this\b/i);
        const statement = qIdx > 0 ? q.slice(0, qIdx).trim() : q;
        const ask = qIdx > 0 ? q.slice(qIdx).trim() : "";

        return (
        <div className="animate-[fadeIn_0.6s_ease] space-y-5">
          <h2 className="text-center font-serif text-2xl font-semibold tracking-tight">
            I’ve identified the heart of your story.
          </h2>

          <div className="relative overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/[.07] via-paper to-paper p-6 shadow-md dark:from-accent/[.12] dark:via-white/5 dark:to-white/5">
            <div className="flex items-start gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent font-serif text-2xl font-bold text-white shadow-sm">
                {initials(name)}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-2xl font-semibold leading-tight">{name}</h3>
                <p className="text-sm text-black/55 dark:text-white/55">{data.protagonist.role}</p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-black/5 bg-white/50 p-4 dark:border-white/10 dark:bg-white/[.03]">
              <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">
                Why StoryDNA believes {first} is the protagonist
              </p>
              <ul className="space-y-1.5 text-sm leading-relaxed text-black/75 dark:text-white/75">
                {bullets.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 shrink-0 text-accent">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Confidence, shown separately beneath */}
            <div className="mt-4 max-w-xs">
              <div className="mb-1 flex items-center justify-between text-xs text-black/55 dark:text-white/55">
                <span>StoryDNA confidence</span>
                <span className="font-semibold tabular-nums text-accent">{pct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-1000"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {!interviewOpen && (
              <button
                type="button"
                onClick={() => setInterviewOpen(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover"
              >
                ✦ Build {first}’s Character DNA
              </button>
            )}
          </div>

          {/* Interview — Question 1 */}
          {interviewOpen && (
            <div className="animate-[fadeIn_0.4s_ease] rounded-2xl border border-black/10 bg-paper p-6 shadow-sm dark:border-white/15 dark:bg-white/5">
              <div className="mb-4 flex items-center gap-2">
                <span className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                  StoryDNA Interview
                </span>
                <span className="text-xs text-black/40 dark:text-white/40">Question 1</span>
              </div>

              <p className="text-lg font-medium leading-snug">{statement}</p>
              {ask && <p className="mt-1.5 text-lg font-medium leading-snug">{ask}</p>}

              <div className="mt-5 flex flex-wrap gap-2">
                {(
                  [
                    ["yes", "Yes"],
                    ["no", "No"],
                    ["not_sure", "Not Sure"],
                  ] as [InterviewAnswer, string][]
                ).map(([value, label]) => {
                  const selected = answer === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => choose(value)}
                      disabled={saving}
                      className={`rounded-xl border px-5 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                        selected
                          ? "border-accent bg-accent text-white shadow-sm"
                          : "border-black/15 hover:border-accent/50 hover:bg-accent/5 dark:border-white/20"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {answer && (
                <div className="mt-6 space-y-4 border-t border-black/10 pt-5 dark:border-white/10">
                  <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    <span>✓</span> {first}’s Character DNA has been updated.
                  </p>

                  <div className="rounded-xl border border-accent/20 bg-accent/[.04] p-4 dark:bg-accent/[.06]">
                    <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                      Next recommended step
                    </p>
                    <p className="mt-1.5 text-sm text-black/75 dark:text-white/75">
                      Let’s define what {first} notices first when entering a room.
                    </p>
                    <p className="mt-0.5 text-xs text-black/45 dark:text-white/45">
                      Estimated time: 30 seconds.
                    </p>
                    {!continued ? (
                      <button
                        type="button"
                        onClick={() => setContinued(true)}
                        className="mt-3 inline-flex items-center rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover"
                      >
                        Continue
                      </button>
                    ) : (
                      <p className="mt-3 text-xs italic text-black/50 dark:text-white/50">
                        This next step is on the way.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        );
      })()}
    </div>
  );
}
