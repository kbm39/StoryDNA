"use client";

import { useRouter } from "next/navigation";
import type { RevisionGenerationStatus } from "@/app/actions/agent-revisions";
import type { WorkflowClientView } from "@/app/actions/editorial-workflows";
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

  const hasActive =
    Boolean(initialActiveWorkflow) &&
    !initialActiveWorkflow!.isTerminal &&
    ["queued", "preparing", "running", "waiting", "paused"].includes(initialActiveWorkflow!.status);

  return (
    <>
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
        onWorkflowStarted={() => {
          router.refresh();
        }}
      />
    </>
  );
}
