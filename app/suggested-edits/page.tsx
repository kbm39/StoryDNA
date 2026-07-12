import Link from "next/link";
import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import {
  getSuggestedEditsForManuscript,
  listManuscriptsWithSuggestedEdits,
} from "@/lib/suggested-edits";
import type { SuggestedEditStatus } from "@/lib/author-response-status";
import SuggestedEditsClient from "./SuggestedEditsClient";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set<SuggestedEditStatus | "all">([
  "all",
  "pending",
  "accepted",
  "rejected",
  "modified",
  "skipped",
]);

function SetupNotice() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        <p className="font-medium">Supabase isn’t configured yet.</p>
        <p className="mt-2">
          Copy <code className="font-mono">.env.example</code> to{" "}
          <code className="font-mono">.env.local</code> and apply the database migrations before
          using Editorial Review.
        </p>
      </div>
    </main>
  );
}

function MigrationNotice() {
  return (
    <div className="mb-8 rounded-xl border border-amber-300/70 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <p className="font-medium">Database migration required</p>
      <p className="mt-2">
        Apply{" "}
        <code className="font-mono">supabase/migrations/0016_author_edit_responses.sql</code> in the
        Supabase SQL editor (or run <code className="font-mono">supabase db push</code> for local
        dev), then reload this page.
      </p>
    </div>
  );
}

async function ManuscriptPicker() {
  const items = await listManuscriptsWithSuggestedEdits();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <header className="mb-10">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          StoryDNA · Editorial Review
        </p>
        <h1 className="mt-3 font-serif text-[26px] leading-snug text-black/90 dark:text-white/95">
          Suggested Edits
        </h1>
        <p className="mt-4 max-w-xl font-serif text-[18px] leading-relaxed text-black/75 dark:text-white/80">
          Choose a manuscript to review its suggested edits in context and record your responses.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="font-serif text-[17px] text-black/70 dark:text-white/75">
          No manuscripts have revision candidates yet. Generate them from a manuscript’s Literary
          Agent review first.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((m) => (
            <li key={m.id}>
              <Link
                href={`/suggested-edits?manuscript=${m.id}`}
                className="block rounded-xl border border-black/10 bg-paper p-4 shadow-sm transition hover:border-accent/40 dark:border-white/15 dark:bg-white/5"
              >
                <span className="font-serif text-[18px] font-medium">{m.title}</span>
                <span className="mt-1 block font-sans text-sm text-black/50 dark:text-white/50">
                  {m.editCount} suggestion{m.editCount === 1 ? "" : "s"}
                  {m.pendingCount > 0 && ` · ${m.pendingCount} pending`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default async function SuggestedEditsPage({
  searchParams,
}: {
  searchParams: Promise<{ manuscript?: string; status?: string; candidate?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const { manuscript: manuscriptId, status: rawStatus, candidate: candidateId } =
    await searchParams;
  const statusFilter: SuggestedEditStatus | "all" =
    rawStatus && VALID_STATUS.has(rawStatus as SuggestedEditStatus | "all")
      ? (rawStatus as SuggestedEditStatus | "all")
      : "all";

  if (!manuscriptId) return <ManuscriptPicker />;

  const payload = await getSuggestedEditsForManuscript(manuscriptId);
  if (!payload) notFound();

  return (
    <>
      {payload.migrationRequired && <div className="mx-auto max-w-2xl px-6 pt-8"><MigrationNotice /></div>}
      <SuggestedEditsClient
        manuscriptId={manuscriptId}
        manuscriptTitle={payload.manuscript.title}
        edits={payload.edits}
        statusFilter={statusFilter}
        initialCandidateId={candidateId ?? null}
      />
    </>
  );
}
