import Link from "next/link";
import { notFound } from "next/navigation";
import { getManuscriptMeta } from "@/lib/reviews";
import { getStoryDna, listInterviewAnswers } from "@/lib/storydna";
import { getManuscriptIntake, getAuthorProfile } from "@/lib/intake";
import { listSeries, seriesBookCounts } from "@/lib/series";
import { parseBookDisplay } from "@/lib/booktitle";
import StoryDnaDiscovery from "./StoryDnaDiscovery";
import ManuscriptIntake, { type IntakePrefill } from "./ManuscriptIntake";
import type {
  InterviewAnswer,
  ManuscriptRelation,
  ManuscriptType,
  ManuscriptStage,
  ReviewObjective,
  Optimization,
  FeedbackStyle,
  Series,
  AuthorProfile,
  Manuscript,
} from "@/lib/types";

export const dynamic = "force-dynamic";
// Whole-manuscript discovery can run for a minute-plus on a long novel.
export const maxDuration = 300;

function stageFromDraft(label: string | null): ManuscriptStage {
  const d = (label ?? "").toLowerCase();
  if (d.includes("final")) return "query_ready";
  if (d.includes("revised") || d.includes("advanced")) return "advanced_revision";
  if (d.includes("first") || d.includes("rough")) return "first_draft";
  if (d.includes("polished") || d.includes("clean")) return "query_ready";
  if (d.includes("draft")) return "early_revision";
  return "early_revision";
}

function objectiveFromStage(stage: ManuscriptStage): ReviewObjective {
  switch (stage) {
    case "query_ready":
    case "publisher_submission":
      return "agent_submission";
    case "producer_submission":
      return "producer_review";
    case "final_proof":
      return "final_proof";
    default:
      return "developmental";
  }
}

function buildPrefill(
  manuscript: Pick<Manuscript, "original_filename" | "title" | "word_count" | "series_order">,
  allSeries: Series[],
  profile: AuthorProfile | null,
): IntakePrefill {
  const display = parseBookDisplay(
    manuscript.original_filename,
    manuscript.title,
    null,
    manuscript.series_order,
  );
  const spaced = (manuscript.original_filename ?? "").replace(/[_-]+/g, " ").toLowerCase();
  const matched = allSeries.find((s) => s.title && spaced.includes(s.title.toLowerCase())) ?? null;
  const bookNum = display.bookLabel ? parseInt(display.bookLabel.replace(/\D/g, ""), 10) : null;

  let relation: ManuscriptRelation = "standalone";
  if (matched) relation = "existing_series";
  else if (bookNum != null) relation = "new_series";

  const wc = manuscript.word_count ?? 0;
  let type: ManuscriptType = "main_novel";
  if (wc > 0 && wc < 7500) type = "short_story";
  else if (wc > 0 && wc < 40000) type = "novella";

  const stage = stageFromDraft(display.draftLabel);

  return {
    relation,
    matchedSeriesId: matched?.id ?? null,
    seriesName: matched?.title ?? "",
    bookNumber: bookNum,
    manuscriptType: type,
    manuscriptStage: stage,
    objective: objectiveFromStage(stage),
    optimization: (profile?.optimization as Optimization) ?? "balanced",
    feedbackStyle: (profile?.feedback_style as FeedbackStyle[]) ?? [],
    recommendSpecialists: true,
    loadDefault: relation === "existing_series",
  };
}

export default async function StoryDnaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const manuscript = await getManuscriptMeta(id);
  if (!manuscript) notFound();

  const [intake, dna] = await Promise.all([getManuscriptIntake(id), getStoryDna(id)]);

  const nav = (
    <div className="mb-6 flex items-center justify-between gap-3 text-sm">
      <Link href="/" className="text-accent hover:underline">
        ← All manuscripts
      </Link>
      <Link href={`/manuscripts/${id}`} className="text-black/50 hover:text-accent dark:text-white/50">
        View full reports →
      </Link>
    </div>
  );

  // --- Gate: required Manuscript Intake before Story Understanding runs ---
  const needsIntake = !intake?.completed_at && !dna;
  if (needsIntake) {
    const [allSeries, counts, profile] = await Promise.all([
      listSeries(),
      seriesBookCounts(),
      getAuthorProfile(),
    ]);
    const prefill = buildPrefill(manuscript, allSeries, profile);
    const seriesOptions = allSeries.map((s) => ({ id: s.id, title: s.title, books: counts[s.id] ?? 0 }));
    const d = parseBookDisplay(manuscript.original_filename, manuscript.title, null, manuscript.series_order);
    const detectedLabel = [d.bookLabel, d.bookTitle, d.draftLabel].filter(Boolean).join(" · ");

    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        {nav}
        <header className="mb-8">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-accent">StoryDNA</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Tell StoryDNA About This Manuscript</h1>
        </header>
        <ManuscriptIntake
          manuscriptId={id}
          prefill={prefill}
          series={seriesOptions}
          detectedLabel={detectedLabel || manuscript.original_filename}
        />
      </main>
    );
  }

  // --- Intake complete (or already analyzed): the existing Story Understanding flow ---
  const [answers, allSeries] = await Promise.all([
    listInterviewAnswers(id),
    manuscript.series_id ? listSeries() : Promise.resolve([]),
  ]);
  const answerMap: Record<string, InterviewAnswer> = {};
  for (const a of answers) answerMap[a.question_key] = a.answer;

  const seriesTitle = manuscript.series_id
    ? allSeries.find((s) => s.id === manuscript.series_id)?.title ?? null
    : null;
  const display = parseBookDisplay(
    manuscript.original_filename,
    manuscript.title,
    seriesTitle,
    manuscript.series_order,
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      {nav}
      <header className="mb-8">
        {display.seriesName && (
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {display.seriesName}
          </p>
        )}
        {display.bookLabel && (
          <p className="mt-1.5 text-sm font-medium text-black/50 dark:text-white/50">{display.bookLabel}</p>
        )}
        <h1 className="mt-0.5 text-3xl font-semibold tracking-tight">{display.bookTitle}</h1>
        {display.draftLabel && (
          <p className="mt-1 text-sm italic text-black/45 dark:text-white/45">{display.draftLabel}</p>
        )}
      </header>

      <StoryDnaDiscovery
        manuscriptId={id}
        initialData={dna?.data ?? null}
        answerMap={answerMap}
        initialFeedback={dna?.understanding_feedback ?? null}
      />
    </main>
  );
}
