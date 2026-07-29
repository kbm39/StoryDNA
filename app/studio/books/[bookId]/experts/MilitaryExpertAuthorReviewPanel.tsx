"use client";

import { MilitaryExpertAuthorReviewFindingCard } from "@/app/studio/books/[bookId]/experts/MilitaryExpertFindingCard.tsx";
import type { MilitaryExpertFindingDisplayItem } from "@/lib/studio/military-expert-finding-display.ts";

export function MilitaryExpertAuthorReviewPanel({
  items,
}: {
  items: readonly MilitaryExpertFindingDisplayItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div>
        <h3 className="text-sm font-semibold tracking-wide text-amber-900 dark:text-amber-100">
          Author Review Required ({items.length})
        </h3>
        <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">
          These findings were released provisionally because StoryDNA could not complete its
          confidence check.
        </p>
      </div>

      <ul className="space-y-4">
        {items.map((item) => (
          <MilitaryExpertAuthorReviewFindingCard key={item.findingId} item={item} />
        ))}
      </ul>
    </section>
  );
}
