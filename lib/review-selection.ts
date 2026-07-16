import type { Review } from "@/lib/types";

/**
 * @deprecated Prefer resolveAuthoritativeReviewFromList with current_version_id.
 * Returns newest active commercial review without version validation.
 */
export function activeCommercialReview(reviews: Review[]): Review | undefined {
  return reviews
    .filter(
      (r) =>
        r.perspective === "commercial" && (r.lifecycle_status ?? "active") === "active",
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}
