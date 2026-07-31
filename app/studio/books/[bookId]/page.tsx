import Link from "next/link";
import { notFound } from "next/navigation";
import { studioExpertRecruitmentHref } from "@/lib/author-intent/entry-gate.ts";
import { getStudioBookWorkspace } from "@/lib/studio/book-workspace.ts";
import { StudioNav } from "../../components/StudioShell.tsx";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function StudioBookWorkspacePage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const workspace = await getStudioBookWorkspace(bookId);
  if (!workspace) notFound();

  return (
    <section className="space-y-8">
      <StudioNav bookId={bookId} />

      <div className="rounded-xl border border-black/10 bg-paper p-6 shadow-sm dark:border-white/10">
        <h2 className="font-serif text-2xl font-semibold">{workspace.title}</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-black/50">Series</dt>
            <dd>{workspace.seriesName ?? "Standalone"}</dd>
          </div>
          <div>
            <dt className="text-black/50">Volume</dt>
            <dd>{workspace.volumeNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-black/50">Active version</dt>
            <dd>
              {workspace.activeVersionLabel ??
                (workspace.activeVersionNumber ? `v${workspace.activeVersionNumber}` : "—")}
            </dd>
          </div>
          <div>
            <dt className="text-black/50">Word count</dt>
            <dd>{workspace.wordCount?.toLocaleString() ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-black/50">Open issues</dt>
            <dd>{workspace.openIssueCount}</dd>
          </div>
          <div>
            <dt className="text-black/50">Accepted revisions</dt>
            <dd>{workspace.acceptedRevisionCount}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/manuscripts/${bookId}`}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm hover:border-accent dark:border-white/10"
          >
            Upload New Revision
          </Link>
          <Link
            href={studioExpertRecruitmentHref(bookId)}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm hover:border-accent dark:border-white/10"
          >
            Editorial Team
          </Link>
          <Link
            href={`/studio/books/${bookId}/revisions`}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:opacity-90"
          >
            Open Revision Board
          </Link>
          <Link
            href={`/studio/books/${bookId}/exports`}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm hover:border-accent dark:border-white/10"
          >
            Export
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-black/10 bg-paper p-5 dark:border-white/10">
          <h3 className="font-serif text-lg font-semibold">Version history</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {workspace.versions.length === 0 ? (
              <li className="text-black/50">No version records.</li>
            ) : (
              workspace.versions.map((v) => (
                <li key={v.id} className="flex justify-between gap-4 border-b border-black/5 py-2 last:border-0">
                  <span>
                    {v.label ?? `Version ${v.versionNumber}`}
                    {v.isCurrent ? " (current)" : ""}
                  </span>
                  <span className="text-black/50">
                    {v.wordCount?.toLocaleString() ?? "—"} words · {formatDate(v.createdAt)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-black/10 bg-paper p-5 dark:border-white/10">
          <h3 className="font-serif text-lg font-semibold">Review history</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {workspace.reviews.length === 0 ? (
              <li className="text-black/50">No reviews yet.</li>
            ) : (
              workspace.reviews.map((r) => (
                <li key={r.id} className="flex justify-between gap-4 border-b border-black/5 py-2 last:border-0">
                  <span>{r.perspective}</span>
                  <span className="text-black/50">
                    {r.lifecycleStatus ?? "—"} · {formatDate(r.createdAt)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </section>
  );
}
