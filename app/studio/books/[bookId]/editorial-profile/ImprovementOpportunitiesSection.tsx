import type { AuthorFacingImprovementOpportunity } from "@/lib/editorial-profile/author-facing-types.ts";
import { confidenceTone, EvidenceList, SectionShell, UncertaintyNotes } from "./presentation-utils.tsx";

export function ImprovementOpportunitiesSection({
  items,
}: {
  items: readonly AuthorFacingImprovementOpportunity[];
}) {
  if (items.length === 0) {
    return (
      <SectionShell id="improvement-opportunities" title="Improvement Opportunities">
        <p className="text-sm text-black/55 dark:text-white/55">
          No improvement opportunities recorded yet.
        </p>
      </SectionShell>
    );
  }

  return (
    <SectionShell id="improvement-opportunities" title="Improvement Opportunities">
      <ul className="space-y-6">
        {items.map((item) => (
          <li key={item.entry_id} className="rounded-lg border border-black/8 px-5 py-4 dark:border-white/8">
            <h3 className="font-medium text-black/85 dark:text-white/85">{item.description}</h3>
            <p className="mt-2 text-sm leading-relaxed text-black/70 dark:text-white/70">
              {item.why_it_matters}
            </p>
            {item.reader_effect ? (
              <p className="mt-2 text-sm text-black/65 dark:text-white/65">{item.reader_effect}</p>
            ) : null}
            <p className={`mt-2 text-sm ${confidenceTone(item.confidence)}`}>{item.confidence_label}</p>
            <EvidenceList items={item.evidence} />
            <UncertaintyNotes notes={item.uncertainty_notes} />
            {item.may_benefit_from_specialist ? (
              <p className="mt-2 text-xs text-black/50 dark:text-white/50">
                May benefit from specialist evaluation — recommendation only.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
