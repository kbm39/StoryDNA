/**
 * Distinguishes projected ceiling from accrued spend.
 * Optional/retry/reconciliation calls refuse if the next estimate would exceed $1.00.
 * A mandatory in-flight call is not aborted because its final usage may cross the estimate.
 */

import { HAIKU_INPUT_USD_PER_MTOK, HAIKU_OUTPUT_USD_PER_MTOK, SEGMENTED_CALL_ROLES } from "./constants.ts";
import { PaidPilotCostCeilingError } from "./errors.ts";
import type { SegmentedCallRole } from "./constants.ts";
import { RECKONING_PAID_PILOT_AUTHORIZATION } from "./paid-pilot-authorization.ts";

export interface PaidPilotLedgerRow {
  role: SegmentedCallRole;
  segment_or_batch_id: string;
  provider: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  finish_reason: string | null;
  duration_ms: number;
  status: "ok" | "parse_failed" | "validation_failed" | "aborted";
  estimated_usd: number | null;
  usage_confidence: "exact" | "estimated" | "missing";
}

export function estimateHaikuUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * HAIKU_INPUT_USD_PER_MTOK +
    (outputTokens / 1_000_000) * HAIKU_OUTPUT_USD_PER_MTOK;
}

export function accruedPaidPilotCostUsd(rows: readonly PaidPilotLedgerRow[]): number {
  return rows.reduce((sum, row) => sum + (row.estimated_usd ?? 0), 0);
}

export function assertOptionalCallWithinCeiling(args: {
  accrued_usd: number;
  proposed_call_estimate_usd: number;
  ceiling_usd?: number;
  mandatory_in_flight?: boolean;
}): void {
  const ceiling = args.ceiling_usd ?? RECKONING_PAID_PILOT_AUTHORIZATION.hard_cost_ceiling_usd;
  if (args.mandatory_in_flight) return;
  if (args.accrued_usd + args.proposed_call_estimate_usd > ceiling) {
    throw new PaidPilotCostCeilingError(
      `optional call refused: accrued ${args.accrued_usd} + proposed ${args.proposed_call_estimate_usd} exceeds ${ceiling}`,
    );
  }
}

export function recordPaidCallBeforeParse(
  row: PaidPilotLedgerRow,
  ledger: PaidPilotLedgerRow[],
): PaidPilotLedgerRow {
  ledger.push(row);
  return row;
}

export function futureCallRolesRemain(): readonly SegmentedCallRole[] {
  return SEGMENTED_CALL_ROLES;
}

export const RECKONING_PAID_PILOT_COST_PROJECTION = {
  low_usd: 0.32,
  expected_usd: 0.41,
  high_usd: 0.68,
  computed_ceiling_usd: 0.85,
  hard_ceiling_usd: 1,
} as const;
