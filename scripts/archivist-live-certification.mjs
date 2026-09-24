/**
 * Paid Archivist certification smoke CLI.
 * Does not enable Studio, Trigger, or execution. Paid smoke is closed after certification.
 */
const { parsePaidCertificationArgv, runPaidArchivistScopeCertification } = await import(
  "@/experts/archivist/live-paid-certification.ts"
);

try {
  const args = parsePaidCertificationArgv(process.argv.slice(2));
  const report = await runPaidArchivistScopeCertification({
    acknowledge: args.acknowledge ?? "",
    sessionId: args.sessionId,
    maxCostUsd: args.maxCostUsd,
    writeArtifacts: true,
  });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 2);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[certify:archivist] ${message}`);
  process.exit(1);
}
