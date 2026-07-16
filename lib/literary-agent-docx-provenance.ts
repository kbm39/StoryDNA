import type { AuthoritativeReviewDisplay } from "./authoritative-review-display.ts";
import { provenanceLinesForDisplay } from "./review-provenance.ts";

/** Shared provenance block for Literary Agent DOCX and text snapshots. */
export function appendProvenanceToDocxLines(display: AuthoritativeReviewDisplay): string[] {
  return [
    "--- Review provenance ---",
    ...provenanceLinesForDisplay(display.provenance),
    "---",
  ];
}
