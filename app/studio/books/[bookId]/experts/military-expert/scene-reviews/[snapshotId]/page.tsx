import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioNav } from "@/app/studio/components/StudioShell.tsx";
import { getStudioBookWorkspace } from "@/lib/studio/book-workspace.ts";
import { isMilitaryExpertV2AvailableInStudio } from "@/lib/studio/military-expert-v2-feature-flag.ts";
import { loadInventoryById } from "@/lib/studio/military-expert-v2/persistence.ts";
import { loadSnapshotById, validatePhase2AHandoff } from "@/lib/studio/military-expert-v2/handoff-validation.ts";
import { loadSceneReviewsForSnapshot } from "@/lib/studio/military-expert-v2/scene-review-persistence.ts";
import { computeSceneReviewCoverage } from "@/lib/studio/military-expert-v2/scene-review-coverage.ts";
import { scoreMilitaryDepth } from "@/lib/studio/military-expert-v2/scene-review-quality.ts";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { MilitaryExpertSceneReviewsClient } from "./MilitaryExpertSceneReviewsClient.tsx";

export default async function MilitaryExpertSceneReviewsPage({
  params,
}: {
  params: Promise<{ bookId: string; snapshotId: string }>;
}) {
  const { bookId, snapshotId } = await params;

  if (!isMilitaryExpertV2AvailableInStudio()) {
    notFound();
  }

  const workspace = await getStudioBookWorkspace(bookId);
  if (!workspace) notFound();

  const handoff = await validatePhase2AHandoff({
    selectionSnapshotId: snapshotId,
    requirePinnedSnapshot: false,
  });
  if (!handoff.ok || !handoff.inventory || !handoff.selectedSceneIds) {
    notFound();
  }
  if (handoff.inventory.manuscript_id !== bookId) notFound();

  const inventory = await loadInventoryById(handoff.inventory.inventory_id);
  if (!inventory) notFound();

  const reviews = await loadSceneReviewsForSnapshot(snapshotId);
  const coverage = computeSceneReviewCoverage(handoff.selectedSceneIds, reviews);
  const scorecards = reviews
    .filter((r) => r.document)
    .map((r) => scoreMilitaryDepth(r.document!));

  const supabase = getSupabaseAdmin();
  const { data: workflow } = await supabase
    .from("editorial_workflows")
    .select("id, status, result_summary")
    .eq("workflow_type", "military_expert_v2_scene_review")
    .contains("input_snapshot", { phase2a: { selectionSnapshotId: snapshotId } })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const snapshotRow = await loadSnapshotById(snapshotId);

  return (
    <section className="space-y-6">
      <StudioNav bookId={bookId} />
      <div>
        <Link
          href={`/studio/books/${bookId}/experts`}
          className="text-sm text-accent hover:underline"
        >
          ← Back to Expert Desk
        </Link>
        <p className="mt-3 text-sm text-black/55 dark:text-white/55">
          {workspace.title} — Military Expert V2 Scene Review Calibration
        </p>
      </div>
      <MilitaryExpertSceneReviewsClient
        data={{
          bookId,
          snapshotId,
          inventory,
          selectedSceneIds: handoff.selectedSceneIds,
          workflowStatus: workflow?.status ?? null,
          workflowId: workflow?.id ?? null,
          coverage,
          reviews,
          scorecards,
          resultSummary: (workflow?.result_summary as Record<string, unknown>) ?? null,
        }}
      />
      {snapshotRow && !snapshotRow.immutable && (
        <p className="text-sm text-amber-700">Warning: snapshot is not immutable.</p>
      )}
    </section>
  );
}
