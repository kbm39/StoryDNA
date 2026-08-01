import type { AuthorFacingConfidenceSummary } from "@/lib/editorial-profile/author-facing-types.ts";
import { confidenceTone, SectionShell } from "./presentation-utils.tsx";

export function ConfidenceUncertaintySection({ content }: { content: AuthorFacingConfidenceSummary }) {
  return (
    <SectionShell id="confidence-and-uncertainty" title="Confidence and Uncertainty">
      <p className={`text-sm font-medium ${confidenceTone(content.overall_confidence)}`}>
        {content.overall_confidence_label}
      </p>
      <p className="mt-2 text-sm text-black/65 dark:text-white/65">{content.read_coverage_note}</p>
      <p className="mt-1 text-sm text-black/65 dark:text-white/65">{content.evidence_depth_note}</p>
      {content.sections_with_limited_confidence.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-black/70 dark:text-white/70">Sections with limited confidence</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {content.sections_with_limited_confidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {content.gaps_affecting_confidence.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-black/70 dark:text-white/70">Gaps affecting confidence</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {content.gaps_affecting_confidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {content.uncertainty_explanations.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-black/70 dark:text-white/70">Uncertainty notes</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {content.uncertainty_explanations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {content.unresolved_conflicts.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-black/70 dark:text-white/70">Unresolved conflicts</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {content.unresolved_conflicts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </SectionShell>
  );
}
