"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { getStudioRevisionExportPreview } from "@/app/studio/actions/revision-export.ts";
import type { StudioRevisionExport, StudioRevisionExportItem } from "@/lib/studio/export-types.ts";
import {
  buildTextualDiffLines,
  DIFF_PREVIEW_NOTICE,
  formatTextualDiffForDisplay,
} from "@/lib/studio/textual-diff.ts";

type PreviewFilter =
  | "all_accepted"
  | "accepted_unchanged"
  | "accepted_modified"
  | "safe_only"
  | "unsafe_only"
  | "with_conflicts";

function filterItems(
  items: readonly StudioRevisionExportItem[],
  filter: PreviewFilter,
): readonly StudioRevisionExportItem[] {
  switch (filter) {
    case "accepted_unchanged":
      return items.filter((i) => i.revision.disposition === "accepted");
    case "accepted_modified":
      return items.filter((i) => i.revision.disposition === "accepted_modified");
    case "safe_only":
      return items.filter((i) => i.applicability.safeToApplyLater);
    case "unsafe_only":
      return items.filter((i) => !i.applicability.safeToApplyLater);
    case "with_conflicts":
      return items.filter((i) => i.applicability.conflictReasons.length > 0);
    default:
      return items;
  }
}

function PreviewItem({ item, index }: { item: StudioRevisionExportItem; index: number }) {
  const diffLines = buildTextualDiffLines(item.revision.originalText, item.revision.finalExportText);

  return (
    <article className="rounded-xl border border-black/10 bg-paper p-5 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-serif text-lg font-semibold">Revision {index}</h4>
        <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs font-medium">
          {item.revision.disposition === "accepted_modified"
            ? "Accepted With Changes"
            : item.revision.disposition === "accepted"
              ? "Accepted"
              : "Saved for Later"}
        </span>
      </div>

      <dl className="mt-3 grid gap-1 text-xs text-black/55 sm:grid-cols-2">
        <div>
          <dt className="inline font-medium">Expert: </dt>
          <dd className="inline">{item.expert.expertName}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Location: </dt>
          <dd className="inline">{item.manuscriptLocation.locatorLabel ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Revision type: </dt>
          <dd className="inline">{item.revision.revisionType}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Source match: </dt>
          <dd className="inline">{item.applicability.sourceTextMatchState}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Application readiness: </dt>
          <dd className="inline">
            {item.applicability.safeToApplyLater ? "Safe for later application" : "Not safe for automatic application"}
          </dd>
        </div>
        <div>
          <dt className="inline font-medium">Conflicts: </dt>
          <dd className="inline">
            {item.applicability.conflictReasons.length
              ? item.applicability.conflictReasons.join(", ")
              : "None"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section aria-labelledby={`orig-${item.itemId}`}>
          <h5 id={`orig-${item.itemId}`} className="text-xs font-semibold uppercase tracking-wide text-black/45">
            Original
          </h5>
          <p className="mt-1 rounded-lg bg-black/[0.03] p-3 text-sm dark:bg-white/5">
            {item.revision.originalText || "—"}
          </p>
        </section>
        <section aria-labelledby={`sugg-${item.itemId}`}>
          <h5 id={`sugg-${item.itemId}`} className="text-xs font-semibold uppercase tracking-wide text-black/45">
            Expert Suggestion
          </h5>
          <p className="mt-1 rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30">
            {item.revision.expertSuggestedText || "—"}
          </p>
        </section>
        <section aria-labelledby={`final-${item.itemId}`}>
          <h5 id={`final-${item.itemId}`} className="text-xs font-semibold uppercase tracking-wide text-black/45">
            Kevin&apos;s Final Text
          </h5>
          <p className="mt-1 rounded-lg bg-indigo-50 p-3 text-sm dark:bg-indigo-950/30">
            {item.revision.finalExportText || "—"}
          </p>
        </section>
      </div>

      {item.revision.authorNote ? (
        <p className="mt-3 text-sm">
          <span className="font-medium">Author note: </span>
          {item.revision.authorNote}
        </p>
      ) : null}

      <div className="mt-4">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-black/45">Preview diff</h5>
        <p className="mt-1 text-xs text-black/45">{DIFF_PREVIEW_NOTICE}</p>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-black/10 bg-black/[0.02] p-3 text-xs whitespace-pre-wrap dark:border-white/10">
          {formatTextualDiffForDisplay(diffLines)}
        </pre>
      </div>
    </article>
  );
}

export function AcceptedRevisionPreviewClient({
  bookId,
  manifest: initialManifest,
}: {
  bookId: string;
  manifest: StudioRevisionExport;
}) {
  const [manifest, setManifest] = useState(initialManifest);
  const [includeDeferred, setIncludeDeferred] = useState(initialManifest.filters.includeDeferred);
  const [filter, setFilter] = useState<PreviewFilter>("all_accepted");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getStudioRevisionExportPreview({
        manuscriptId: bookId,
        includeDeferred,
      });
      if (result.ok) setManifest(result.manifest);
    });
  }, [bookId, includeDeferred]);

  const approvedItems = useMemo(() => filterItems(manifest.items, filter), [manifest.items, filter]);
  const hasAccepted = manifest.items.length > 0 || (includeDeferred && manifest.planningItems.length > 0);
  const allSafe =
    manifest.items.length > 0 && manifest.summary.notSafeForAutomaticApplication === 0;

  const downloadQuery = new URLSearchParams({
    expectedActiveVersionId: manifest.expectedActiveVersionId ?? "",
    ...(includeDeferred ? { includeDeferred: "true" } : {}),
  }).toString();

  const integritySecondary = allSafe
    ? "All included revisions have deterministic source locations, but they have not been applied."
    : "Some accepted revisions cannot yet be applied automatically because their source location is ambiguous, stale, or unresolved. Review the warnings below.";

  return (
    <section className="space-y-6" aria-labelledby="accepted-preview-heading">
      <div>
        <h3 id="accepted-preview-heading" className="font-serif text-xl font-semibold">
          Accepted Revision Preview
        </h3>
        <p className="mt-1 text-sm text-black/55">
          Preview and download your accepted editorial decisions without modifying the manuscript.
        </p>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
        <p className="font-medium">{manifest.integrity.warning}</p>
        {manifest.items.length > 0 ? <p className="mt-2">{integritySecondary}</p> : null}
      </div>

      {!hasAccepted ? (
        <div className="rounded-xl border border-black/10 bg-paper p-6 text-sm">
          <p>
            No accepted revisions are ready to export. Review recommendations in the{" "}
            <Link href={`/studio/books/${bookId}/revisions`} className="text-accent hover:underline">
              Revision Board
            </Link>{" "}
            and accept or edit the changes you want to keep.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Accepted unchanged", manifest.summary.acceptedUnchanged],
              ["Accepted with changes", manifest.summary.acceptedModified],
              ["Conflicts", manifest.summary.conflictCount],
              ["Unresolved locations", manifest.summary.unresolvedLocatorCount],
              ["Safe for later", manifest.summary.safeForLaterApplication],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg border border-black/10 bg-paper p-3 text-sm">
                <p className="text-black/50">{label as string}</p>
                <p className="text-lg font-semibold">{value as number}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="font-medium">Filter:</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as PreviewFilter)}
                className="rounded-lg border border-black/10 bg-white px-2 py-1 text-sm dark:border-white/10 dark:bg-black/20"
              >
                <option value="all_accepted">All accepted</option>
                <option value="accepted_unchanged">Accepted unchanged</option>
                <option value="accepted_modified">Accepted with changes</option>
                <option value="safe_only">Safe for application</option>
                <option value="unsafe_only">Not safe for automatic application</option>
                <option value="with_conflicts">With conflicts</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeDeferred}
                disabled={pending}
                onChange={(e) => setIncludeDeferred(e.target.checked)}
              />
              Include Saved for Later in planning export
            </label>
          </div>

          {manifest.conflicts.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <h4 className="font-medium">Conflicts requiring attention</h4>
              <ul className="mt-2 list-disc pl-5">
                {manifest.conflicts.map((c) => (
                  <li key={c.conflictId}>
                    {c.conflictType}: {c.explanation}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-4">
            {approvedItems.map((item, idx) => (
              <PreviewItem key={item.itemId} item={item} index={idx + 1} />
            ))}
          </div>

          {includeDeferred && manifest.planningItems.length > 0 ? (
            <section className="space-y-4 border-t border-black/10 pt-6">
              <h4 className="font-serif text-lg font-semibold">Saved for Later (Planning Only — Not Approved)</h4>
              {manifest.planningItems.map((item, idx) => (
                <PreviewItem key={item.itemId} item={item} index={idx + 1} />
              ))}
            </section>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <a
              href={`/studio/books/${bookId}/exports/json?${downloadQuery}`}
              aria-disabled={manifest.items.length === 0}
              className={`rounded-lg px-4 py-2 text-sm text-white ${manifest.items.length === 0 ? "pointer-events-none bg-black/30" : "bg-accent hover:opacity-90"}`}
            >
              Download JSON
            </a>
            <a
              href={`/studio/books/${bookId}/exports/markdown?${downloadQuery}`}
              aria-disabled={manifest.items.length === 0}
              className={`rounded-lg border px-4 py-2 text-sm ${manifest.items.length === 0 ? "pointer-events-none border-black/10 text-black/40" : "border-black/10 hover:border-accent"}`}
            >
              Download Markdown
            </a>
          </div>
        </>
      )}
    </section>
  );
}
