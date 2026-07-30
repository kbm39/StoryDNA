"use server";

import { revalidatePath } from "next/cache";
import { requireStudioAccess } from "@/lib/studio/access.ts";
import { isMilitaryExpertV2AvailableInStudio } from "@/lib/studio/military-expert-v2-feature-flag.ts";
import { startMilitaryExpertV2SynthesisWorkflow } from "@/lib/editorial-workflow/start-military-expert-v2-synthesis-workflow.ts";
import { validatePhase2BHandoff } from "@/lib/studio/military-expert-v2/handoff-validation.ts";
import { estimatePhase2BSynthesisBudget } from "@/lib/studio/military-expert-v2/synthesis-budget.ts";

export async function launchMilitaryExpertV2Synthesis(input: {
  manuscriptId: string;
  selectionSnapshotId: string;
  phase2aWorkflowId?: string;
}): Promise<{
  ok: boolean;
  workflowId?: string;
  error?: string;
  budgetEstimate?: ReturnType<typeof estimatePhase2BSynthesisBudget>;
}> {
  await requireStudioAccess(`/studio/books/${input.manuscriptId}/experts`);
  if (!isMilitaryExpertV2AvailableInStudio()) {
    return { ok: false, error: "Military Expert V2 synthesis is not enabled." };
  }

  const handoff = await validatePhase2BHandoff({
    selectionSnapshotId: input.selectionSnapshotId,
    phase2aWorkflowId: input.phase2aWorkflowId,
    requirePinnedSnapshot: false,
  });
  if (!handoff.ok || !handoff.inventory) {
    return { ok: false, error: handoff.errorMessage ?? "Phase 2B handoff validation failed." };
  }

  if (handoff.inventory.manuscript_id !== input.manuscriptId) {
    return { ok: false, error: "Manuscript mismatch." };
  }

  const budgetEstimate = estimatePhase2BSynthesisBudget();

  const result = await startMilitaryExpertV2SynthesisWorkflow({
    selectionSnapshotId: input.selectionSnapshotId,
    phase2aWorkflowId: input.phase2aWorkflowId,
  });

  if (result.ok) {
    revalidatePath(
      `/studio/books/${input.manuscriptId}/experts/military-expert/scene-reviews/${input.selectionSnapshotId}`,
    );
    revalidatePath(`/studio/books/${input.manuscriptId}/experts`);
  }

  return { ...result, budgetEstimate };
}

export async function getMilitaryExpertV2SynthesisBudget(input: {
  selectionSnapshotId: string;
}): Promise<{
  ok: boolean;
  estimate?: ReturnType<typeof estimatePhase2BSynthesisBudget>;
  error?: string;
}> {
  const handoff = await validatePhase2BHandoff({
    selectionSnapshotId: input.selectionSnapshotId,
    requirePinnedSnapshot: false,
    allowExistingSynthesis: true,
  });
  if (!handoff.ok) {
    return { ok: false, error: handoff.errorMessage };
  }
  return { ok: true, estimate: estimatePhase2BSynthesisBudget() };
}
