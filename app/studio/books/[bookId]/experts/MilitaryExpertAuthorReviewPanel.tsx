"use client";

import type { MilitaryExpertAuthorReviewRequiredItem } from "@/lib/studio/military-expert-display.ts";

export function MilitaryExpertAuthorReviewPanel({
  items,
}: {
  items: readonly MilitaryExpertAuthorReviewRequiredItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div>
        <h3 className="text-sm font-semibold tracking-wide text-amber-900 dark:text-amber-100">
          Author Review Required ({items.length})
        </h3>
        <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">
          These findings were released provisionally because StoryDNA could not complete its
          confidence check.
        </p>
      </div>

      <ul className="space-y-4">
        {items.map((item) => (
          <li
            key={item.findingId}
            className="rounded-lg border border-amber-200/80 bg-white/80 p-4 dark:border-amber-500/20 dark:bg-black/20"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              {item.heading}
            </p>
            <h4 className="mt-2 text-base font-medium text-slate-900 dark:text-slate-100">
              {item.title}
            </h4>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{item.intro}</p>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{item.concern}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Supporting evidence: {item.supportingEvidenceSummary}
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600 dark:text-slate-400">
              {item.unresolvedChecks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">{item.disclaimer}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {item.actions.map((action) => (
                <button
                  key={action}
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {action}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
