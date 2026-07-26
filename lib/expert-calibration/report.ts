import { EXPERT_CALIBRATION_REPORT_SCHEMA_VERSION } from "./constants.ts";
import type {
  CalibrationReport,
  CalibrationSuiteResult,
  CertificationReadinessDecision,
} from "./contracts.ts";
import { MILITARY_CALIBRATION_EXPECTATION_MATCHING_VERSION } from "./expectation-matching.ts";

function sanitizeMessage(message: string): string {
  if (message.length > 200) return `${message.slice(0, 197)}...`;
  return message;
}

export function formatCalibrationReportMarkdown(
  suiteResult: CalibrationSuiteResult,
  certification: CertificationReadinessDecision,
): string {
  const m = suiteResult.metrics;
  const lines = [
    `# Expert Calibration Report — ${suiteResult.expert_key} ${suiteResult.expert_version}`,
    "",
    `**Run ID**: ${suiteResult.run_id}`,
    `**Mode**: ${suiteResult.mode}`,
    `**Decision**: ${certification.status} (certified: false)`,
    "",
    "## Summary",
    "| Metric | Value |",
    "|--------|-------|",
    `| Precision | ${m.precision} |`,
    `| Recall | ${m.recall} |`,
    `| Hallucination rate | ${m.hallucination_rate} |`,
    `| Cases passed | ${m.cases_passed}/${m.cases_total} |`,
    "",
    "## Blockers",
    ...certification.blockers_failed.map((b) => `- ${sanitizeMessage(b)}`),
    "",
    "## Warnings",
    ...certification.warnings_raised.map((w) => `- ${sanitizeMessage(w)}`),
    "",
    "## Case Failures",
  ];

  for (const r of suiteResult.case_results.filter((c) => !c.ok || c.case_score < 0.8)) {
    lines.push(`### ${r.case_id}`);
    lines.push(`- Score: ${r.case_score} | Parse: ${r.parse_status}`);
    if (r.failure_reason) lines.push(`- Reason: ${sanitizeMessage(r.failure_reason)}`);
  }

  lines.push("", "## Limitations", "- PR 3A: test/replay only, no live model execution");
  return lines.join("\n");
}

export function buildCalibrationReport(
  suiteResult: CalibrationSuiteResult,
): CalibrationReport {
  const executive_summary = `Calibration ${suiteResult.mode} run ${suiteResult.run_id}: ${suiteResult.metrics.cases_passed}/${suiteResult.metrics.cases_total} cases passed; readiness=${suiteResult.certification.status}.`;

  const markdown = formatCalibrationReportMarkdown(
    suiteResult,
    suiteResult.certification,
  );

  return Object.freeze({
    report_id: `${suiteResult.run_id}-report`,
    schema_version: EXPERT_CALIBRATION_REPORT_SCHEMA_VERSION,
    suite_id: suiteResult.suite_id,
    run_id: suiteResult.run_id,
    expert_key: suiteResult.expert_key,
    expert_version: suiteResult.expert_version,
    definition_hash: suiteResult.definition_hash,
    mode: suiteResult.mode,
    executive_summary,
    suite_result: suiteResult,
    markdown,
    audit_trail: Object.freeze({
      baseline_sha: suiteResult.definition_hash,
      model_calls: 0,
      provider_calls: 0,
      production_execution_occurred: false,
      expectation_matching_policy_version: MILITARY_CALIBRATION_EXPECTATION_MATCHING_VERSION,
    }),
    limitations: Object.freeze([
      "PR 3A performs no live model execution.",
      "Human-adjudicated editorial metrics remain pending until adjudication records supplied.",
    ]),
  });
}

export function serializeCalibrationReport(report: CalibrationReport): string {
  const { suite_result, ...rest } = report;
  return JSON.stringify(
    {
      ...rest,
      suite_result: {
        ...suite_result,
        case_results: suite_result.case_results.map((r) => ({
          ...r,
          failure_reason: r.failure_reason ? sanitizeMessage(r.failure_reason) : undefined,
        })),
      },
    },
    null,
    2,
  );
}
