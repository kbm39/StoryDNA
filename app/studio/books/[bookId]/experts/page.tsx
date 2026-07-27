import { notFound } from "next/navigation";
import {
  groupStudioExpertsByTier,
  listStudioExpertDeskEntries,
} from "@/lib/studio/expert-desk.ts";
import { StudioNav } from "../../../components/StudioShell.tsx";
import { ExpertDeskClient } from "./ExpertDeskClient.tsx";

export default async function StudioExpertDeskPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const entries = listStudioExpertDeskEntries();
  const groups = groupStudioExpertsByTier(entries);

  return (
    <section className="space-y-6">
      <StudioNav bookId={bookId} />
      <div>
        <h2 className="font-serif text-2xl font-semibold">Expert Desk</h2>
        <p className="mt-1 text-sm text-black/55 dark:text-white/55">
          Available StoryDNA experts for this book. Lifecycle labels reflect registry truth.
        </p>
      </div>
      <ExpertDeskClient
        bookId={bookId}
        groups={groups as Record<string, readonly (typeof entries)[number][]>}
      />
    </section>
  );
}
