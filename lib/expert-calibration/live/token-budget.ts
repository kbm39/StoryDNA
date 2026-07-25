/**
 * Explicit live-calibration token budget concepts — per-call provider caps vs cumulative run ceilings.
 */

import type { LiveCalibrationCliArgs } from "./contracts.ts";
import { LiveCalibrationError } from "./errors.ts";

export const LIVE_CALIBRATION_TOKEN_BUDGET_POLICY_VERSION =
  "live_calibration_token_budget@v2" as const;

/** Anthropic request max_tokens for a single provider call. */
export interface LiveCalibrationTokenBudgetLimits {
  readonly policyVersion: typeof LIVE_CALIBRATION_TOKEN_BUDGET_POLICY_VERSION;
  readonly providerMaxOutputTokensPerCall: number;
  readonly runMaxOutputTokens: number;
  readonly runMaxInputTokens: number;
}

export interface ResolveTokenBudgetInput {
  readonly maxOutputTokens: number;
  readonly maxRunOutputTokens?: number;
  readonly maxInputTokens: number;
  readonly maxCalls: number;
}

/** Resolve per-call provider and cumulative run token ceilings without conflating CLI flags. */
export function resolveTokenBudgetLimits(
  input: ResolveTokenBudgetInput,
): LiveCalibrationTokenBudgetLimits {
  const providerMaxOutputTokensPerCall = input.maxOutputTokens;
  if (providerMaxOutputTokensPerCall < 1) {
    throw new LiveCalibrationError(
      "invalid_configuration",
      "--max-output-tokens must be >= 1 (provider per-call cap)",
    );
  }

  const derivedRunMaxOutputTokens = providerMaxOutputTokensPerCall * input.maxCalls;
  const runMaxOutputTokens = input.maxRunOutputTokens ?? derivedRunMaxOutputTokens;

  if (runMaxOutputTokens < providerMaxOutputTokensPerCall) {
    throw new LiveCalibrationError(
      "invalid_configuration",
      "Cumulative run output-token ceiling must be >= provider per-call max output tokens",
    );
  }

  if (runMaxOutputTokens < derivedRunMaxOutputTokens) {
    throw new LiveCalibrationError(
      "invalid_configuration",
      `Cumulative run output ceiling (${runMaxOutputTokens}) is insufficient for ${input.maxCalls} calls at ${providerMaxOutputTokensPerCall} tokens per call (requires ${derivedRunMaxOutputTokens})`,
    );
  }

  return Object.freeze({
    policyVersion: LIVE_CALIBRATION_TOKEN_BUDGET_POLICY_VERSION,
    providerMaxOutputTokensPerCall,
    runMaxOutputTokens,
    runMaxInputTokens: input.maxInputTokens,
  });
}

export function resolveTokenBudgetFromCliArgs(
  args: Pick<
    LiveCalibrationCliArgs,
    "maxOutputTokens" | "maxRunOutputTokens" | "maxInputTokens" | "maxCalls"
  >,
): LiveCalibrationTokenBudgetLimits {
  return resolveTokenBudgetLimits({
    maxOutputTokens: args.maxOutputTokens,
    maxRunOutputTokens: args.maxRunOutputTokens,
    maxInputTokens: args.maxInputTokens,
    maxCalls: args.maxCalls,
  });
}
