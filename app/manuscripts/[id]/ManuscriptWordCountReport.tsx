import {
  dualWordCountDisplay,
  WORD_COUNT_DUAL_EXPLANATION,
} from "@/lib/word-count-reporting";

export function ManuscriptWordCountReport({
  canonicalWordCount,
  sourceDocumentWordCount,
}: {
  canonicalWordCount: number | null | undefined;
  sourceDocumentWordCount: number | null | undefined;
}) {
  const report = dualWordCountDisplay({
    canonicalWordCount,
    sourceDocumentWordCount,
  });
  if (!report) return null;

  return (
    <div className="mt-2 max-w-xl rounded-lg border border-black/10 bg-black/[.02] px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[.03]">
      <dl className="space-y-0.5">
        <div>
          <dt className="inline text-black/45 dark:text-white/45">StoryDNA analytical count: </dt>
          <dd className="inline font-medium tabular-nums text-black/75 dark:text-white/75">
            {report.canonicalWordCount.toLocaleString()}
          </dd>
        </div>
        {report.sourceUnavailable ? (
          <div className="text-black/55 dark:text-white/55">Microsoft Word document count unavailable.</div>
        ) : (
          <>
            <div>
              <dt className="inline text-black/45 dark:text-white/45">Microsoft Word document count: </dt>
              <dd className="inline font-medium tabular-nums text-black/75 dark:text-white/75">
                {report.sourceDocumentWordCount!.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="inline text-black/45 dark:text-white/45">Difference: </dt>
              <dd className="inline font-medium tabular-nums text-black/75 dark:text-white/75">
                {report.differenceWords!.toLocaleString()} words ({report.percentDifferenceLabel})
              </dd>
            </div>
          </>
        )}
      </dl>
      <p className="mt-2 leading-snug text-black/50 dark:text-white/50">{WORD_COUNT_DUAL_EXPLANATION}</p>
    </div>
  );
}
