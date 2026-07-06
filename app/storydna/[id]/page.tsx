import Link from "next/link";
import { notFound } from "next/navigation";
import { getManuscriptMeta } from "@/lib/reviews";
import { getStoryDna, listInterviewAnswers } from "@/lib/storydna";
import { listSeries } from "@/lib/series";
import { parseBookDisplay } from "@/lib/booktitle";
import StoryDnaDiscovery from "./StoryDnaDiscovery";
import type { InterviewAnswer } from "@/lib/types";

export const dynamic = "force-dynamic";
// Whole-manuscript discovery can run for a minute-plus on a long novel.
export const maxDuration = 300;

export default async function StoryDnaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const manuscript = await getManuscriptMeta(id);
  if (!manuscript) notFound();

  const [dna, answers, allSeries] = await Promise.all([
    getStoryDna(id),
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
      <div className="mb-6 flex items-center justify-between gap-3 text-sm">
        <Link href="/" className="text-accent hover:underline">
          ← All manuscripts
        </Link>
        <Link href={`/manuscripts/${id}`} className="text-black/50 hover:text-accent dark:text-white/50">
          View full reports →
        </Link>
      </div>

      <header className="mb-8">
        {display.seriesName && (
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {display.seriesName}
          </p>
        )}
        {display.bookLabel && (
          <p className="mt-1.5 text-sm font-medium text-black/50 dark:text-white/50">
            {display.bookLabel}
          </p>
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
      />
    </main>
  );
}
