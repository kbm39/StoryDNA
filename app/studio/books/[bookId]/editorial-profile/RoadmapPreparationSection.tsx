import type { AuthorFacingRoadmapPreparation } from "@/lib/editorial-profile/author-facing-types.ts";
import { confidenceTone, SectionShell } from "./presentation-utils.tsx";

export function RoadmapPreparationSection({ content }: { content: AuthorFacingRoadmapPreparation }) {
  return (
    <SectionShell id="roadmap-preparation" title="Roadmap Preparation">
      <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
        {content.current_editorial_position}
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-black/70 dark:text-white/70">Likely destination</h3>
          <p className="mt-1 text-sm">{content.likely_destination}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-black/70 dark:text-white/70">Readiness considerations</h3>
          {content.readiness_considerations.length > 0 ? (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {content.readiness_considerations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-black/50 dark:text-white/50">None noted yet.</p>
          )}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-black/70 dark:text-white/70">Protected strengths</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {content.protected_strengths.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-medium text-black/70 dark:text-white/70">Principal improvement areas</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {content.principal_improvement_areas.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      {content.possible_sequencing.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-black/70 dark:text-white/70">Possible sequencing</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {content.possible_sequencing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className={`text-sm ${confidenceTone(content.confidence)}`}>{content.confidence_label}</p>
      {content.unresolved_questions.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-black/70 dark:text-white/70">Unresolved questions</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {content.unresolved_questions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-xs text-black/50 dark:text-white/50">
        Editorial Roadmap not generated. No next best action on this screen.
      </p>
    </SectionShell>
  );
}
