/**
 * Studio revision export eligibility — authoritative author_edit_responses only.
 */

import type { AuthorEditDisposition } from "@/lib/types.ts";
import { mapDbDispositionToStudio, type StudioAuthorDisposition } from "./decisions.ts";

export const STUDIO_REVISION_EXPORT_VERSION = "studio_revision_export@v1" as const;

export type ApprovedDisposition = "accepted" | "accepted_modified";

export function isApprovedRevisionDecision(
  disposition: StudioAuthorDisposition | AuthorEditDisposition | null | undefined,
): disposition is ApprovedDisposition {
  if (!disposition) return false;
  const studio =
    disposition === "accepted" ||
    disposition === "accepted_modified" ||
    disposition === "rejected" ||
    disposition === "deferred" ||
    disposition === "pending"
      ? disposition
      : mapDbDispositionToStudio(disposition as AuthorEditDisposition);
  return studio === "accepted" || studio === "accepted_modified";
}

export function isPlanningOnlyDisposition(
  disposition: StudioAuthorDisposition | AuthorEditDisposition | null | undefined,
): boolean {
  if (!disposition) return false;
  const studio =
    disposition === "skipped"
      ? "deferred"
      : disposition === "modified"
        ? "accepted_modified"
        : disposition === "accepted" ||
            disposition === "accepted_modified" ||
            disposition === "rejected" ||
            disposition === "deferred" ||
            disposition === "pending"
          ? disposition
          : mapDbDispositionToStudio(disposition as AuthorEditDisposition);
  return studio === "deferred";
}

export function resolveFinalExportText(input: {
  readonly disposition: StudioAuthorDisposition;
  readonly expertSuggestedText: string;
  readonly authorModifiedText: string | null;
}): { ok: true; text: string } | { ok: false; error: string } {
  if (input.disposition === "accepted") {
    return { ok: true, text: input.expertSuggestedText };
  }
  if (input.disposition === "accepted_modified") {
    const text = input.authorModifiedText?.trim();
    if (!text) {
      return { ok: false, error: "Accepted with changes is missing author final text." };
    }
    return { ok: true, text };
  }
  return { ok: false, error: "Disposition is not approved for export." };
}
