/**
 * Safe observability for manuscript brief lifecycle.
 * Never logs brief body text or manuscript content.
 */

export type ManuscriptBriefEventType =
  | "manuscript_brief_draft_created"
  | "manuscript_brief_draft_saved"
  | "manuscript_brief_submitted"
  | "manuscript_brief_superseded"
  | "manuscript_brief_cancelled"
  | "eic_acknowledgment_viewed";

export type ManuscriptBriefEvent = {
  readonly event: ManuscriptBriefEventType;
  readonly brief_id?: string;
  readonly manuscript_id?: string;
  readonly manuscript_version_id?: string;
  readonly status?: string;
  readonly reason_code?: string;
};

export function emitManuscriptBriefEvent(event: ManuscriptBriefEvent): void {
  if (process.env.NODE_ENV === "test") return;
  const payload = Object.freeze({
    ...event,
    ts: new Date().toISOString(),
  });
  console.info("[storydna:manuscript-brief]", JSON.stringify(payload));
}
