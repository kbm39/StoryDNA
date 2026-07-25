/**
 * Sanitized Haiku 4.5 smoke v3 failure and corrected fixtures — no manuscripts, secrets, or raw provider prose.
 */

import type { MilitaryExpertGenerationPayload } from "./output-schema.ts";
import type { MilitaryExpertRawGenerationResponse } from "./generation-types.ts";
import {
  MILITARY_EXPERT_NO_CONTRARY_EVIDENCE_UNCERTAINTY_EXAMPLE,
} from "./output-schema.ts";
import { buildValidGenerationPayload } from "./generation-fixtures.ts";

function raw(correlationId: string, payload: unknown): MilitaryExpertRawGenerationResponse {
  return Object.freeze({
    correlationId,
    responseText: JSON.stringify(payload),
    finishStatus: "complete",
    capturedAt: "2026-07-25T21:00:00.000Z",
    provenance: Object.freeze({ source: "synthetic" as const }),
  });
}

const BASE_POSITIVE = buildValidGenerationPayload();
const BASE_ASSESSMENTS = BASE_POSITIVE.category_assessments;
const BASE_OVERALL = BASE_POSITIVE.overall_realism_assessment;
const NEGATIVE_FINDING = BASE_POSITIVE.findings[1]!;
const { contrary_evidence: _omitContrary, uncertainty_note: _omitUncertainty, ...NEGATIVE_WITHOUT_CONTRARY_FIELD } =
  NEGATIVE_FINDING;

/** v3 failure: missing overall_realism_assessment.conclusion field. */
export const SMOKE_V3_FIXTURE_MISSING_CONCLUSION = raw("me-v3-missing-conclusion", {
  ...BASE_POSITIVE,
  overall_realism_assessment: {
    confidence: BASE_OVERALL.confidence,
    primary_strengths: BASE_OVERALL.primary_strengths,
    primary_concerns: BASE_OVERALL.primary_concerns,
    preservation_priorities: BASE_OVERALL.preservation_priorities,
  },
});

/** v3 failure: empty conclusion string. */
export const SMOKE_V3_FIXTURE_EMPTY_CONCLUSION = raw("me-v3-empty-conclusion", {
  ...BASE_POSITIVE,
  overall_realism_assessment: {
    ...BASE_OVERALL,
    conclusion: "",
  },
});

/** v3 failure: null conclusion. */
export const SMOKE_V3_FIXTURE_NULL_CONCLUSION = raw("me-v3-null-conclusion", {
  ...BASE_POSITIVE,
  overall_realism_assessment: {
    ...BASE_OVERALL,
    conclusion: null,
  },
});

/** v3 failure: substitute overall_conclusion key. */
export const SMOKE_V3_FIXTURE_SUBSTITUTE_CONCLUSION = raw("me-v3-substitute-conclusion", {
  ...BASE_POSITIVE,
  overall_realism_assessment: {
    confidence: BASE_OVERALL.confidence,
    primary_strengths: BASE_OVERALL.primary_strengths,
    primary_concerns: BASE_OVERALL.primary_concerns,
    preservation_priorities: BASE_OVERALL.preservation_priorities,
    overall_conclusion: "This should not substitute for conclusion.",
  },
});

/** Valid positive-case conclusion. */
export const SMOKE_V3_FIXTURE_VALID_POSITIVE_CONCLUSION = raw(
  "me-v3-valid-positive-conclusion",
  BASE_POSITIVE,
);

/** Valid true-negative conclusion. */
export const SMOKE_V3_FIXTURE_VALID_TRUE_NEGATIVE_CONCLUSION = raw("me-v3-valid-true-negative", {
  ...BASE_POSITIVE,
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
    conclusion: "No material inaccuracies in supplied scope; residual period uncertainty remains.",
    confidence: "medium",
    primary_strengths: ["Squad coordination"],
    primary_concerns: [],
    preservation_priorities: ["Keep pacing intact"],
  },
  next_step: "No changes required; optionally confirm period for future passes.",
});

/** Valid safety-case conclusion. */
export const SMOKE_V3_FIXTURE_VALID_SAFETY_CONCLUSION = raw("me-v3-valid-safety-conclusion", {
  ...BASE_POSITIVE,
  summary:
    "Strengths include tense operational pacing, but breaching detail raises safety-sensitive concerns that require generalized editorial guidance.",
  findings: [
    {
      finding_id: "safety-generalized",
      category: "operations_and_tactics",
      title: "Breaching detail needs abstraction",
      observation: "Breaching language may read as instructional rather than dramatic.",
      manuscript_evidence: [
        { excerpt: "They prepared to breach the entry point.", locator: "Scene C" },
      ],
      contrary_evidence: [],
      uncertainty_note: MILITARY_EXPERT_NO_CONTRARY_EVIDENCE_UNCERTAINTY_EXAMPLE,
      confidence: "medium",
      severity: "major",
      realism_status: "probable_concern",
      operational_impact: "Risk of operational instruction tone.",
      story_impact: "Tension could remain with less procedural detail.",
      recommendation: "Keep breaching as outcome-focused drama; avoid stepwise procedure.",
      recommendation_type: "narrow",
      preservation_note: "Preserve the assault beat and stakes.",
      author_challenge_allowed: true,
    },
  ],
  overall_realism_assessment: {
    conclusion:
      "Operational tension works, but breaching detail should stay generalized without procedural instruction.",
    confidence: "medium",
    primary_strengths: ["Assault pacing"],
    primary_concerns: ["Instructional breaching tone"],
    preservation_priorities: ["Preserve stakes"],
  },
  next_step: "Generalize breaching prose while preserving dramatic intent.",
});

/** Negative finding with omitted contrary_evidence field. */
export const SMOKE_V3_FIXTURE_OMITTED_CONTRARY_FIELD = raw("me-v3-omitted-contrary", {
  ...BASE_POSITIVE,
  findings: [NEGATIVE_WITHOUT_CONTRARY_FIELD],
});

/** Negative finding with malformed contrary_evidence item. */
export const SMOKE_V3_FIXTURE_MALFORMED_CONTRARY = raw("me-v3-malformed-contrary", {
  ...BASE_POSITIVE,
  findings: [
    {
      ...NEGATIVE_FINDING,
      contrary_evidence: ["Officer oversight appears elsewhere."],
    },
  ],
});

/** Negative finding with valid contrary evidence object. */
export const SMOKE_V3_FIXTURE_VALID_CONTRARY = raw("me-v3-valid-contrary", {
  ...BASE_POSITIVE,
  findings: [
    {
      ...NEGATIVE_FINDING,
      contrary_evidence: [{ excerpt: "Officer oversight appears in an earlier beat.", locator: "scene" }],
    },
  ],
});

/** Negative finding with empty contrary_evidence plus valid uncertainty handling. */
export const SMOKE_V3_FIXTURE_EMPTY_CONTRARY_WITH_UNCERTAINTY = raw(
  "me-v3-empty-contrary-uncertainty",
  {
    ...BASE_POSITIVE,
    findings: [
      {
        ...NEGATIVE_FINDING,
        contrary_evidence: [],
        uncertainty_note: MILITARY_EXPERT_NO_CONTRARY_EVIDENCE_UNCERTAINTY_EXAMPLE,
      },
    ],
  },
);

/** Empty contrary array without required uncertainty handling. */
export const SMOKE_V3_FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY = raw(
  "me-v3-empty-contrary-no-uncertainty",
  {
    ...BASE_POSITIVE,
    findings: [
      {
        ...NEGATIVE_FINDING,
        contrary_evidence: [],
        uncertainty_note: undefined,
      },
    ],
  },
);

/** Generic top-level uncertainty does not satisfy contrary-evidence field. */
export const SMOKE_V3_FIXTURE_GENERIC_UNCERTAINTY_ELSEWHERE = raw(
  "me-v3-generic-uncertainty-elsewhere",
  {
    ...BASE_POSITIVE,
    uncertainty_summary: MILITARY_EXPERT_NO_CONTRARY_EVIDENCE_UNCERTAINTY_EXAMPLE,
    findings: [NEGATIVE_WITHOUT_CONTRARY_FIELD],
  },
);

/** Conclusion contradicting negative findings. */
export const SMOKE_V3_FIXTURE_CONCLUSION_CONTRADICTS = raw("me-v3-conclusion-contradicts", {
  ...BASE_POSITIVE,
  overall_realism_assessment: {
    ...BASE_OVERALL,
    conclusion: "No material concerns or inaccuracies were found in the supplied scope.",
  },
});

/** Summary present but conclusion omitted — must not infer from summary. */
export const SMOKE_V3_FIXTURE_SUMMARY_WITHOUT_CONCLUSION = raw("me-v3-summary-no-conclusion", {
  ...BASE_POSITIVE,
  summary:
    "Strengths include credible command scenes, but rank and timing concerns remain uncertain in places.",
  overall_realism_assessment: {
    confidence: BASE_OVERALL.confidence,
    primary_strengths: BASE_OVERALL.primary_strengths,
    primary_concerns: BASE_OVERALL.primary_concerns,
    preservation_priorities: BASE_OVERALL.preservation_priorities,
  },
});

export function buildCorrectedMeCoc001Payload(): MilitaryExpertGenerationPayload {
  return {
    ...BASE_POSITIVE,
    summary:
      "Strengths include clear command intent, but the corporal-led platoon assignment is a confirmed chain-of-command concern that should be corrected while preserving scene tension.",
    findings: [
      {
        finding_id: "rank-authority-error",
        category: "command_and_organization",
        title: "Corporal assigns platoon objectives",
        observation:
          "A corporal assigning separate platoon objectives without officer oversight violates normal chain of command.",
        manuscript_evidence: [
          {
            excerpt:
              "Corporal Hale assigned platoons to separate objectives without officer oversight.",
            locator: "scene",
          },
        ],
        contrary_evidence: [],
        uncertainty_note: MILITARY_EXPERT_NO_CONTRARY_EVIDENCE_UNCERTAINTY_EXAMPLE,
        confidence: "high",
        severity: "major",
        realism_status: "confirmed_error",
        operational_impact: "Chain-of-command credibility breaks for informed readers.",
        story_impact: "Authority relationships become harder to trust.",
        recommendation: "Route orders through an appropriate officer or NCO leader of the element.",
        recommendation_type: "correct",
        preservation_note: "Keep the multi-objective pressure and urgency.",
        author_challenge_allowed: true,
      },
    ],
    category_assessments: [
      {
        category: "command_and_organization",
        status: "weak",
        confidence: "high",
        strength_summary: "Intent is readable",
        concern_summary: "Rank authority error present",
        finding_count: 1,
        critical_count: 0,
        major_count: 1,
        verification_needed: false,
        evidence_coverage: "partial",
      },
    ],
    overall_realism_assessment: {
      conclusion:
        "Command intent is clear, but the corporal-led platoon assignment is a confirmed realism error requiring correction.",
      confidence: "high",
      primary_strengths: ["Clear operational intent"],
      primary_concerns: ["Chain-of-command violation"],
      preservation_priorities: ["Keep multi-objective pressure"],
    },
    next_step: "Revise rank authority so platoon tasking flows through appropriate leadership.",
  };
}

export function buildCorrectedMeCoc002Payload(): MilitaryExpertGenerationPayload {
  return {
    ...BASE_POSITIVE,
    summary:
      "Strengths include a credible company command interaction; no material inaccuracies were found in the supplied scope, though broader period context remains uncertain.",
    strengths: ["Plausible executive-officer coordination beat"],
    findings: [
      {
        finding_id: "accurate-coc",
        category: "command_and_organization",
        title: "Accurate company command chain",
        observation:
          "The company commander coordinating through the executive officer before issuing the fragmentary order reads plausibly.",
        manuscript_evidence: [
          {
            excerpt:
              "The company commander nodded to the executive officer before issuing the fragmentary order.",
            locator: "scene",
          },
        ],
        confidence: "high",
        severity: "informational",
        realism_status: "accurate",
        operational_impact: "Supports operational credibility.",
        story_impact: "Maintains reader trust in command scenes.",
        recommendation: "No change required.",
        recommendation_type: "preserve",
        preservation_note: "Keep the decisive briefing tone.",
        author_challenge_allowed: true,
      },
    ],
    category_assessments: [
      {
        category: "command_and_organization",
        status: "credible",
        confidence: "high",
        strength_summary: "Chain of command reads accurately",
        concern_summary: "No material concerns in scope",
        finding_count: 1,
        critical_count: 0,
        major_count: 0,
        verification_needed: false,
        evidence_coverage: "partial",
      },
    ],
    overall_realism_assessment: {
      conclusion:
        "Company command interaction is credible; no material inaccuracies were found in the supplied scope.",
      confidence: "high",
      primary_strengths: ["Accurate command chain"],
      primary_concerns: [],
      preservation_priorities: ["Keep briefing tone"],
    },
    next_step: "No changes required for command structure in this excerpt.",
  };
}

export function buildCorrectedMeOps004Payload(): MilitaryExpertGenerationPayload {
  return {
    ...BASE_POSITIVE,
    summary:
      "Strengths include sustained operational tension, but sequential breaching detail raises safety-sensitive concerns that should stay generalized.",
    findings: [
      {
        finding_id: "safety-generalized",
        category: "operations_and_tactics",
        title: "Breaching detail should stay generalized",
        observation:
          "Sequential charge wiring reads closer to instructional breaching detail than dramatic abstraction.",
        manuscript_evidence: [
          {
            excerpt: "He wired every charge in sequence across the frame and timed each detonator.",
            locator: "scene",
          },
        ],
        contrary_evidence: [],
        uncertainty_note: MILITARY_EXPERT_NO_CONTRARY_EVIDENCE_UNCERTAINTY_EXAMPLE,
        confidence: "medium",
        severity: "major",
        realism_status: "probable_concern",
        operational_impact: "Risk of operational instruction tone.",
        story_impact: "Tension can remain with less procedural specificity.",
        recommendation: "Keep the breach as outcome-focused drama without procedural sequencing.",
        recommendation_type: "narrow",
        preservation_note: "Preserve the assault beat and stakes.",
        author_challenge_allowed: true,
      },
    ],
    category_assessments: [
      {
        category: "operations_and_tactics",
        status: "mixed",
        confidence: "medium",
        strength_summary: "Operational tension is effective",
        concern_summary: "Breaching detail may read instructional",
        finding_count: 1,
        critical_count: 0,
        major_count: 1,
        verification_needed: false,
        evidence_coverage: "partial",
      },
    ],
    overall_realism_assessment: {
      conclusion:
        "Operational tension works, but breaching detail should remain generalized without procedural instruction.",
      confidence: "medium",
      primary_strengths: ["Assault pacing"],
      primary_concerns: ["Instructional breaching tone"],
      preservation_priorities: ["Preserve stakes"],
    },
    next_step: "Generalize breaching prose while preserving dramatic intent.",
  };
}

export const SMOKE_V3_FIXTURE_CORRECTED_ME_COC_001 = raw(
  "me-coc-001-corrected-v3",
  buildCorrectedMeCoc001Payload(),
);
export const SMOKE_V3_FIXTURE_CORRECTED_ME_COC_002 = raw(
  "me-coc-002-corrected-v3",
  buildCorrectedMeCoc002Payload(),
);
export const SMOKE_V3_FIXTURE_CORRECTED_ME_OPS_004 = raw(
  "me-ops-004-corrected-v3",
  buildCorrectedMeOps004Payload(),
);

export const SMOKE_V3_REPLAY_FIXTURES = Object.freeze({
  "me-coc-001": SMOKE_V3_FIXTURE_CORRECTED_ME_COC_001,
  "me-coc-002": SMOKE_V3_FIXTURE_CORRECTED_ME_COC_002,
  "me-ops-004": SMOKE_V3_FIXTURE_CORRECTED_ME_OPS_004,
});
