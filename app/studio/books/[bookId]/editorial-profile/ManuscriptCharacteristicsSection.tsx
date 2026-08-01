import type { AuthorFacingManuscriptCharacteristic } from "@/lib/editorial-profile/author-facing-types.ts";
import { confidenceTone, EvidenceList, SectionShell, UncertaintyNotes } from "./presentation-utils.tsx";

const CATEGORY_LABELS: Record<AuthorFacingManuscriptCharacteristic["category"], string> = {
  story_identity: "Story Identity",
  story_engine: "Story Engine",
  editorial: "Editorial",
  technical: "Technical",
  emotional: "Emotional",
  commercial: "Commercial",
};

export function ManuscriptCharacteristicsSection({
  items,
}: {
  items: readonly AuthorFacingManuscriptCharacteristic[];
}) {
  const grouped = items.reduce<Record<string, AuthorFacingManuscriptCharacteristic[]>>((acc, item) => {
    const label = CATEGORY_LABELS[item.category];
    acc[label] = acc[label] ?? [];
    acc[label].push(item);
    return acc;
  }, {});

  return (
    <SectionShell id="manuscript-characteristics" title="Manuscript Characteristics">
      <div className="space-y-8">
        {Object.entries(grouped).map(([category, entries]) => (
          <div key={category}>
            <h3 className="text-sm font-medium uppercase tracking-wide text-black/55 dark:text-white/55">
              {category}
            </h3>
            <ul className="mt-3 space-y-5">
              {entries.map((item) => (
                <li key={item.characteristic_id} className="rounded-lg border border-black/8 px-5 py-4 dark:border-white/8">
                  <h4 className="font-medium text-black/85 dark:text-white/85">{item.name}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-black/70 dark:text-white/70">
                    {item.interpretation}
                  </p>
                  <p className="mt-2 text-sm text-black/60 dark:text-white/60">{item.why_it_matters}</p>
                  <p className={`mt-2 text-sm ${confidenceTone(item.confidence)}`}>{item.confidence_label}</p>
                  <EvidenceList items={item.evidence} />
                  <UncertaintyNotes notes={item.uncertainty_notes} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
