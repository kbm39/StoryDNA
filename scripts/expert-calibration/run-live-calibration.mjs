/**
 * Military Expert live calibration CLI (PR 3B-2).
 *
 * Developer-only controlled calibration — not production execution.
 * Live mode supports one pinned Anthropic model (`haiku-4-5-v1`) and the
 * three-case smoke subset only. It requires explicit authorization,
 * all live feature flags, session/run budgets, `--session-id`, and
 * `ANTHROPIC_API_KEY` in the environment.
 *
 * Do not run in CI or Vercel. Dry-run and synthetic modes remain
 * zero provider-call paths for local validation.
 *
 * Relies on --import ./scripts/test-path-alias.mjs from npm script for @/ resolution.
 */
const { runLiveCalibrationFromArgv } = await import(
  "@/lib/expert-calibration/live/orchestrator.ts"
);
const { serializeUsd } = await import(
  "@/lib/expert-calibration/live/budget-controller.ts"
);

const argv = process.argv.slice(2);

try {
  const result = await runLiveCalibrationFromArgv(argv);
  if (result.failureReason) {
    console.error(`[calibrate:military] ${result.failureReason}`);
  }
  if (result.callPlan) {
    console.log(
      JSON.stringify(
        {
          ok: result.ok,
          mode: result.mode,
          run_id: result.runId,
          planned_calls: result.callPlan.calls.length,
          estimated_cost_usd: serializeUsd(result.callPlan.totalEstimatedCostUsd),
          model_calls: result.modelCalls,
          provider_calls: result.providerCalls,
        },
        null,
        2,
      ),
    );
  }
  process.exit(result.exitCode);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[calibrate:military] ${message}`);
  process.exit(1);
}
