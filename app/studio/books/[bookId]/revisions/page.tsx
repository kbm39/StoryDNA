import Link from "next/link";
import { notFound } from "next/navigation";
import { getStudioRevisionBoard } from "@/lib/studio/exports.ts";
import { StudioNav } from "../../../components/StudioShell.tsx";
import { RevisionBoardClient } from "./RevisionBoardClient.tsx";

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
        <RevisionBoardClient bookId={bookId} items={items} summary={summary} />
      )}
    </section>
  );
}
