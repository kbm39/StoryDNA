import type { AuthorFacingProtectedAssetEntry } from "@/lib/editorial-profile/author-facing-types.ts";
import { confidenceTone, EvidenceList, SectionShell, UncertaintyNotes } from "./presentation-utils.tsx";

export function ProtectedAssetsSection({ items }: { items: readonly AuthorFacingProtectedAssetEntry[] }) {
  if (items.length === 0) {
    return (
      <SectionShell id="protected-assets" title="Protected Assets">
        <p className="text-sm text-black/55 dark:text-white/55">
          No protected assets identified yet.
        </p>
      </SectionShell>
    );
  }

  return (
    <SectionShell id="protected-assets" title="Protected Assets" className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-6 dark:border-emerald-500/20 dark:bg-emerald-500/5">
      <p className="text-sm text-black/65 dark:text-white/65">
        These elements should be preserved during revision — they support what is working on the page.
      </p>
      <ul className="space-y-6">
        {items.map((item) => (
          <li key={item.asset_id} className="rounded-lg border border-emerald-200/60 bg-white/50 px-5 py-4 dark:border-emerald-500/15 dark:bg-black/10">
            <h3 className="font-medium text-emerald-950 dark:text-emerald-50">{item.what_to_protect}</h3>
            <p className="mt-2 text-sm leading-relaxed text-black/70 dark:text-white/70">
              {item.why_it_matters}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-black/65 dark:text-white/65">
              {item.avoid_damaging}
            </p>
            <p className={`mt-2 text-sm ${confidenceTone(item.confidence)}`}>{item.confidence_label}</p>
            <EvidenceList items={item.evidence} />
            <UncertaintyNotes notes={[]} />
            {item.related_characteristic ? (
              <p className="mt-2 text-xs text-black/50 dark:text-white/50">
                Related narrative element: {item.related_characteristic}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
