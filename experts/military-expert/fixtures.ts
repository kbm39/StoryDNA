/**
 * Synthetic Military Expert fixtures — clearly fictional, no Hold Fast prose.
 */

import {
  MILITARY_EXPERT_KEY,
  MILITARY_EXPERT_VERSION,
  type MilitaryExpertFinding,
  type MilitaryExpertReview,
} from "./contracts.ts";

const BASE_REVIEW_FIELDS = {
  expert_key: MILITARY_EXPERT_KEY,
  expert_version: MILITARY_EXPERT_VERSION,
  definition_hash: "0000000000000000000000000000000000000000000000000000000000000000",
  manuscript_version_id: "mv-fixture-001",
  review_scope: "full_manuscript" as const,
  review_status: "complete" as const,
  strengths: ["Clear squad dialogue under pressure"],
  category_assessments: [],
  overall_realism_assessment: {
    conclusion: "Mixed operational credibility with strong command scenes.",
    confidence: "medium" as const,
    primary_strengths: ["Command interactions"],
    primary_concerns: ["Timing of extraction"],
    preservation_priorities: ["Keep the rooftop standoff"],
  },
  critical_issues: [],
  priority_actions: ["Verify rank insignia in chapter two"],
  verification_requests: [],
  escalation_recommendations: [],
  uncertainty_summary: "Limited period detail for comms gear.",
  author_challenge_supported: true as const,
  next_step: "Revise rank references and confirm extraction timeline.",
  provenance: {
    validator_version: "military_expert_validators@v1-draft",
    normalization_version: "military_expert_normalization@v1-draft",
    definition_hash: "0000000000000000000000000000000000000000000000000000000000000000",
  },
};

function baseFinding(overrides: Partial<MilitaryExpertFinding>): MilitaryExpertFinding {
  return {
    finding_id: "fixture-finding",
    category: "command_and_organization",
    title: "Fixture finding",
    observation: "Synthetic observation.",
    manuscript_evidence: [{ excerpt: "The captain signed the op order.", locator: "Chapter 1" }],
    confidence: "medium",
    severity: "moderate",
    realism_status: "probable_concern",
    operational_impact: "Command credibility weakens.",
    story_impact: "Reader trust dips slightly.",
    recommendation: "Adjust rank/title to match branch conventions.",
    recommendation_type: "correct",
    preservation_note: "Keep the decisive briefing tone.",
    author_challenge_allowed: true,
    ...overrides,
  };
}

export const FIXTURE_ACCURATE_COMMAND_CHAIN = baseFinding({
  finding_id: "accurate-command-chain",
  category: "command_and_organization",
  title: "Accurate company command chain",
  realism_status: "accurate",
  severity: "informational",
  observation: "Company commander issues orders through the executive officer plausibly.",
  manuscript_evidence: [{ excerpt: "The company commander nodded to the XO.", locator: "Chapter 3" }],
  recommendation: "No change required.",
  recommendation_type: "preserve",
  operational_impact: "Supports operational credibility.",
});

export const FIXTURE_INCORRECT_RANK_AUTHORITY = baseFinding({
  finding_id: "incorrect-rank-authority",
  category: "command_and_organization",
  title: "Corporal directs major operation",
  realism_status: "confirmed_error",
  severity: "major",
  confidence: "high",
  observation: "A corporal appears to task a battalion-sized element without supervision.",
  manuscript_evidence: [{ excerpt: "Corporal Hale assigned platoons to separate objectives.", locator: "Chapter 5" }],
  recommendation: "Assign tasking to a lieutenant or senior NCO with explicit commander approval.",
});

export const FIXTURE_PLAUSIBLE_UNUSUAL_TACTIC = baseFinding({
  finding_id: "plausible-unusual-tactic",
  category: "operations_and_tactics",
  title: "Unusual but defensible canal bypass",
  realism_status: "plausible_but_unusual",
  severity: "minor",
  observation: "The canal bypass is rare but possible with local guides.",
  manuscript_evidence: [{ excerpt: "They slipped through the maintenance culvert.", locator: "Chapter 8" }],
  recommendation: "Add one line acknowledging higher risk and command approval.",
  recommendation_type: "clarify",
});

export const FIXTURE_INSUFFICIENT_CONTEXT = baseFinding({
  finding_id: "insufficient-context",
  category: "rules_authority_and_coordination",
  title: "ROE cannot be assessed",
  realism_status: "insufficient_evidence",
  severity: "informational",
  confidence: "low",
  observation: "Rules of engagement are not established in the available excerpt.",
  manuscript_evidence: [],
  operational_impact: "Not assessed.",
  recommendation: "Provide the briefing scene or country context.",
  recommendation_type: "verify",
  preservation_note: "Ambiguity may be intentional for suspense.",
});

export const FIXTURE_COMMUNICATIONS_TERMINOLOGY = baseFinding({
  finding_id: "communications-terminology",
  category: "communications_and_terminology",
  title: "Civilian radio chatter on tactical net",
  realism_status: "probable_concern",
  observation: "Informal chatter lacks brevity codes expected on a tactical net.",
  manuscript_evidence: [{ excerpt: "Hey guys, come in, come in, we need help now.", locator: "Chapter 6" }],
  recommendation: "Use shorter, disciplined radio exchanges while keeping urgency.",
});

export const FIXTURE_LOGISTICS_TIMING = baseFinding({
  finding_id: "logistics-timing",
  category: "logistics_and_timing",
  title: "Impossible overnight resupply",
  realism_status: "confirmed_error",
  severity: "major",
  confidence: "high",
  observation: "Heavy vehicles arrive overnight without a described transport chain.",
  manuscript_evidence: [{ excerpt: "By dawn the convoy was waiting at the ridge.", locator: "Chapter 9" }],
  recommendation: "Extend the timeline or add an aerial resupply beat.",
});

export const FIXTURE_HUMAN_PERFORMANCE = baseFinding({
  finding_id: "human-performance",
  category: "human_performance",
  title: "No degradation after multi-day operation",
  realism_status: "probable_concern",
  observation: "Operators show no fatigue after seventy-two hours awake.",
  manuscript_evidence: [{ excerpt: "No one slept and everyone moved at full speed.", locator: "Chapter 10" }],
  recommendation: "Show mild degradation without removing competence.",
});

export const FIXTURE_EQUIPMENT_ROLE = baseFinding({
  finding_id: "equipment-role",
  category: "weapons_and_equipment",
  title: "Designated marksman carries wrong platform",
  realism_status: "probable_concern",
  observation: "The designated marksman uses a short-barreled submachine gun at long range.",
  manuscript_evidence: [{ excerpt: "She raised the compact SMG and steadied the four-hundred-meter shot.", locator: "Chapter 4" }],
  recommendation: "Swap to a rifle-class weapon or shorten the engagement distance.",
});

export const FIXTURE_CONTRARY_EVIDENCE_NARROWS = baseFinding({
  finding_id: "contrary-evidence-narrows",
  category: "operations_and_tactics",
  title: "Initial breach concern narrowed",
  realism_status: "context_dependent",
  severity: "minor",
  observation: "An earlier breach seemed impossible until a prior recon passage was found.",
  manuscript_evidence: [{ excerpt: "They had mapped the service door during the recon.", locator: "Chapter 7" }],
  contrary_evidence: [{ excerpt: "The steel door looked sealed from the alley.", locator: "Chapter 7" }],
  recommendation: "Make the prior recon reference slightly earlier for clarity.",
  recommendation_type: "narrow",
});

export const FIXTURE_SAFETY_GENERALIZED = baseFinding({
  finding_id: "safety-generalized",
  category: "operations_and_tactics",
  title: "Breaching detail should stay generalized",
  realism_status: "probable_concern",
  observation: "The scene implies detailed breaching steps beyond editorial need.",
  manuscript_evidence: [{ excerpt: "He wired every charge in sequence across the frame.", locator: "Chapter 11" }],
  recommendation: "Keep the breach outcome without step-by-step instructions.",
  recommendation_type: "clarify",
});

export const FIXTURE_MISSING_EVIDENCE = baseFinding({
  finding_id: "missing-evidence",
  category: "intelligence_and_opsec",
  title: "Intel failure claim without evidence",
  realism_status: "probable_concern",
  manuscript_evidence: [],
  recommendation: "Add a scene reference or downgrade to insufficient_evidence.",
});

export const FIXTURE_UNSUPPORTED_CONFIDENCE = baseFinding({
  finding_id: "unsupported-confidence",
  category: "military_culture",
  title: "High-confidence culture claim",
  realism_status: "probable_concern",
  confidence: "medium",
  severity: "critical",
  observation: "Unit tradition is asserted without support.",
  manuscript_evidence: [{ excerpt: "The unit always did things this way.", locator: "Chapter 2" }],
  recommendation: "Lower confidence or add a specific tradition reference.",
});

export const FIXTURE_OUTSIDE_DOMAIN = baseFinding({
  finding_id: "outside-domain",
  category: "human_performance",
  title: "Surgical procedure accuracy",
  realism_status: "outside_expertise",
  severity: "informational",
  observation: "Field surgery depiction requires medical specialist review.",
  manuscript_evidence: [{ excerpt: "He reset the bone and closed the wound in minutes.", locator: "Chapter 12" }],
  escalation_expert: "medical_expert",
  recommendation: "Escalate to Medical Expert for treatment realism.",
  recommendation_type: "escalate",
  operational_impact: "Medical credibility uncertain.",
});

export function buildValidMilitaryExpertReview(): MilitaryExpertReview {
  return {
    ...BASE_REVIEW_FIELDS,
    summary:
      "Strengths include credible command scenes, but timing and terminology concerns remain uncertain in places and should be preserved where they serve tension.",
    findings: [
      FIXTURE_ACCURATE_COMMAND_CHAIN,
      FIXTURE_COMMUNICATIONS_TERMINOLOGY,
      FIXTURE_CONTRARY_EVIDENCE_NARROWS,
    ],
    category_assessments: [
      {
        category: "command_and_organization",
        status: "credible",
        confidence: "medium",
        strength_summary: "Chain of command mostly plausible",
        concern_summary: "One rank issue",
        finding_count: 1,
        critical_count: 0,
        major_count: 0,
        verification_needed: false,
        evidence_coverage: "partial",
      },
    ],
  };
}

export function buildInvalidMilitaryExpertReview(): MilitaryExpertReview {
  return {
    ...BASE_REVIEW_FIELDS,
    summary: "Everything is wrong.",
    strengths: [],
    findings: [FIXTURE_MISSING_EVIDENCE, FIXTURE_UNSUPPORTED_CONFIDENCE],
    author_challenge_supported: true,
  };
}

export const MILITARY_EXPERT_FIXTURES = {
  accurateCommandChain: FIXTURE_ACCURATE_COMMAND_CHAIN,
  incorrectRankAuthority: FIXTURE_INCORRECT_RANK_AUTHORITY,
  plausibleUnusualTactic: FIXTURE_PLAUSIBLE_UNUSUAL_TACTIC,
  insufficientContext: FIXTURE_INSUFFICIENT_CONTEXT,
  communicationsTerminology: FIXTURE_COMMUNICATIONS_TERMINOLOGY,
  logisticsTiming: FIXTURE_LOGISTICS_TIMING,
  humanPerformance: FIXTURE_HUMAN_PERFORMANCE,
  equipmentRole: FIXTURE_EQUIPMENT_ROLE,
  contraryEvidenceNarrows: FIXTURE_CONTRARY_EVIDENCE_NARROWS,
  safetyGeneralized: FIXTURE_SAFETY_GENERALIZED,
  missingEvidence: FIXTURE_MISSING_EVIDENCE,
  unsupportedConfidence: FIXTURE_UNSUPPORTED_CONFIDENCE,
  outsideDomain: FIXTURE_OUTSIDE_DOMAIN,
  validReview: buildValidMilitaryExpertReview(),
  invalidReview: buildInvalidMilitaryExpertReview(),
} as const;
