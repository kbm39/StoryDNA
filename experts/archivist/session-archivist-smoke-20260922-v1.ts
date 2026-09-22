/**
 * Frozen evidence inventory for failed paid smoke archivist-smoke-20260922-v1.
 * Raw model outputs were not persisted. Do not reuse this session ID.
 */

export const ARCHIVIST_SMOKE_20260922_V1_SESSION_ID = "archivist-smoke-20260922-v1" as const;

export const ARCHIVIST_SMOKE_20260922_V1_EVIDENCE = {
  session_id: ARCHIVIST_SMOKE_20260922_V1_SESSION_ID,
  provider: "anthropic",
  model: "claude-haiku-4-5-20251001",
  hold_fast_used: false,
  canon_written: false,
  live_model_certified: false,
  execution_wired: false,
  runtime_enabled: false,
  studio_selectable: false,
  total_cost_usd: 0.056230999999999996,
  cost_accounting: {
    complete: false,
    exactness: "partial_session_totals_only",
    primary_and_repair_separated: false,
    tokens_persisted: false,
    runtime_persisted: false,
    cost_status_persisted: false,
    case_cost_usd: [0.020434, 0.020401, 0.015396],
  },
  cases: [
    {
      id: "within_book_exact_contradiction",
      gate: "continuity_detection",
      final_error_code: "structured_output_invalid",
      confirmed_count: 0,
      raw_primary_preserved: false,
      raw_repair_preserved: false,
      finish_reason_preserved: false,
      token_usage_preserved: false,
      parse_error_preserved: false,
      schema_errors_preserved: false,
      repair_prompt_preserved: false,
    },
    {
      id: "explained_apparent_conflict",
      gate: "temporal_reasoning",
      final_error_code: "structured_output_invalid",
      confirmed_count: 0,
      raw_primary_preserved: false,
      raw_repair_preserved: false,
      finish_reason_preserved: false,
      token_usage_preserved: false,
      parse_error_preserved: false,
      schema_errors_preserved: false,
      repair_prompt_preserved: false,
    },
    {
      id: "no_false_positive_control",
      gate: "false_positives",
      final_error_code: "structured_output_invalid",
      confirmed_count: 0,
      raw_primary_preserved: false,
      raw_repair_preserved: false,
      finish_reason_preserved: false,
      token_usage_preserved: false,
      parse_error_preserved: false,
      schema_errors_preserved: false,
      repair_prompt_preserved: false,
    },
  ],
  blue_green_contradiction_detected_by_haiku: "unknown_raw_output_not_preserved",
  likely_failure_band: [
    "not_json",
    "markdown_fenced_json",
    "prose_wrapped_json",
    "truncated_json",
    "malformed_json",
  ],
  excluded_by_parser_behavior: [
    "valid empty JSON object would have parsed and scored as 0 confirmed after envelope",
    "identity/schema/metrics failures would have been validation_failed, not structured_output_invalid",
  ],
} as const;
