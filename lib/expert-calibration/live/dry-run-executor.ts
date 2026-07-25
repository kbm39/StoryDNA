import type {
  LiveCalibrationCallPlan,
  LiveCalibrationCliArgs,
  LiveCalibrationRunManifest,
} from "./contracts.ts";
import { LIVE_CALIBRATION_EXIT } from "./errors.ts";
import { LIVE_CALIBRATION_MANIFEST_SCHEMA_VERSION } from "./constants.ts";
import { formatCliArgsForManifest } from "./cli-parser.ts";
import { writeRunManifest } from "./result-store.ts";

export interface DryRunExecutorInput {
  readonly args: LiveCalibrationCliArgs;
  readonly callPlan: LiveCalibrationCallPlan;
  readonly runId: string;
  readonly correlationId: string;
  readonly startedAt: number;
  readonly writeArtifacts?: boolean;
}

export interface DryRunExecutorResult {
  readonly ok: true;
  readonly exitCode: typeof LIVE_CALIBRATION_EXIT.success;
  readonly manifest: LiveCalibrationRunManifest;
  readonly filesWritten: number;
  readonly modelCalls: 0;
  readonly providerCalls: 0;
  readonly productionWrites: 0;
  readonly productionExecutionOccurred: false;
}

export async function executeDryRun(input: DryRunExecutorInput): Promise<DryRunExecutorResult> {
  const manifest: LiveCalibrationRunManifest = Object.freeze({
    schema_version: LIVE_CALIBRATION_MANIFEST_SCHEMA_VERSION,
    run_id: input.runId,
    correlation_id: input.correlationId,
    mode: "dry-run",
    expert_key: input.args.expert,
    suite_id: input.args.suite,
    subset_id: input.args.subset,
    subset_hash: input.callPlan.subsetHash,
    provider: input.args.provider,
    model_id: input.callPlan.providerSpec.modelId,
    pricing_profile_id: input.callPlan.providerSpec.pricingProfileId,
    runs: input.args.runs,
    planned_calls: input.callPlan.calls.length,
    estimated_cost_usd: input.callPlan.totalEstimatedCostUsd,
    started_at: new Date(input.startedAt).toISOString(),
    completed_at: new Date(input.startedAt).toISOString(),
    synthetic_scenario: null,
    flags_acknowledged: false,
    model_lifecycle: input.callPlan.modelLifecycle,
  });

  let filesWritten = 0;

  if (input.writeArtifacts !== false) {
    writeRunManifest(input.args.outputDir, input.runId, {
      ...manifest,
      cli_args: formatCliArgsForManifest(input.args),
      call_plan: {
        calls: input.callPlan.calls.map((c) => ({
          case_id: c.caseId,
          run_index: c.runIndex,
          correlation_id: c.correlationId,
          estimated_input_tokens: c.estimatedInputTokens,
          estimated_output_tokens: c.estimatedOutputTokens,
          estimated_cost_usd: c.estimatedCostUsd,
          authorized_output_tokens: c.authorizedOutputTokens,
          authorized_worst_case_cost_usd: c.authorizedWorstCaseCostUsd,
          provider_max_output_tokens: c.providerMaxOutputTokens,
          request_hash: c.requestHash,
          system_prompt_hash: c.systemPromptHash,
          review_prompt_hash: c.reviewPromptHash,
        })),
        total_estimated_input_tokens: input.callPlan.totalEstimatedInputTokens,
        total_estimated_output_tokens: input.callPlan.totalEstimatedOutputTokens,
        total_estimated_cost_usd: input.callPlan.totalEstimatedCostUsd,
        total_authorized_worst_case_cost_usd: input.callPlan.totalAuthorizedWorstCaseCostUsd,
        output_token_policy_version: input.callPlan.outputTokenPolicyVersion,
        token_budget_policy_version: input.callPlan.tokenBudgetPolicyVersion,
        provider_max_output_tokens: input.callPlan.providerMaxOutputTokens,
        run_max_output_tokens: input.callPlan.runMaxOutputTokens,
        model_lifecycle: input.callPlan.modelLifecycle,
      },
    }, input.args.overwrite);
    filesWritten += 1;
  }

  return {
    ok: true,
    exitCode: LIVE_CALIBRATION_EXIT.success,
    manifest,
    filesWritten,
    modelCalls: 0,
    providerCalls: 0,
    productionWrites: 0,
    productionExecutionOccurred: false,
  };
}
