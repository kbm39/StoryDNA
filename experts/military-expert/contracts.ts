/**
 * Military Expert review output contract (StoryDNA PR 1 — draft, not runtime-wired).
 */

export const MILITARY_EXPERT_KEY = "military_expert" as const;

export const MILITARY_EXPERT_VERSION = "v1.0.0-draft" as const;

export const MILITARY_EXPERT_DEFINITION_VERSION = "military_expert_review@v1-draft" as const;

export const MILITARY_EXPERT_CATEGORIES = [
  "command_and_organization",
  "operations_and_tactics",
  "weapons_and_equipment",
  "intelligence_and_opsec",
  "logistics_and_timing",
  "human_performance",
  "communications_and_terminology",
  "military_culture",
  "rules_authority_and_coordination",
  "overall_operational_realism",
] as const;

export type MilitaryExpertCategory = (typeof MILITARY_EXPERT_CATEGORIES)[number];

export const MILITARY_EXPERT_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export type MilitaryExpertConfidence = (typeof MILITARY_EXPERT_CONFIDENCE_LEVELS)[number];

export const MILITARY_EXPERT_SEVERITY_LEVELS = [
  "critical",
  "major",
  "moderate",
  "minor",
  "informational",
] as const;

export type MilitaryExpertSeverity = (typeof MILITARY_EXPERT_SEVERITY_LEVELS)[number];

export const MILITARY_EXPERT_REALISM_STATUSES = [
  "confirmed_error",
  "probable_concern",
  "context_dependent",
  "plausible_but_unusual",
  "accurate",
  "insufficient_evidence",
  "outside_expertise",
] as const;

export type MilitaryExpertRealismStatus = (typeof MILITARY_EXPERT_REALISM_STATUSES)[number];

export const MILITARY_EXPERT_RECOMMENDATION_TYPES = [
  "correct",
  "clarify",
  "narrow",
  "verify",
  "preserve",
  "escalate",
  "no_change",
] as const;

export type MilitaryExpertRecommendationType =
  (typeof MILITARY_EXPERT_RECOMMENDATION_TYPES)[number];

export const MILITARY_EXPERT_CATEGORY_ASSESSMENT_STATUSES = [
  "strong",
  "credible",
  "mixed",
  "weak",
  "insufficient_evidence",
  "not_applicable",
] as const;

export type MilitaryExpertCategoryAssessmentStatus =
  (typeof MILITARY_EXPERT_CATEGORY_ASSESSMENT_STATUSES)[number];

export const MILITARY_EXPERT_REVIEW_STATUSES = [
  "complete",
  "completed_with_author_review_required",
  "partial",
  "insufficient_evidence",
  "aborted",
] as const;

export type MilitaryExpertReviewStatus = (typeof MILITARY_EXPERT_REVIEW_STATUSES)[number];

export const MILITARY_EXPERT_FINDING_STATUSES = [
  "validated",
  "author_review_required",
] as const;

export type MilitaryExpertFindingStatus = (typeof MILITARY_EXPERT_FINDING_STATUSES)[number];

export type MilitaryExpertUnresolvedConfidenceField = "contrary_evidence" | "uncertainty_note";

export const MILITARY_EXPERT_REVIEW_SCOPES = [
  "full_manuscript",
  "sample",
  "chapter_set",
  "scene",
] as const;

export type MilitaryExpertReviewScope = (typeof MILITARY_EXPERT_REVIEW_SCOPES)[number];

export const MILITARY_EXPERT_CHALLENGE_OUTCOMES = [
  "upheld",
  "narrowed",
  "withdrawn",
  "replaced",
  "escalated",
  "requires_human_judgment",
] as const;

export type MilitaryExpertChallengeOutcome = (typeof MILITARY_EXPERT_CHALLENGE_OUTCOMES)[number];

export const MILITARY_EXPERT_ESCALATION_EXPERTS = [
  "librarian",
  "medical_expert",
  "psychologist",
  "legal_expert",
  "police_expert",
  "intelligence_expert",
] as const;

export type MilitaryExpertEscalationExpert = (typeof MILITARY_EXPERT_ESCALATION_EXPERTS)[number];

/** Maximum words allowed in a single manuscript evidence excerpt. */
export const MILITARY_EXPERT_MAX_EVIDENCE_EXCERPT_WORDS = 80;

/** Negative realism statuses require full evidence-backed fields. */
export const MILITARY_EXPERT_NEGATIVE_REALISM_STATUSES: readonly MilitaryExpertRealismStatus[] = [
  "confirmed_error",
  "probable_concern",
  "context_dependent",
  "plausible_but_unusual",
];

export interface MilitaryExpertEvidenceRecord {
  excerpt: string;
  locator?: string;
  verification_note?: string;
}

export interface MilitaryExpertFinding {
  finding_id: string;
  category: MilitaryExpertCategory;
  title: string;
  observation: string;
  manuscript_evidence: MilitaryExpertEvidenceRecord[];
  contrary_evidence?: MilitaryExpertEvidenceRecord[];
  evidence_location?: string;
  confidence: MilitaryExpertConfidence;
  severity: MilitaryExpertSeverity;
  realism_status: MilitaryExpertRealismStatus;
  operational_impact: string;
  story_impact: string;
  recommendation: string;
  recommendation_type: MilitaryExpertRecommendationType;
  preservation_note: string;
  escalation_expert?: MilitaryExpertEscalationExpert;
  author_challenge_allowed: true;
  score_impact?: number;
  uncertainty_note?: string;
  source_requirements?: string;
  /** Set when contrary-evidence confidence check could not be completed. */
  finding_status?: MilitaryExpertFindingStatus;
}

export interface MilitaryExpertCategoryAssessment {
  category: MilitaryExpertCategory;
  status: MilitaryExpertCategoryAssessmentStatus;
  confidence: MilitaryExpertConfidence;
  strength_summary: string;
  concern_summary: string;
  finding_count: number;
  critical_count: number;
  major_count: number;
  verification_needed: boolean;
  evidence_coverage: string;
  score?: number;
}

export interface MilitaryExpertOverallRealismAssessment {
  conclusion: string;
  confidence: MilitaryExpertConfidence;
  primary_strengths: string[];
  primary_concerns: string[];
  preservation_priorities: string[];
}

export interface MilitaryExpertProvenance {
  validator_version: string;
  normalization_version: string;
  definition_hash: string;
}

export interface MilitaryExpertReview {
  expert_key: typeof MILITARY_EXPERT_KEY;
  expert_version: typeof MILITARY_EXPERT_VERSION;
  definition_hash: string;
  manuscript_version_id: string;
  review_scope: MilitaryExpertReviewScope;
  review_status: MilitaryExpertReviewStatus;
  summary: string;
  strengths: string[];
  findings: MilitaryExpertFinding[];
  category_assessments: MilitaryExpertCategoryAssessment[];
  overall_realism_assessment: MilitaryExpertOverallRealismAssessment;
  critical_issues: string[];
  priority_actions: string[];
  verification_requests: string[];
  escalation_recommendations: string[];
  uncertainty_summary: string;
  author_challenge_supported: true;
  next_step: string;
  provenance: MilitaryExpertProvenance;
  scoring_version?: string;
  /** Excluded from deterministic hash comparison when present. */
  generated_at?: string;
}

export interface MilitaryExpertValidationResult {
  ok: boolean;
  errors: string[];
}
