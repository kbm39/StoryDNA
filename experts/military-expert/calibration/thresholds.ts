import type { CertificationThresholds } from "@/lib/expert-calibration/contracts.ts";
import {
  MILITARY_EXPERT_KEY,
  MILITARY_EXPERT_VERSION,
} from "../contracts.ts";

export const MILITARY_EXPERT_CALIBRATION_THRESHOLDS: CertificationThresholds = Object.freeze({
  threshold_id: "military_expert_draft_v1",
  expert_key: MILITARY_EXPERT_KEY,
  expert_version: MILITARY_EXPERT_VERSION,
  blockers: Object.freeze({
    min_precision: 0.85,
    min_recall: 0.8,
    max_hallucination_rate: 0.15,
    max_unsupported_finding_rate: 0.15,
    min_evidence_compliance: 0.75,
    min_contrary_evidence_compliance: 0.75,
    min_uncertainty_compliance: 0.75,
    min_preservation_score: 0.7,
    max_parser_failure_rate: 0.02,
    max_repair_required_rate: 0.1,
    required_case_pass_rate: 0.8,
    max_critical_false_negatives: 0,
    min_stability: null,
    max_cost_per_review_usd: null,
    max_p95_latency_ms: null,
  }),
  warnings: Object.freeze({
    recall_below_target: 0.85,
    stability_below_target: 0.9,
    cost_above_target: 0.5,
    latency_above_target_ms: 30_000,
    editorial_quality_below: 0.9,
  }),
  domain_overrides: Object.freeze({
    operations_and_tactics: Object.freeze({ min_recall: 0.85 }),
    weapons_and_equipment: Object.freeze({ min_precision: 0.9 }),
  }),
});
