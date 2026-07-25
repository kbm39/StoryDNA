/**
 * Sanitized Haiku 4.5 smoke-remediation fixtures — no manuscripts, secrets, or raw provider prose.
 */

import type { MilitaryExpertGenerationPayload } from "./output-schema.ts";
import type { MilitaryExpertRawGenerationResponse } from "./generation-types.ts";
import { buildValidGenerationPayload } from "./generation-fixtures.ts";

function raw(correlationId: string, payload: unknown): MilitaryExpertRawGenerationResponse {
  return Object.freeze({
    correlationId,
    responseText: JSON.stringify(payload),
    finishStatus: "complete",
    capturedAt: "2026-07-25T12:00:00.000Z",
    provenance: Object.freeze({ source: "synthetic" as const }),
  });
}

const BASE_ASSESSMENTS = buildValidGenerationPayload().category_assessments;
const BASE_OVERALL = buildValidGenerationPayload().overall_realism_assessment;

/** Smoke case 1 failure shape: unsupported author_challenge_note, missing required top-level fields. */
export const SMOKE_FIXTURE_UNSUPPORTED_COMMENTARY = raw("me-coc-001-smoke", {
  author_challenge_note: "Author may dispute rank finding.",
  findings: [
    {
      finding_id: "rank-issue",
      category: "command_and_organization",
      title: "Rank mismatch",
      observation: "A corporal appears to direct a major.",
      manuscript_evidence: [{ excerpt: "Corporal Hale signed the op order.", locator: "Scene A" }],
      contrary_evidence: [],
      uncertainty_note: "No contrary evidence was found in the supplied scope.",
      confidence: "moderate",
      severity: "minor",
      realism_status: "probable_concern",
      operational_impact: "Chain-of-command credibility weakens.",
      story_impact: "Reader trust dips slightly.",
      recommendation: "Adjust rank or reporting relationship.",
      recommendation_type: "correct",
      preservation_note: "Keep the briefing tension.",
      author_challenge_allowed: true,
    },
  ],
  category_assessments: BASE_ASSESSMENTS,
  overall_realism_assessment: BASE_OVERALL,
  critical_issues: [],
  priority_actions: [],
  verification_requests: [],
  escalation_recommendations: [],
  uncertainty_summary: "Limited rank context.",
});

/** Smoke case 2 failure shape: missing summary/strengths/next_step + invalid enums. */
export const SMOKE_FIXTURE_MISSING_REQUIRED_TOP_LEVEL = raw("me-coc-002-smoke", {
  findings: [
    {
      finding_id: "comms-issue",
      category: "communications_and_terminology",
      title: "Informal radio check",
      observation: "Radio check phrasing is informal.",
      manuscript_evidence: [{ excerpt: "Radio check, anyone there?", locator: "Scene B" }],
      contrary_evidence: [],
      uncertainty_note: "No contrary evidence was found in the supplied scope.",
      confidence: "high",
      severity: "medium",
      realism_status: "context_dependent",
      operational_impact: "Minor comms credibility concern.",
      story_impact: "Low impact on tension.",
      recommendation: "Clarify whether informal net is intentional.",
      recommendation_type: "context_clarification",
      preservation_note: "Keep urgency in the exchange.",
      author_challenge_allowed: true,
    },
  ],
  category_assessments: BASE_ASSESSMENTS,
  overall_realism_assessment: BASE_OVERALL,
  critical_issues: [],
  priority_actions: [],
  verification_requests: [],
  escalation_recommendations: [],
  uncertainty_summary: "Period-specific comms doctrine not supplied.",
  author_challenge_supported: true,
});

/** Smoke case 3 failure shape: closing_note + context_required recommendation type. */
export const SMOKE_FIXTURE_CLOSING_NOTE = raw("me-ops-004-smoke", {
  closing_note: "Review complete.",
  findings: [
    {
      finding_id: "tactical-detail",
      category: "operations_and_tactics",
      title: "Ambiguous breaching context",
      observation: "Breaching sequence lacks period context.",
      manuscript_evidence: [{ excerpt: "They prepared to breach the door.", locator: "Scene C" }],
      contrary_evidence: [],
      uncertainty_note: "No contrary evidence was found in the supplied scope.",
      confidence: "low",
      severity: "moderate",
      realism_status: "insufficient_evidence",
      operational_impact: "Cannot assess tactical plausibility without period.",
      story_impact: "Suspense remains intact.",
      recommendation: "Supply period and force type for verification.",
      recommendation_type: "context_required",
      preservation_note: "Keep the tension beat.",
      author_challenge_allowed: true,
    },
  ],
  category_assessments: BASE_ASSESSMENTS,
  overall_realism_assessment: BASE_OVERALL,
  critical_issues: [],
  priority_actions: [],
  verification_requests: ["Confirm period and unit type"],
  escalation_recommendations: [],
  uncertainty_summary: "Insufficient operational context.",
  author_challenge_supported: true,
});

export function buildCorrectedPositiveFindingPayload(): MilitaryExpertGenerationPayload {
  return buildValidGenerationPayload();
}

export function buildCorrectedTrueNegativePayload(): MilitaryExpertGenerationPayload {
  const base = buildValidGenerationPayload();
  return {
    ...base,
    summary:
      "Strengths include credible squad coordination; no material inaccuracies were found in the supplied scope, though period detail remains uncertain.",
    strengths: ["Plausible squad dialogue under pressure"],
    findings: [],
    category_assessments: [
      {
        category: "command_and_organization",
        status: "credible",
        confidence: "medium",
        strength_summary: "Command interactions read plausibly",
        concern_summary: "No material concerns in scope",
        finding_count: 0,
        critical_count: 0,
        major_count: 0,
        verification_needed: false,
        evidence_coverage: "partial",
      },
    ],
    overall_realism_assessment: {
      conclusion: "No negative findings in supplied scope.",
      confidence: "medium",
      primary_strengths: ["Squad coordination"],
      primary_concerns: [],
      preservation_priorities: ["Keep pacing intact"],
    },
    next_step: "No changes required; optionally confirm period for future passes.",
  };
}

export function buildCorrectedSafetyEscalationPayload(): MilitaryExpertGenerationPayload {
  const base = buildValidGenerationPayload();
  return {
    ...base,
    summary:
      "Strengths include tense operational pacing, but breaching detail raises safety-sensitive concerns that require generalized editorial guidance.",
    findings: [
      {
        finding_id: "safety-breach-generalization",
        category: "operations_and_tactics",
        title: "Breaching detail needs abstraction",
        observation: "Breaching language may read as instructional rather than dramatic.",
        manuscript_evidence: [{ excerpt: "They prepared to breach the entry point.", locator: "Scene C" }],
        contrary_evidence: [],
        uncertainty_note: "No contrary evidence was found in the supplied scope.",
        confidence: "medium",
        severity: "major",
        realism_status: "probable_concern",
        operational_impact: "Risk of operational instruction tone.",
        story_impact: "Tension could remain with less procedural detail.",
        recommendation: "Keep breaching as outcome-focused drama; avoid stepwise procedure.",
        recommendation_type: "narrow",
        preservation_note: "Preserve the assault beat and stakes.",
        escalation_expert: "intelligence_expert",
        author_challenge_allowed: true,
      },
    ],
    escalation_recommendations: ["Route intelligence detail to Intelligence specialist"],
    next_step: "Generalize breaching prose while preserving dramatic intent.",
  };
}

export const SMOKE_FIXTURE_CORRECTED_POSITIVE = raw(
  "me-coc-001-corrected",
  buildCorrectedPositiveFindingPayload(),
);
export const SMOKE_FIXTURE_CORRECTED_TRUE_NEGATIVE = raw(
  "me-coc-002-corrected",
  buildCorrectedTrueNegativePayload(),
);
export const SMOKE_FIXTURE_CORRECTED_SAFETY = raw(
  "me-ops-004-corrected",
  buildCorrectedSafetyEscalationPayload(),
);

export const SMOKE_FIXTURE_UNKNOWN_ENUM = raw("unknown-enum", {
  ...buildCorrectedPositiveFindingPayload(),
  findings: [
    {
      ...buildCorrectedPositiveFindingPayload().findings[1],
      recommendation_type: "invented_type",
    },
  ],
});

export const SMOKE_FIXTURE_ALIAS_CONFIDENCE = raw("alias-confidence", {
  ...buildCorrectedPositiveFindingPayload(),
  findings: [
    {
      ...buildCorrectedPositiveFindingPayload().findings[1],
      confidence: "moderate",
    },
  ],
});

export const SMOKE_FIXTURE_ALIAS_SEVERITY = raw("alias-severity", {
  ...buildCorrectedPositiveFindingPayload(),
  findings: [
    {
      ...buildCorrectedPositiveFindingPayload().findings[1],
      severity: "medium",
    },
  ],
});
