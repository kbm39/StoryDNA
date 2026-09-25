/**
 * $0 replay of saved real-Reckoning V2 output through compact proposition recovery.
 * No provider call. Does not rewrite the official artifact.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { V2_REAL_RECKONING_CAL_V1_SESSION_ID } from "./lock.ts";
import { replaySavedRealReckoningCalibration } from "./replay.ts";

const official = JSON.parse(
  readFileSync(`.calibration-results/${V2_REAL_RECKONING_CAL_V1_SESSION_ID}.json`, "utf8"),
) as { raw: { r8010: string; r8011: string; r8029: string }; overall?: { true_positives?: number } };
if (official.overall?.true_positives !== 3) {
  throw new Error("STOP: official artifact true_positives must remain 3");
}
const report = replaySavedRealReckoningCalibration(official.raw);
mkdirSync(".calibration-results", { recursive: true });
writeFileSync(
  `.calibration-results/${V2_REAL_RECKONING_CAL_V1_SESSION_ID}-replay.json`,
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    {
      session_id: report.session_id,
      official_verdict_unrewritten: report.official_verdict_unrewritten,
      provider_calls: report.provider_calls,
      incremental_cost_usd: report.incremental_cost_usd,
      official_tp: report.official.true_positives,
      replay_overall: report.overall,
      detection: report.detection,
      r8010_capabilities: report.r8010.capabilities,
      r8010_quarantined: report.r8010.quarantined,
      r8029_injuries: report.r8029.injuries,
    },
    null,
    2,
  ),
);
