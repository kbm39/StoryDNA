/**
 * Synthetic Military Expert generation fixtures (PR 2 — no Hold Fast content).
 */

import { MAX_CANONICAL_OUTPUT_BYTES } from "@/lib/expert-review-engine/canonical-output.ts";
import type { MilitaryExpertGenerationPayload } from "./output-schema.ts";
import type {
  MilitaryExpertGenerationContractInput,
  MilitaryExpertRawGenerationResponse,
} from "./generation-types.ts";

export const FIXTURE_CORRELATION_ID = "me-gen-fixture-001" as const;
export const FIXTURE_MANUSCRIPT_VERSION_ID = "mv-gen-fixture-001" as const;
export const FIXTURE_MANUSCRIPT_HASH = "synthetic-manuscript-hash-001" as const;

export const FIXTURE_MANUSCRIPT_TEXT = [
  "Chapter One",
  "",
  "Captain Reyes signed the op order while the squad waited in the rain.",
  "",
  "Corporal Hale checked the radio twice before the convoy moved out.",
].join("\n");

export function baseRawResponse(
  responseText: string,
  correlationId: string = FIXTURE_CORRELATION_ID,
  overrides: Partial<MilitaryExpertRawGenerationResponse> = {},
): MilitaryExpertRawGenerationResponse {
  return {
    correlationId,
    responseText,
    finishStatus: "complete",
    capturedAt: "2026-07-24T00:00:00.000Z",
    provenance: { source: "synthetic" },
    ...overrides,
  };
}

export function buildValidGenerationPayload(): MilitaryExpertGenerationPayload {
  return {
    summary:
      "Strengths include credible command scenes, but rank and timing concerns remain uncertain in places and should be preserved where they serve tension.",
    strengths: ["Clear squad dialogue under pressure"],
    findings: [
      {
        finding_id: "accurate-command-chain",
        category: "command_and_organization",
        title: "Accurate company command chain",
        observation: "Company commander issues orders through the executive officer plausibly.",
        manuscript_evidence: [
          { excerpt: "Captain Reyes signed the op order while the squad waited.", locator: "Chapter One" },
        ],
        contrary_evidence: [
          { excerpt: "No higher headquarters approval is shown.", locator: "Chapter One" },
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
      {
        finding_id: "communications-terminology",
        category: "communications_and_terminology",
        title: "Informal radio check",
        observation: "The radio check is slightly informal for a tactical net.",
        manuscript_evidence: [
          { excerpt: "Corporal Hale checked the radio twice before the convoy moved out.", locator: "Chapter One" },
        ],
        contrary_evidence: [],
        uncertainty_note: "No contrary evidence was found in the supplied scope.",
        confidence: "medium",
        severity: "minor",
        realism_status: "probable_concern",
        operational_impact: "Minor credibility dip on comms discipline.",
        story_impact: "Low impact on tension.",
        recommendation: "Use shorter, disciplined radio exchanges while keeping urgency.",
        recommendation_type: "clarify",
        preservation_note: "Keep the pre-move tension beat.",
        author_challenge_allowed: true,
      },
    ],
    category_assessments: [
      {
        category: "command_and_organization",
        status: "credible",
        confidence: "medium",
        strength_summary: "Chain of command mostly plausible",
        concern_summary: "One minor comms issue",
        finding_count: 2,
        critical_count: 0,
        major_count: 0,
        verification_needed: false,
        evidence_coverage: "partial",
      },
    ],
    overall_realism_assessment: {
      conclusion: "Mixed operational credibility with strong command scenes.",
      confidence: "medium",
      primary_strengths: ["Command interactions"],
      primary_concerns: ["Informal comms phrasing"],
      preservation_priorities: ["Keep the pre-move tension"],
    },
    critical_issues: [],
    priority_actions: ["Verify rank references in chapter one"],
    verification_requests: [],
    escalation_recommendations: [],
    uncertainty_summary: "Limited period detail for comms gear.",
    next_step: "Revise radio phrasing and confirm rank references.",
    author_challenge_supported: true,
  };
}

export function buildValidGenerationJson(): string {
  return JSON.stringify(buildValidGenerationPayload());
}

export const FIXTURE_VALID_COMPLETE_JSON = baseRawResponse(buildValidGenerationJson());

export const FIXTURE_VALID_FENCED_JSON = baseRawResponse(
  "```json\n" + buildValidGenerationJson() + "\n```",
);

export const FIXTURE_TRAILING_CLOSING_FENCE = baseRawResponse(
  "```json\n" + buildValidGenerationJson() + "\n```\n",
);

export const FIXTURE_BARE_JSON_TRAILING_FENCE = baseRawResponse(
  buildValidGenerationJson() + "\n```",
);

export const FIXTURE_BARE_JSON_TRAILING_JSON_FENCE = baseRawResponse(
  buildValidGenerationJson() + "\n```json",
);

export const FIXTURE_FENCED_JSON_TRAILING_JSON_FENCE = baseRawResponse(
  "```json\n" + buildValidGenerationJson() + "\n```json",
);

export const FIXTURE_TRAILING_WHITESPACE = baseRawResponse(buildValidGenerationJson() + "\n\n  \n");

export const FIXTURE_TRAILING_PARTIAL_DUPLICATE = baseRawResponse(
  buildValidGenerationJson() + '\n{"summary":"dup',
);

export const FIXTURE_MALFORMED_JSON = baseRawResponse("{summary: not valid json");

export const FIXTURE_MULTIPLE_PAYLOADS = baseRawResponse(
  buildValidGenerationJson() + "\n" + JSON.stringify({ second_payload: true }),
);

export const FIXTURE_TRAILING_PROSE = baseRawResponse(buildValidGenerationJson() + "\nExtra prose.");

export function buildSafeMarkdownAuthorSummary(): string {
  return [
    "## Summary for Author",
    "",
    "- Command scenes remain credible overall.",
    "- Radio phrasing is slightly informal but preserves tension.",
    "- Next step: revise radio phrasing and confirm rank references.",
  ].join("\n");
}

export const FIXTURE_TRAILING_MARKDOWN_SUMMARY = baseRawResponse(
  buildValidGenerationJson() + "\n```\n\n" + buildSafeMarkdownAuthorSummary(),
);

export const FIXTURE_TRAILING_MARKDOWN_SUMMARY_HEADINGS = baseRawResponse(
  buildValidGenerationJson() +
    "\n\n## Key Takeaways\n\n- Clear squad dialogue under pressure\n- Informal radio check noted as minor concern",
);

export const FIXTURE_TRAILING_MARKDOWN_NEW_FINDING = baseRawResponse(
  buildValidGenerationJson() +
    "\n\n## Additional Review\n\n- **New finding:** logistics timing error in chapter two.",
);

export const FIXTURE_TRAILING_MARKDOWN_CHANGED_SEVERITY = baseRawResponse(
  buildValidGenerationJson() +
    "\n\n## Summary for Author\n\n- Severity should be critical for the radio check issue.",
);

export const FIXTURE_TRAILING_MARKDOWN_CHANGED_RECOMMENDATION = baseRawResponse(
  buildValidGenerationJson() +
    "\n\n## Summary for Author\n\n- Recommendation should be remove the radio scene entirely.",
);

export const FIXTURE_TRAILING_MARKDOWN_NEW_EVIDENCE = baseRawResponse(
  buildValidGenerationJson() +
    '\n\n## Summary for Author\n\n- Evidence: "The colonel personally rewired the encrypted satellite terminal before dawn."',
);

export const FIXTURE_TRAILING_MARKDOWN_CORRECTION = baseRawResponse(
  buildValidGenerationJson() +
    "\n\n## Correction\n\nThis JSON report understated the command-chain issue; the memo replaces it.",
);

export const FIXTURE_TRAILING_MARKDOWN_FENCED_SECOND_PAYLOAD = baseRawResponse(
  buildValidGenerationJson() + '\n\n```json\n{"second_payload":true}\n```',
);

export const FIXTURE_TRAILING_MARKDOWN_MALFORMED = baseRawResponse(
  "{summary: broken}\n\n## Summary for Author\n\n- Nothing valid here.",
);

export const FIXTURE_TRAILING_MARKDOWN_TRUNCATED = baseRawResponse(
  buildValidGenerationJson().slice(0, -20) + "\n\n## Summary for Author\n\n- Trailing summary.",
  undefined,
  { finishStatus: "truncated" },
);

export const FIXTURE_MISSING_EVIDENCE = baseRawResponse(
  JSON.stringify({
    ...buildValidGenerationPayload(),
    findings: [
      {
        ...buildValidGenerationPayload().findings[1],
        finding_id: "missing-evidence",
        manuscript_evidence: [],
        contrary_evidence: [],
        uncertainty_note: "",
      },
    ],
  }),
);

export const FIXTURE_MISSING_CONTRARY_EVIDENCE = baseRawResponse(
  JSON.stringify({
    ...buildValidGenerationPayload(),
    findings: [
      (() => {
        const finding = {
          ...buildValidGenerationPayload().findings[1],
          finding_id: "missing-contrary",
        };
        delete (finding as { contrary_evidence?: unknown }).contrary_evidence;
        delete (finding as { uncertainty_note?: unknown }).uncertainty_note;
        return finding;
      })(),
    ],
  }),
);

export const FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY = baseRawResponse(
  JSON.stringify({
    ...buildValidGenerationPayload(),
    findings: [
      (() => {
        const finding = {
          ...buildValidGenerationPayload().findings[1],
          finding_id: "empty-contrary-no-note",
          contrary_evidence: [],
        };
        delete (finding as { uncertainty_note?: unknown }).uncertainty_note;
        return finding;
      })(),
    ],
  }),
);

export const FIXTURE_EXPLICIT_NO_CONTRARY_OBSERVATION = baseRawResponse(
  JSON.stringify({
    ...buildValidGenerationPayload(),
    findings: [
      (() => {
        const finding = {
          ...buildValidGenerationPayload().findings[1],
          finding_id: "explicit-no-contrary",
          observation:
            "The radio check is slightly informal for a tactical net. No contrary evidence was found in the supplied scope.",
        };
        delete (finding as { contrary_evidence?: unknown }).contrary_evidence;
        delete (finding as { uncertainty_note?: unknown }).uncertainty_note;
        return finding;
      })(),
    ],
  }),
);

export function buildContraryEvidencePatchSuccessJson(args?: {
  findingIndex?: number;
  missingFields?: ("contrary_evidence" | "uncertainty_note")[];
}): string {
  const findingIndex = args?.findingIndex ?? 0;
  const repairs: Array<{ finding_index: number; field: string; value: unknown }> = [];
  const fields = args?.missingFields ?? ["contrary_evidence", "uncertainty_note"];

  if (fields.includes("contrary_evidence")) {
    repairs.push({ finding_index: findingIndex, field: "contrary_evidence", value: [] });
  }
  if (fields.includes("uncertainty_note") || fields.includes("contrary_evidence")) {
    repairs.push({
      finding_index: findingIndex,
      field: "uncertainty_note",
      value: "No contrary evidence was found in the supplied scope.",
    });
  }

  return JSON.stringify({ repairs });
}

export function buildContraryEvidenceRepairSuccessJson(): string {
  return buildContraryEvidencePatchSuccessJson();
}

export const FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS = baseRawResponse(
  buildContraryEvidenceRepairSuccessJson(),
);

export const FIXTURE_CONTRARY_EVIDENCE_REPAIR_FAILED = baseRawResponse(
  JSON.stringify({
    repairs: [{ finding_index: 0, field: "contrary_evidence", value: [] }],
  }),
);

export const FIXTURE_CONTRARY_EVIDENCE_UNCERTAINTY_PATCH_SUCCESS = baseRawResponse(
  buildContraryEvidencePatchSuccessJson({
    missingFields: ["uncertainty_note"],
  }),
);

export const FIXTURE_UNSUPPORTED_CATEGORY = baseRawResponse(
  JSON.stringify({
    ...buildValidGenerationPayload(),
    findings: [
      {
        ...buildValidGenerationPayload().findings[1],
        category: "not_a_category",
      },
    ],
  }),
);

export const FIXTURE_UNSUPPORTED_ENUM = baseRawResponse(
  JSON.stringify({
    ...buildValidGenerationPayload(),
    findings: [
      {
        ...buildValidGenerationPayload().findings[1],
        realism_status: "made_up",
      },
    ],
  }),
);

export const FIXTURE_UNSAFE_OPERATIONAL_DETAIL = baseRawResponse(
  JSON.stringify({
    ...buildValidGenerationPayload(),
    findings: [
      {
        ...buildValidGenerationPayload().findings[1],
        recommendation: "Step 1 enter the compound. Step 2 breach the door. Step 3 engage.",
      },
    ],
  }),
);

export const FIXTURE_LETTER_GRADE = baseRawResponse(
  JSON.stringify({
    ...buildValidGenerationPayload(),
    summary: "Overall grade A- with some concerns and strengths.",
  }),
);

export const FIXTURE_FABRICATED_SOURCE = baseRawResponse(
  JSON.stringify({
    ...buildValidGenerationPayload(),
    findings: [
      {
        ...buildValidGenerationPayload().findings[1],
        source_requirements: "See classified field manual FM-9999 for proof.",
      },
    ],
  }),
);

export const FIXTURE_INSUFFICIENT_EVIDENCE_DEDUCTION = baseRawResponse(
  JSON.stringify({
    ...buildValidGenerationPayload(),
    findings: [
      {
        ...buildValidGenerationPayload().findings[1],
        realism_status: "insufficient_evidence",
        score_impact: -5,
        manuscript_evidence: [],
        uncertainty_note: "No contrary evidence was found in the supplied scope.",
        operational_impact: "Not assessed.",
        recommendation: "Provide more context.",
        recommendation_type: "verify",
      },
    ],
  }),
);

export const FIXTURE_ACCURATE_NEGATIVE_DEDUCTION = baseRawResponse(
  JSON.stringify({
    ...buildValidGenerationPayload(),
    findings: [
      {
        ...buildValidGenerationPayload().findings[0],
        score_impact: -3,
      },
    ],
  }),
);

export const FIXTURE_CRITICAL_WEAK_EVIDENCE = baseRawResponse(
  JSON.stringify({
    ...buildValidGenerationPayload(),
    findings: [
      {
        ...buildValidGenerationPayload().findings[1],
        severity: "critical",
        confidence: "medium",
      },
    ],
  }),
);

export const FIXTURE_OUTSIDE_DOMAIN_NO_ESCALATION = baseRawResponse(
  JSON.stringify({
    ...buildValidGenerationPayload(),
    findings: [
      {
        ...buildValidGenerationPayload().findings[1],
        category: "human_performance",
        realism_status: "outside_expertise",
        severity: "informational",
        escalation_expert: undefined,
      },
    ],
  }),
);

export const FIXTURE_RESPONSE_TOO_LARGE = baseRawResponse(
  " ".repeat(MAX_CANONICAL_OUTPUT_BYTES + 1),
);

export const FIXTURE_CORRELATION_MISMATCH = baseRawResponse(buildValidGenerationJson(), "wrong-correlation");

export const FIXTURE_DETERMINISTIC_CLEANUP_ONLY = baseRawResponse(
  "  ```json\n" + buildValidGenerationJson() + "\n```  ",
);

export const FIXTURE_PROVIDER_REPAIR_REQUIRED = FIXTURE_MALFORMED_JSON;

export function buildValidGenerationContractInput(): MilitaryExpertGenerationContractInput {
  return {
    correlationId: FIXTURE_CORRELATION_ID,
    manuscriptVersionId: FIXTURE_MANUSCRIPT_VERSION_ID,
    reviewScope: "full_manuscript",
    manuscriptText: FIXTURE_MANUSCRIPT_TEXT,
    canonicalWordCount: 24,
    manuscriptHash: FIXTURE_MANUSCRIPT_HASH,
    genreContext: "military thriller",
    countryPeriod: "contemporary US",
    rawResponse: FIXTURE_VALID_COMPLETE_JSON,
  };
}

export function buildInvalidGenerationContractInput(): MilitaryExpertGenerationContractInput {
  return {
    ...buildValidGenerationContractInput(),
    rawResponse: FIXTURE_MISSING_EVIDENCE,
  };
}

export const MILITARY_EXPERT_GENERATION_FIXTURES = {
  validCompleteJson: FIXTURE_VALID_COMPLETE_JSON,
  validFencedJson: FIXTURE_VALID_FENCED_JSON,
  malformedJson: FIXTURE_MALFORMED_JSON,
  multiplePayloads: FIXTURE_MULTIPLE_PAYLOADS,
  trailingProse: FIXTURE_TRAILING_PROSE,
  missingEvidence: FIXTURE_MISSING_EVIDENCE,
  missingContraryEvidence: FIXTURE_MISSING_CONTRARY_EVIDENCE,
  unsupportedCategory: FIXTURE_UNSUPPORTED_CATEGORY,
  unsupportedEnum: FIXTURE_UNSUPPORTED_ENUM,
  unsafeOperationalDetail: FIXTURE_UNSAFE_OPERATIONAL_DETAIL,
  letterGrade: FIXTURE_LETTER_GRADE,
  fabricatedSource: FIXTURE_FABRICATED_SOURCE,
  insufficientEvidenceDeduction: FIXTURE_INSUFFICIENT_EVIDENCE_DEDUCTION,
  accurateNegativeDeduction: FIXTURE_ACCURATE_NEGATIVE_DEDUCTION,
  criticalWeakEvidence: FIXTURE_CRITICAL_WEAK_EVIDENCE,
  outsideDomainNoEscalation: FIXTURE_OUTSIDE_DOMAIN_NO_ESCALATION,
  responseTooLarge: FIXTURE_RESPONSE_TOO_LARGE,
  correlationMismatch: FIXTURE_CORRELATION_MISMATCH,
  deterministicCleanupOnly: FIXTURE_DETERMINISTIC_CLEANUP_ONLY,
  providerRepairRequired: FIXTURE_PROVIDER_REPAIR_REQUIRED,
  validContractInput: buildValidGenerationContractInput(),
  invalidContractInput: buildInvalidGenerationContractInput(),
} as const;
