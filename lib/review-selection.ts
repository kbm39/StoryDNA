import type { Review } from "@/lib/types";

/** Active Literary Agent (commercial) review for a manuscript, if any. */
export function activeCommercialReview(reviews: Review[]): Review | undefined {
  return reviews
    .filter(
      (r) =>
        r.perspective === "commercial" && (r.lifecycle_status ?? "active") === "active",
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}
