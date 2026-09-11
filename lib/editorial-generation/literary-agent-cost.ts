/**
 * Staging-ready Literary Agent cost accounting.
 * Token counts come from the provider. USD is estimated from published Anthropic rates.
 */

export const LITERARY_AGENT_COST_PROVIDER = "anthropic" as const;

export const LITERARY_AGENT_PRICING_SOURCE =
  "https://platform.claude.com/docs/en/about-claude/pricing";

export const LITERARY_AGENT_PRICING_PROFILE = "anthropic_opus_4_8_2026_09" as const;

export type LiteraryAgentCallRole =
  | "memo_generation"
  | "memo_repair"
  | "contrary_evidence"
  | "rubric_generation"
  | "rubric_retry"
  | "revision_candidates"
  | "revision_candidates_repair";

export interface ProviderTokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  cacheCreationTokens: number | null;
}

export interface ModelTokenRatesUsdPerMtok {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
}

/** Official Anthropic list prices (USD / million tokens), Sep 2026. */
export const ANTHROPIC_RATES_USD_PER_MTOK = {
  opus_4_8: { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25 },
  sonnet_4: { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75 },
  sonnet_4_6: { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75 },
  haiku_4_5: { input: 1, output: 5, cacheRead: 0.1, cacheWrite5m: 1.25 },
} as const satisfies Record<string, ModelTokenRatesUsdPerMtok>;

export interface LiteraryAgentProviderCall {
  role: LiteraryAgentCallRole;
  provider: typeof LITERARY_AGENT_COST_PROVIDER;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  cacheCreationTokens: number | null;
  costUsd: number | null;
  costKind: "estimated" | "unknown";
  durationMs: number;
  /** Present when a call completed but later parse/validation failed. */
  status?: "ok" | "parse_failed" | "validation_failed";
}

export interface RoleTokenTotals {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheCreationTokens: number;
  callCount: number;
  costUsd: number;
}

export interface LiteraryAgentCostRecord {
  provider: typeof LITERARY_AGENT_COST_PROVIDER;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheCreationTokens: number;
  repairCallTokens: RoleTokenTotals;
  revisionCandidateCallTokens: RoleTokenTotals;
  revisionCandidateRepairCallTokens: RoleTokenTotals;
  contraryEvidenceCallTokens: RoleTokenTotals;
  calls: LiteraryAgentProviderCall[];
  perCallCostUsd: Array<number | null>;
  totalRunCostUsd: number | null;
  runtimeMs: number;
  tokenCounts: "exact" | "partial" | "missing";
  costUsdKind: "estimated" | "unknown";
  pricingSource: typeof LITERARY_AGENT_PRICING_SOURCE;
  pricingProfile: typeof LITERARY_AGENT_PRICING_PROFILE;
}

const EMPTY_ROLE: RoleTokenTotals = {
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  cacheCreationTokens: 0,
  callCount: 0,
  costUsd: 0,
};

export function ratesForModel(model: string): ModelTokenRatesUsdPerMtok {
  const id = model.toLowerCase();
  if (id.includes("haiku")) return ANTHROPIC_RATES_USD_PER_MTOK.haiku_4_5;
  if (id.includes("sonnet-4-6") || id.includes("sonnet-4.6")) {
    return ANTHROPIC_RATES_USD_PER_MTOK.sonnet_4_6;
  }
  if (id.includes("sonnet")) return ANTHROPIC_RATES_USD_PER_MTOK.sonnet_4;
  return ANTHROPIC_RATES_USD_PER_MTOK.opus_4_8;
}

export function estimateCallCostUsd(
  model: string,
  usage: ProviderTokenUsage,
): number | null {
  if (
    usage.inputTokens == null &&
    usage.outputTokens == null &&
    usage.cachedTokens == null &&
    usage.cacheCreationTokens == null
  ) {
    return null;
  }
  const rates = ratesForModel(model);
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  const cacheRead = usage.cachedTokens ?? 0;
  const cacheWrite = usage.cacheCreationTokens ?? 0;
  const usd =
    (input * rates.input +
      output * rates.output +
      cacheRead * rates.cacheRead +
      cacheWrite * rates.cacheWrite5m) /
    1_000_000;
  return roundUsd(usd);
}

export function usageFromAnthropicMessage(usage: {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
} | null | undefined): ProviderTokenUsage {
  return {
    inputTokens: usage?.input_tokens ?? null,
    outputTokens: usage?.output_tokens ?? null,
    cachedTokens: usage?.cache_read_input_tokens ?? null,
    cacheCreationTokens: usage?.cache_creation_input_tokens ?? null,
  };
}

export function createLiteraryAgentCostLedger() {
  const calls: LiteraryAgentProviderCall[] = [];

  function record(args: {
    role: LiteraryAgentCallRole;
    model: string;
    usage: ProviderTokenUsage;
    durationMs: number;
    status?: LiteraryAgentProviderCall["status"];
  }): LiteraryAgentProviderCall {
    const costUsd = estimateCallCostUsd(args.model, args.usage);
    const call: LiteraryAgentProviderCall = {
      role: args.role,
      provider: LITERARY_AGENT_COST_PROVIDER,
      model: args.model,
      inputTokens: args.usage.inputTokens,
      outputTokens: args.usage.outputTokens,
      cachedTokens: args.usage.cachedTokens,
      cacheCreationTokens: args.usage.cacheCreationTokens,
      costUsd,
      costKind: costUsd == null ? "unknown" : "estimated",
      durationMs: Math.max(0, args.durationMs),
      ...(args.status ? { status: args.status } : {}),
    };
    calls.push(call);
    return call;
  }

  function finalize(runtimeMs: number): LiteraryAgentCostRecord {
    return aggregateLiteraryAgentCost(calls, runtimeMs);
  }

  return { record, finalize, get calls() { return calls; } };
}

export function aggregateLiteraryAgentCost(
  calls: LiteraryAgentProviderCall[],
  runtimeMs: number,
): LiteraryAgentCostRecord {
  const tokenPresence = calls.map((c) => c.inputTokens != null && c.outputTokens != null);
  const tokenCounts: LiteraryAgentCostRecord["tokenCounts"] =
    calls.length === 0 || tokenPresence.every((ok) => !ok)
      ? "missing"
      : tokenPresence.every(Boolean)
        ? "exact"
        : "partial";

  const knownCosts = calls.map((c) => c.costUsd);
  const allCostsKnown = calls.length > 0 && knownCosts.every((c) => c != null);
  const totalRunCostUsd = allCostsKnown
    ? roundUsd(knownCosts.reduce<number>((sum, c) => sum + (c ?? 0), 0))
    : null;

  const primaryModel =
    calls.find((c) => c.role === "memo_generation")?.model ??
    calls[0]?.model ??
    "unknown";

  return {
    provider: LITERARY_AGENT_COST_PROVIDER,
    model: primaryModel,
    inputTokens: sum(calls, (c) => c.inputTokens),
    outputTokens: sum(calls, (c) => c.outputTokens),
    cachedTokens: sum(calls, (c) => c.cachedTokens),
    cacheCreationTokens: sum(calls, (c) => c.cacheCreationTokens),
    repairCallTokens: roleTotals(calls, "memo_repair"),
    revisionCandidateCallTokens: roleTotals(calls, "revision_candidates"),
    revisionCandidateRepairCallTokens: roleTotals(calls, "revision_candidates_repair"),
    contraryEvidenceCallTokens: roleTotals(calls, "contrary_evidence"),
    calls,
    perCallCostUsd: knownCosts,
    totalRunCostUsd,
    runtimeMs: Math.max(0, runtimeMs),
    tokenCounts,
    costUsdKind: totalRunCostUsd == null ? "unknown" : "estimated",
    pricingSource: LITERARY_AGENT_PRICING_SOURCE,
    pricingProfile: LITERARY_AGENT_PRICING_PROFILE,
  };
}

function roleTotals(
  calls: LiteraryAgentProviderCall[],
  role: LiteraryAgentCallRole,
): RoleTokenTotals {
  const matched = calls.filter((c) => c.role === role);
  if (matched.length === 0) return { ...EMPTY_ROLE };
  return {
    inputTokens: sum(matched, (c) => c.inputTokens),
    outputTokens: sum(matched, (c) => c.outputTokens),
    cachedTokens: sum(matched, (c) => c.cachedTokens),
    cacheCreationTokens: sum(matched, (c) => c.cacheCreationTokens),
    callCount: matched.length,
    costUsd: roundUsd(matched.reduce((s, c) => s + (c.costUsd ?? 0), 0)),
  };
}

function sum(
  calls: LiteraryAgentProviderCall[],
  pick: (c: LiteraryAgentProviderCall) => number | null,
): number {
  return calls.reduce((s, c) => s + (pick(c) ?? 0), 0);
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
