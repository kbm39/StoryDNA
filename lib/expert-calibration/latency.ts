import type { CalibrationCaseResult, LatencyMetrics } from "./contracts.ts";

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

export function computeLatencyMetrics(
  caseResults: readonly CalibrationCaseResult[],
): LatencyMetrics {
  const durations = caseResults.map((r) => r.duration_ms);
  return {
    total_duration_ms: durations.reduce((a, b) => a + b, 0),
    case_duration_p50_ms: percentile(durations, 0.5),
    case_duration_p95_ms: percentile(durations, 0.95),
    case_duration_max_ms: durations.length === 0 ? 0 : Math.max(...durations),
  };
}
