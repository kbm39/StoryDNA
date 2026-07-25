/**
 * Sanitized Haiku 4.5 smoke v2 failure fixtures — no manuscripts, secrets, or raw provider prose.
 */

import type { MilitaryExpertRawGenerationResponse } from "./generation-types.ts";
import {
  buildCorrectedPositiveFindingPayload,
  buildCorrectedSafetyEscalationPayload,
  buildCorrectedTrueNegativePayload,
} from "./smoke-remediation-fixtures.ts";
import { buildValidGenerationPayload } from "./generation-fixtures.ts";

function raw(correlationId: string, payload: unknown): MilitaryExpertRawGenerationResponse {
  return Object.freeze({
    correlationId,
    responseText: JSON.stringify(payload),
    finishStatus: "complete",
    capturedAt: "2026-07-25T14:00:00.000Z",
    provenance: Object.freeze({ source: "synthetic" as const }),
  });
}

const BASE_POSITIVE = buildValidGenerationPayload();
const BASE_ASSESSMENTS = BASE_POSITIVE.category_assessments;
const BASE_OVERALL = BASE_POSITIVE.overall_realism_assessment;

/** v2 failure: manuscript_evidence returned as string instead of object. */
export const SMOKE_V2_FIXTURE_EVIDENCE_STRING = raw("me-coc-001-evidence-string", {
  ...BASE_POSITIVE,
  findings: [
    {
      ...BASE_POSITIVE.findings[1],
      manuscript_evidence: ["Corporal Hale checked the radio twice before the convoy moved out."],
    },
  ],
});

/** v2 failure: negative finding with no valid evidence object. */
export const SMOKE_V2_FIXTURE_NEGATIVE_NO_EVIDENCE = raw("me-coc-001-no-evidence", {
  ...BASE_POSITIVE,
  findings: [
    {
      ...BASE_POSITIVE.findings[1],
      manuscript_evidence: [],
    },
  ],
});

/** v2 failure: missing contrary-evidence representation. */
export const SMOKE_V2_FIXTURE_MISSING_CONTRARY = raw("me-coc-001-missing-contrary", {
  ...BASE_POSITIVE,
  findings: [
    {
      ...BASE_POSITIVE.findings[1],
      contrary_evidence: undefined,
      uncertainty_note: undefined,
    },
  ],
});

/** v2 failure: empty category assessment status. */
export const SMOKE_V2_FIXTURE_EMPTY_CATEGORY_STATUS = raw("me-coc-001-empty-status", {
  ...BASE_POSITIVE,
  category_assessments: [
    {
      ...BASE_ASSESSMENTS[0],
      status: "",
    },
  ],
});

/** v2 failure: unsupported category status synonym. */
export const SMOKE_V2_FIXTURE_UNSUPPORTED_CATEGORY_STATUS = raw("me-coc-001-bad-status", {
  ...BASE_POSITIVE,
  category_assessments: [
    {
      ...BASE_ASSESSMENTS[0],
      status: "acceptable",
    },
  ],
});

/** v2 failure: summary mentions concerns but no strengths. */
export const SMOKE_V2_FIXTURE_SUMMARY_CONCERNS_ONLY = raw("me-coc-001-summary-concerns", {
  ...BASE_POSITIVE,
  summary:
    "Several inaccurate rank depictions and comms issues undermine credibility throughout the supplied scope.",
});

/** v2 failure: summary mentions strengths but omits material concern. */
export const SMOKE_V2_FIXTURE_SUMMARY_OMITS_CONCERN = raw("me-coc-001-summary-omit-concern", {
  ...BASE_POSITIVE,
  summary:
    "Strengths include credible command scenes and effective squad dialogue under pressure throughout the supplied scope.",
});

export const SMOKE_V2_FIXTURE_CORRECTED_POSITIVE = raw(
  "me-coc-001-corrected",
  buildCorrectedPositiveFindingPayload(),
);
export const SMOKE_V2_FIXTURE_CORRECTED_TRUE_NEGATIVE = raw(
  "me-coc-002-corrected",
  buildCorrectedTrueNegativePayload(),
);
export const SMOKE_V2_FIXTURE_CORRECTED_SAFETY = raw(
  "me-ops-004-corrected",
  buildCorrectedSafetyEscalationPayload(),
);

export const SMOKE_V2_FIXTURE_ALIAS_WITH_AUDIT = raw("me-coc-001-alias", {
  ...buildCorrectedPositiveFindingPayload(),
  findings: [
    {
      ...buildCorrectedPositiveFindingPayload().findings[1],
      confidence: "moderate",
    },
  ],
});

export const SMOKE_V2_FIXTURE_UNKNOWN_STRUCTURAL = raw("me-coc-001-unknown-struct", {
  ...buildCorrectedPositiveFindingPayload(),
  findings: [
    {
      ...buildCorrectedPositiveFindingPayload().findings[1],
      recommendation_type: "invented_type",
    },
  ],
});

export const SMOKE_V2_REPLAY_FIXTURES = Object.freeze({
  "me-coc-001": SMOKE_V2_FIXTURE_CORRECTED_POSITIVE,
  "me-coc-002": SMOKE_V2_FIXTURE_CORRECTED_TRUE_NEGATIVE,
  "me-ops-004": SMOKE_V2_FIXTURE_CORRECTED_SAFETY,
} as const);
