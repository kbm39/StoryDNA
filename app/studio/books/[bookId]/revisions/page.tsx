import Link from "next/link";
import { notFound } from "next/navigation";
import { getStudioRevisionBoard } from "@/lib/studio/exports.ts";
import { StudioNav } from "../../../components/StudioShell.tsx";

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export default async function StudioRevisionBoardPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const board = await getStudioRevisionBoard(bookId);
  if (!board) notFound();

  const { items, summary } = board;

  return (
    <section className="space-y-6">
      <StudioNav bookId={bookId} />
      <div>
        <h2 className="font-serif text-2xl font-semibold">Revision Board</h2>
        <p className="mt-1 text-sm text-black/55 dark:text-white/55">
          The expert proposes. The author decides.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Total", summary.total],
          ["Open", summary.open],
          ["Accepted", summary.accepted],
          ["Rejected", summary.rejected],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-black/10 bg-paper p-4 text-center dark:border-white/10"
          >
            <p className="text-xs uppercase tracking-wide text-black/45">{label}</p>
            <p className="mt-1 font-serif text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-black/10 bg-paper p-8 text-center dark:border-white/10">
          <p className="text-black/55">No revision candidates yet.</p>
          <Link
            href={`/studio/books/${bookId}/experts`}
            className="mt-2 inline-block text-sm text-accent hover:underline"
          >
            Run an expert review
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-black/10 bg-paper p-5 shadow-sm dark:border-white/10"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-black/45">
                    {item.sourceExpert} · {item.category ?? "General"}
                  </p>
                  <h3 className="font-serif text-lg font-semibold">{item.issueTitle}</h3>
                </div>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs capitalize">
                  {statusLabel(item.status)}
                </span>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-black/45">
                    Original
                  </h4>
                  <p className="mt-1 rounded-lg bg-black/[0.03] p-3 text-sm italic dark:bg-white/5">
                    {item.quotedEvidence || "—"}
                  </p>
                </section>
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-black/45">
                    Suggested rewrite
                  </h4>
                  <p className="mt-1 rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30">
                    {item.suggestedRewrite || "—"}
                  </p>
                </section>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div>
                  <span className="font-medium">Expert concern: </span>
                  {item.explanation}
                </div>
                {item.whyItMatters ? (
                  <div>
                    <span className="font-medium">Why it matters: </span>
                    {item.whyItMatters}
                  </div>
                ) : null}
                <div>
                  <span className="font-medium">Author decision: </span>
                  {item.authorDecision ?? "Pending"}
                </div>
                {item.authorNotes ? (
                  <div>
                    <span className="font-medium">Author notes: </span>
                    {item.authorNotes}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-black/50">
                <span>Severity: {item.severity ?? "—"}</span>
                <span>Confidence: {item.confidence ?? "—"}</span>
                <span>Location: {item.chapterOrLocation ?? "—"}</span>
              </div>

              <p className="mt-4 text-xs text-black/45">
                Accept / Reject / Edit controls record author intent only in K1 — use{" "}
                <Link href="/suggested-edits" className="text-accent hover:underline">
                  Suggested Edits
                </Link>{" "}
                to record decisions. Manuscript application is a later milestone.
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
