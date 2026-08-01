import type { AuthorFacingEditorialUnderstanding } from "@/lib/editorial-profile/author-facing-types.ts";
import { SectionShell, UncertaintyNotes } from "./presentation-utils.tsx";

export function EditorialUnderstandingSection({
  content,
}: {
  content: AuthorFacingEditorialUnderstanding;
}) {
  return (
    <SectionShell id="editorial-understanding" title="Editorial Understanding">
      <p className="text-[0.9375rem] leading-relaxed text-black/75 dark:text-white/75">
        {content.opening_copy}
      </p>
      <div className="space-y-4 text-[0.9375rem] leading-relaxed text-black/80 dark:text-white/80">
        <p>{content.synthesis_narrative}</p>
        <div>
          <h3 className="text-sm font-medium text-black/70 dark:text-white/70">Story kind</h3>
          <p className="mt-1">{content.story_kind}</p>
        </div>
        {content.narrative_drivers.length > 0 ? (
          <div>
            <h3 className="text-sm font-medium text-black/70 dark:text-white/70">Narrative drivers</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {content.narrative_drivers.map((driver) => (
                <li key={driver}>{driver}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {content.emotional_experience.length > 0 ? (
          <div>
            <h3 className="text-sm font-medium text-black/70 dark:text-white/70">Emotional experience</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {content.emotional_experience.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {content.author_intention_summary ? (
          <div>
            <h3 className="text-sm font-medium text-black/70 dark:text-white/70">Your goal</h3>
            <p className="mt-1">{content.author_intention_summary}</p>
          </div>
        ) : null}
        <div>
          <h3 className="text-sm font-medium text-black/70 dark:text-white/70">Intention and execution</h3>
          <p className="mt-1">{content.alignment_summary}</p>
          {content.alignment_differences.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {content.alignment_differences.map((diff) => (
                <li key={diff}>{diff}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <UncertaintyNotes notes={content.uncertainty_notes} />
      </div>
    </SectionShell>
  );
}
