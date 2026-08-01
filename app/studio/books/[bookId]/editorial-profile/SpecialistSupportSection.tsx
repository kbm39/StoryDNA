import { AUTHOR_FACING_SPECIALIST_FRAMING } from "@/lib/editorial-profile/author-facing-contract.ts";
import type { AuthorFacingSpecialistRecommendation } from "@/lib/editorial-profile/author-facing-types.ts";
import { confidenceTone, SectionShell, UncertaintyNotes } from "./presentation-utils.tsx";

export function SpecialistSupportSection({
  items,
}: {
  items: readonly AuthorFacingSpecialistRecommendation[];
}) {
  return (
    <SectionShell id="recommended-specialist-support" title="Recommended Specialist Support">
      <p className="text-[0.9375rem] leading-relaxed text-black/75 dark:text-white/75">
        {AUTHOR_FACING_SPECIALIST_FRAMING}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-black/55 dark:text-white/55">
          No specialist support areas recommended at this time.
        </p>
      ) : (
        <ul className="space-y-6">
          {items.map((item) => (
            <li key={item.recommendation_id} className="rounded-lg border border-black/8 px-5 py-4 dark:border-white/8">
              <h3 className="font-medium text-black/85 dark:text-white/85">{item.capability_area}</h3>
              <p className="mt-2 text-sm leading-relaxed text-black/70 dark:text-white/70">
                {item.demonstrated_need}
              </p>
              <p className="mt-2 text-sm text-black/65 dark:text-white/65">{item.why_it_may_help}</p>
              <p className="mt-2 text-sm text-black/60 dark:text-white/60">{item.evidence_summary}</p>
              <p className={`mt-2 text-sm ${confidenceTone(item.confidence)}`}>{item.confidence_label}</p>
              {item.suggested_timing ? (
                <p className="mt-2 text-sm text-black/55 dark:text-white/55">
                  Suggested timing: {item.suggested_timing}
                </p>
              ) : null}
              <UncertaintyNotes notes={item.uncertainty_notes} />
              <div className="mt-4 space-y-1 border-t border-black/8 pt-3 text-xs text-black/50 dark:border-white/8 dark:text-white/50">
                <p>Specialist not activated.</p>
                <p>Manuscript not shared.</p>
                <p>Recommendation only — no action required from this screen.</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}
