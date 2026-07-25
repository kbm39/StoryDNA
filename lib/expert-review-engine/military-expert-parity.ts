/**
 * Military Expert deterministic parity harness (PR 2).
 *
 * Compares direct certified invocation against module-resolver/executor paths
 * for approved deterministic Military Expert exports. Not wired to production.
 */

import { MILITARY_EXPERT, buildReviewPrompt, buildSystemPrompt } from "@/experts/military-expert/definition.ts";
import {
  MILITARY_EXPERT_KEY,
} from "@/experts/military-expert/contracts.ts";
import { buildMilitaryExpertGenerationRequest } from "@/experts/military-expert/generation-contract.ts";
import { parseMilitaryExpertGenerationResponse } from "@/experts/military-expert/parsing.ts";
import { classifyMilitaryExpertRepairNeed } from "@/experts/military-expert/repair-classification.ts";
import { normalizeMilitaryExpertReview } from "@/experts/military-expert/normalization.ts";
import {
  buildMilitaryExpertReviewPrompt,
  buildMilitaryExpertSystemPrompt,
} from "@/experts/military-expert/prompts.ts";
import { buildValidMilitaryExpertReview } from "@/experts/military-expert/fixtures.ts";
import {
  FIXTURE_CORRELATION_ID,
  FIXTURE_MANUSCRIPT_HASH,
  FIXTURE_MANUSCRIPT_TEXT,
  FIXTURE_MANUSCRIPT_VERSION_ID,
  FIXTURE_VALID_COMPLETE_JSON,
} from "@/experts/military-expert/generation-fixtures.ts";
import { militaryExpertRuntimeDefinition } from "@/experts/military-expert/runtime-definition.ts";
import { compareCanonicalOutputs } from "@/lib/expert-review-engine/canonical-output.ts";
import {
  EXPERT_MILITARY_GENERATION_CONTRACT_FLAG_NAME,
  readExpertMilitaryGenerationContractEnabled,
} from "@/lib/expert-review-engine/feature-flags.ts";

export const MILITARY_EXPERT_PARITY_EXPERT_KEY = MILITARY_EXPERT_KEY;
export const MILITARY_EXPERT_PARITY_DEFINITION_HASH =
  militaryExpertRuntimeDefinition().runtime_versions.definition_hash;

export const MILITARY_EXPERT_APPROVED_PARITY_EXPORTS = [
  {
    key: "system_prompt",
    direct: () => buildMilitaryExpertSystemPrompt(MILITARY_EXPERT),
    engine: () => buildSystemPrompt(MILITARY_EXPERT),
  },
  {
    key: "review_prompt",
    direct: () =>
      buildMilitaryExpertReviewPrompt({
        def: MILITARY_EXPERT,
        manuscriptVersionId: FIXTURE_MANUSCRIPT_VERSION_ID,
        reviewScope: "full_manuscript",
        manuscriptText: FIXTURE_MANUSCRIPT_TEXT,
        canonicalWordCount: 24,
        manuscriptHash: FIXTURE_MANUSCRIPT_HASH,
      }),
    engine: () =>
      buildReviewPrompt(MILITARY_EXPERT, null, {
        wordCount: 24,
        manuscriptText: FIXTURE_MANUSCRIPT_TEXT,
        manuscriptVersionId: FIXTURE_MANUSCRIPT_VERSION_ID,
        reviewScope: "full_manuscript",
        manuscriptHash: FIXTURE_MANUSCRIPT_HASH,
      }),
  },
  {
    key: "generation_request",
    direct: () =>
      buildMilitaryExpertGenerationRequest({
        correlationId: FIXTURE_CORRELATION_ID,
        manuscriptVersionId: FIXTURE_MANUSCRIPT_VERSION_ID,
        reviewScope: "full_manuscript",
        manuscriptText: FIXTURE_MANUSCRIPT_TEXT,
        canonicalWordCount: 24,
        manuscriptHash: FIXTURE_MANUSCRIPT_HASH,
      }),
    engine: () =>
      buildMilitaryExpertGenerationRequest({
        correlationId: FIXTURE_CORRELATION_ID,
        manuscriptVersionId: FIXTURE_MANUSCRIPT_VERSION_ID,
        reviewScope: "full_manuscript",
        manuscriptText: FIXTURE_MANUSCRIPT_TEXT,
        canonicalWordCount: 24,
        manuscriptHash: FIXTURE_MANUSCRIPT_HASH,
      }),
  },
] as const;

export interface MilitaryExpertParityResult {
  key: string;
  match: boolean;
  engineHash?: string;
  directHash?: string;
}

export function runMilitaryExpertDeterministicParity(args?: {
  bypassFeatureFlag?: boolean;
  featureFlagReader?: () => boolean;
}): { ok: boolean; results: MilitaryExpertParityResult[]; message?: string } {
  const featureFlagReader =
    args?.featureFlagReader ?? readExpertMilitaryGenerationContractEnabled;
  if (!args?.bypassFeatureFlag && !featureFlagReader()) {
    return {
      ok: false,
      message: `${EXPERT_MILITARY_GENERATION_CONTRACT_FLAG_NAME} is off`,
      results: [],
    };
  }

  const results: MilitaryExpertParityResult[] = [];
  for (const entry of MILITARY_EXPERT_APPROVED_PARITY_EXPORTS) {
    const directOutput = entry.direct();
    const engineOutput = entry.engine();
    const comparison = compareCanonicalOutputs(engineOutput, directOutput);
    if (!comparison.ok) {
      return { ok: false, message: `Canonicalization failed for ${entry.key}`, results };
    }
    results.push({
      key: entry.key,
      match: comparison.match,
      engineHash: comparison.engineHash,
      directHash: comparison.directHash,
    });
  }

  const parsedDirect = parseMilitaryExpertGenerationResponse(FIXTURE_VALID_COMPLETE_JSON, {
    expectedCorrelationId: FIXTURE_CORRELATION_ID,
  });
  const parsedEngine = parseMilitaryExpertGenerationResponse(structuredClone(FIXTURE_VALID_COMPLETE_JSON), {
    expectedCorrelationId: FIXTURE_CORRELATION_ID,
  });
  const repair = classifyMilitaryExpertRepairNeed({
    raw: FIXTURE_VALID_COMPLETE_JSON,
    expectedCorrelationId: FIXTURE_CORRELATION_ID,
  });
  const normalizedDirect = normalizeMilitaryExpertReview(buildValidMilitaryExpertReview());
  const normalizedEngine = normalizeMilitaryExpertReview(structuredClone(buildValidMilitaryExpertReview()));
  const normalizationComparison = compareCanonicalOutputs(normalizedEngine, normalizedDirect);

  results.push({
    key: "parser",
    match: parsedDirect.ok && parsedEngine.ok,
  });
  results.push({ key: "repair", match: repair.decision === "no_repair_needed" });
  results.push({
    key: "normalization",
    match: normalizationComparison.ok ? normalizationComparison.match : false,
    engineHash: normalizationComparison.ok ? normalizationComparison.engineHash : undefined,
    directHash: normalizationComparison.ok ? normalizationComparison.directHash : undefined,
  });

  return {
    ok: results.every((result) => result.match),
    results,
  };
}

export {
  EXPERT_MILITARY_GENERATION_CONTRACT_FLAG_NAME,
  readExpertMilitaryGenerationContractEnabled,
};
