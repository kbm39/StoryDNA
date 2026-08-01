import type { AuditEventType } from "./contract.ts";
import type { AuditEvent, KnowledgeDomainAnalysisV1 } from "./types.ts";

export function createAuditEvent(input: {
  readonly event_id: string;
  readonly event_type: AuditEventType;
  readonly timestamp: string;
  readonly actor: AuditEvent["actor"];
  readonly summary: string;
  readonly related_ids?: readonly string[];
  readonly prior_state?: string | null;
  readonly new_state?: string | null;
}): AuditEvent {
  return Object.freeze({
    event_id: input.event_id,
    event_type: input.event_type,
    timestamp: input.timestamp,
    actor: input.actor,
    summary: input.summary,
    related_ids: Object.freeze([...(input.related_ids ?? [])]),
    prior_state: input.prior_state ?? null,
    new_state: input.new_state ?? null,
  });
}

/** Append-only audit — returns new analysis with appended event. */
export function appendAuditEvent(
  analysis: KnowledgeDomainAnalysisV1,
  event: AuditEvent,
): KnowledgeDomainAnalysisV1 {
  return Object.freeze({
    ...analysis,
    audit_history: Object.freeze([...analysis.audit_history, event]),
    updated_at: event.timestamp,
  });
}

export function appendAuditEvents(
  analysis: KnowledgeDomainAnalysisV1,
  events: readonly AuditEvent[],
): KnowledgeDomainAnalysisV1 {
  if (events.length === 0) return analysis;
  return Object.freeze({
    ...analysis,
    audit_history: Object.freeze([...analysis.audit_history, ...events]),
    updated_at: events[events.length - 1]?.timestamp ?? analysis.updated_at,
  });
}

/** Audit history is append-only — prior events must not be removed or mutated. */
export function assertAuditHistoryAppendOnly(
  prior: readonly AuditEvent[],
  next: readonly AuditEvent[],
): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  if (next.length < prior.length) {
    return { ok: false, reason: "Audit history cannot shrink — append-only violation." };
  }
  for (let i = 0; i < prior.length; i++) {
    const p = prior[i];
    const n = next[i];
    if (p.event_id !== n.event_id || p.timestamp !== n.timestamp) {
      return { ok: false, reason: `Audit event at index ${i} was mutated — append-only violation.` };
    }
  }
  return { ok: true };
}
