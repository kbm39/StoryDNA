import Link from "next/link";
import { notFound } from "next/navigation";
import { getStudioBookWorkspace } from "@/lib/studio/book-workspace.ts";
import { listStudioExportOptions } from "@/lib/studio/exports.ts";
import { buildAcceptedRevisionManifest } from "@/lib/studio/revision-export-manifest.ts";
import { requireStudioAccess } from "@/lib/studio/access.ts";
import { StudioNav } from "../../../components/StudioShell.tsx";
import { AcceptedRevisionPreviewClient } from "./AcceptedRevisionPreviewClient.tsx";

export default async function StudioExportsPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  await requireStudioAccess(`/studio/books/${bookId}/exports`);

  const workspace = await getStudioBookWorkspace(bookId);
  if (!workspace) notFound();

  const [exports, manifest] = await Promise.all([
    listStudioExportOptions(bookId),
    buildAcceptedRevisionManifest({ manuscriptId: bookId }),
  ]);

  if (!manifest) notFound();

  return (
    <section className="space-y-8">
      <StudioNav bookId={bookId} />
      <div>
        <h2 className="font-serif text-2xl font-semibold">Exports</h2>
        <p className="mt-1 text-sm text-black/55 dark:text-white/55">
          Preview accepted editorial decisions and download export packages. Your canonical manuscript is never modified by these exports.
        </p>
      </div>

      <AcceptedRevisionPreviewClient bookId={bookId} manifest={manifest} />

      <div>
        <h3 className="font-serif text-xl font-semibold">Commercial export links</h3>
        <p className="mt-1 text-sm text-black/55">
          Additional exports available through the commercial manuscript workspace.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {exports.map((option) => (
            <article
              key={option.key}
              className="rounded-xl border border-black/10 bg-paper p-5 shadow-sm dark:border-white/10"
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-serif text-lg font-semibold">{option.label}</h4>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    option.ready
                      ? "bg-emerald-100 text-emerald-900"
                      : option.comingLater
                        ? "bg-black/5 text-black/50"
                        : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {option.ready ? "Ready" : option.comingLater ? "Later milestone" : "Not ready"}
                </span>
              </div>
              <p className="mt-2 text-sm text-black/60 dark:text-white/60">{option.description}</p>
              {option.ready && option.href ? (
                <a href={option.href} className="mt-4 inline-block text-sm text-accent hover:underline">
                  Download
                </a>
              ) : option.comingLater ? (
                <p className="mt-4 text-xs text-black/45">Coming in a later Studio milestone.</p>
              ) : (
                <p className="mt-4 text-xs text-black/45">Generate prerequisite content first.</p>
              )}
            </article>
          ))}
        </div>
      </div>

      <p className="text-sm text-black/50">
        <Link href={`/manuscripts/${bookId}`} className="text-accent hover:underline">
          Open commercial manuscript workspace
        </Link>{" "}
        for additional export routes.
      </p>
    </section>
  );
}
