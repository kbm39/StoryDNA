import type { AuthorFacingWhatHappensNext } from "@/lib/editorial-profile/author-facing-types.ts";
import { SectionShell } from "./presentation-utils.tsx";

export function EditorialProfileNextSteps({ content }: { content: AuthorFacingWhatHappensNext }) {
  return (
    <SectionShell id="what-happens-next" title="What Happens Next">
      <p className="text-[0.9375rem] leading-relaxed text-black/75 dark:text-white/75">{content.summary}</p>
      <ul className="mt-4 space-y-2 text-sm text-black/65 dark:text-white/65">
        <li>No specialist has been activated.</li>
        <li>No manuscript has been shared.</li>
        <li>Recommendations remain recommendations until you choose otherwise.</li>
        <li>You retain final authority over editorial decisions.</li>
        <li>Your Editorial Roadmap is a later step — not shown here.</li>
      </ul>
      <p className="mt-4 text-sm leading-relaxed text-black/70 dark:text-white/70">
        {content.author_control_statement}
      </p>
    </SectionShell>
  );
}
