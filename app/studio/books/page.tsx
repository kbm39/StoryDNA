import Link from "next/link";
import { studioExpertRecruitmentHref } from "@/lib/author-intent/entry-gate.ts";
import { listStudioLibraryBooks } from "@/lib/studio/library.ts";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function StudioLibraryPage() {
  const books = await listStudioLibraryBooks();

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold">Library</h2>
        <p className="mt-1 text-sm text-black/55 dark:text-white/55">
          Your manuscripts and editorial progress.
        </p>
      </div>

      {books.length === 0 ? (
        <div className="rounded-xl border border-black/10 bg-paper p-8 text-center dark:border-white/10">
          <p className="text-black/60 dark:text-white/60">No manuscripts yet.</p>
          <Link href="/" className="mt-3 inline-block text-sm text-accent hover:underline">
            Upload a manuscript on the main site
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/10 bg-paper shadow-sm dark:border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-black/10 bg-black/[0.02] text-xs uppercase tracking-wide text-black/50 dark:border-white/10">
              <tr>
                <th className="px-4 py-3">Book</th>
                <th className="px-4 py-3">Series</th>
                <th className="px-4 py-3">Vol</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Words</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-4 py-3">Review</th>
                <th className="px-4 py-3">Open</th>
                <th className="px-4 py-3">Accepted</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr key={book.id} className="border-b border-black/5 last:border-0 dark:border-white/5">
                  <td className="px-4 py-3 font-medium">{book.title}</td>
                  <td className="px-4 py-3">{book.seriesName ?? "—"}</td>
                  <td className="px-4 py-3">{book.volumeNumber ?? "—"}</td>
                  <td className="px-4 py-3">
                    {book.activeVersionLabel ??
                      (book.activeVersionNumber ? `v${book.activeVersionNumber}` : "—")}
                  </td>
                  <td className="px-4 py-3">{book.wordCount?.toLocaleString() ?? "—"}</td>
                  <td className="px-4 py-3">{formatDate(book.lastUploadDate)}</td>
                  <td className="px-4 py-3">{book.latestReviewStatus ?? "—"}</td>
                  <td className="px-4 py-3">{book.unresolvedIssueCount}</td>
                  <td className="px-4 py-3">{book.acceptedRevisionCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/studio/books/${book.id}`}
                        className="text-accent hover:underline"
                      >
                        Open Book
                      </Link>
                      <Link
                        href={studioExpertRecruitmentHref(book.id)}
                        className="text-accent hover:underline"
                      >
                        Run Expert
                      </Link>
                      <Link
                        href={`/studio/books/${book.id}/revisions`}
                        className="text-accent hover:underline"
                      >
                        Continue Revising
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
