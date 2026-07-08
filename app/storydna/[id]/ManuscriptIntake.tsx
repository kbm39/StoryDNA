"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveManuscriptIntake } from "@/app/actions/intake";
import type {
  ManuscriptRelation,
  ManuscriptType,
  ManuscriptStage,
  ReviewObjective,
  Optimization,
  FeedbackStyle,
} from "@/lib/types";

export interface IntakePrefill {
  relation: ManuscriptRelation;
  matchedSeriesId: string | null;
  seriesName: string;
  bookNumber: number | null;
  manuscriptType: ManuscriptType;
  manuscriptStage: ManuscriptStage;
  objective: ReviewObjective;
  optimization: Optimization;
  feedbackStyle: FeedbackStyle[];
  recommendSpecialists: boolean;
  loadDefault: boolean;
}

export interface SeriesOption {
  id: string;
  title: string;
  books: number;
}

type Opt<T extends string> = { value: T; label: string };

const RELATION: Opt<ManuscriptRelation>[] = [
  { value: "standalone", label: "Standalone" },
  { value: "existing_series", label: "Part of an existing series" },
  { value: "new_series", label: "The beginning of a new series" },
];
const TYPE: Opt<ManuscriptType>[] = [
  { value: "main_novel", label: "Main novel" },
  { value: "prequel", label: "Prequel" },
  { value: "sequel", label: "Sequel" },
  { value: "novella", label: "Novella" },
  { value: "lead_magnet", label: "Lead magnet" },
  { value: "short_story", label: "Short story" },
];
const STAGE: Opt<ManuscriptStage>[] = [
  { value: "first_draft", label: "First draft" },
  { value: "early_revision", label: "Early revision" },
  { value: "advanced_revision", label: "Advanced revision" },
  { value: "query_ready", label: "Query ready" },
  { value: "publisher_submission", label: "Publisher submission" },
  { value: "producer_submission", label: "Producer submission" },
  { value: "final_proof", label: "Final proof" },
];
const OBJECTIVE: Opt<ReviewObjective>[] = [
  { value: "agent_submission", label: "Literary agent submission" },
  { value: "producer_review", label: "Producer / streaming review" },
  { value: "developmental", label: "Developmental editing" },
  { value: "character_consistency", label: "Character consistency" },
  { value: "dialogue", label: "Dialogue improvement" },
  { value: "reality_check", label: "Reality checking" },
  { value: "final_proof", label: "Final proof" },
  { value: "knowledge_only", label: "Build StoryDNA knowledge only" },
];
const OPTIMIZATION: Opt<Optimization>[] = [
  { value: "best_book", label: "Best possible book" },
  { value: "most_commercial", label: "Most commercial book" },
  { value: "most_faithful", label: "Most faithful to my vision" },
  { value: "best_adaptation", label: "Best adaptation potential" },
  { value: "balanced", label: "Balanced" },
];
const FEEDBACK: Opt<FeedbackStyle>[] = [
  { value: "brutally_honest", label: "Brutally honest" },
  { value: "protect_voice", label: "Protect my voice" },
  { value: "prioritize_commercial", label: "Prioritize commercial success" },
  { value: "challenge_assumptions", label: "Challenge my assumptions" },
  { value: "real_agent", label: "Tell me what a real agent would actually think" },
];
const ORDER: Opt<string>[] = [
  { value: "both", label: "Both — same in publication and story order" },
  { value: "publication", label: "Publication order" },
  { value: "chronological", label: "Story / chronological order" },
];
const LOAD: { key: keyof Answers["load"]; label: string }[] = [
  { key: "canon", label: "Canon — world facts, rules, places" },
  { key: "characters", label: "Characters — Character DNA" },
  { key: "timeline", label: "Timeline — series chronology" },
  { key: "story_memory", label: "Story Memory — prior understanding" },
  { key: "author_intent", label: "Previous author intent" },
  { key: "editorial_decisions", label: "Previous editorial decisions" },
  { key: "reviewer_feedback", label: "Prior reviewer feedback" },
];

const OBJECTIVE_REVIEWER: Partial<Record<ReviewObjective, string>> = {
  agent_submission: "Literary Agent",
  producer_review: "Producer",
  developmental: "Developmental Editor",
  character_consistency: "Continuity Reviewer",
  dialogue: "Dialogue Coach",
  reality_check: "Domain Specialists",
  final_proof: "Proofreader",
};

interface Answers {
  relation: ManuscriptRelation;
  seriesId: string | null;
  seriesName: string;
  bookNumber: number | null;
  orderType: string;
  orderOther: number | null;
  manuscriptType: ManuscriptType;
  manuscriptStage: ManuscriptStage;
  load: {
    canon: boolean;
    characters: boolean;
    timeline: boolean;
    story_memory: boolean;
    author_intent: boolean;
    editorial_decisions: boolean;
    reviewer_feedback: boolean;
  };
  objective: ReviewObjective;
  optimization: Optimization;
  feedbackStyle: FeedbackStyle[];
  recommendSpecialists: boolean;
  saveSeriesDefault: boolean;
}

type StepId =
  | "relation"
  | "series_select"
  | "series_name"
  | "book_number"
  | "order_type"
  | "order_other"
  | "type"
  | "stage"
  | "load"
  | "objective"
  | "optimization"
  | "feedback"
  | "specialists"
  | "summary";

const STEPS: { id: StepId; visible: (a: Answers) => boolean }[] = [
  { id: "relation", visible: () => true },
  { id: "series_select", visible: (a) => a.relation === "existing_series" },
  { id: "series_name", visible: (a) => a.relation === "new_series" },
  { id: "book_number", visible: (a) => a.relation !== "standalone" },
  { id: "order_type", visible: (a) => a.relation !== "standalone" },
  { id: "order_other", visible: (a) => a.relation !== "standalone" && !!a.orderType && a.orderType !== "both" },
  { id: "type", visible: () => true },
  { id: "stage", visible: () => true },
  { id: "load", visible: (a) => a.relation === "existing_series" },
  { id: "objective", visible: () => true },
  { id: "optimization", visible: () => true },
  { id: "feedback", visible: () => true },
  { id: "specialists", visible: () => true },
  { id: "summary", visible: () => true },
];

export default function ManuscriptIntake({
  manuscriptId,
  prefill,
  series,
  detectedLabel,
}: {
  manuscriptId: string;
  prefill: IntakePrefill;
  series: SeriesOption[];
  detectedLabel: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({
    relation: prefill.relation,
    seriesId: prefill.matchedSeriesId,
    seriesName: prefill.seriesName,
    bookNumber: prefill.bookNumber,
    orderType: "both",
    orderOther: null,
    manuscriptType: prefill.manuscriptType,
    manuscriptStage: prefill.manuscriptStage,
    load: {
      canon: prefill.loadDefault,
      characters: prefill.loadDefault,
      timeline: prefill.loadDefault,
      story_memory: prefill.loadDefault,
      author_intent: prefill.loadDefault,
      editorial_decisions: prefill.loadDefault,
      reviewer_feedback: prefill.loadDefault,
    },
    objective: prefill.objective,
    optimization: prefill.optimization,
    feedbackStyle: prefill.feedbackStyle,
    recommendSpecialists: prefill.recommendSpecialists,
    saveSeriesDefault: false,
  });
  const [cursor, setCursor] = useState(0);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => STEPS.filter((s) => s.visible(answers)), [answers]);
  const idx = Math.min(cursor, visible.length - 1);
  const step = visible[idx];
  const progress = Math.round(((idx + 1) / visible.length) * 100);

  const set = (patch: Partial<Answers>) => setAnswers((a) => ({ ...a, ...patch }));
  const next = () => setCursor((c) => Math.min(c + 1, visible.length - 1));
  const back = () => setCursor((c) => Math.max(0, c - 1));
  /** Set an answer and advance (single-select behavior). */
  const pick = (patch: Partial<Answers>) => {
    set(patch);
    next();
  };
  const toggleLoad = (key: keyof Answers["load"]) =>
    set({ load: { ...answers.load, [key]: !answers.load[key] } });
  const toggleFeedback = (v: FeedbackStyle) =>
    set({
      feedbackStyle: answers.feedbackStyle.includes(v)
        ? answers.feedbackStyle.filter((x) => x !== v)
        : [...answers.feedbackStyle, v],
    });

  function begin() {
    setError(null);
    let published: number | null = null;
    let story: number | null = null;
    if (answers.relation !== "standalone") {
      const n = answers.bookNumber;
      if (answers.orderType === "publication") {
        published = n;
        story = answers.orderOther ?? n;
      } else if (answers.orderType === "chronological") {
        story = n;
        published = answers.orderOther ?? n;
      } else {
        published = n;
        story = n;
      }
    }
    startSaving(async () => {
      const r = await saveManuscriptIntake(manuscriptId, {
        relation: answers.relation,
        series_id: answers.relation === "existing_series" ? answers.seriesId : null,
        series_name: answers.seriesName,
        book_number: answers.bookNumber,
        order_type: answers.relation === "standalone" ? null : answers.orderType,
        published_order: published,
        story_order: story,
        manuscript_type: answers.manuscriptType,
        manuscript_stage: answers.manuscriptStage,
        load: answers.load,
        objectives: [answers.objective],
        optimization: answers.optimization,
        feedback_style: answers.feedbackStyle,
        recommend_specialists: answers.recommendSpecialists,
        save_series_default: answers.saveSeriesDefault,
      });
      if (!r.ok) {
        setError(r.error ?? "Could not save your answers.");
        return;
      }
      router.refresh(); // gate opens → Story Understanding runs
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress */}
      <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/[.07] via-paper to-paper p-6 shadow-md dark:from-accent/[.12] dark:via-white/5 dark:to-white/5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            StoryDNA · situating your manuscript
          </p>
          {idx > 0 && step.id !== "summary" && (
            <button type="button" onClick={back} className="text-xs text-black/50 hover:text-accent dark:text-white/50">
              ← Back
            </button>
          )}
        </div>

        {renderStep()}
      </div>
    </div>
  );

  function renderStep() {
    switch (step.id) {
      case "relation":
        return (
          <Question
            lead="Before I read this manuscript, help me understand where it fits in your body of work."
            prompt="Where does this manuscript fit?"
          >
            <SingleChoice
              options={RELATION}
              value={answers.relation}
              onPick={(v) => pick({ relation: v })}
            />
          </Question>
        );
      case "series_select":
        return (
          <Question prompt="Which series does it belong to?">
            {series.length === 0 ? (
              <p className="text-sm text-black/55 dark:text-white/55">
                No StoryDNA series yet — go back and choose “The beginning of a new series.”
              </p>
            ) : (
              <div className="space-y-2">
                {series.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pick({ seriesId: s.id, seriesName: s.title, bookNumber: answers.bookNumber ?? s.books + 1 })}
                    className={choiceCls(answers.seriesId === s.id)}
                  >
                    {s.title}
                    <span className="ml-2 text-xs text-black/45 dark:text-white/45">
                      {s.books} {s.books === 1 ? "book" : "books"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Question>
        );
      case "series_name":
        return (
          <Question prompt="What’s the name of this new series?">
            <TextEntry
              value={answers.seriesName}
              onChange={(v) => set({ seriesName: v })}
              placeholder="Series name"
              onContinue={next}
              canContinue={answers.seriesName.trim().length > 0}
            />
          </Question>
        );
      case "book_number":
        return (
          <Question prompt="What book number is this?">
            <NumberEntry
              value={answers.bookNumber}
              onChange={(v) => set({ bookNumber: v })}
              onContinue={next}
              canContinue={answers.bookNumber != null}
            />
          </Question>
        );
      case "order_type":
        return (
          <Question prompt="Is that the publication order, story order, or both?">
            <SingleChoice options={ORDER} value={answers.orderType} onPick={(v) => pick({ orderType: v })} />
          </Question>
        );
      case "order_other":
        return (
          <Question
            prompt={
              answers.orderType === "publication"
                ? "And what’s its story / chronological order number?"
                : "And what’s its publication order number?"
            }
          >
            <NumberEntry
              value={answers.orderOther}
              onChange={(v) => set({ orderOther: v })}
              onContinue={next}
              canContinue={answers.orderOther != null}
            />
          </Question>
        );
      case "type":
        return (
          <Question prompt="What kind of manuscript is this?">
            <SingleChoice options={TYPE} value={answers.manuscriptType} onPick={(v) => pick({ manuscriptType: v })} />
          </Question>
        );
      case "stage":
        return (
          <Question prompt="What stage is it in?">
            <SingleChoice options={STAGE} value={answers.manuscriptStage} onPick={(v) => pick({ manuscriptStage: v })} />
          </Question>
        );
      case "load":
        return (
          <Question prompt="What should I load before reading?" hint="I’ll bring in what you have on record for this series.">
            <div className="space-y-2">
              {LOAD.map((o) => (
                <button key={o.key} type="button" onClick={() => toggleLoad(o.key)} className={choiceCls(answers.load[o.key])}>
                  <span className="mr-2">{answers.load[o.key] ? "☑" : "☐"}</span>
                  {o.label}
                </button>
              ))}
            </div>
            <Continue onClick={next} />
          </Question>
        );
      case "objective":
        return (
          <Question prompt="What is your objective today?">
            <SingleChoice options={OBJECTIVE} value={answers.objective} onPick={(v) => pick({ objective: v })} />
          </Question>
        );
      case "optimization":
        return (
          <Question prompt="What should I optimize for?">
            <SingleChoice options={OPTIMIZATION} value={answers.optimization} onPick={(v) => pick({ optimization: v })} />
          </Question>
        );
      case "feedback":
        return (
          <Question prompt="What feedback style should I use?" hint="I’ll remember this for your future manuscripts.">
            <div className="flex flex-wrap gap-2">
              {FEEDBACK.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggleFeedback(o.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    answers.feedbackStyle.includes(o.value)
                      ? "border-accent bg-accent text-white"
                      : "border-black/15 hover:border-accent/50 dark:border-white/20"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <Continue onClick={next} />
          </Question>
        );
      case "specialists":
        return (
          <Question prompt="Should I recommend domain specialists after reading?">
            <SingleChoice
              options={[
                { value: "yes", label: "Yes — scan the content and suggest experts" },
                { value: "no", label: "No" },
              ]}
              value={answers.recommendSpecialists ? "yes" : "no"}
              onPick={(v) => pick({ recommendSpecialists: v === "yes" })}
            />
          </Question>
        );
      case "summary":
        return renderSummary();
    }
  }

  function renderSummary() {
    const place =
      answers.relation === "standalone"
        ? `a standalone ${typeLabel(answers.manuscriptType).toLowerCase()}`
        : `Book ${answers.bookNumber ?? "?"} of ${answers.seriesName || "your series"}`;
    const loaded = LOAD.filter((o) => answers.load[o.key]).map((o) => o.label.split(" — ")[0].toLowerCase());
    const loadPhrase =
      answers.relation === "existing_series" && loaded.length > 0
        ? `load ${loaded.join(", ")}, then `
        : "";
    const reviewers = [
      OBJECTIVE_REVIEWER[answers.objective],
      answers.recommendSpecialists && answers.objective !== "knowledge_only" ? "Domain Specialists (after reading)" : null,
    ].filter(Boolean) as string[];

    return (
      <div className="space-y-4">
        <p className="font-serif text-lg leading-snug">
          Great. I’ll treat this as <span className="font-semibold">{place}</span>, {loadPhrase}then begin Story Understanding.
        </p>
        <p className="text-sm text-black/60 dark:text-white/60">
          Objective: {objLabel(answers.objective)} · Optimize for: {optLabel(answers.optimization)}
          {answers.feedbackStyle.length ? ` · Voice: ${answers.feedbackStyle.map(fbLabel).join(", ")}` : ""}
        </p>

        {answers.objective !== "knowledge_only" && (
          <div className="rounded-xl border border-black/10 bg-black/[.02] p-3 text-sm dark:border-white/10 dark:bg-white/[.03]">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
                Editorial Board Preview
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                Preliminary
              </span>
            </div>
            <ul className="list-disc pl-5 text-black/70 dark:text-white/70">
              {reviewers.length ? reviewers.map((r) => <li key={r}>{r}</li>) : <li>To be determined after reading</li>}
            </ul>
            <p className="mt-2 text-[11px] italic text-black/45 dark:text-white/45">
              Preliminary — based on your answers only. Confirmed after StoryDNA reads the manuscript.
            </p>
          </div>
        )}

        {answers.relation !== "standalone" && (
          <label className="flex items-center gap-2 text-sm text-black/70 dark:text-white/70">
            <input
              type="checkbox"
              checked={answers.saveSeriesDefault}
              onChange={(e) => set({ saveSeriesDefault: e.target.checked })}
              className="size-4 accent-accent"
            />
            Save these as the default for this series
          </label>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={begin}
            disabled={saving}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover disabled:opacity-60"
          >
            {saving ? "Starting…" : "Begin StoryDNA Analysis"}
          </button>
          <button type="button" onClick={back} className="text-sm text-black/50 hover:underline dark:text-white/50">
            ← Edit answers
          </button>
        </div>
        <p className="text-xs text-black/45 dark:text-white/45">Detected from your file: {detectedLabel}</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }
}

// --- small presentational helpers -------------------------------------------

function choiceCls(selected: boolean): string {
  return `block w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
    selected
      ? "border-accent bg-accent/10 font-medium text-accent"
      : "border-black/15 hover:border-accent/50 hover:bg-accent/5 dark:border-white/20"
  }`;
}

function Question({
  prompt,
  lead,
  hint,
  children,
}: {
  prompt: string;
  lead?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {lead && <p className="mb-3 text-sm italic text-black/55 dark:text-white/55">“{lead}”</p>}
      <h2 className="mb-1 font-serif text-xl font-semibold tracking-tight">{prompt}</h2>
      {hint && <p className="mb-3 text-sm text-black/50 dark:text-white/50">{hint}</p>}
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function SingleChoice<T extends string>({
  options,
  value,
  onPick,
}: {
  options: Opt<T>[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onPick(o.value)} className={choiceCls(value === o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TextEntry({
  value,
  onChange,
  placeholder,
  onContinue,
  canContinue,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onContinue: () => void;
  canContinue: boolean;
}) {
  return (
    <div className="space-y-3">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent dark:border-white/20"
      />
      <Continue onClick={onContinue} disabled={!canContinue} />
    </div>
  );
}

function NumberEntry({
  value,
  onChange,
  onContinue,
  canContinue,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  return (
    <div className="space-y-3">
      <input
        type="number"
        min={1}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="w-28 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent dark:border-white/20"
      />
      <Continue onClick={onContinue} disabled={!canContinue} />
    </div>
  );
}

function Continue({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
    >
      Continue →
    </button>
  );
}

function typeLabel(v: ManuscriptType) {
  return TYPE.find((o) => o.value === v)?.label ?? "manuscript";
}
function objLabel(v: ReviewObjective) {
  return OBJECTIVE.find((o) => o.value === v)?.label ?? v;
}
function optLabel(v: Optimization) {
  return OPTIMIZATION.find((o) => o.value === v)?.label ?? v;
}
function fbLabel(v: FeedbackStyle) {
  return FEEDBACK.find((o) => o.value === v)?.label ?? v;
}
