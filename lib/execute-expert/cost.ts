/**
 * Generic expert cost ledger.
 *
 * Literary Agent keeps literary-agent-cost.ts unchanged.
 * Dry-run: zero calls, zero tokens, $0, cost_status exact.
 * Recording a provider call in dry_run is a hard error.
 */

import { DryRunProviderForbiddenError } from "./dry-run-guard.ts";
import type {
  ExecuteExpertCostSummary,
  ExecuteExpertMode,
  ExecuteExpertProvenance,
} from "./types.ts";

export interface ExpertCostUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  cacheCreationTokens: number | null;
}

export interface ExpertCostCall {
  role: string;
  provider: ExecuteExpertProvenance["provider"];
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  cacheCreationTokens: number | null;
  costUsd: number | null;
  durationMs: number;
}

export interface ExpertCostLedger {
  expert_key: string;
  execution_mode: ExecuteExpertMode;
  record(call: {
    role: string;
    provider: ExecuteExpertProvenance["provider"];
    model: string;
    usage: ExpertCostUsage;
    durationMs: number;
    costUsd?: number | null;
  }): ExpertCostCall;
  finalize(runtimeMs: number): ExecuteExpertCostSummary;
  readonly calls: readonly ExpertCostCall[];
}

function dryRunExactZero(
  expertKey: string,
  runtimeMs: number,
): ExecuteExpertCostSummary {
  return {
    expert_key: expertKey,
    execution_mode: "dry_run",
    provider: "none",
    model: "none",
    call_count: 0,
    input_tokens: 0,
    output_tokens: 0,
    cached_tokens: 0,
    cache_creation_tokens: 0,
    total_cost_usd: 0,
    runtime_ms: Math.max(0, runtimeMs),
    token_counts: "exact",
    cost_status: "exact",
  };
}

export function createExpertCostLedger(args: {
  expertKey: string;
  mode: ExecuteExpertMode;
}): ExpertCostLedger {
  const calls: ExpertCostCall[] = [];

  function record(call: {
    role: string;
    provider: ExecuteExpertProvenance["provider"];
    model: string;
    usage: ExpertCostUsage;
    durationMs: number;
    costUsd?: number | null;
  }): ExpertCostCall {
    if (args.mode === "dry_run") {
      throw new DryRunProviderForbiddenError(
        `dry_run cannot record provider call role=${call.role}`,
      );
    }
    const row: ExpertCostCall = {
      role: call.role,
      provider: call.provider,
      model: call.model,
      inputTokens: call.usage.inputTokens,
      outputTokens: call.usage.outputTokens,
      cachedTokens: call.usage.cachedTokens,
      cacheCreationTokens: call.usage.cacheCreationTokens,
      costUsd: call.costUsd ?? 0,
      durationMs: Math.max(0, call.durationMs),
    };
    calls.push(row);
    return row;
  }

  function finalize(runtimeMs: number): ExecuteExpertCostSummary {
    if (args.mode === "dry_run") {
      return dryRunExactZero(args.expertKey, runtimeMs);
    }

    const tokenPresence = calls.map((c) => c.inputTokens != null && c.outputTokens != null);
    const token_counts: ExecuteExpertCostSummary["token_counts"] =
      calls.length === 0 || tokenPresence.every((ok) => !ok)
        ? "missing"
        : tokenPresence.every(Boolean)
          ? "exact"
          : "partial";
    const known = calls.map((c) => c.costUsd);
    const allKnown = calls.length > 0 && known.every((c) => c != null);
    const cost_status: ExecuteExpertCostSummary["cost_status"] = allKnown
      ? "exact"
      : calls.length === 0
        ? "missing"
        : "partial";

    return {
      expert_key: args.expertKey,
      execution_mode: "live",
      provider: calls[0]?.provider ?? "none",
      model: calls[0]?.model ?? "none",
      call_count: calls.length,
      input_tokens: calls.reduce((s, c) => s + (c.inputTokens ?? 0), 0),
      output_tokens: calls.reduce((s, c) => s + (c.outputTokens ?? 0), 0),
      cached_tokens: calls.reduce((s, c) => s + (c.cachedTokens ?? 0), 0),
      cache_creation_tokens: calls.reduce((s, c) => s + (c.cacheCreationTokens ?? 0), 0),
      total_cost_usd: allKnown ? known.reduce<number>((s, c) => s + (c ?? 0), 0) : 0,
      runtime_ms: Math.max(0, runtimeMs),
      token_counts,
      cost_status,
    };
  }

  return {
    expert_key: args.expertKey,
    execution_mode: args.mode,
    record,
    finalize,
    get calls() {
      return calls;
    },
  };
}
