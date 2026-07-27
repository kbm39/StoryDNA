"use client";

import { useState } from "react";
import Link from "next/link";
import type { StudioExpertDeskEntry } from "@/lib/studio/types.ts";

function tierTone(tier: StudioExpertDeskEntry["tier"]): string {
  switch (tier) {
    case "certified":
      return "bg-emerald-100 text-emerald-900";
    case "validated":
      return "bg-indigo-100 text-indigo-900";
    case "experimental":
      return "bg-amber-100 text-amber-900";
    case "advisory_only":
      return "bg-orange-100 text-orange-900";
    default:
      return "bg-black/5 text-black/60";
  }
}

function ExpertCard({
  entry,
  acknowledged,
}: {
  entry: StudioExpertDeskEntry;
  acknowledged: boolean;
}) {
  const canLaunch = entry.studioExecutionAllowed && (entry.tier === "certified" || acknowledged);
  const launchHref =
    entry.key === "literary_agent" && canLaunch
      ? `/manuscripts/${entry.key}` // placeholder — parent passes book link
      : null;

  return (
    <article className="rounded-xl border border-black/10 bg-paper p-4 shadow-sm dark:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-serif text-lg font-semibold">{entry.displayName}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tierTone(entry.tier)}`}>
          {entry.tierLabel}
        </span>
      </div>
      <p className="mt-2 text-sm text-black/65 dark:text-white/65">{entry.purpose}</p>
      {entry.experimentalNotice ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {entry.experimentalNotice}
        </p>
      ) : null}
      <dl className="mt-3 grid gap-1 text-xs text-black/55 dark:text-white/55">
        <div>
          <dt className="inline font-medium">Runtime: </dt>
          <dd className="inline">{entry.expectedRuntime}</dd>
        </div>
        {entry.estimatedCost ? (
          <div>
            <dt className="inline font-medium">Cost: </dt>
            <dd className="inline">{entry.estimatedCost}</dd>
          </div>
        ) : null}
        <div>
          <dt className="inline font-medium">Scope: </dt>
          <dd className="inline">{entry.scopeOptions.join(", ")}</dd>
        </div>
      </dl>
      {entry.placeholder ? (
        <p className="mt-3 text-xs text-black/45">Placeholder — not yet in StoryDNA registry.</p>
      ) : entry.tier === "certified" ? (
        <p className="mt-3 text-xs text-emerald-800">Launches through canonical review workflow.</p>
      ) : (
        <p className="mt-3 text-xs text-black/45">{entry.limitations[0]}</p>
      )}
      {launchHref ? null : (
        <button
          type="button"
          disabled
          className="mt-4 w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-black/40"
        >
          {entry.tier === "certified" ? "Launch from Book Workspace" : "Not executable in K1"}
        </button>
      )}
    </article>
  );
}

export function ExpertDeskClient({
  bookId,
  groups,
}: {
  bookId: string;
  groups: Record<string, readonly StudioExpertDeskEntry[]>;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  const sections = [
    { key: "certified", title: "Certified" },
    { key: "validated", title: "Validated" },
    { key: "experimental", title: "Experimental" },
    { key: "advisory_only", title: "Advisory Only" },
    { key: "placeholder", title: "Coming Soon" },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-1"
          />
          <span>
            I understand experimental and advisory experts are for private Kevin Track use only.
            They are not commercially certified and do not alter StoryDNA production controls.
          </span>
        </label>
      </div>

      {sections.map(({ key, title }) => {
        const entries = groups[key] ?? [];
        if (entries.length === 0) return null;
        return (
          <section key={key}>
            <h3 className="mb-3 font-serif text-xl font-semibold">{title}</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {entries.map((entry) => (
                <ExpertCard key={entry.key} entry={entry} acknowledged={acknowledged} />
              ))}
            </div>
          </section>
        );
      })}

      <p className="text-sm text-black/50">
        Certified Literary Agent reviews launch from the{" "}
        <Link href={`/manuscripts/${bookId}`} className="text-accent hover:underline">
          commercial manuscript workspace
        </Link>{" "}
        using existing execution controls.
      </p>
    </div>
  );
}
