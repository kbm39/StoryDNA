"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RevisionGenerationStatus } from "@/app/actions/agent-revisions";
import type { WorkflowClientView } from "@/app/actions/editorial-workflows";
import ExpertTeamSelector, {
  type SelectedExpertKeys,
} from "@/app/components/reviews/ExpertTeamSelector.tsx";
import {
  createDefaultExpertSelection,
  hasLaunchableSelection,
} from "@/lib/expert-team-selection.ts";
import RunAgentReviewButton from "./RunAgentReviewButton";
import PublishingWorkflowCard from "./PublishingWorkflowCard";

export default function LiteraryAgentPublishingSection({
  manuscriptId,
  hasReview,
  generationStatus,
  workflowEnabled,
  initialActiveWorkflow,
}: {
  manuscriptId: string;
  hasReview: boolean;
  generationStatus: RevisionGenerationStatus;
  workflowEnabled: boolean;
  initialActiveWorkflow: WorkflowClientView | null;
}) {
  const router = useRouter();
  const [selectedExperts, setSelectedExperts] = useState<SelectedExpertKeys>(() =>
    createDefaultExpertSelection(),
  );

  const hasActive =
    Boolean(initialActiveWorkflow) &&
    !initialActiveWorkflow!.isTerminal &&
    ["queued", "preparing", "running", "waiting", "paused"].includes(initialActiveWorkflow!.status);

  return (
    <>
      <ExpertTeamSelector
        selectedExperts={selectedExperts}
        onSelectedExpertsChange={setSelectedExperts}
      />
      {initialActiveWorkflow && (
        <PublishingWorkflowCard
          key={initialActiveWorkflow.id}
          initialWorkflow={initialActiveWorkflow}
        />
      )}
      <RunAgentReviewButton
        manuscriptId={manuscriptId}
        hasReview={hasReview}
        generationStatus={generationStatus}
        workflowEnabled={workflowEnabled}
        hasActiveWorkflow={hasActive}
        literaryAgentSelected={hasLaunchableSelection(selectedExperts)}
        onWorkflowStarted={() => {
          router.refresh();
        }}
      />
    </>
  );
}
