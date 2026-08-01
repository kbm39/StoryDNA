/** Amendment 002 — Progressive Editorial Understanding types */

export const CONFIDENCE_LEVELS = [
  "insufficient",
  "emerging",
  "adequate",
  "strong",
  "author_confirmed",
] as const;

export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const CONFIDENCE_DIMENSIONS = [
  "story_understanding",
  "author_goal_understanding",
  "reader_experience_understanding",
  "market_position_understanding",
  "success_definition_understanding",
  "unresolved_ambiguity",
  "grounding_confidence",
] as const;

export type ConfidenceDimension = (typeof CONFIDENCE_DIMENSIONS)[number];

export const RESPONSE_QUALITY_LEVELS = [
  "acknowledgment",
  "grounded_reflection",
  "editorial_synthesis",
  "material_clarification",
] as const;

export type ResponseQualityLevel = (typeof RESPONSE_QUALITY_LEVELS)[number];

export const RESPONSE_QUALITY_LEVEL_NUM: Record<ResponseQualityLevel, 1 | 2 | 3 | 4> = {
  acknowledgment: 1,
  grounded_reflection: 2,
  editorial_synthesis: 3,
  material_clarification: 4,
};

export const GATE_FAIL_REASONS = [
  "INSUFFICIENT_EDITORIAL_ADVANCEMENT",
  "INVENTED_INTERPRETATION",
  "EMPTY_PRAISE",
  "THERAPY_LANGUAGE",
  "UNNECESSARY_CLARIFICATION",
  "MULTIPLE_CLARIFICATIONS",
  "UNSUPPORTED_MARKET_CONCLUSION",
  "UNSUPPORTED_EDITORIAL_PRIORITY",
  "FRAMING_EVIDENCE_BOUNDARY_VIOLATION",
  "RESPONSE_TOO_VERBOSE",
  "RESPONSE_NOT_GROUNDED",
  "RESPONSE_GRAMMAR_INVALID",
] as const;

export type GateFailReason = (typeof GATE_FAIL_REASONS)[number];

export type GateResult = "pass" | GateFailReason;

export type UnderstandingQualityDimensions = Record<ConfidenceDimension, ConfidenceLevel>;

export type UnderstandingQuality = {
  readonly dimensions: UnderstandingQualityDimensions;
  readonly aggregate_level: ConfidenceLevel;
  readonly last_response_quality_level: 1 | 2 | 3 | 4 | null;
  readonly last_gate_result: GateResult;
  readonly last_repair_attempted?: boolean;
  readonly provider_model?: string | null;
};

export type SynthesisArtifact = {
  readonly stage_id: string;
  readonly quality_level: 2 | 3;
  readonly synthesis_text: string;
  readonly grounded_in: readonly string[];
  readonly created_at: string;
};

export type ProviderResponseSchema = {
  readonly quality_level: 1 | 2 | 3 | 4;
  readonly response_text: string;
  readonly grounded_claims: readonly { claim: string; source_turn_id: string }[];
  readonly uncertainty_notes: readonly string[];
  readonly gate_result: "pass";
  readonly fail_reason: null;
};

export type AdvancementGateInput = {
  readonly candidateResponse: string;
  readonly authorTurn: string;
  readonly priorAuthorTurns?: readonly string[];
  readonly stageId: string;
  readonly qualityLevel: ResponseQualityLevel;
  readonly authorDeclaredUnsure?: boolean;
  readonly clarificationAlreadyUsed?: boolean;
  readonly isSubstantiveAnswer?: boolean;
};

export type AdvancementGateResult = {
  readonly gate_result: GateResult;
  readonly quality_level: ResponseQualityLevel;
  readonly fail_reason: GateFailReason | null;
};

export const AUTHOR_FACING_CONFIDENCE_PHRASES: Partial<Record<ConfidenceLevel, string>> = {
  emerging: "Editorial Understanding is taking shape.",
  adequate: "Editorial Understanding is taking shape.",
  strong: "Editorial Understanding is taking shape.",
  author_confirmed: "Editorial Understanding is ready for your confirmation.",
};
