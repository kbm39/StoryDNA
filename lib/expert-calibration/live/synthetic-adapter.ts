import type { MilitaryExpertReview } from "@/experts/military-expert/contracts.ts";
import { MILITARY_EXPERT_NEGATIVE_REALISM_STATUSES } from "@/experts/military-expert/contracts.ts";
import type { MilitaryExpertRawGenerationResponse } from "@/experts/military-expert/generation-types.ts";
import type { MilitaryExpertGenerationPayload } from "@/experts/military-expert/output-schema.ts";
import { buildPerfectMilitaryExpertReplayOutputs } from "@/experts/military-expert/calibration/replay-fixtures.ts";
import type { SyntheticScenarioId } from "./contracts.ts";
import { LiveCalibrationError } from "./errors.ts";

export const SYNTHETIC_SCENARIO_IDS: readonly SyntheticScenarioId[] = Object.freeze([
  "success",
  "parser_failure",
  "timeout",
  "rate_limit",
  "service_failure",
  "unsafe_output",
  "output_too_large",
  "budget_exhausted",
  "correlation_mismatch",
]);

export function isSyntheticScenarioId(value: string): value is SyntheticScenarioId {
  return (SYNTHETIC_SCENARIO_IDS as readonly string[]).includes(value);
}

function reviewToPayload(review: MilitaryExpertReview): MilitaryExpertGenerationPayload {
  const payload = {
    summary: review.summary,
    strengths: [...review.strengths],
    findings: [...review.findings],
    category_assessments: [...review.category_assessments],
    overall_realism_assessment: review.overall_realism_assessment,
    critical_issues: [...review.critical_issues],
    priority_actions: [...review.priority_actions],
    verification_requests: [...review.verification_requests],
    escalation_recommendations: [...review.escalation_recommendations],
    uncertainty_summary: review.uncertainty_summary,
    next_step: review.next_step,
    author_challenge_supported: true as const,
  };

  let summary = payload.summary;
  const summaryLower = summary.toLowerCase();
  const mentionsStrength = /strength|works|accurate|credible|effective/.test(summaryLower);
  const mentionsConcern = /concern|inaccurate|issue|uncertain|weak|problem/.test(summaryLower);
  if (!mentionsStrength || !mentionsConcern) {
    summary =
      "Strengths include clear scene framing and credible intent. Concerns include operational realism gaps noted in the findings.";
  }

  const strengths =
    payload.strengths.length > 0 ? payload.strengths : ["Clear scene framing supports reader engagement."];

  const findings = payload.findings.map((finding) => {
    const negative = MILITARY_EXPERT_NEGATIVE_REALISM_STATUSES.includes(finding.realism_status);
    if (!negative) return finding;

    const hasContrary = (finding.contrary_evidence?.length ?? 0) > 0;
    const hasExplicitNone =
      /no contrary evidence|none was found|contrary evidence was not found|did not find contrary/i.test(
        `${finding.uncertainty_note ?? ""} ${finding.observation}`,
      );

    if (hasContrary || hasExplicitNone) return finding;

    return {
      ...finding,
      uncertainty_note:
        finding.uncertainty_note ??
        "No contrary evidence was found in the available excerpt.",
    };
  });

  return { ...payload, summary, strengths, findings };
}

function baseSyntheticRaw(
  correlationId: string,
  responseText: string,
  overrides: Partial<MilitaryExpertRawGenerationResponse> = {},
): MilitaryExpertRawGenerationResponse {
  return Object.freeze({
    correlationId,
    responseText,
    finishStatus: "complete" as const,
    inputTokens: 3114,
    outputTokens: 2500,
    modelIdentifier: "claude-3-5-haiku-20241022",
    capturedAt: "2026-07-25T12:00:00.000Z",
    provenance: Object.freeze({ source: "synthetic" as const }),
    ...overrides,
  });
}

export function buildSyntheticSuccessRawResponse(
  correlationId: string,
  caseId: string,
): MilitaryExpertRawGenerationResponse {
  const replay = buildPerfectMilitaryExpertReplayOutputs().find((r) => r.case_id === caseId);
  if (!replay?.review) {
    throw new LiveCalibrationError(
      "synthetic_scenario_unknown",
      `No perfect replay for case: ${caseId}`,
    );
  }
  const payload = reviewToPayload(replay.review as MilitaryExpertReview);
  return baseSyntheticRaw(correlationId, JSON.stringify(payload));
}

export interface SyntheticScenarioResult {
  readonly scenario: SyntheticScenarioId;
  readonly rawResponse?: MilitaryExpertRawGenerationResponse;
  readonly providerError?: { code: string; message: string };
  readonly abortReason?: string;
  readonly budgetExhausted?: boolean;
}

export function resolveSyntheticScenario(
  scenario: SyntheticScenarioId,
  correlationId: string,
  caseId: string,
): SyntheticScenarioResult {
  switch (scenario) {
    case "success":
      return {
        scenario,
        rawResponse: buildSyntheticSuccessRawResponse(correlationId, caseId),
      };

    case "parser_failure":
      return {
        scenario,
        rawResponse: baseSyntheticRaw(correlationId, "{ not valid json"),
      };

    case "timeout":
      return { scenario, abortReason: "timeout" };

    case "rate_limit":
      return {
        scenario,
        providerError: { code: "rate_limit", message: "Rate limit exceeded (synthetic)" },
      };

    case "service_failure":
      return {
        scenario,
        providerError: { code: "service_unavailable", message: "Service unavailable (synthetic)" },
      };

    case "unsafe_output":
      return {
        scenario,
        rawResponse: baseSyntheticRaw(
          correlationId,
          JSON.stringify({
            summary: "Unsafe operational guidance detected.",
            strengths: [],
            findings: [
              {
                finding_id: "unsafe-breach",
                category: "operations_and_tactics",
                title: "Step 1 breach the door, step 2 wire every charge",
                observation: "Step 1 enter the compound. Step 2 wire every charge in sequence.",
                manuscript_evidence: [{ excerpt: "He wired every charge", locator: "scene" }],
                confidence: "high",
                severity: "major",
                realism_status: "confirmed_error",
                operational_impact: "Unsafe.",
                story_impact: "Unsafe.",
                recommendation: "Revise.",
                recommendation_type: "correct",
                preservation_note: "Preserve intent.",
                author_challenge_allowed: true,
              },
            ],
            category_assessments: [],
            overall_realism_assessment: {
              conclusion: "Unsafe.",
              confidence: "high",
              primary_strengths: [],
              primary_concerns: ["Unsafe guidance"],
              preservation_priorities: [],
            },
            critical_issues: [],
            priority_actions: [],
            verification_requests: [],
            escalation_recommendations: [],
            uncertainty_summary: "",
            next_step: "Revise unsafe content.",
            author_challenge_supported: true,
          }),
        ),
      };

    case "output_too_large":
      return {
        scenario,
        rawResponse: baseSyntheticRaw(correlationId, JSON.stringify({ blob: "x".repeat(600_000) })),
      };

    case "budget_exhausted":
      return { scenario, budgetExhausted: true };

    case "correlation_mismatch":
      return {
        scenario,
        rawResponse: buildSyntheticSuccessRawResponse(`wrong-${correlationId}`, caseId),
      };

    default:
      throw new LiveCalibrationError(
        "synthetic_scenario_unknown",
        `Unknown synthetic scenario: ${scenario satisfies never}`,
      );
  }
}

export function getSyntheticScenarioIds(): readonly SyntheticScenarioId[] {
  return SYNTHETIC_SCENARIO_IDS;
}
