/**
 * Military Expert live calibration CLI (PR 3B-1).
 * Dry-run and synthetic modes only — live mode rejected until PR 3B-2.
 *
 * Relies on --import ./scripts/test-path-alias.mjs from npm script for @/ resolution.
 */
const { runLiveCalibrationFromArgv } = await import(
  "@/lib/expert-calibration/live/orchestrator.ts"
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
          estimated_cost_usd: result.callPlan.totalEstimatedCostUsd,
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
