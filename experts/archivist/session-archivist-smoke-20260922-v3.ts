/**
 * Frozen evidence inventory for paid smoke archivist-smoke-20260922-v3.
 * Official result: 3/3 PASS. Historical only. Do not reuse this session ID.
 */

export const ARCHIVIST_SMOKE_20260922_V3_SESSION_ID = "archivist-smoke-20260922-v3" as const;

export const ARCHIVIST_SMOKE_20260922_V3_EVIDENCE = {
  session_id: ARCHIVIST_SMOKE_20260922_V3_SESSION_ID,
  official_result: "3/3 PASS",
  not_a_pass: false,
  provider: "anthropic",
  model: "claude-haiku-4-5-20251001",
  hold_fast_used: false,
  canon_written: false,
  live_model_certified: false,
  execution_wired: false,
  runtime_enabled: false,
  studio_selectable: false,
  total_cost_usd: 0.020533,
  total_calls: 3,
  repair_calls: 0,
  extract_method: "fenced",
  official_passes: 3,
  official_failures: 0,
  cases: [
    {
      id: "within_book_exact_contradiction",
      passed: true,
      confirmed_count: 1,
      both_sides: true,
      cost_usd: 0.008304,
    },
    {
      id: "explained_apparent_conflict",
      passed: true,
      confirmed_count: 0,
      both_sides: true,
      cost_usd: 0.008365,
    },
    {
      id: "no_false_positive_control",
      passed: true,
      confirmed_count: 0,
      both_sides: true,
      cost_usd: 0.003864,
    },
  ],
} as const;
