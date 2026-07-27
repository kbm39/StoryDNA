import Link from "next/link";
import { notFound } from "next/navigation";
import { getStudioBookWorkspace } from "@/lib/studio/book-workspace.ts";
import { listStudioExportOptions } from "@/lib/studio/exports.ts";
import { StudioNav } from "../../../components/StudioShell.tsx";

export default async function StudioExportsPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const workspace = await getStudioBookWorkspace(bookId);
  if (!workspace) notFound();

  const exports = await listStudioExportOptions(bookId);

  return (
    <section className="space-y-6">
      <StudioNav bookId={bookId} />
      <div>
        <h2 className="font-serif text-2xl font-semibold">Exports</h2>
        <p className="mt-1 text-sm text-black/55 dark:text-white/55">
          Download reports and revision artifacts. Unavailable exports are marked for later milestones.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {exports.map((option) => (
          <article
            key={option.key}
            className="rounded-xl border border-black/10 bg-paper p-5 shadow-sm dark:border-white/10"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-serif text-lg font-semibold">{option.label}</h3>
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
              <a
                href={option.href}
                className="mt-4 inline-block text-sm text-accent hover:underline"
              >
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

      <p className="text-sm text-black/50">
        <Link href={`/manuscripts/${bookId}`} className="text-accent hover:underline">
          Open commercial manuscript workspace
        </Link>{" "}
        for additional export routes.
      </p>
    </section>
  );
}
