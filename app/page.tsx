import Link from "next/link";
import UploadForm from "@/app/components/UploadForm";
import ManuscriptLibrary from "@/app/components/ManuscriptLibrary";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { listManuscripts } from "@/lib/manuscripts";
import { listSeries, seriesBookCounts } from "@/lib/series";
import type { Manuscript, Series } from "@/lib/types";

export const dynamic = "force-dynamic";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 font-sans text-xs font-semibold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
      {children}
    </h2>
  );
}

function SetupNotice() {
  return (
    <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <p className="font-medium">Supabase isn’t configured yet.</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>
          Copy <code className="font-mono">.env.example</code> to{" "}
          <code className="font-mono">.env.local</code> and fill in your Supabase URL and
          service-role key.
        </li>
        <li>
          Apply <code className="font-mono">supabase/migrations/0001_init.sql</code> to your
          database (Supabase SQL editor, or <code className="font-mono">supabase db reset</code>{" "}
          for local dev).
        </li>
        <li>Restart the dev server.</li>
      </ol>
    </div>
  );
}

export default async function Home() {
  const configured = isSupabaseConfigured();
  let manuscripts: Manuscript[] = [];
  let series: Series[] = [];
  let counts: Record<string, number> = {};
  let loadError: string | null = null;

  if (configured) {
    try {
      [manuscripts, series, counts] = await Promise.all([
        listManuscripts(),
        listSeries(),
        seriesBookCounts(),
      ]);
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Failed to load manuscripts.";
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">Your manuscripts</h1>
        <p className="mt-2 text-black/55 dark:text-white/55">
          Upload a Word manuscript to review, score, and revise it.
        </p>
      </header>

      {!configured ? (
        <SetupNotice />
      ) : (
        <div className="space-y-10">
          <section>
            <SectionLabel>Upload</SectionLabel>
            <UploadForm />
          </section>

          <section>
            <SectionLabel>Library</SectionLabel>
            {loadError ? (
              <p className="text-sm text-red-600">{loadError}</p>
            ) : (
              <ManuscriptLibrary manuscripts={manuscripts} />
            )}
          </section>

          {series.length > 0 && (
            <section>
              <SectionLabel>Series</SectionLabel>
              <ul className="grid gap-3 sm:grid-cols-2">
                {series.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/series/${s.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-paper p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md dark:border-white/10 dark:bg-white/5"
                    >
                      <span className="truncate font-serif text-lg font-semibold leading-snug">
                        {s.title}
                      </span>
                      <span className="shrink-0 text-xs text-black/55 dark:text-white/55">
                        {counts[s.id] ?? 0} {(counts[s.id] ?? 0) === 1 ? "book" : "books"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
