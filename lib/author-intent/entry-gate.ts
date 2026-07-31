/**
 * Phase 1A Author Intent entry gate — routes expert recruitment through intent.
 * Pure helpers are safe for unit tests; no provider or workflow calls.
 */

import { isStudioEicEnabled } from "@/lib/eic/feature-flag.ts";
import { isStudioAuthorIntentEnabled } from "./feature-flag.ts";

/** Both Phase 1A flags must be on for the entry gate and intent-first links. */
export function isAuthorIntentEntryGateActive(): boolean {
  return isStudioAuthorIntentEnabled() && isStudioEicEnabled();
}

export function studioExpertRecruitmentHref(bookId: string): string {
  if (isAuthorIntentEntryGateActive()) {
    return `/studio/books/${bookId}/intent`;
  }
  return `/studio/books/${bookId}/experts`;
}

export function shouldRedirectExpertDeskToAuthorIntent(input: {
  gateActive: boolean;
  manuscriptVersionId: string | null;
  hasActiveIntent: boolean;
}): boolean {
  if (!input.gateActive) return false;
  if (!input.manuscriptVersionId) return false;
  return !input.hasActiveIntent;
}
