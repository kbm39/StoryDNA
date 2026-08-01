"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { ManuscriptBriefRecord } from "@/lib/author-manuscript-brief/types.ts";
import { INTAKE_PROMPT_COUNT } from "@/lib/author-manuscript-brief/contract.ts";
import {
  editSubmittedBriefAction,
  recordEicAcknowledgmentViewed,
  saveManuscriptBriefDraftAction,
  submitManuscriptBriefAction,
} from "@/app/studio/actions/manuscript-brief.ts";

type Stage = "welcome" | "intake" | "acknowledgment";

type PromptDef = {
  key: keyof BriefFormState;
  label: string;
  question: string;
  placeholder: string;
  optional?: boolean;
};

type BriefFormState = {
  elevator_pitch: string;
  author_motivation: string;
  desired_reader_experience: string;
  market_position: string;
  comparison_titles: string;
  success_definition: string;
};

const PROMPTS: readonly PromptDef[] = [
  {
    key: "elevator_pitch",
    label: "About your manuscript",
    question: "What is your manuscript about?",
    placeholder: "In a few sentences, tell me what happens — or what it's really about.",
  },
  {
    key: "author_motivation",
    label: "Why you wrote it",
    question: "Why did you write it?",
    placeholder: "What made this book worth your time?",
  },
  {
    key: "desired_reader_experience",
    label: "Reader experience",
    question: "What experience do you want readers to have?",
    placeholder: "Emotionally, intellectually, viscerally — what should they feel or think?",
    optional: true,
  },
  {
    key: "market_position",
    label: "Market position",
    question: "Where do you see it in the market?",
    placeholder: "Who is it for? You can write “I'm not sure” if you're still figuring that out.",
  },
  {
    key: "comparison_titles",
    label: "Comparison titles",
    question: "Are there books, films, or shows you would compare it to?",
    placeholder: "Optional — comps help me understand tone and positioning.",
    optional: true,
  },
  {
    key: "success_definition",
    label: "Success for you",
    question: "What would make this editorial process feel successful to you?",
    placeholder: "Query-ready, self-publishing launch, realism pass, or something else.",
    optional: true,
  },
];

type Props = {
  bookId: string;
  bookTitle: string;
  versionLabel: string | null;
  draftBrief: ManuscriptBriefRecord | null;
  submittedBrief: ManuscriptBriefRecord | null;
};

function briefToForm(brief: ManuscriptBriefRecord | null): BriefFormState {
  return {
    elevator_pitch: brief?.elevator_pitch ?? "",
    author_motivation: brief?.author_motivation ?? "",
    desired_reader_experience: brief?.desired_reader_experience ?? "",
    market_position: brief?.market_position === "unsure" ? "" : (brief?.market_position ?? ""),
    comparison_titles: brief?.comparison_titles ?? "",
    success_definition: brief?.success_definition ?? "",
  };
}

function EicMessage({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      aria-label="Editor-in-Chief"
      className={`rounded-2xl border border-black/[0.08] bg-black/[0.015] px-8 py-7 dark:border-white/[0.08] dark:bg-white/[0.02] ${className}`}
    >
      <p className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-accent">
        Editor-in-Chief
      </p>
      <div className="space-y-5 text-[0.9375rem] leading-[1.75] text-black/80 dark:text-white/80">
        {children}
      </div>
    </article>
  );
}

const EDITORIAL_JOURNEY_STEPS = [
  "Conversation",
  "Independent Read",
  "Editorial Strategy",
  "Editorial Team Recommendation",
  "Your Approval",
  "Expert Reviews Begin",
] as const;

function EditorialJourneyRoadmap() {
  return (
    <aside
      aria-label="Your Editorial Journey"
      className="rounded-2xl border border-black/[0.06] px-7 py-8 dark:border-white/[0.06]"
    >
      <h3 className="font-serif text-lg font-medium tracking-tight text-black/90 dark:text-white/90">
        Your Editorial Journey
      </h3>
      <ol className="mt-8 space-y-0">
        {EDITORIAL_JOURNEY_STEPS.map((step, index) => (
          <li key={step} className="flex flex-col items-start">
            <div className="flex items-baseline gap-3">
              <span
                aria-hidden="true"
                className={`font-serif text-sm tabular-nums ${
                  index === 0 ? "text-accent" : "text-black/35 dark:text-white/35"
                }`}
              >
                {index + 1}.
              </span>
              <span
                className={`text-sm leading-snug ${
                  index === 0
                    ? "font-medium text-black/85 dark:text-white/85"
                    : "text-black/50 dark:text-white/50"
                }`}
              >
                {step}
              </span>
            </div>
            {index < EDITORIAL_JOURNEY_STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className="ml-[0.4rem] py-2 pl-3 text-xs leading-none text-black/20 dark:text-white/20"
              >
                ↓
              </span>
            )}
          </li>
        ))}
      </ol>
    </aside>
  );
}

export function ConversationalIntakeClient({
  bookId,
  bookTitle,
  versionLabel,
  draftBrief,
  submittedBrief,
}: Props) {
  const initialStage: Stage = submittedBrief ? "acknowledgment" : "welcome";
  const [stage, setStage] = useState<Stage>(initialStage);
  const [step, setStep] = useState(0);
  const [briefId, setBriefId] = useState<string | null>(draftBrief?.brief_id ?? null);
  const [form, setForm] = useState<BriefFormState>(() => briefToForm(draftBrief ?? submittedBrief));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const currentPrompt = PROMPTS[step];

  useEffect(() => {
    if (stage === "acknowledgment") {
      void recordEicAcknowledgmentViewed(bookId);
    }
  }, [stage, bookId]);

  const progressLabel = useMemo(
    () => `Step ${step + 1} of ${INTAKE_PROMPT_COUNT}`,
    [step],
  );

  function updateField(key: keyof BriefFormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function persistDraft(exitAfter = false): Promise<{ ok: boolean; briefId?: string }> {
    return new Promise((resolve) => {
      startTransition(async () => {
        setError(null);
        const result = await saveManuscriptBriefDraftAction({
          manuscriptId: bookId,
          briefId: briefId ?? undefined,
          ...form,
          desired_reader_experience: form.desired_reader_experience.trim() || null,
          comparison_titles: form.comparison_titles.trim() || null,
          success_definition: form.success_definition.trim() || null,
        });
        if (!result.ok) {
          setError(result.error ?? "Could not save draft.");
          resolve({ ok: false });
          return;
        }
        if (result.briefId) setBriefId(result.briefId);
        if (exitAfter) {
          window.location.href = `/studio/books/${bookId}`;
        }
        resolve({ ok: true, briefId: result.briefId });
      });
    });
  }

  function canAdvanceFromStep(): boolean {
    if (currentPrompt.optional || currentPrompt.key === "market_position") return true;
    if (currentPrompt.key === "elevator_pitch") return form.elevator_pitch.trim().length >= 10;
    return form[currentPrompt.key].trim().length > 0;
  }

  if (stage === "welcome") {
    return (
      <div className="mx-auto max-w-3xl space-y-12 py-6">
        <header className="space-y-2">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-black/40 dark:text-white/40">
            StoryDNA Editorial
          </p>
          <h2 className="font-serif text-3xl font-medium tracking-tight text-black/90 dark:text-white/90">
            Your Editor-in-Chief
          </h2>
          <p className="text-sm text-black/45 dark:text-white/45">
            {bookTitle}
            {versionLabel ? ` · ${versionLabel}` : ""}
          </p>
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] lg:gap-14">
          <EicMessage>
            <p className="font-serif text-xl font-medium leading-snug text-black/90 dark:text-white/90">
              Welcome to StoryDNA.
            </p>
            <p>
              I&apos;ll be serving as your Editor-in-Chief throughout this manuscript.
            </p>
            <p>
              Before I read a single page, I&apos;d like to hear about your story directly from
              you.
            </p>
            <p>Every author begins with a vision.</p>
            <p>My first responsibility is to understand yours.</p>
            <p>
              I&apos;ll keep your goals in mind while reading your manuscript, but I&apos;ll also
              evaluate it independently.
            </p>
            <p>My job is not simply to confirm your expectations.</p>
            <p>
              It is to understand the story you&apos;re trying to tell and provide an honest
              professional assessment of what is actually on the page.
            </p>
            <p>
              Once I understand both your vision and your manuscript, I&apos;ll recommend the
              editorial team I believe will best help you achieve your goals.
            </p>
            <p>No expert will receive your manuscript without your approval.</p>
          </EicMessage>

          <EditorialJourneyRoadmap />
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button
            type="button"
            onClick={() => setStage("intake")}
            className="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium tracking-wide text-white"
          >
            Begin Conversation
          </button>
          <Link
            href={`/studio/books/${bookId}`}
            className="px-2 py-2.5 text-sm text-black/50 underline-offset-4 hover:text-black/70 hover:underline dark:text-white/50 dark:hover:text-white/70"
          >
            Not Now
          </Link>
        </div>
      </div>
    );
  }

  if (stage === "intake") {
    const value = form[currentPrompt.key];

    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-black/45 dark:text-white/45">
            {progressLabel}
          </p>
          <h2 className="mt-1 font-serif text-xl font-semibold">{currentPrompt.question}</h2>
        </div>
        <EicMessage>
          <p>{currentPrompt.question}</p>
        </EicMessage>
        <div>
          <label htmlFor={currentPrompt.key} className="sr-only">
            {currentPrompt.label}
          </label>
          <textarea
            id={currentPrompt.key}
            aria-required={!currentPrompt.optional && currentPrompt.key !== "market_position"}
            value={value}
            onChange={(e) => updateField(currentPrompt.key, e.target.value)}
            rows={4}
            placeholder={currentPrompt.placeholder}
            className="w-full rounded-lg border border-black/10 bg-paper px-3 py-2 text-sm dark:border-white/10"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/10"
            >
              Back
            </button>
          )}
          {currentPrompt.optional && (
            <button
              type="button"
              onClick={() => {
                updateField(currentPrompt.key, "");
                setStep((s) => Math.min(s + 1, PROMPTS.length - 1));
              }}
              className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/10"
            >
              Skip this question
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => void persistDraft(true)}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/10"
          >
            Save draft & exit
          </button>
          {step < PROMPTS.length - 1 ? (
            <button
              type="button"
              disabled={pending || !canAdvanceFromStep()}
              onClick={async () => {
                const saved = await persistDraft(false);
                if (saved.ok) setStep((s) => s + 1);
              }}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={pending || form.elevator_pitch.trim().length < 10}
              onClick={async () => {
                const saved = await persistDraft(false);
                const id = saved.briefId ?? briefId;
                if (!saved.ok || !id) {
                  setError("Could not save before submit.");
                  return;
                }
                const submitResult = await submitManuscriptBriefAction({
                  manuscriptId: bookId,
                  briefId: id,
                });
                if (!submitResult.ok) {
                  setError(submitResult.error ?? "Submit failed.");
                  return;
                }
                setStage("acknowledgment");
              }}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Submit to Editor-in-Chief
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold">Thank you</h2>
        <p className="mt-1 text-sm text-black/55 dark:text-white/55">
          Manuscript brief received
          {versionLabel ? ` · ${versionLabel}` : ""}
        </p>
      </div>
      <EicMessage>
        <p>Thank you. That&apos;s helpful context.</p>
        <p>
          I&apos;ve heard what you&apos;re trying to accomplish. Next, I&apos;ll read your
          manuscript — fresh, as if encountering it for the first time — while keeping what
          you&apos;ve told me in mind.
        </p>
        <p>
          Your description helps me understand your goals. It does <strong>not</strong> override my
          independent professional judgment, and it is <strong>not</strong> treated as evidence
          about what&apos;s on the page.
        </p>
        <p>
          No expert has received your manuscript. When I&apos;m ready to recommend an editorial
          team, I&apos;ll ask for your permission first.
        </p>
      </EicMessage>
      <p className="rounded-lg border border-black/10 px-4 py-3 text-sm text-black/55 dark:border-white/10 dark:text-white/55">
        Manuscript brief received · {versionLabel ?? "Current version"} · No experts contacted
      </p>
      <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
        The Editor-in-Chief&apos;s independent read is the next stage of your editorial journey.
        That step has not started yet — no provider or expert review is running.
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            window.location.href = `/studio/books/${bookId}`;
          }}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Continue
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await editSubmittedBriefAction(bookId);
              if (!result.ok) {
                setError(result.error ?? "Could not edit answers.");
                return;
              }
              if (result.briefId) setBriefId(result.briefId);
              setStage("intake");
              setStep(0);
            });
          }}
          className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/10"
        >
          Edit my answers
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
