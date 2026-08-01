import type { AuthorFacingEditorialRiskEntry } from "@/lib/editorial-profile/author-facing-types.ts";
import { confidenceTone, EvidenceList, SectionShell, UncertaintyNotes } from "./presentation-utils.tsx";

export function EditorialRisksSection({ items }: { items: readonly AuthorFacingEditorialRiskEntry[] }) {
  if (items.length === 0) {
    return (
      <SectionShell id="editorial-risks" title="Editorial Risks">
        <p className="text-sm text-black/55 dark:text-white/55">
          No editorial risks identified in this profile.
        </p>
      </SectionShell>
    );
  }

  return (
    <SectionShell id="editorial-risks" title="Editorial Risks">
      <ul className="space-y-6">
        {items.map((item) => (
          <li
            key={item.risk_id}
            className={`rounded-lg border px-5 py-4 ${
              item.confidence === "limited"
                ? "border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]"
                : "border-black/8 dark:border-white/8"
            }`}
          >
            <h3 className="font-medium text-black/85 dark:text-white/85">{item.risk_description}</h3>
            <p className="mt-2 text-sm leading-relaxed text-black/70 dark:text-white/70">
              {item.why_it_matters}
            </p>
            <p className="mt-2 text-sm text-black/65 dark:text-white/65">{item.potential_effect}</p>
            <p className={`mt-2 text-sm ${confidenceTone(item.confidence)}`}>{item.confidence_label}</p>
            <EvidenceList items={item.evidence} />
            <UncertaintyNotes notes={item.uncertainty_notes} />
            {item.conflicting_evidence ? (
              <p className="mt-2 text-xs text-black/50 dark:text-white/50">
                Conflicting evidence was noted during the independent read.
              </p>
            ) : null}
            {item.may_need_specialist_evaluation ? (
              <p className="mt-2 text-xs text-black/50 dark:text-white/50">
                May warrant specialist evaluation in a later step — not activated here.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
