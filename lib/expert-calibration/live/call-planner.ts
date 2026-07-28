import {
  buildMilitaryExpertGenerationRequest,
  hashMilitaryExpertGenerationRequest,
  hashMilitaryExpertReviewPrompt,
  hashMilitaryExpertSystemPrompt,
} from "@/experts/military-expert/generation-contract.ts";
import { MILITARY_EXPERT_CALIBRATION_SUITE } from "@/experts/military-expert/calibration/corpus.ts";
import { estimateTokenCost, isLiveEligiblePricingProfile } from "../cost-analysis.ts";
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
import {
  toModelLifecycleSnapshot,
  validateModelLifecycleForLivePlan,
} from "./model-lifecycle.ts";
import { exceedsUsdLimit, serializeUsd, sumSerializedUsd } from "./budget-controller.ts";
import {
  deriveAuthorizedOutputTokenPolicy,
  LIVE_CALIBRATION_OUTPUT_TOKEN_POLICY_VERSION,
  validateAuthorizedTokenPolicy,
} from "./budget-policy.ts";
import {
  LIVE_CALIBRATION_TOKEN_BUDGET_POLICY_VERSION,
  resolveTokenBudgetFromCliArgs,
} from "./token-budget.ts";

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

  if (input.args.mode === "live" && !isLiveEligiblePricingProfile(input.providerSpec.pricingProfileId)) {
    throw new LiveCalibrationError(
      "allowlist_violation",
      `Pricing profile not eligible for new live plans: ${input.providerSpec.pricingProfileId}`,
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

  const lifecycleRecord = validateModelLifecycleForLivePlan(input.providerSpec.modelId);
  const modelLifecycle = toModelLifecycleSnapshot(lifecycleRecord);

  const caseById = new Map(
    MILITARY_EXPERT_CALIBRATION_SUITE.cases.map((c) => [c.case_id, c]),
  );

  const calls: LiveCalibrationPlannedCall[] = [];
  let maxPlannedInputTokens: number = LIVE_CALIBRATION_ESTIMATED_INPUT_TOKENS_PER_CASE;

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
      const reviewPromptHash = hashMilitaryExpertReviewPrompt(
        request.reviewPrompt,
        request.manuscriptHash,
      );
      const { inputTokens, outputTokens } = estimateTokensFromRequest(
        request.systemPrompt,
        request.reviewPrompt,
      );
      maxPlannedInputTokens = Math.max(maxPlannedInputTokens, inputTokens);
      const estimatedCostUsd = serializeUsd(
        estimateTokenCost(
          inputTokens,
          outputTokens,
          input.providerSpec.pricingProfileId,
        ),
      );

      calls.push(
        Object.freeze({
          caseId,
          runIndex,
          correlationId,
          estimatedInputTokens: inputTokens,
          estimatedOutputTokens: outputTokens,
          estimatedCostUsd,
          authorizedOutputTokens: 0,
          authorizedWorstCaseCostUsd: 0,
          providerMaxOutputTokens: 0,
          requestHash,
          systemPromptHash,
          reviewPromptHash,
        }),
      );
    }
  }

  const tokenPolicy = deriveAuthorizedOutputTokenPolicy({
    maxCostPerCallUsd: input.args.maxCostPerCallUsd,
    maxTotalCostUsd: input.args.maxTotalCostUsd,
    plannedCallCount: calls.length,
    plannedInputTokensPerCall: maxPlannedInputTokens,
    pricingProfileId: input.providerSpec.pricingProfileId,
    cliMaxOutputTokens: input.args.maxOutputTokens,
  });

  validateAuthorizedTokenPolicy({
    policy: tokenPolicy,
    maxCostPerCallUsd: input.args.maxCostPerCallUsd,
    maxTotalCostUsd: input.args.maxTotalCostUsd,
    plannedCallCount: calls.length,
  });

  const tokenLimits = resolveTokenBudgetFromCliArgs(input.args);
  const minimumRunOutputTokens = tokenPolicy.providerMaxOutputTokens * calls.length;
  if (tokenLimits.runMaxOutputTokens < minimumRunOutputTokens) {
    throw new LiveCalibrationError(
      "invalid_configuration",
      `Cumulative run output ceiling (${tokenLimits.runMaxOutputTokens}) is insufficient for ${calls.length} calls at ${tokenPolicy.providerMaxOutputTokens} tokens per call (requires ${minimumRunOutputTokens})`,
    );
  }

  const authorizedCalls = calls.map((call) =>
    Object.freeze({
      ...call,
      authorizedOutputTokens: tokenPolicy.authorizedOutputTokensPerCall,
      authorizedWorstCaseCostUsd: tokenPolicy.authorizedWorstCaseCostUsd,
      providerMaxOutputTokens: tokenPolicy.providerMaxOutputTokens,
    }),
  );

  const totalEstimatedInputTokens = authorizedCalls.reduce((s, c) => s + c.estimatedInputTokens, 0);
  const totalEstimatedOutputTokens = authorizedCalls.reduce(
    (s, c) => s + c.estimatedOutputTokens,
    0,
  );
  const totalEstimatedCostUsd = sumSerializedUsd(authorizedCalls.map((c) => c.estimatedCostUsd));
  const totalAuthorizedWorstCaseCostUsd = sumSerializedUsd(
    authorizedCalls.map((c) => c.authorizedWorstCaseCostUsd),
  );

  if (authorizedCalls.length > input.args.maxCalls) {
    throw new LiveCalibrationError(
      "cost_limit_exceeded",
      `Planned calls (${authorizedCalls.length}) exceed --max-calls (${input.args.maxCalls})`,
    );
  }

  if (exceedsUsdLimit(totalEstimatedCostUsd, input.args.maxTotalCostUsd)) {
    throw new LiveCalibrationError(
      "cost_limit_exceeded",
      `Estimated cost ($${serializeUsd(totalEstimatedCostUsd).toFixed(4)}) exceeds --max-total-cost ($${input.args.maxTotalCostUsd})`,
    );
  }

  for (const call of authorizedCalls) {
    if (exceedsUsdLimit(call.estimatedCostUsd, input.args.maxCostPerCallUsd)) {
      throw new LiveCalibrationError(
        "cost_limit_exceeded",
        `Per-call estimate for ${call.caseId} exceeds --max-cost-per-call`,
      );
    }
    if (exceedsUsdLimit(call.authorizedWorstCaseCostUsd, input.args.maxCostPerCallUsd)) {
      throw new LiveCalibrationError(
        "cost_limit_exceeded",
        `Authorized worst-case for ${call.caseId} exceeds --max-cost-per-call`,
      );
    }
  }

  return Object.freeze({
    subsetId: subset.subsetId,
    subsetHash: subset.subsetHash,
    suiteId: input.args.suite,
    expertKey: input.args.expert,
    providerSpec: input.providerSpec,
    modelLifecycle,
    runs: input.args.runs,
    calls: Object.freeze(authorizedCalls),
    totalEstimatedInputTokens,
    totalEstimatedOutputTokens,
    totalEstimatedCostUsd,
    totalAuthorizedWorstCaseCostUsd,
    outputTokenPolicyVersion: LIVE_CALIBRATION_OUTPUT_TOKEN_POLICY_VERSION,
    tokenBudgetPolicyVersion: LIVE_CALIBRATION_TOKEN_BUDGET_POLICY_VERSION,
    providerMaxOutputTokens: tokenPolicy.providerMaxOutputTokens,
    runMaxOutputTokens: tokenLimits.runMaxOutputTokens,
  });
}

export function getPlannedCallCount(plan: LiveCalibrationCallPlan): number {
  return plan.calls.length;
}
