import type { CalibrationReplayOutput } from "@/lib/expert-calibration/contracts.ts";
import type { MilitaryExpertFinding, MilitaryExpertReview } from "../contracts.ts";
import { MILITARY_EXPERT_RUNTIME_DEFINITION_HASH } from "../generation-contract.ts";
import { buildValidMilitaryExpertReview } from "../fixtures.ts";
import { MILITARY_EXPERT_CALIBRATION_CASES } from "./corpus.ts";

function baseReview(overrides: Partial<MilitaryExpertReview>): MilitaryExpertReview {
  const base = buildValidMilitaryExpertReview();
  return {
    ...base,
    definition_hash: MILITARY_EXPERT_RUNTIME_DEFINITION_HASH,
    ...overrides,
  };
}

function findingFromExpected(
  findingKey: string,
  category: string,
  realismStatus: string,
  title: string,
  excerpt: string,
  extras: Partial<MilitaryExpertFinding> = {},
): MilitaryExpertFinding {
  return {
    finding_id: findingKey,
    category: category as MilitaryExpertFinding["category"],
    title,
    observation: `Synthetic observation for ${findingKey}.`,
    manuscript_evidence: [{ excerpt, locator: "scene" }],
    confidence: "high",
    severity: realismStatus === "confirmed_error" ? "major" : "moderate",
    realism_status: realismStatus as MilitaryExpertFinding["realism_status"],
    operational_impact: "Operational credibility affected.",
    story_impact: "Reader trust affected.",
    recommendation: "Adjust for realism while preserving intent.",
    recommendation_type: "correct",
    preservation_note: "Preserve dramatic intent.",
    author_challenge_allowed: true,
    ...extras,
  };
}

/** Build synthetic perfect replay outputs for all corpus cases. */
export function buildPerfectMilitaryExpertReplayOutputs(): CalibrationReplayOutput[] {
  return MILITARY_EXPERT_CALIBRATION_CASES.map((calibrationCase) => {
    const findings: MilitaryExpertFinding[] = calibrationCase.expected_findings.map((ef) =>
      findingFromExpected(
        ef.finding_key,
        ef.category,
        ef.realism_status ?? "probable_concern",
        ef.finding_key.replace(/-/g, " "),
        calibrationCase.manuscript.text.slice(0, 80),
        {
          escalation_expert:
            (ef.escalation_expert as MilitaryExpertFinding["escalation_expert"]) ?? undefined,
          recommendation_type:
            (ef.recommendation_type as MilitaryExpertFinding["recommendation_type"]) ?? "correct",
          contrary_evidence: calibrationCase.expected_contrary_evidence.some(
            (c) => c.finding_key === ef.finding_key,
          )
            ? [{ excerpt: "Contrary passage noted.", locator: "scene" }]
            : undefined,
          uncertainty_note:
            ef.realism_status === "insufficient_evidence"
              ? "Insufficient context in excerpt."
              : undefined,
          manuscript_evidence:
            ef.must_include_evidence === false
              ? []
              : [{ excerpt: calibrationCase.manuscript.text.slice(0, 80), locator: "scene" }],
          realism_status:
            (ef.realism_status as MilitaryExpertFinding["realism_status"]) ?? "probable_concern",
        },
      ),
    );

    const review = baseReview({
      manuscript_version_id: `cal-${calibrationCase.case_id}`,
      review_scope: "scene",
      summary: `Calibration synthetic review for ${calibrationCase.case_id}.`,
      findings,
    });

    return {
      case_id: calibrationCase.case_id,
      run_index: 0,
      review,
      parse_status: "success" as const,
      repair_required: false,
      safety_failure: false,
      duration_ms: 5,
      input_tokens: 100,
      output_tokens: 200,
      request_hash: `req-${calibrationCase.case_id}`,
      raw_response_hash: `raw-${calibrationCase.case_id}`,
      parsed_output_hash: `parsed-${calibrationCase.case_id}`,
    };
  });
}

export const REPLAY_SCENARIO_PARTIAL_RECALL: CalibrationReplayOutput = {
  case_id: "me-coc-001",
  run_index: 0,
  review: baseReview({
    findings: [],
    summary: "No findings returned.",
  }),
  parse_status: "success",
};

export const REPLAY_SCENARIO_FALSE_POSITIVE_HEAVY: CalibrationReplayOutput = {
  case_id: "me-coc-002",
  run_index: 0,
  review: baseReview({
    findings: [
      findingFromExpected(
        "spurious-error",
        "command_and_organization",
        "confirmed_error",
        "Spurious command error",
        "The company commander nodded to the executive officer.",
      ),
    ],
  }),
  parse_status: "success",
};

export const REPLAY_SCENARIO_HALLUCINATED: CalibrationReplayOutput = {
  case_id: "me-coc-002",
  run_index: 0,
  review: baseReview({
    findings: [
      findingFromExpected(
        "hallucinated-vehicle",
        "weapons_and_equipment",
        "confirmed_error",
        "Nonexistent vehicle platform",
        "The hover tank arrived instantly.",
      ),
    ],
  }),
  parse_status: "success",
};

export const REPLAY_SCENARIO_MISSING_CONTRARY: CalibrationReplayOutput = {
  case_id: "me-ops-003",
  run_index: 0,
  review: baseReview({
    findings: [
      findingFromExpected(
        "breach-narrowed",
        "operations_and_tactics",
        "context_dependent",
        "Breach concern",
        "They breached the steel door.",
      ),
    ],
  }),
  parse_status: "success",
};

export const REPLAY_SCENARIO_PARSER_FAILURE: CalibrationReplayOutput = {
  case_id: "me-coc-001",
  run_index: 0,
  parse_status: "parse_failed",
  failure_reason: "malformed_json",
};

export const REPLAY_SCENARIO_REPAIR_REQUIRED: CalibrationReplayOutput = {
  case_id: "me-coc-001",
  run_index: 0,
  review: baseReview({ findings: [] }),
  parse_status: "success",
  repair_required: true,
};

export const REPLAY_SCENARIO_SAFETY_FAILURE: CalibrationReplayOutput = {
  case_id: "me-ops-004",
  run_index: 0,
  review: baseReview({
    findings: [
      findingFromExpected(
        "step-list",
        "operations_and_tactics",
        "probable_concern",
        "Step 1 wire the charge then step 2 detonate",
        "He wired every charge in sequence across the frame.",
      ),
    ],
  }),
  parse_status: "success",
  safety_failure: true,
};

export const REPLAY_SCENARIO_HIGH_COST: CalibrationReplayOutput = {
  ...buildPerfectMilitaryExpertReplayOutputs()[0]!,
  input_tokens: 50_000,
  output_tokens: 20_000,
};

export const REPLAY_SCENARIO_HIGH_LATENCY: CalibrationReplayOutput = {
  ...buildPerfectMilitaryExpertReplayOutputs()[0]!,
  duration_ms: 45_000,
};

export const REPLAY_SCENARIO_ZERO_RESULTS: CalibrationReplayOutput = {
  case_id: "me-int-003",
  run_index: 0,
  review: baseReview({ findings: [] }),
  parse_status: "success",
};

export const REPLAY_SCENARIO_MISSING_UNCERTAINTY: CalibrationReplayOutput = {
  case_id: "me-int-001",
  run_index: 0,
  review: baseReview({
    findings: [
      findingFromExpected(
        "opsec-error",
        "intelligence_and_opsec",
        "confirmed_error",
        "Confirmed OPSEC violation without context",
        "They discussed the mission over coffee.",
      ),
    ],
  }),
  parse_status: "success",
};

export const REPLAY_SCENARIO_INAPPROPRIATE_ESCALATION: CalibrationReplayOutput = {
  case_id: "me-hp-002",
  run_index: 0,
  review: baseReview({
    findings: [
      findingFromExpected(
        "stress-accurate",
        "human_performance",
        "accurate",
        "Stress response accurate",
        "After the contact, hands shook.",
        { escalation_expert: "medical_expert" },
      ),
    ],
  }),
  parse_status: "success",
};

export const REPLAY_SCENARIO_MISSED_ESCALATION: CalibrationReplayOutput = {
  case_id: "me-hp-003",
  run_index: 0,
  review: baseReview({
    findings: [
      findingFromExpected(
        "outside-domain",
        "human_performance",
        "outside_expertise",
        "Field surgery accuracy",
        "He reset the bone and closed the wound.",
      ),
    ],
  }),
  parse_status: "success",
};

export const REPLAY_SCENARIO_DUPLICATE_FINDINGS: CalibrationReplayOutput = {
  case_id: "me-trap-001",
  run_index: 0,
  review: baseReview({
    findings: [
      findingFromExpected(
        "dup-rank-error",
        "command_and_organization",
        "confirmed_error",
        "Corporal orders battalion",
        "The corporal ordered the battalion.",
      ),
      findingFromExpected(
        "dup-rank-error-2",
        "command_and_organization",
        "confirmed_error",
        "Corporal orders battalion again",
        "The corporal ordered the battalion.",
      ),
    ],
  }),
  parse_status: "success",
};

export const REPLAY_SCENARIO_OVERBROAD_FINDINGS: CalibrationReplayOutput = {
  case_id: "me-trap-002",
  run_index: 0,
  review: baseReview({
    findings: [
      findingFromExpected(
        "blanket-error",
        "overall_operational_realism",
        "confirmed_error",
        "Everything in the chapter was wrong",
        "Every military detail in the chapter was wrong.",
      ),
    ],
  }),
  parse_status: "success",
};

export const REPLAY_SCENARIO_ACCURATE_NON_FINDING: CalibrationReplayOutput = {
  case_id: "me-coc-002",
  run_index: 0,
  review: baseReview({
    findings: [
      findingFromExpected(
        "accurate-coc",
        "command_and_organization",
        "accurate",
        "Accurate company command chain",
        "The company commander nodded to the executive officer.",
        { severity: "informational", recommendation_type: "preserve" },
      ),
    ],
  }),
  parse_status: "success",
};

/** Pair of outputs for stability testing — identical hashes. */
export function buildStableRepeatedRunPair(caseId = "me-coc-001"): CalibrationReplayOutput[] {
  const base = buildPerfectMilitaryExpertReplayOutputs().find((r) => r.case_id === caseId)!;
  return [
    { ...base, run_index: 0, parsed_output_hash: "stable-hash-a" },
    { ...base, run_index: 1, parsed_output_hash: "stable-hash-a" },
  ];
}

/** Pair of outputs for stability testing — divergent finding sets. */
export function buildUnstableRepeatedRunPair(): CalibrationReplayOutput[] {
  return [
    REPLAY_SCENARIO_PARTIAL_RECALL,
    {
      ...REPLAY_SCENARIO_PARTIAL_RECALL,
      run_index: 1,
      review: baseReview({
        findings: [
          findingFromExpected(
            "rank-authority-error",
            "command_and_organization",
            "confirmed_error",
            "Corporal tasks battalion",
            "Corporal Hale assigned platoons.",
          ),
        ],
      }),
      parsed_output_hash: "unstable-hash-b",
    },
  ];
}

export const REPLAY_SCENARIO_INCOMPLETE_HUMAN_ADJUDICATION = {
  caseId: "me-rank-001",
  replay: buildPerfectMilitaryExpertReplayOutputs().find((r) => r.case_id === "me-rank-001")!,
  adjudicationRecords: [] as const,
} as const;

export const MILITARY_EXPERT_REPLAY_SCENARIOS = {
  perfect: buildPerfectMilitaryExpertReplayOutputs,
  partialRecall: REPLAY_SCENARIO_PARTIAL_RECALL,
  falsePositiveHeavy: REPLAY_SCENARIO_FALSE_POSITIVE_HEAVY,
  hallucinated: REPLAY_SCENARIO_HALLUCINATED,
  missingContrary: REPLAY_SCENARIO_MISSING_CONTRARY,
  missingUncertainty: REPLAY_SCENARIO_MISSING_UNCERTAINTY,
  inappropriateEscalation: REPLAY_SCENARIO_INAPPROPRIATE_ESCALATION,
  missedEscalation: REPLAY_SCENARIO_MISSED_ESCALATION,
  parserFailure: REPLAY_SCENARIO_PARSER_FAILURE,
  repairRequired: REPLAY_SCENARIO_REPAIR_REQUIRED,
  safetyFailure: REPLAY_SCENARIO_SAFETY_FAILURE,
  duplicateFindings: REPLAY_SCENARIO_DUPLICATE_FINDINGS,
  overbroadFindings: REPLAY_SCENARIO_OVERBROAD_FINDINGS,
  accurateNonFinding: REPLAY_SCENARIO_ACCURATE_NON_FINDING,
  stableRepeatedRuns: buildStableRepeatedRunPair,
  unstableRepeatedRuns: buildUnstableRepeatedRunPair,
  incompleteHumanAdjudication: REPLAY_SCENARIO_INCOMPLETE_HUMAN_ADJUDICATION,
  highCost: REPLAY_SCENARIO_HIGH_COST,
  highLatency: REPLAY_SCENARIO_HIGH_LATENCY,
  zeroResults: REPLAY_SCENARIO_ZERO_RESULTS,
} as const;
