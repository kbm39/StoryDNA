import type { MilitaryExpertSceneLocator } from "./contracts.ts";

/** Author-facing locator display — internal offsets are never primary. */
export function formatAuthorLocator(loc: MilitaryExpertSceneLocator): string {
  if (loc.exact_page_number != null && !loc.page_is_approximate) {
    return `p. ${loc.exact_page_number}`;
  }
  if (loc.exact_page_number != null && loc.page_is_approximate) {
    return `approx. p. ${loc.exact_page_number}`;
  }
  if (loc.chapter_label && loc.scene_heading) {
    return `${loc.chapter_label} · ${loc.scene_heading}`;
  }
  if (loc.chapter_label) {
    return loc.chapter_label;
  }
  return `~${Math.round(loc.approximate_book_percentage)}% through book`;
}

export function locatorHasAuthorFacingFallback(loc: MilitaryExpertSceneLocator): boolean {
  if (loc.exact_page_number != null) return true;
  if (loc.chapter_label) return true;
  if (loc.scene_heading) return true;
  return Number.isFinite(loc.approximate_book_percentage);
}
