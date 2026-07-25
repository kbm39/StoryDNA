"use client";

import { useId, useState } from "react";
import {
  EXPERT_CATALOG_ENTRIES,
  type ExpertCatalogEntry,
} from "@/lib/expert-catalog.ts";
import {
  canToggleExpertSelection,
  createDefaultExpertSelection,
  isExpertSelected,
  type SelectedExpertKeys,
  toggleExpertSelection,
} from "@/lib/expert-team-selection.ts";

function statusTone(entry: ExpertCatalogEntry): string {
  if (entry.availability === "available") {
    return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200";
  }
  if (entry.availability === "coming_soon") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
  }
  return "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60";
}

function certificationTone(entry: ExpertCatalogEntry): string {
  if (entry.certificationStatus === "certified") {
    return "bg-indigo-100 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200";
  }
  return "bg-black/5 text-black/55 dark:bg-white/10 dark:text-white/55";
}

function ExpertCard({
  entry,
  selected,
  onToggle,
}: {
  entry: ExpertCatalogEntry;
  selected: boolean;
  onToggle: (key: ExpertCatalogEntry["key"]) => void;
}) {
  const selectable = canToggleExpertSelection(entry);
  const checkboxId = useId();
  const disabledReason = selectable
    ? undefined
    : `${entry.displayName} is ${entry.statusLabel.toLowerCase()} and cannot be selected yet.`;

  return (
    <article
      aria-labelledby={`${checkboxId}-title`}
      className={`rounded-xl border bg-paper p-5 shadow-sm dark:bg-white/5 ${
        selectable
          ? "border-black/10 dark:border-white/15"
          : "border-black/10 opacity-95 dark:border-white/15"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            id={`${checkboxId}-title`}
            className="font-serif text-lg font-semibold tracking-tight text-ink dark:text-[var(--foreground)]"
          >
            {entry.displayName}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-black/70 dark:text-white/70">
            {entry.shortDescription}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone(entry)}`}
          >
            {entry.statusLabel}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${certificationTone(entry)}`}
          >
            {entry.certificationLabel}
          </span>
        </div>
      </div>

      <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-black/60 dark:text-white/60">
        {entry.responsibilities.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <div className="mt-4 flex items-start gap-2">
        <input
          id={checkboxId}
          type="checkbox"
          className="mt-0.5 size-4 accent-accent"
          checked={selected}
          disabled={!selectable}
          aria-disabled={!selectable}
          aria-describedby={disabledReason ? `${checkboxId}-help` : undefined}
          onChange={() => {
            if (selectable) onToggle(entry.key);
          }}
        />
        <label
          htmlFor={checkboxId}
          className={`text-sm ${
            selectable
              ? "cursor-pointer text-black/80 dark:text-white/80"
              : "cursor-not-allowed text-black/50 dark:text-white/50"
          }`}
        >
          {selectable ? `Include ${entry.displayName} in this review` : "Selection unavailable"}
        </label>
      </div>
      {!selectable && (
        <p id={`${checkboxId}-help`} className="mt-2 text-xs text-black/55 dark:text-white/55">
          {disabledReason}
        </p>
      )}
      <p className="sr-only">
        Status: {entry.statusLabel}. Certification: {entry.certificationLabel}.
      </p>
    </article>
  );
}

export default function ExpertTeamSelector({
  selectedExperts,
  onSelectedExpertsChange,
}: {
  selectedExperts?: SelectedExpertKeys;
  onSelectedExpertsChange?: (next: SelectedExpertKeys) => void;
}) {
  const [internalSelected, setInternalSelected] = useState<SelectedExpertKeys>(() =>
    createDefaultExpertSelection(),
  );
  const selected = selectedExperts ?? internalSelected;

  function updateSelection(next: SelectedExpertKeys) {
    if (selectedExperts === undefined) {
      setInternalSelected(next);
    }
    onSelectedExpertsChange?.(next);
  }

  function handleToggle(key: ExpertCatalogEntry["key"]) {
    updateSelection(toggleExpertSelection(selected, key));
  }

  return (
    <section
      aria-labelledby="expert-team-heading"
      className="mb-4 rounded-xl border border-black/10 bg-paper p-5 shadow-sm dark:border-white/15 dark:bg-white/5"
    >
      <h2
        id="expert-team-heading"
        className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-black/45 dark:text-white/45"
      >
        Expert Team
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/70 dark:text-white/70">
        Choose the experts you want to review your manuscript. Available experts may be selected now.
        Additional experts will be added as they complete testing and certification.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {EXPERT_CATALOG_ENTRIES.map((entry) => (
          <ExpertCard
            key={entry.key}
            entry={entry}
            selected={isExpertSelected(selected, entry.key)}
            onToggle={handleToggle}
          />
        ))}
      </div>

      <p className="mt-5 rounded-lg border border-black/10 bg-black/[0.02] px-4 py-3 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
        Editor-in-Chief synthesis will become available when multi-expert reviews are enabled.
      </p>
    </section>
  );
}

export type { SelectedExpertKeys };
