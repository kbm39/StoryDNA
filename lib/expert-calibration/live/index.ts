export {
  LIVE_CALIBRATION_ACK_TOKEN,
  LIVE_CALIBRATION_APPROVED_ROOT,
  LIVE_CALIBRATION_DEFAULTS,
  LIVE_CALIBRATION_ESTIMATED_INPUT_TOKENS_PER_CASE,
  LIVE_CALIBRATION_ESTIMATED_OUTPUT_TOKENS_PER_CASE,
  LIVE_CALIBRATION_LIVE_SMOKE,
  LIVE_CALIBRATION_SCHEMA_VERSION,
  LIVE_CALIBRATION_SESSION_DEFAULTS,
} from "./constants.ts";

export type {
  LiveCalibrationCliArgs,
  LiveCalibrationCallPlan,
  LiveCalibrationMode,
  LiveCalibrationResult,
  LiveCalibrationRunManifest,
  LiveCalibrationSubsetId,
  LiveCalibrationProviderInvoker,
  LiveCalibrationSessionBudget,
  LiveCalibrationAuditEvent,
  SyntheticScenarioId,
} from "./contracts.ts";

export {
  LiveCalibrationError,
  LIVE_CALIBRATION_EXIT,
  sanitizeLiveCalibrationMessage,
} from "./errors.ts";

export {
  EXPERT_CALIBRATION_LIVE_ENABLED_FLAG_NAME,
  EXPERT_CALIBRATION_ANTHROPIC_ENABLED_FLAG_NAME,
  EXPERT_MILITARY_LIVE_CALIBRATION_ENABLED_FLAG_NAME,
  readExpertCalibrationLiveEnabled,
  readExpertCalibrationAnthropicEnabled,
  readExpertMilitaryLiveCalibrationEnabled,
  readLiveCalibrationFeatureFlagStatus,
} from "./feature-flags.ts";

export { parseLiveCalibrationCliArgs, formatCliArgsForManifest } from "./cli-parser.ts";
export { validateOperatorAuthorization } from "./operator-auth.ts";
export { validateLiveSmokeAuthorization } from "./live-authorization.ts";
export { readAnthropicApiKey, hasAnthropicApiKey, ANTHROPIC_API_KEY_ENV } from "./api-key.ts";
export {
  loadSessionBudget,
  reserveSessionBudget,
  commitSessionSpend,
  canSessionAfford,
  getSessionRemainingMicroUsd,
} from "./session-budget.ts";
export { appendAuditEvent, createAuditEvent } from "./audit-log.ts";
export { resolveProviderSpec, ANTHROPIC_HAIKU_MODEL_ID, ANTHROPIC_HAIKU_MODEL_ALIAS } from "./provider-allowlist.ts";
export {
  LIVE_CALIBRATION_SUBSETS,
  LIVE_CALIBRATION_SUBSET_IDS,
  getLiveCalibrationSubset,
  hashLiveCalibrationSubsetCaseIds,
} from "./subsets.ts";
export { buildLiveCalibrationCallPlan } from "./call-planner.ts";
export { createBudgetController, usdToMicroUsd, microUsdToUsd } from "./budget-controller.ts";
export { createAbortController, isAbortError } from "./abort-controller.ts";
export {
  writeAtomicArtifact,
  writeRunManifest,
  resolveApprovedOutputPath,
  rejectPathTraversal,
} from "./result-store.ts";
export {
  resolveSyntheticScenario,
  buildSyntheticSuccessRawResponse,
  SYNTHETIC_SCENARIO_IDS,
} from "./synthetic-adapter.ts";
export { executeDryRun } from "./dry-run-executor.ts";
export { executeSynthetic } from "./synthetic-executor.ts";
export { executeLive } from "./live-executor.ts";
export { createAnthropicProviderInvoker } from "./providers/anthropic/invoke.ts";
export { runLiveCalibration, runLiveCalibrationFromArgv } from "./orchestrator.ts";
