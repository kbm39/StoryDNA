import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioNav } from "@/app/studio/components/StudioShell.tsx";
import { getStudioBookWorkspace } from "@/lib/studio/book-workspace.ts";
import { isMilitaryExpertV2AvailableInStudio } from "@/lib/studio/military-expert-v2-feature-flag.ts";
import {
  getConfirmedSnapshot,
  loadInventoryById,
  loadInventorySelections,
} from "@/lib/studio/military-expert-v2/persistence.ts";
import { MilitaryExpertInventorySelectionClient } from "./MilitaryExpertInventorySelectionClient.tsx";

export default async function MilitaryExpertInventorySelectionPage({
  params,
}: {
  params: Promise<{ bookId: string; inventoryId: string }>;
}) {
  const { bookId, inventoryId } = await params;

  if (!isMilitaryExpertV2AvailableInStudio()) {
    notFound();
  }

  const workspace = await getStudioBookWorkspace(bookId);
  if (!workspace) notFound();

  const inventory = await loadInventoryById(inventoryId);
  if (!inventory || inventory.manuscript_id !== bookId) notFound();
  if (inventory.inventory_status !== "ready_for_selection") notFound();

  const selections = await loadInventorySelections(inventoryId);
  const confirmedSnapshot = await getConfirmedSnapshot(inventoryId);

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
          {workspace.title} — Military Expert V2 Scene Selection
        </p>
      </div>
      <MilitaryExpertInventorySelectionClient
        bookId={bookId}
        inventory={inventory}
        initialSelections={selections}
        confirmedSnapshot={confirmedSnapshot}
      />
    </section>
  );
}
