"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { EditorialUnderstandingRecord } from "@/lib/editorial-understanding/types.ts";
import { EIC_INTAKE_STAGES, EIC_INTAKE_STAGE_COUNT } from "@/lib/conversational-intelligence/stages.ts";
import {
  confirmEditorialUnderstandingAction,
  editUnderstandingAnswersAction,
  ensureEditorialUnderstandingDraftAction,
  requestSummaryCorrectionAction,
  submitStageAnswerAction,
} from "@/app/studio/actions/conversational-intelligence.ts";

type Stage =
  | "welcome"
  | "intake"
  | "eic_response"
  | "clarification"
  | "confirmation"
  | "confirmed";

type BriefFormState = {
  elevator_pitch: string;
  author_motivation: string;
  desired_reader_experience: string;
  market_position: string;
  comparison_titles: string;
  success_definition: string;
};

type Props = {
  bookId: string;
  bookTitle: string;
  versionLabel: string | null;
  understanding: EditorialUnderstandingRecord | null;
  confirmedUnderstanding: EditorialUnderstandingRecord | null;
};

function understandingToForm(record: EditorialUnderstandingRecord | null): BriefFormState {
  return {
    elevator_pitch: record?.primary_vision ?? "",
    author_motivation: record?.creative_motivation ?? "",
    desired_reader_experience: record?.desired_reader_experience ?? "",
    market_position:
      record?.market_position === "unsure" ? "" : (record?.market_position ?? ""),
    comparison_titles: record?.comparison_titles ?? "",
    success_definition: record?.success_definition ?? "",
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

function SummarySections({
  primaryVision,
  targetReader,
  desiredReaderExperience,
  marketPosition,
  creativeMotivation,
  successDefinition,
}: {
  primaryVision: string | null;
  targetReader: string | null;
  desiredReaderExperience: string | null;
  marketPosition: string | null;
  creativeMotivation: string | null;
  successDefinition: string | null;
}) {
  const readerExperience =
    desiredReaderExperience?.trim() || "You skipped this — that's fine.";

  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <p>
        <strong>Your story:</strong> {primaryVision}
      </p>
      <p>
        <strong>Your reader:</strong> {targetReader ?? marketPosition}
      </p>
      <p>
        <strong>The experience you want:</strong> {readerExperience}
      </p>
      <p>
        <strong>Market position:</strong> {marketPosition}
      </p>
      <p>
        <strong>Why you wrote it:</strong> {creativeMotivation}
      </p>
      <p>
        <strong>Success for you:</strong> {successDefinition}
      </p>
      <p className="font-medium">Did I understand you correctly?</p>
    </div>
  );
}

export function ConversationalIntelligenceClient({
  bookId,
  bookTitle,
  versionLabel,
  understanding,
  confirmedUnderstanding,
}: Props) {
  const activeRecord = confirmedUnderstanding ?? understanding;
  const initialStage: Stage = confirmedUnderstanding
    ? "confirmed"
    : understanding?.status === "awaiting_author_confirmation"
      ? "confirmation"
      : "welcome";

  const [stage, setStage] = useState<Stage>(initialStage);
  const [step, setStep] = useState(0);
  const [understandingId, setUnderstandingId] = useState<string | null>(
    understanding?.understanding_id ?? confirmedUnderstanding?.understanding_id ?? null,
  );
  const [form, setForm] = useState<BriefFormState>(() => understandingToForm(activeRecord));
  const [eicResponse, setEicResponse] = useState<string | null>(null);
  const [clarificationQuestion, setClarificationQuestion] = useState<string | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const [summaryRecord, setSummaryRecord] = useState<EditorialUnderstandingRecord | null>(
    understanding?.status === "awaiting_author_confirmation" ? understanding : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const currentStage = EIC_INTAKE_STAGES[step]!;
  const currentPromptKey = currentStage.prompt_key as keyof BriefFormState;
  const progressLabel = useMemo(
    () => `Step ${step + 1} of ${EIC_INTAKE_STAGE_COUNT}`,
    [step],
  );

  useEffect(() => {
    if (!understandingId && stage === "intake") {
      void ensureEditorialUnderstandingDraftAction(bookId).then((result) => {
        if (result.ok && result.understandingId) setUnderstandingId(result.understandingId);
      });
    }
  }, [bookId, stage, understandingId]);

  function updateField(key: keyof BriefFormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function canAdvanceFromStep(): boolean {
    if (currentStage.optional || currentStage.prompt_key === "market_position") return true;
    if (currentStage.prompt_key === "elevator_pitch") return form.elevator_pitch.trim().length >= 10;
    return form[currentPromptKey].trim().length > 0;
  }

  function handleStageSubmit(options?: { skipped?: boolean; isClarification?: boolean }) {
    if (!understandingId) {
      setError("Could not start editorial understanding.");
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await submitStageAnswerAction({
        manuscriptId: bookId,
        understandingId,
        promptKey: currentStage.prompt_key,
        authorAnswer: options?.isClarification
          ? clarificationAnswer
          : form[currentPromptKey],
        skipped: Boolean(options?.skipped),
        isClarificationFollowUp: Boolean(options?.isClarification),
        clarificationAnswer: options?.isClarification ? clarificationAnswer : undefined,
      });

      if (!result.ok) {
        setError(result.error ?? "Could not save your answer.");
        return;
      }

      if (result.eicResponse?.content) {
        setEicResponse(result.eicResponse.content);
      }

      if (result.awaitingClarification) {
        setClarificationQuestion(result.eicResponse?.content ?? null);
        setClarificationAnswer("");
        setStage("clarification");
        return;
      }

      if (result.status === "awaiting_author_confirmation") {
        setSummaryRecord((prev) =>
          prev ??
          (understanding
            ? { ...understanding, status: "awaiting_author_confirmation" }
            : null),
        );
        setStage("confirmation");
        return;
      }

      setStage("eic_response");
    });
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
    const value = form[currentPromptKey];

    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <p
            className="text-xs font-medium uppercase tracking-widest text-black/45 dark:text-white/45"
            aria-valuenow={step + 1}
            aria-valuemax={EIC_INTAKE_STAGE_COUNT}
          >
            {progressLabel}
          </p>
          <h2 className="mt-1 font-serif text-xl font-semibold">{currentStage.question}</h2>
        </div>
        <EicMessage>
          <p>{currentStage.question}</p>
        </EicMessage>
        <div>
          <label htmlFor={currentStage.prompt_key} className="sr-only">
            {currentStage.label}
          </label>
          <textarea
            id={currentStage.prompt_key}
            aria-required={currentStage.required && currentStage.prompt_key !== "market_position"}
            value={value}
            onChange={(e) => updateField(currentPromptKey, e.target.value)}
            rows={4}
            placeholder={currentStage.placeholder}
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
          {currentStage.optional && (
            <button
              type="button"
              onClick={() => {
                updateField(currentPromptKey, "");
                handleStageSubmit({ skipped: true });
              }}
              className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/10"
            >
              Skip this question
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              window.location.href = `/studio/books/${bookId}`;
            }}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/10"
          >
            Save and return later
          </button>
          <button
            type="button"
            disabled={pending || !canAdvanceFromStep()}
            onClick={() => handleStageSubmit()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (stage === "clarification") {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <p className="text-xs font-medium uppercase tracking-widest text-black/45 dark:text-white/45">
          {progressLabel} · Follow-up
        </p>
        <EicMessage>
          <p>{clarificationQuestion}</p>
        </EicMessage>
        <div>
          <label htmlFor="clarification-answer" className="sr-only">
            Your clarification
          </label>
          <textarea
            id="clarification-answer"
            aria-required
            value={clarificationAnswer}
            onChange={(e) => setClarificationAnswer(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-black/10 bg-paper px-3 py-2 text-sm dark:border-white/10"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={pending || clarificationAnswer.trim().length < 2}
          onClick={() => handleStageSubmit({ isClarification: true })}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    );
  }

  if (stage === "eic_response") {
    const understandingLabel =
      summaryRecord?.understanding_quality?.aggregate_level ??
      understanding?.understanding_quality?.aggregate_level;
    const phrase =
      understandingLabel === "author_confirmed"
        ? "Editorial Understanding is ready for your confirmation."
        : understandingLabel && understandingLabel !== "insufficient"
          ? "Editorial Understanding is taking shape."
          : null;

    return (
      <div className="mx-auto max-w-xl space-y-6">
        <p className="text-xs font-medium uppercase tracking-widest text-black/45 dark:text-white/45">
          {progressLabel}
        </p>
        {phrase && (
          <p className="text-xs text-black/40 dark:text-white/40" aria-live="polite">
            {phrase}
          </p>
        )}
        <EicMessage>
          <p>{eicResponse}</p>
        </EicMessage>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setEicResponse(null);
            if (step < EIC_INTAKE_STAGE_COUNT - 1) {
              setStep((s) => s + 1);
              setStage("intake");
            } else {
              setStage("confirmation");
            }
          }}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Continue
        </button>
      </div>
    );
  }

  if (stage === "confirmation") {
    const record: EditorialUnderstandingRecord | null = summaryRecord ?? understanding;
    const display = {
      primary_vision: record?.primary_vision ?? form.elevator_pitch,
      target_reader: (record?.target_reader ?? form.market_position) || "unsure",
      desired_reader_experience: (record?.desired_reader_experience ?? form.desired_reader_experience) || null,
      market_position: (record?.market_position ?? form.market_position) || "unsure",
      creative_motivation: record?.creative_motivation ?? form.author_motivation,
      success_definition: record?.success_definition ?? form.success_definition,
    };

    if (!display.primary_vision?.trim()) {
      return <p className="text-sm text-black/55">Loading summary…</p>;
    }

    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Before I read your manuscript</h2>
          <p className="mt-1 text-sm text-black/55 dark:text-white/55">
            {versionLabel ? `Version ${versionLabel}` : "Current version"}
          </p>
          {record?.understanding_quality?.aggregate_level &&
            record.understanding_quality.aggregate_level !== "insufficient" && (
              <p className="mt-2 text-xs text-black/40 dark:text-white/40">
                Editorial Understanding is ready for your confirmation.
              </p>
            )}
        </div>
        <EicMessage>
          <SummarySections
            primaryVision={display.primary_vision}
            targetReader={display.target_reader}
            desiredReaderExperience={display.desired_reader_experience}
            marketPosition={display.market_position}
            creativeMotivation={display.creative_motivation}
            successDefinition={display.success_definition}
          />
        </EicMessage>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!understandingId) return;
              startTransition(async () => {
                const result = await confirmEditorialUnderstandingAction({
                  manuscriptId: bookId,
                  understandingId,
                });
                if (!result.ok) {
                  setError(result.error ?? "Could not confirm.");
                  return;
                }
                setStage("confirmed");
              });
            }}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Yes
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await editUnderstandingAnswersAction(bookId);
                if (!result.ok) {
                  setError(result.error ?? "Could not reopen answers.");
                  return;
                }
                if (result.understandingId) setUnderstandingId(result.understandingId);
                setStep(0);
                setStage("intake");
              });
            }}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/10"
          >
            Edit answers
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!understandingId) return;
              startTransition(async () => {
                await requestSummaryCorrectionAction({
                  manuscriptId: bookId,
                  understandingId,
                });
                setStep(0);
                setStage("intake");
              });
            }}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/10"
          >
            Correct summary
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = `/studio/books/${bookId}`;
            }}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/10"
          >
            Save and return later
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold">Thank you</h2>
        <p className="mt-1 text-sm text-black/55 dark:text-white/55">
          Editorial understanding confirmed
          {versionLabel ? ` · ${versionLabel}` : ""}
        </p>
      </div>
      <EicMessage>
        <p>Thank you. I believe I understand your goals.</p>
        <p>
          Your description helps me understand what you&apos;re trying to accomplish. It does{" "}
          <strong>not</strong> override my independent professional judgment, and it is{" "}
          <strong>not</strong> treated as evidence about what&apos;s on the page.
        </p>
        <p>
          No expert has received your manuscript. When I&apos;m ready to recommend an editorial
          team, I&apos;ll ask for your permission first.
        </p>
      </EicMessage>
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
          Return to Book Workspace
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await editUnderstandingAnswersAction(bookId);
              if (!result.ok) {
                setError(result.error ?? "Could not edit answers.");
                return;
              }
              if (result.understandingId) setUnderstandingId(result.understandingId);
              setStep(0);
              setStage("intake");
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
