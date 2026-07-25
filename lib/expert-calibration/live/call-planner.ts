import {
  buildMilitaryExpertGenerationRequest,
  hashMilitaryExpertGenerationRequest,
  hashMilitaryExpertReviewPrompt,
  hashMilitaryExpertSystemPrompt,
} from "@/experts/military-expert/generation-contract.ts";
import { MILITARY_EXPERT_CALIBRATION_SUITE } from "@/experts/military-expert/calibration/corpus.ts";
import { estimateTokenCost } from "../cost-analysis.ts";
import type {
  LiveCalibrationCallPlan,
  LiveCalibrationCliArgs,
  LiveCalibrationPlannedCall,
  LiveCalibrationProviderSpec,
} from "./contracts.ts";
import { LiveCalibrationError } from "./errors.ts";
import {
  LIVE_CALIBRATION_ESTIMATED_INPUT_TOKENS_PER_CASE,
  LIVE_CALIBRATION_ESTIMATED_OUTPUT_TOKENS_PER_CASE,
} from "./constants.ts";
import { getLiveCalibrationSubset, validateSubsetCaseIds } from "./subsets.ts";

export interface BuildCallPlanInput {
  readonly args: LiveCalibrationCliArgs;
  readonly providerSpec: LiveCalibrationProviderSpec;
  readonly correlationPrefix: string;
}

function estimateTokensFromRequest(systemPrompt: string, reviewPrompt: string): {
  inputTokens: number;
  outputTokens: number;
} {
  // Use design-report provisional estimates; char-based fallback for sanity check
  const charEstimate = Math.ceil((systemPrompt.length + reviewPrompt.length) / 4);
  const inputTokens = Math.max(LIVE_CALIBRATION_ESTIMATED_INPUT_TOKENS_PER_CASE, charEstimate);
  const outputTokens = LIVE_CALIBRATION_ESTIMATED_OUTPUT_TOKENS_PER_CASE;
  return { inputTokens, outputTokens };
}

export function buildLiveCalibrationCallPlan(input: BuildCallPlanInput): LiveCalibrationCallPlan {
  if (input.args.suite !== MILITARY_EXPERT_CALIBRATION_SUITE.suite_id) {
    throw new LiveCalibrationError(
      "invalid_configuration",
      `Unknown suite: ${input.args.suite}`,
    );
  }

  const subset = getLiveCalibrationSubset(input.args.subset);
  const validation = validateSubsetCaseIds(subset.caseIds);
  if (!validation.ok) {
    throw new LiveCalibrationError(
      "invalid_configuration",
      `Unknown case IDs in subset: ${validation.unknown.join(", ")}`,
    );
  }

  const caseById = new Map(
    MILITARY_EXPERT_CALIBRATION_SUITE.cases.map((c) => [c.case_id, c]),
  );

  const calls: LiveCalibrationPlannedCall[] = [];

  for (let runIndex = 0; runIndex < input.args.runs; runIndex++) {
    for (const caseId of subset.caseIds) {
      const calibrationCase = caseById.get(caseId);
      if (!calibrationCase) {
        throw new LiveCalibrationError(
          "invalid_configuration",
          `Case not found in suite: ${caseId}`,
        );
      }

      const correlationId = `${input.correlationPrefix}-${caseId}-${runIndex}`;
      const request = buildMilitaryExpertGenerationRequest({
        correlationId,
        manuscriptVersionId: `cal-${caseId}`,
        reviewScope: calibrationCase.manuscript.scope === "scene" ? "scene" : "sample",
        manuscriptText: calibrationCase.manuscript.text,
        canonicalWordCount: calibrationCase.manuscript.word_count,
        manuscriptHash: calibrationCase.manuscript.content_hash,
        genreContext: calibrationCase.manuscript.genre_context ?? null,
        countryPeriod: calibrationCase.manuscript.country_period ?? null,
      });

      const requestHash = hashMilitaryExpertGenerationRequest(request);
      const systemPromptHash = hashMilitaryExpertSystemPrompt(request.systemPrompt);
      const reviewPromptHash = hashMilitaryExpertReviewPrompt(request.reviewPrompt);
      const { inputTokens, outputTokens } = estimateTokensFromRequest(
        request.systemPrompt,
        request.reviewPrompt,
      );
      const estimatedCostUsd = estimateTokenCost(
        inputTokens,
        outputTokens,
        input.providerSpec.pricingProfileId,
      );

      calls.push(
        Object.freeze({
          caseId,
          runIndex,
          correlationId,
          estimatedInputTokens: inputTokens,
          estimatedOutputTokens: outputTokens,
          estimatedCostUsd,
          requestHash,
          systemPromptHash,
          reviewPromptHash,
        }),
      );
    }
  }

  const totalEstimatedInputTokens = calls.reduce((s, c) => s + c.estimatedInputTokens, 0);
  const totalEstimatedOutputTokens = calls.reduce((s, c) => s + c.estimatedOutputTokens, 0);
  const totalEstimatedCostUsd = calls.reduce((s, c) => s + c.estimatedCostUsd, 0);

  if (calls.length > input.args.maxCalls) {
    throw new LiveCalibrationError(
      "cost_limit_exceeded",
      `Planned calls (${calls.length}) exceed --max-calls (${input.args.maxCalls})`,
    );
  }

  if (totalEstimatedCostUsd > input.args.maxTotalCostUsd) {
    throw new LiveCalibrationError(
      "cost_limit_exceeded",
      `Estimated cost ($${totalEstimatedCostUsd.toFixed(4)}) exceeds --max-total-cost ($${input.args.maxTotalCostUsd})`,
    );
  }

  for (const call of calls) {
    if (call.estimatedCostUsd > input.args.maxCostPerCallUsd) {
      throw new LiveCalibrationError(
        "cost_limit_exceeded",
        `Per-call estimate for ${call.caseId} exceeds --max-cost-per-call`,
      );
    }
  }

  return Object.freeze({
    subsetId: subset.subsetId,
    subsetHash: subset.subsetHash,
    suiteId: input.args.suite,
    expertKey: input.args.expert,
    providerSpec: input.providerSpec,
    runs: input.args.runs,
    calls: Object.freeze(calls),
    totalEstimatedInputTokens,
    totalEstimatedOutputTokens,
    totalEstimatedCostUsd,
  });
}

export function getPlannedCallCount(plan: LiveCalibrationCallPlan): number {
  return plan.calls.length;
}
