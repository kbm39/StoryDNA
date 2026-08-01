/** Structured observability events for Amendment 002 PEU. */

export type PeuEventName =
  | "peu.gate_pass"
  | "peu.gate_fail"
  | "peu.fallback_used"
  | "peu.anti_echo_triggered"
  | "peu.clarification_emitted"
  | "peu.confirmation_completed";

export type PeuEventPayload = {
  readonly stage_id?: string;
  readonly quality_level?: number;
  readonly duration_ms?: number;
  readonly fail_reason?: string;
  readonly candidate_hash?: string;
  readonly reason?: string;
  readonly overlap_ratio?: number;
  readonly materiality_reason?: string;
  readonly understanding_id?: string;
  readonly aggregate_level?: string;
};

export function logPeuEvent(event: PeuEventName, payload: PeuEventPayload): void {
  if (process.env.NODE_ENV === "test") return;
  const redacted = { ...payload };
  console.info(JSON.stringify({ event, ...redacted, ts: new Date().toISOString() }));
}

export function hashCandidate(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash).toString(16)}`;
}
