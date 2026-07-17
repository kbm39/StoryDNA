"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  cancelPublishingWorkflow,
  type WorkflowClientView,
} from "@/app/actions/editorial-workflows";
import { workflowDisplayName } from "@/lib/editorial-workflow/phase-labels";
import { useWorkflowSubscription } from "./useWorkflowSubscription";

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const ACTIVE = new Set(["queued", "preparing", "running", "waiting", "paused"]);

export default function PublishingWorkflowCard({
  initialWorkflow,
  workflowType = "literary_agent_review",
}: {
  initialWorkflow: WorkflowClientView | null;
  workflowType?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);
  const { workflow } = useWorkflowSubscription(initialWorkflow);

  useEffect(() => {
    if (workflow?.status === "completed") {
      router.refresh();
    }
  }, [workflow?.status, router]);

  if (!workflow) return null;

  const name = workflowDisplayName(workflowType);
  const isActive = ACTIVE.has(workflow.status);
  const canCancel =
    isActive &&
    workflow.status !== "queued" &&
    !workflow.cancellationRequestedAt &&
    !workflow.cancelledAt;

  function cancel() {
    setCancelMsg(null);
    start(async () => {
      const result = await cancelPublishingWorkflow(workflow!.id);
      if (!result.ok) setCancelMsg(result.error ?? "Could not cancel.");
      else
        setCancelMsg(
          "Cancellation requested. We'll stop before preparing your results when the current step finishes.",
        );
    });
  }

  return (
    <div className="mb-4 rounded-lg border border-accent/30 bg-accent/5 p-4 dark:border-accent/40 dark:bg-accent/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Publishing Workflow</p>
          <h3 className="text-base font-semibold text-black dark:text-white">{name}</h3>
          {workflow.ownerLabel && (
            <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">
              {workflow.department ? `${workflow.department} · ` : ""}
              {workflow.ownerLabel}
            </p>
          )}
          <p className="mt-1 text-sm text-black/70 dark:text-white/70">
            {workflow.progressSummary ?? "Publishing Workflow"}
          </p>
        </div>
        {canCancel && (
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
          >
            Cancel
          </button>
        )}
      </div>

      <dl className="mt-3 grid gap-1 text-xs text-black/60 dark:text-white/60 sm:grid-cols-2">
        <div>
          <dt className="inline font-medium">Started: </dt>
          <dd className="inline">{fmtWhen(workflow.startedAt ?? workflow.queuedAt)}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Last update: </dt>
          <dd className="inline">
            {fmtWhen(workflow.heartbeatAt ?? workflow.startedAt ?? workflow.queuedAt)}
          </dd>
        </div>
      </dl>

      {isActive && (
        <p className="mt-3 text-sm text-black/75 dark:text-white/75">
          You can leave this page — StoryDNA will keep working and save your results here.
        </p>
      )}

      {workflow.status === "completed" && workflow.authoritativeResultId && (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {workflow.nextBestAction ?? "Your Literary Agent review is ready."}{" "}
          <Link
            href={`#reviews`}
            className="font-medium underline"
            onClick={() => router.refresh()}
          >
            View review
          </Link>
          {workflow.resultSummary && typeof workflow.resultSummary.issueCount === "number" && (
            <>
              {" "}
              ({workflow.resultSummary.issueCount as number} issue
              {(workflow.resultSummary.issueCount as number) === 1 ? "" : "s"},{" "}
              {workflow.resultSummary.candidateCount as number} candidate
              {(workflow.resultSummary.candidateCount as number) === 1 ? "" : "s"})
            </>
          )}
        </p>
      )}

      {(workflow.status === "failed" || workflow.status === "waiting") && workflow.safeErrorMessage && (
        <div className="mt-3 rounded-md border border-amber-200/80 bg-amber-50/80 p-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p>{workflow.safeErrorMessage}</p>
          {workflow.status === "failed" && (
            <p className="mt-2 text-xs opacity-90">
              No changes were made to your manuscript. Retrying will run the assessment again and may
              use additional model capacity.
            </p>
          )}
        </div>
      )}

      {workflow.status === "cancelled" && (
        <p className="mt-3 text-sm text-black/70 dark:text-white/70">
          This Publishing Workflow was cancelled. No new review was published.
        </p>
      )}

      {cancelMsg && (
        <p className="mt-2 text-sm text-black/70 dark:text-white/70" role="status">
          {cancelMsg}
        </p>
      )}
    </div>
  );
}
