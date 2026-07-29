/**
 * Provider-neutral Military Expert generation contracts (PR 2 — draft).
 */

import {
  MILITARY_EXPERT_KEY,
  MILITARY_EXPERT_VERSION,
  type MilitaryExpertReviewScope,
} from "./contracts.ts";
import type { MilitaryExpertReview } from "./contracts.ts";
import type { MilitaryExpertEnumNormalizationAudit } from "./enum-normalization.ts";

export type MilitaryExpertRepairDecision =
  | "no_repair_needed"
  | "deterministic_cleanup_allowed"
  | "provider_repair_required"
  | "schema_repair_required"
  | "reject_output";

export interface MilitaryExpertGenerationProvenance {
  promptVersion: string;
  outputSchemaVersion: string;
  builderVersion: string;
  generationProfileId: string;
}

export interface MilitaryExpertGenerationRequest {
  expertKey: typeof MILITARY_EXPERT_KEY;
  expertVersion: typeof MILITARY_EXPERT_VERSION;
  definitionHash: string;
  correlationId: string;
  manuscriptVersionId: string;
  reviewScope: MilitaryExpertReviewScope;
  canonicalWordCount: number;
  manuscriptHash: string;
  systemPrompt: string;
  reviewPrompt: string;
  responseFormat: "json_object";
  temperature: 0;
  maxOutputTokens: number;
  safetyMetadata: {
    editorialOnly: true;
    noOperationalInstruction: true;
    noServiceHistoryClaims: true;
    noFabricatedSources: true;
  };
  provenance: MilitaryExpertGenerationProvenance;
}

export interface MilitaryExpertRawGenerationResponse {
  correlationId: string;
  responseText: string;
  finishStatus: "complete" | "truncated" | "error";
  inputTokens?: number;
  outputTokens?: number;
  modelIdentifier?: string;
  capturedAt: string;
  provenance: {
    source: "synthetic" | "replay" | "external_caller";
  };
}

export type MilitaryExpertGenerationStatus = "success" | "parse_failed" | "validation_failed" | "contract_rejected";

export interface MilitaryExpertGenerationContractInput {
  correlationId: string;
  manuscriptVersionId: string;
  reviewScope: MilitaryExpertReviewScope;
  manuscriptText: string;
  canonicalWordCount: number;
  manuscriptHash: string;
  genreContext?: string | null;
  countryPeriod?: string | null;
  rawResponse?: MilitaryExpertRawGenerationResponse;
  /** Optional synthetic repair response for harness-only schema repair. */
  repairResponse?: MilitaryExpertRawGenerationResponse;
  /** When true, a schema repair pass was already attempted and must not repeat. */
  repairAlreadyAttempted?: boolean;
}

export interface MilitaryExpertGenerationContractResult {
  ok: boolean;
  correlationId: string;
  expertKey: typeof MILITARY_EXPERT_KEY;
  expertVersion: typeof MILITARY_EXPERT_VERSION;
  definitionHash: string;
  requestHash: string;
  systemPromptHash: string;
  reviewPromptHash: string;
  rawResponseHash: string | null;
  parsedReviewHash: string | null;
  generationStatus: MilitaryExpertGenerationStatus;
  repairDecision: MilitaryExpertRepairDecision;
  modelCalls: 0;
  writes: 0;
  filesWritten: 0;
  productionExecutionOccurred: false;
  durationMs: number;
  failureReason?: string;
  parseFailureCode?: string;
  parseTrailingCategory?: string;
  parseDiagnostics?: Record<string, unknown>;
  enumNormalizationAudits?: readonly MilitaryExpertEnumNormalizationAudit[];
  contraryEvidenceRepair?: {
    attempted: boolean;
    succeeded: boolean;
    deterministicNormalizationApplied: boolean;
    failureCode?: string;
    eventPayload?: Record<string, unknown>;
  };
  trailingCommentaryNormalization?: {
    trailing_character_count: number;
    normalization_attempted: boolean;
    normalization_succeeded: boolean;
    second_payload_detected: boolean;
  };
  trailingMarkdownSummaryNormalization?: {
    trailing_character_count: number;
    normalization_attempted: boolean;
    normalization_succeeded: boolean;
    second_payload_detected: boolean;
  };
  trailingCommentaryUnsafe?: boolean;
  trailingMarkdownSummaryUnsafe?: boolean;
  review?: MilitaryExpertReview;
}
