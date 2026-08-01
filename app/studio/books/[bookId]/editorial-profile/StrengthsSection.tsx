import type { AuthorFacingStrengthEntry } from "@/lib/editorial-profile/author-facing-types.ts";
import { confidenceTone, EvidenceList, SectionShell, UncertaintyNotes } from "./presentation-utils.tsx";

export function StrengthsSection({ items }: { items: readonly AuthorFacingStrengthEntry[] }) {
  if (items.length === 0) {
    return (
      <SectionShell id="what-is-working" title="What Is Working">
        <p className="text-sm text-black/55 dark:text-white/55">
          No strengths recorded in this profile yet.
        </p>
      </SectionShell>
    );
  }

  return (
    <SectionShell id="what-is-working" title="What Is Working">
      <ul className="space-y-6">
        {items.map((item) => (
          <li key={item.entry_id} className="rounded-lg border border-black/8 px-5 py-4 dark:border-white/8">
            <h3 className="font-medium text-black/85 dark:text-white/85">{item.statement}</h3>
            <p className="mt-2 text-sm leading-relaxed text-black/70 dark:text-white/70">
              {item.why_it_works}
            </p>
            <p className={`mt-2 text-sm ${confidenceTone(item.confidence)}`}>{item.confidence_label}</p>
            <EvidenceList items={item.evidence} />
            <UncertaintyNotes notes={item.uncertainty_notes} />
            {item.related_protected_asset_id ? (
              <p className="mt-2 text-xs text-black/50 dark:text-white/50">
                Connected to a protected asset in this profile.
              </p>
            ) : item.may_become_protected_asset ? (
              <p className="mt-2 text-xs text-black/50 dark:text-white/50">
                This strength may warrant protection in later editorial planning.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
