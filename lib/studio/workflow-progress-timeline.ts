import { authorPhaseLabel } from "@/lib/editorial-workflow/phase-labels.ts";
import type { InternalPhase, WorkflowType } from "@/lib/editorial-workflow/types.ts";

export type WorkflowTimelineStepState = "completed" | "current" | "upcoming" | "failed";

export interface WorkflowTimelineStep {
  readonly id: string;
  readonly label: string;
  readonly state: WorkflowTimelineStepState;
  readonly timestamp: string | null;
}

export interface WorkflowActivityEntry {
  readonly id: string;
  readonly label: string;
  readonly timestamp: string;
  readonly tone: "neutral" | "progress" | "issue";
}

export interface WorkflowEventRecord {
  readonly eventType: string;
  readonly phase: string | null;
  readonly payload: Record<string, unknown>;
  readonly createdAt: string;
}

interface ProgressStepDefinition {
  readonly id: string;
  readonly label: string;
  readonly phaseKeys?: readonly InternalPhase[];
}

const MILITARY_EXPERT_STEPS: readonly ProgressStepDefinition[] = [
  { id: "queued", label: "Review queued" },
  { id: "validating", label: "Checking your manuscript", phaseKeys: ["validating"] },
  { id: "memo_generation", label: "Reading the manuscript", phaseKeys: ["memo_generation"] },
  {
    id: "assessment_validation",
    label: "Validating the assessment",
    phaseKeys: ["memo_repair", "contrary_evidence", "rubric_validation"],
  },
  { id: "complete", label: "Complete", phaseKeys: ["publishing", "completed"] },
];

const LITERARY_AGENT_STEPS: readonly ProgressStepDefinition[] = [
  { id: "queued", label: "Review queued" },
  { id: "validating", label: "Checking your manuscript", phaseKeys: ["validating", "preparing"] },
  { id: "memo_generation", label: "Reading the manuscript", phaseKeys: ["memo_generation"] },
  { id: "memo_repair", label: "Developing the assessment", phaseKeys: ["memo_repair"] },
  { id: "contrary_evidence", label: "Checking the findings", phaseKeys: ["contrary_evidence"] },
  { id: "rubric_generation", label: "Developing the assessment", phaseKeys: ["rubric_generation"] },
  { id: "rubric_validation", label: "Checking the findings", phaseKeys: ["rubric_validation"] },
  { id: "revision_candidates", label: "Developing the assessment", phaseKeys: ["revision_candidates"] },
  { id: "publishing", label: "Preparing your results", phaseKeys: ["publishing"] },
  { id: "complete", label: "Complete", phaseKeys: ["completed"] },
];

function stepsForWorkflowType(workflowType: WorkflowType): readonly ProgressStepDefinition[] {
  return workflowType === "military_expert_review" ? MILITARY_EXPERT_STEPS : LITERARY_AGENT_STEPS;
}

function currentStepIndex(args: {
  workflowType: WorkflowType;
  status: string;
  currentPhase: InternalPhase | null;
  events: readonly WorkflowEventRecord[];
}): number {
  const steps = stepsForWorkflowType(args.workflowType);
  if (args.status === "queued") return 0;

  const hasParseFailed = args.events.some((event) => event.eventType === "parse_failed");
  const phase = args.currentPhase;

  if (args.status === "completed") return steps.length - 1;

  if (hasParseFailed) {
    const validationIndex = steps.findIndex((step) => step.id === "assessment_validation");
    if (validationIndex >= 0) return validationIndex;
  }

  if (phase) {
    for (let index = steps.length - 1; index >= 0; index -= 1) {
      const step = steps[index]!;
      if (step.phaseKeys?.includes(phase)) return index;
    }
  }

  if (args.events.some((event) => event.eventType === "started")) {
    return Math.max(1, steps.findIndex((step) => step.id === "validating"));
  }

  return 0;
}

function timestampForStep(
  step: ProgressStepDefinition,
  events: readonly WorkflowEventRecord[],
): string | null {
  if (step.id === "queued") {
    return events.find((event) => event.eventType === "queued")?.createdAt ?? null;
  }
  if (step.id === "complete") {
    return (
      events.find((event) => event.eventType === "completed")?.createdAt ??
      events.find((event) => event.eventType === "failed")?.createdAt ??
      null
    );
  }
  if (step.phaseKeys?.length) {
    for (const phase of step.phaseKeys) {
      const match = [...events]
        .reverse()
        .find((event) => event.eventType === "phase_changed" && event.phase === phase);
      if (match) return match.createdAt;
    }
  }
  if (step.id === "assessment_validation") {
    return events.find((event) => event.eventType === "parse_failed")?.createdAt ?? null;
  }
  return events.find((event) => event.eventType === "started")?.createdAt ?? null;
}

export function buildWorkflowProgressTimeline(args: {
  workflowType: WorkflowType;
  status: string;
  currentPhase: InternalPhase | null;
  isTerminal: boolean;
  events: readonly WorkflowEventRecord[];
}): WorkflowTimelineStep[] {
  const steps = stepsForWorkflowType(args.workflowType);
  const activeIndex = currentStepIndex(args);
  const failed = args.status === "failed" || args.status === "cancelled";

  return steps.map((step, index) => {
    let state: WorkflowTimelineStepState = "upcoming";
    if (index < activeIndex) state = "completed";
    else if (index === activeIndex) {
      if (failed && args.isTerminal) state = "failed";
      else if (args.status === "completed" && index === steps.length - 1) state = "completed";
      else state = "current";
    } else if (args.status === "completed") {
      state = "completed";
    }

    return Object.freeze({
      id: step.id,
      label: step.label,
      state,
      timestamp: timestampForStep(step, args.events),
    });
  });
}

function eventActivityLabel(event: WorkflowEventRecord): { label: string; tone: WorkflowActivityEntry["tone"] } {
  switch (event.eventType) {
    case "queued":
      return { label: "Review queued", tone: "neutral" };
    case "trigger_run_linked":
      return { label: "Background worker connected", tone: "progress" };
    case "started":
      return { label: "Review started", tone: "progress" };
    case "phase_changed":
      return {
        label:
          (typeof event.payload.progress_summary === "string" && event.payload.progress_summary) ||
          authorPhaseLabel(event.phase as InternalPhase | null),
        tone: "progress",
      };
    case "parse_failed":
      return { label: "Validating provider response", tone: "issue" };
    case "completed":
      return { label: "Review complete", tone: "progress" };
    case "failed":
      return { label: "Review could not be completed", tone: "issue" };
    case "cancel_requested":
    case "cancelled":
      return { label: "Review cancelled", tone: "issue" };
    case "waiting":
      return { label: "Waiting to continue", tone: "neutral" };
    default:
      return { label: "Workflow update", tone: "neutral" };
  }
}

export function buildWorkflowActivityLog(
  events: readonly WorkflowEventRecord[],
  limit = 8,
): WorkflowActivityEntry[] {
  return [...events]
    .slice(-limit)
    .reverse()
    .map((event, index) => {
      const { label, tone } = eventActivityLabel(event);
      return Object.freeze({
        id: `${event.createdAt}-${event.eventType}-${index}`,
        label,
        timestamp: event.createdAt,
        tone,
      });
    });
}

export function formatWorkflowElapsed(startIso: string | null | undefined, endIso?: string | null): string {
  if (!startIso) return "—";
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const ms = Math.max(0, end - start);
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min === 0) return `${remSec}s`;
  return `${min}m ${remSec}s`;
}

export function pickActiveStudioWorkflow<T extends { isTerminal: boolean }>(
  literary: T | null,
  military: T | null,
): T | null {
  if (literary && !literary.isTerminal) return literary;
  if (military && !military.isTerminal) return military;
  return literary ?? military;
}
