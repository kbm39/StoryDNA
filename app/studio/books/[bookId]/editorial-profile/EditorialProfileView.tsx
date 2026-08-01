import { AUTHOR_FACING_SECTION_ORDER } from "@/lib/editorial-profile/author-facing-contract.ts";
import type { StudioEditorialProfilePresentation } from "@/lib/studio/editorial-profile-presentation.ts";
import { ConfidenceUncertaintySection } from "./ConfidenceUncertaintySection.tsx";
import { EditorialProfileHeaderFromPresentation } from "./EditorialProfileHeader.tsx";
import { EditorialProfileNextSteps } from "./EditorialProfileNextSteps.tsx";
import { EditorialRisksSection } from "./EditorialRisksSection.tsx";
import { EditorialUnderstandingSection } from "./EditorialUnderstandingSection.tsx";
import { ImprovementOpportunitiesSection } from "./ImprovementOpportunitiesSection.tsx";
import { ManuscriptCharacteristicsSection } from "./ManuscriptCharacteristicsSection.tsx";
import { ProtectedAssetsSection } from "./ProtectedAssetsSection.tsx";
import { RoadmapPreparationSection } from "./RoadmapPreparationSection.tsx";
import { SpecialistSupportSection } from "./SpecialistSupportSection.tsx";
import { StrengthsSection } from "./StrengthsSection.tsx";

type Props = {
  presentation: StudioEditorialProfilePresentation;
};

export function EditorialProfileView({ presentation }: Props) {
  const sectionOrder = presentation.sections.map((section) => section.section_key);
  if (sectionOrder.join(",") !== AUTHOR_FACING_SECTION_ORDER.join(",")) {
    throw new Error("Editorial Profile sections are out of required presentation order");
  }

  return (
    <article className="space-y-10" aria-label="Editorial Profile">
      <EditorialProfileHeaderFromPresentation presentation={presentation} />
      <nav aria-label="Profile sections" className="rounded-lg border border-black/8 px-4 py-3 dark:border-white/8">
        <p className="text-xs font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
          On this page
        </p>
        <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {presentation.sections.map((section) => (
            <li key={section.section_key}>
              <a
                href={`#${section.section_key.replace(/_/g, "-")}`}
                className="text-accent hover:underline"
              >
                {section.display_order}. {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="space-y-12">
        <EditorialUnderstandingSection content={presentation.editorialUnderstanding} />
        <StrengthsSection items={presentation.whatIsWorking} />
        <ProtectedAssetsSection items={presentation.protectedAssets} />
        <ImprovementOpportunitiesSection items={presentation.improvementOpportunities} />
        <EditorialRisksSection items={presentation.editorialRisks} />
        <ManuscriptCharacteristicsSection items={presentation.manuscriptCharacteristics} />
        <SpecialistSupportSection items={presentation.recommendedSpecialistSupport} />
        <RoadmapPreparationSection content={presentation.roadmapPreparation} />
        <ConfidenceUncertaintySection content={presentation.confidenceAndUncertainty} />
        <EditorialProfileNextSteps content={presentation.whatHappensNext} />
      </div>
    </article>
  );
}
