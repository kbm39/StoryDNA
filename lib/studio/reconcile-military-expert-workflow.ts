import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  getWorkflowById,
  markWorkflowFailed,
  updateWorkflowRow,
} from "@/lib/editorial-workflow/workflow-store.ts";
import { safeErrorForCode } from "@/lib/editorial-workflow/safe-errors.ts";
import {
  classifyAuthoritativeResultIdValue,
  INVALID_AUTHORITATIVE_RESULT_ID,
} from "@/lib/editorial-workflow/authoritative-result-id.ts";
import { ACTIVE_WORKFLOW_STATUSES } from "@/lib/editorial-workflow/types.ts";

export interface ReconcileMilitaryExpertWorkflowResult {
  readonly workflowId: string;
  readonly action: "none" | "marked_failed";
  readonly previousStatus: string;
  readonly reviewPersisted: boolean;
  readonly errorCode: string | null;
}

export interface ReconcileMilitaryExpertWorkflowDeps {
  readonly supabase: SupabaseClient;
  readonly getWorkflow?: typeof getWorkflowById;
  readonly markFailed?: typeof markWorkflowFailed;
  readonly updateRow?: typeof updateWorkflowRow;
}

function defaultDeps(): ReconcileMilitaryExpertWorkflowDeps {
  return {
    supabase: getSupabaseAdmin(),
    getWorkflow: getWorkflowById,
    markFailed: markWorkflowFailed,
    updateRow: updateWorkflowRow,
  };
}

async function countActiveMilitaryExpertWorkflows(
  supabase: SupabaseClient,
): Promise<number> {
  const { count, error } = await supabase
    .from("editorial_workflows")
    .select("*", { count: "exact", head: true })
    .eq("workflow_type", "military_expert_review")
    .in("status", [...ACTIVE_WORKFLOW_STATUSES]);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function reconcileStuckMilitaryExpertWorkflow(
  workflowId: string,
  deps: ReconcileMilitaryExpertWorkflowDeps = defaultDeps(),
): Promise<ReconcileMilitaryExpertWorkflowResult> {
  const getWorkflow = deps.getWorkflow ?? getWorkflowById;
  const markFailed = deps.markFailed ?? markWorkflowFailed;
  const updateRow = deps.updateRow ?? updateWorkflowRow;

  const workflow = await getWorkflow(workflowId);
  if (!workflow || workflow.workflow_type !== "military_expert_review") {
    return Object.freeze({
      workflowId,
      action: "none",
      previousStatus: workflow?.status ?? "missing",
      reviewPersisted: false,
      errorCode: null,
    });
  }

  const { data: reviewRow } = await deps.supabase
    .from("studio_military_expert_draft_reviews")
    .select("id")
    .eq("workflow_id", workflowId)
    .maybeSingle();

  const reviewPersisted = Boolean(reviewRow?.id);
  const authoritativeClassification = workflow.authoritative_result_id
    ? classifyAuthoritativeResultIdValue(workflow.authoritative_result_id)
    : null;

  const needsFailureReconciliation =
    !reviewPersisted &&
    (ACTIVE_WORKFLOW_STATUSES as readonly string[]).includes(workflow.status);

  const needsInvalidAuthoritativeCleanup =
    authoritativeClassification === "sha256_hex" ||
    authoritativeClassification === "invalid";

  if (!needsFailureReconciliation && !needsInvalidAuthoritativeCleanup) {
    return Object.freeze({
      workflowId,
      action: "none",
      previousStatus: workflow.status,
      reviewPersisted,
      errorCode: null,
    });
  }

  const errorCode = needsInvalidAuthoritativeCleanup
    ? INVALID_AUTHORITATIVE_RESULT_ID
    : "COMPLETION_FILING_FAILED";

  await markFailed({
    workflowId,
    errorCode,
    safeErrorMessage: safeErrorForCode(
      errorCode,
      "Military Expert completion filing failed before results could be published.",
    ),
  });

  await updateRow(workflowId, {
    current_phase: null,
    authoritative_result_id: null,
    authoritative_result_type: null,
  });

  return Object.freeze({
    workflowId,
    action: "marked_failed",
    previousStatus: workflow.status,
    reviewPersisted,
    errorCode,
  });
}

export async function reconcileStuckMilitaryExpertWorkflowById(
  workflowId: string,
): Promise<ReconcileMilitaryExpertWorkflowResult> {
  return reconcileStuckMilitaryExpertWorkflow(workflowId);
}

export async function getActiveMilitaryExpertWorkflowCount(
  deps: ReconcileMilitaryExpertWorkflowDeps = defaultDeps(),
): Promise<number> {
  return countActiveMilitaryExpertWorkflows(deps.supabase);
}
