/**
 * Military Expert provider-independent generation contract and test-only harness (PR 2).
 */

import { hashCanonicalOutput } from "@/lib/expert-review-engine/canonical-output.ts";
import {
  EXPERT_MILITARY_GENERATION_CONTRACT_FLAG_NAME,
  readExpertMilitaryGenerationContractEnabled,
} from "@/lib/expert-review-engine/feature-flags.ts";
import {
  MILITARY_EXPERT_KEY,
  MILITARY_EXPERT_VERSION,
  type MilitaryExpertReview,
  type MilitaryExpertReviewScope,
} from "./contracts.ts";
import { MILITARY_EXPERT } from "./definition.ts";
import {
  MILITARY_EXPERT_OUTPUT_SCHEMA_VERSION,
  type MilitaryExpertGenerationPayload,
} from "./output-schema.ts";
import {
  MILITARY_EXPERT_GENERATION_PROFILE_ID,
  MILITARY_EXPERT_PROMPT_VERSION,
  MILITARY_EXPERT_VALIDATOR_VERSION,
  MILITARY_EXPERT_NORMALIZATION_VERSION,
  militaryExpertRuntimeDefinition,
} from "./runtime-definition.ts";
import {
  buildMilitaryExpertReviewPrompt,
  buildMilitaryExpertSystemPrompt,
  militaryExpertReviewPromptShell,
} from "./prompts.ts";
import { parseMilitaryExpertGenerationResponse } from "./parsing.ts";
import { classifyMilitaryExpertRepairNeed } from "./repair-classification.ts";
import { normalizeMilitaryExpertReview } from "./normalization.ts";
import { validateMilitaryExpertReview } from "./validation.ts";
import type {
  MilitaryExpertGenerationContractInput,
  MilitaryExpertGenerationContractResult,
  MilitaryExpertGenerationRequest,
  MilitaryExpertRawGenerationResponse,
} from "./generation-types.ts";

export type {
  MilitaryExpertGenerationContractInput,
  MilitaryExpertGenerationContractResult,
  MilitaryExpertGenerationRequest,
  MilitaryExpertRawGenerationResponse,
} from "./generation-types.ts";

export const MILITARY_EXPERT_GENERATION_BUILDER_VERSION =
  "military_expert_generation_contract@v1-draft" as const;

export const MILITARY_EXPERT_RUNTIME_DEFINITION_HASH =
  militaryExpertRuntimeDefinition().runtime_versions.definition_hash;

export interface BuildMilitaryExpertGenerationRequestInput {
  correlationId: string;
  manuscriptVersionId: string;
  reviewScope: MilitaryExpertReviewScope;
  manuscriptText: string;
  canonicalWordCount: number;
  manuscriptHash: string;
  genreContext?: string | null;
  countryPeriod?: string | null;
  maxOutputTokens?: number;
}

export interface MilitaryExpertGenerationContractDependencies {
  featureFlagReader?: () => boolean;
  bypassFeatureFlag?: boolean;
  now?: () => number;
}

function normalizeDeterministicText(text: string): string {
  return text.replace(/\r\n/g, "\n").trimEnd();
}

export function hashMilitaryExpertSystemPrompt(systemPrompt: string): string {
  return hashCanonicalOutput({ kind: "system_prompt", text: normalizeDeterministicText(systemPrompt) });
}

export function hashMilitaryExpertReviewPrompt(
  reviewPrompt: string,
  manuscriptHash: string,
): string {
  return hashCanonicalOutput({
    kind: "review_prompt",
    text: normalizeDeterministicText(militaryExpertReviewPromptShell(reviewPrompt)),
    manuscriptContentHash: manuscriptHash,
  });
}

export function hashMilitaryExpertGenerationRequest(
  request: MilitaryExpertGenerationRequest,
): string {
  return hashCanonicalOutput({
    expertKey: request.expertKey,
    expertVersion: request.expertVersion,
    definitionHash: request.definitionHash,
    correlationId: request.correlationId,
    manuscriptVersionId: request.manuscriptVersionId,
    reviewScope: request.reviewScope,
    canonicalWordCount: request.canonicalWordCount,
    manuscriptHash: request.manuscriptHash,
    systemPromptHash: hashMilitaryExpertSystemPrompt(request.systemPrompt),
    reviewPromptHash: hashMilitaryExpertReviewPrompt(request.reviewPrompt, request.manuscriptHash),
    responseFormat: request.responseFormat,
    temperature: request.temperature,
    maxOutputTokens: request.maxOutputTokens,
    safetyMetadata: request.safetyMetadata,
    provenance: request.provenance,
  });
}

export function hashMilitaryExpertRawResponse(raw: MilitaryExpertRawGenerationResponse): string {
  return hashCanonicalOutput({
    correlationId: raw.correlationId,
    finishStatus: raw.finishStatus,
    responseText: normalizeDeterministicText(raw.responseText),
    inputTokens: raw.inputTokens ?? null,
    outputTokens: raw.outputTokens ?? null,
    modelIdentifier: raw.modelIdentifier ?? null,
    capturedAt: raw.capturedAt,
    provenance: raw.provenance,
  });
}

export function hashMilitaryExpertParsedReview(review: MilitaryExpertReview): string {
  const stable = { ...review };
  delete stable.generated_at;
  return hashCanonicalOutput(stable);
}

/** Build a provider-neutral generation request for the draft Military Expert runtime. */
export function buildMilitaryExpertGenerationRequest(
  input: BuildMilitaryExpertGenerationRequestInput,
): MilitaryExpertGenerationRequest {
  const runtime = militaryExpertRuntimeDefinition();
  if (runtime.expert_key !== MILITARY_EXPERT_KEY) {
    throw new Error(`Unsupported expert_key: ${runtime.expert_key}`);
  }
  if (runtime.expert_version !== MILITARY_EXPERT_VERSION) {
    throw new Error(`Unsupported expert_version: ${runtime.expert_version}`);
  }

  const systemPrompt = buildMilitaryExpertSystemPrompt(MILITARY_EXPERT);
  const reviewPrompt = buildMilitaryExpertReviewPrompt({
    def: MILITARY_EXPERT,
    manuscriptVersionId: input.manuscriptVersionId,
    reviewScope: input.reviewScope,
    manuscriptText: input.manuscriptText,
    canonicalWordCount: input.canonicalWordCount,
    manuscriptHash: input.manuscriptHash,
    genreContext: input.genreContext ?? null,
    countryPeriod: input.countryPeriod ?? null,
  });

  return Object.freeze({
    expertKey: MILITARY_EXPERT_KEY,
    expertVersion: MILITARY_EXPERT_VERSION,
    definitionHash: runtime.runtime_versions.definition_hash,
    correlationId: input.correlationId,
    manuscriptVersionId: input.manuscriptVersionId,
    reviewScope: input.reviewScope,
    canonicalWordCount: input.canonicalWordCount,
    manuscriptHash: input.manuscriptHash,
    systemPrompt,
    reviewPrompt,
    responseFormat: "json_object",
    temperature: 0,
    maxOutputTokens: input.maxOutputTokens ?? MILITARY_EXPERT.maxTokens,
    safetyMetadata: Object.freeze({
      editorialOnly: true,
      noOperationalInstruction: true,
      noServiceHistoryClaims: true,
      noFabricatedSources: true,
    }),
    provenance: Object.freeze({
      promptVersion: MILITARY_EXPERT_PROMPT_VERSION,
      outputSchemaVersion: MILITARY_EXPERT_OUTPUT_SCHEMA_VERSION,
      builderVersion: MILITARY_EXPERT_GENERATION_BUILDER_VERSION,
      generationProfileId: MILITARY_EXPERT_GENERATION_PROFILE_ID,
    }),
  });
}

function payloadToReview(
  payload: MilitaryExpertGenerationPayload,
  input: MilitaryExpertGenerationContractInput,
  definitionHash: string,
): MilitaryExpertReview {
  return {
    expert_key: MILITARY_EXPERT_KEY,
    expert_version: MILITARY_EXPERT_VERSION,
    definition_hash: definitionHash,
    manuscript_version_id: input.manuscriptVersionId,
    review_scope: input.reviewScope,
    review_status: "complete",
    summary: payload.summary,
    strengths: payload.strengths,
    findings: payload.findings,
    category_assessments: payload.category_assessments,
    overall_realism_assessment: payload.overall_realism_assessment,
    critical_issues: payload.critical_issues,
    priority_actions: payload.priority_actions,
    verification_requests: payload.verification_requests,
    escalation_recommendations: payload.escalation_recommendations,
    uncertainty_summary: payload.uncertainty_summary,
    author_challenge_supported: true,
    next_step: payload.next_step,
    provenance: {
      validator_version: MILITARY_EXPERT_VALIDATOR_VERSION,
      normalization_version: MILITARY_EXPERT_NORMALIZATION_VERSION,
      definition_hash: definitionHash,
    },
  };
}

/**
 * Test-only orchestration for the Military Expert generation contract.
 * Never calls providers, Trigger, databases, or file writers.
 */
export async function runMilitaryExpertGenerationContract(
  input: MilitaryExpertGenerationContractInput,
  dependencies: MilitaryExpertGenerationContractDependencies = {},
): Promise<MilitaryExpertGenerationContractResult> {
  const startedAt = (dependencies.now ?? (() => Date.now()))();
  const featureFlagReader =
    dependencies.featureFlagReader ?? readExpertMilitaryGenerationContractEnabled;

  const base = {
    correlationId: input.correlationId,
    expertKey: MILITARY_EXPERT_KEY,
    expertVersion: MILITARY_EXPERT_VERSION,
    definitionHash: MILITARY_EXPERT_RUNTIME_DEFINITION_HASH,
    modelCalls: 0 as const,
    writes: 0 as const,
    filesWritten: 0 as const,
    productionExecutionOccurred: false as const,
  };

  if (!dependencies.bypassFeatureFlag && !featureFlagReader()) {
    return {
      ...base,
      ok: false,
      requestHash: "",
      systemPromptHash: "",
      reviewPromptHash: "",
      rawResponseHash: null,
      parsedReviewHash: null,
      generationStatus: "contract_rejected",
      repairDecision: "reject_output",
      durationMs: Math.max(0, (dependencies.now ?? Date.now)() - startedAt),
      failureReason: `${EXPERT_MILITARY_GENERATION_CONTRACT_FLAG_NAME} is off`,
    };
  }

  const runtime = militaryExpertRuntimeDefinition();
  if (runtime.enabled !== false) {
    return {
      ...base,
      ok: false,
      requestHash: "",
      systemPromptHash: "",
      reviewPromptHash: "",
      rawResponseHash: null,
      parsedReviewHash: null,
      generationStatus: "contract_rejected",
      repairDecision: "reject_output",
      durationMs: Math.max(0, (dependencies.now ?? Date.now)() - startedAt),
      failureReason: "Draft Military Expert runtime must remain disabled",
    };
  }

  if (runtime.runtime_versions.definition_hash !== MILITARY_EXPERT_RUNTIME_DEFINITION_HASH) {
    return {
      ...base,
      ok: false,
      requestHash: "",
      systemPromptHash: "",
      reviewPromptHash: "",
      rawResponseHash: null,
      parsedReviewHash: null,
      generationStatus: "contract_rejected",
      repairDecision: "reject_output",
      durationMs: Math.max(0, (dependencies.now ?? Date.now)() - startedAt),
      failureReason: "Draft runtime definition hash mismatch",
    };
  }

  const inputSnapshot = structuredClone(input);
  const request = buildMilitaryExpertGenerationRequest(input);
  const requestHash = hashMilitaryExpertGenerationRequest(request);
  const systemPromptHash = hashMilitaryExpertSystemPrompt(request.systemPrompt);
  const reviewPromptHash = hashMilitaryExpertReviewPrompt(
    request.reviewPrompt,
    request.manuscriptHash,
  );

  if (JSON.stringify(input) !== JSON.stringify(inputSnapshot)) {
    return {
      ...base,
      ok: false,
      requestHash,
      systemPromptHash,
      reviewPromptHash,
      rawResponseHash: null,
      parsedReviewHash: null,
      generationStatus: "contract_rejected",
      repairDecision: "reject_output",
      durationMs: Math.max(0, (dependencies.now ?? Date.now)() - startedAt),
      failureReason: "Input was mutated during request build",
    };
  }

  if (!input.rawResponse) {
    return {
      ...base,
      ok: false,
      requestHash,
      systemPromptHash,
      reviewPromptHash,
      rawResponseHash: null,
      parsedReviewHash: null,
      generationStatus: "contract_rejected",
      repairDecision: "reject_output",
      durationMs: Math.max(0, (dependencies.now ?? Date.now)() - startedAt),
      failureReason: "Synthetic raw response is required in PR 2 harness",
    };
  }

  const repairDecision = classifyMilitaryExpertRepairNeed({
    raw: input.rawResponse,
    expectedCorrelationId: input.correlationId,
  }).decision;

  const parsed = parseMilitaryExpertGenerationResponse(input.rawResponse, {
    expectedCorrelationId: input.correlationId,
  });

  if (!parsed.ok) {
    return {
      ...base,
      ok: false,
      requestHash,
      systemPromptHash,
      reviewPromptHash,
      rawResponseHash: hashMilitaryExpertRawResponse(input.rawResponse),
      parsedReviewHash: null,
      generationStatus: "parse_failed",
      repairDecision,
      durationMs: Math.max(0, (dependencies.now ?? Date.now)() - startedAt),
      failureReason: parsed.message,
    };
  }

  const reviewDraft = payloadToReview(parsed.payload, input, request.definitionHash);
  const normalized = normalizeMilitaryExpertReview(reviewDraft);
  const validation = validateMilitaryExpertReview(normalized, {
    expectedDefinitionHash: request.definitionHash,
  });

  if (!validation.ok) {
    return {
      ...base,
      ok: false,
      requestHash,
      systemPromptHash,
      reviewPromptHash,
      rawResponseHash: hashMilitaryExpertRawResponse(input.rawResponse),
      parsedReviewHash: hashMilitaryExpertParsedReview(normalized),
      generationStatus: "validation_failed",
      repairDecision,
      durationMs: Math.max(0, (dependencies.now ?? Date.now)() - startedAt),
      failureReason: validation.errors.slice(0, 5).join("; "),
    };
  }

  return {
    ...base,
    ok: true,
    requestHash,
    systemPromptHash,
    reviewPromptHash,
    rawResponseHash: hashMilitaryExpertRawResponse(input.rawResponse),
    parsedReviewHash: hashMilitaryExpertParsedReview(normalized),
    generationStatus: "success",
    repairDecision,
    durationMs: Math.max(0, (dependencies.now ?? Date.now)() - startedAt),
    enumNormalizationAudits: parsed.enumNormalizationAudits,
    review: normalized,
  };
}

export {
  EXPERT_MILITARY_GENERATION_CONTRACT_FLAG_NAME,
  readExpertMilitaryGenerationContractEnabled,
} from "@/lib/expert-review-engine/feature-flags.ts";
