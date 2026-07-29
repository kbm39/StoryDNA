import "server-only";
import { getWorkflowForClient } from "@/lib/editorial-workflow/start-literary-agent-workflow.ts";
import { isEditorialWorkflowEnabled } from "@/lib/editorial-workflow/feature-flag.ts";
import { getActiveWorkflowForManuscript, getWorkflowEventsForClient } from "@/lib/editorial-workflow/workflow-store.ts";
import { authorPhaseLabel } from "@/lib/editorial-workflow/phase-labels.ts";
import type { InternalPhase } from "@/lib/editorial-workflow/types.ts";
import { getEditorialIssues, getRevisionCandidates } from "@/lib/agent-revisions.ts";
import { listReviews } from "@/lib/reviews.ts";
import { getAuthorEditResponses } from "@/lib/suggested-edits.ts";
import { countAcceptedRevisions, mapDbDispositionToStudio } from "./decisions.ts";
import { getEditorialTeamMembers } from "./editorial-team.ts";
import { classifyExpertExecution } from "./expert-classification.ts";
import { isStudioMilitaryExpertLocalOverrideEnabled } from "@/lib/studio/military-expert-local-policy.ts";
import { resolveMilitaryExpertTeamRunStatus } from "@/lib/studio/military-expert-draft-review-view.ts";
import { buildStudioCostSummary } from "./cost-tracking.ts";
import { buildRoundtableShell } from "./roundtable.ts";
import {
  buildWorkflowActivityLog,
  buildWorkflowProgressTimeline,
  pickActiveStudioWorkflow,
} from "./workflow-progress-timeline.ts";
import type {
  StudioEditorialTeamMember,
  StudioExpertRunStatus,
  StudioReviewExecutionView,
  StudioWorkflowProgressView,
} from "./types.ts";

function mapWorkflowStatusToRunStatus(
  status: string | null | undefined,
): StudioExpertRunStatus {
  switch (status) {
    case "queued":
      return "queued";
    case "preparing":
    case "running":
      return "running";
    case "waiting":
    case "paused":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "waiting";
  }
}

function elapsedMs(startIso: string | null | undefined, endIso?: string | null): number | null {
  if (!startIso) return null;
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  return Math.max(0, end - start);
}

function formatElapsed(ms: number | null): string {
  if (ms === null) return "—";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min === 0) return `${remSec}s`;
  return `${min}m ${remSec}s`;
}

export async function getStudioReviewExecution(
  manuscriptId: string,
  workflowType: "literary_agent_review" | "military_expert_review" = "literary_agent_review",
): Promise<StudioReviewExecutionView | null> {
  if (workflowType === "literary_agent_review" && !isEditorialWorkflowEnabled()) return null;
  if (workflowType === "military_expert_review" && !isStudioMilitaryExpertLocalOverrideEnabled()) {
    return null;
  }

  let row;
  try {
    row = await getActiveWorkflowForManuscript({
      manuscriptId,
      workflowType,
    });
  } catch {
    return null;
  }
  if (!row) return null;

  const workflow = await getWorkflowForClient(row.id);
  if (!workflow) return null;

  const phaseLabel = authorPhaseLabel(workflow.currentPhase as Parameters<typeof authorPhaseLabel>[0]);
  const publishing = workflow.currentPhase === "publishing";
  const statusLabel =
    workflow.status === "queued"
      ? "Queued"
      : workflow.status === "running" || workflow.status === "preparing"
        ? "Running"
        : publishing
          ? "Publishing"
          : workflow.status === "completed"
            ? "Completed"
            : workflow.status === "failed"
              ? "Failed"
              : workflow.status === "cancelled"
                ? "Cancelled"
                : workflow.status;

  return Object.freeze({
    workflowId: workflow.id,
    workflowType,
    expertKey: workflowType === "military_expert_review" ? "military_expert" : "literary_agent",
    expertDisplayName: workflowType === "military_expert_review" ? "Military Expert" : "Literary Agent",
    status: workflow.status,
    statusLabel,
    currentPhase: workflow.currentPhase,
    currentPhaseLabel: phaseLabel,
    progressSummary: workflow.progressSummary,
    safeErrorMessage: workflow.safeErrorMessage,
    startedAt: workflow.startedAt ?? workflow.queuedAt,
    elapsed: formatElapsed(elapsedMs(workflow.startedAt ?? workflow.queuedAt, workflow.completedAt)),
    isTerminal: workflow.isTerminal,
    authoritativeResultId: workflow.authoritativeResultId,
    resultSummary: workflow.resultSummary,
    cost: buildStudioCostSummary({ workflowType: workflow.workflowType as "literary_agent_review" | "military_expert_review" }),
  });
}

export async function enrichEditorialTeamWithRunStatus(
  manuscriptId: string,
  members: readonly StudioEditorialTeamMember[],
): Promise<readonly StudioEditorialTeamMember[]> {
  const [literaryWorkflowRow, militaryWorkflowRow, reviews] = await Promise.all([
    isEditorialWorkflowEnabled()
      ? getActiveWorkflowForManuscript({
          manuscriptId,
          workflowType: "literary_agent_review",
        }).catch(() => null)
      : Promise.resolve(null),
    isStudioMilitaryExpertLocalOverrideEnabled()
      ? getActiveWorkflowForManuscript({
          manuscriptId,
          workflowType: "military_expert_review",
        }).catch(() => null)
      : Promise.resolve(null),
    listReviews(manuscriptId),
  ]);

  const literaryWorkflow = literaryWorkflowRow
    ? await getWorkflowForClient(literaryWorkflowRow.id)
    : null;
  const militaryWorkflow = militaryWorkflowRow
    ? await getWorkflowForClient(militaryWorkflowRow.id)
    : null;

  const laReviews = reviews.filter((r) =>
    r.perspective.toLowerCase().includes("literary") || r.perspective === "commercial",
  );
  const latestLaReview = laReviews[0] ?? null;

  const militaryTeamRunStatus =
    isStudioMilitaryExpertLocalOverrideEnabled()
      ? await resolveMilitaryExpertTeamRunStatus(
          manuscriptId,
          militaryWorkflow?.status ?? null,
          militaryWorkflow?.authoritativeResultId ?? null,
        )
      : null;

  return members.map((member) => {
    let runStatus: StudioExpertRunStatus = "waiting";
    let lastReviewAt: string | null = null;
    let latestReviewId: string | null = null;
    let completedReportStatusLabel: string | null = null;

    if (member.expertKey === "literary_agent") {
      if (literaryWorkflow) {
        runStatus = mapWorkflowStatusToRunStatus(literaryWorkflow.status);
      } else if (latestLaReview) {
        runStatus = "completed";
        lastReviewAt = latestLaReview.created_at;
        latestReviewId = latestLaReview.id;
      }
    } else if (member.expertKey === "military_expert") {
      if (militaryTeamRunStatus) {
        runStatus = militaryTeamRunStatus.runStatus;
        lastReviewAt = militaryTeamRunStatus.lastReviewAt;
        latestReviewId = militaryTeamRunStatus.latestReviewId;
        completedReportStatusLabel = militaryTeamRunStatus.completedReportStatusLabel;
      } else if (!isStudioMilitaryExpertLocalOverrideEnabled()) {
        runStatus = "blocked";
      }
    } else if (classifyExpertExecution(member.expertKey) === "PLACEHOLDER") {
      runStatus = "blocked";
    } else if (classifyExpertExecution(member.expertKey) === "EXPERIMENTAL") {
      runStatus = "blocked";
    }

    return Object.freeze({
      ...member,
      runStatus,
      lastReviewAt,
      latestReviewId,
      completedReportStatusLabel,
    });
  });
}

async function buildStudioWorkflowProgressView(
  workflow: StudioReviewExecutionView,
): Promise<StudioWorkflowProgressView> {
  const events = await getWorkflowEventsForClient(workflow.workflowId);
  const timeline = buildWorkflowProgressTimeline({
    workflowType: workflow.workflowType,
    status: workflow.status,
    currentPhase: (workflow.currentPhase as InternalPhase | null) ?? null,
    isTerminal: workflow.isTerminal,
    events,
  });
  return Object.freeze({
    workflow,
    timeline,
    activity: buildWorkflowActivityLog(events),
  });
}

export async function getStudioExpertDeskContext(manuscriptId: string) {
  const [members, literaryWorkflowView, militaryWorkflowView, issues, candidates, { responses }] =
    await Promise.all([
      getEditorialTeamMembers(manuscriptId),
      getStudioReviewExecution(manuscriptId, "literary_agent_review"),
      getStudioReviewExecution(manuscriptId, "military_expert_review"),
      getEditorialIssues(manuscriptId),
      getRevisionCandidates(manuscriptId),
      getAuthorEditResponses(manuscriptId),
    ]);

  const enrichedTeam = await enrichEditorialTeamWithRunStatus(manuscriptId, members);
  const accepted = countAcceptedRevisions(responses);
  const deferred = responses.filter((r) => mapDbDispositionToStudio(r.disposition) === "deferred").length;
  const rejected = responses.filter((r) => mapDbDispositionToStudio(r.disposition) === "rejected").length;
  const resolved = issues.filter((i) => i.resolution_status === "resolved").length;
  const open = issues.filter((i) => i.resolution_status !== "resolved").length;

  const roundtable = buildRoundtableShell({
    team: enrichedTeam,
    issueCount: issues.length,
    candidateCount: candidates.length,
  });

  const activeWorkflow = pickActiveStudioWorkflow(literaryWorkflowView, militaryWorkflowView);
  const workflowProgress = activeWorkflow
    ? await buildStudioWorkflowProgressView(activeWorkflow)
    : null;

  return Object.freeze({
    team: enrichedTeam,
    activeWorkflow,
    workflowProgress,
    roundtable,
    issueCount: issues.length,
    candidateCount: candidates.length,
    editorialHealth: {
      issues: issues.length,
      resolved,
      accepted,
      deferred,
      rejected,
      open,
      overallProgress: issues.length > 0 ? Math.round(((accepted + rejected + deferred) / issues.length) * 100) : 0,
    },
  });
}
