/**
 * Run read-only Cross-Expert Adjudication Audit.
 *
 *   node --env-file=.env.local --import ./scripts/test-path-alias.mjs --experimental-strip-types scripts/run-cross-expert-adjudication-audit.ts
 *   node --env-file=.env.local --import ./scripts/test-path-alias.mjs --experimental-strip-types scripts/run-cross-expert-adjudication-audit.ts --json-out .calibration-results/cross-expert-audit/report.json
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runCrossExpertAdjudicationAudit } from "@/lib/studio/cross-expert-adjudication/audit.ts";
import { isCrossExpertAdjudicationAuditEnabled } from "@/lib/studio/cross-expert-adjudication/feature-flag.ts";
import {
  loadCrossExpertAuditInput,
  verifyImmutabilitySnapshots,
} from "@/lib/studio/cross-expert-adjudication/load-input.ts";
import {
  renderCrossExpertAuditJson,
  renderCrossExpertAuditMarkdown,
} from "@/lib/studio/cross-expert-adjudication/report.ts";
import { getExpertCatalogEntry } from "@/lib/expert-catalog.ts";
import { isStudioMilitaryExpertLocalOverrideEnabled } from "@/lib/studio/military-expert-local-policy.ts";

const DEFAULTS = Object.freeze({
  manuscriptId: "b1756b92-4332-4179-9814-c8fca2664dc9",
  manuscriptVersionId: "73cb6278-0f36-4385-a813-308847500b48",
  literaryAgentReviewId: "21ec086b-b6ff-4ba3-8089-d220a4b89955",
  militaryExpertReviewId: "123f792c-8081-4202-aa3b-c406bb6df4c9",
});

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  if (!isCrossExpertAdjudicationAuditEnabled()) {
    console.error("Cross-Expert Adjudication Audit is disabled. Set STUDIO_ENABLED=true.");
    process.exit(2);
  }

  const input = await loadCrossExpertAuditInput({
    manuscriptId: argValue("--manuscript-id") ?? DEFAULTS.manuscriptId,
    manuscriptVersionId: argValue("--manuscript-version-id") ?? DEFAULTS.manuscriptVersionId,
    literaryAgentReviewId: argValue("--la-review-id") ?? DEFAULTS.literaryAgentReviewId,
    militaryExpertReviewId: argValue("--me-review-id") ?? DEFAULTS.militaryExpertReviewId,
  });

  const report = runCrossExpertAdjudicationAudit(input);
  const immutability = await verifyImmutabilitySnapshots({ input });

  const outDir =
    argValue("--out-dir") ??
    path.join(".calibration-results", `cross-expert-audit-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  await mkdir(outDir, { recursive: true });
  const markdownPath = path.join(outDir, "report.md");
  const jsonPath = argValue("--json-out") ?? path.join(outDir, "report.json");
  await writeFile(markdownPath, renderCrossExpertAuditMarkdown(report), "utf8");
  await writeFile(jsonPath, renderCrossExpertAuditJson(report), "utf8");

  console.log(
    JSON.stringify(
      {
        status: "STORYDNA_CROSS_EXPERT_AUDIT_COMPLETE",
        manuscriptId: report.input.manuscriptId,
        manuscriptVersionId: report.input.manuscriptVersionId,
        literaryAgentReviewId: report.input.literaryAgentReviewId,
        militaryExpertReviewId: report.input.militaryExpertReviewId,
        wordCount: report.input.wordCount,
        summary: report.summary,
        mandatoryCases: {
          pamela: report.mandatoryCases.pamelaForeshadowing,
          transfusion: report.mandatoryCases.fieldTransfusion,
        },
        grades: {
          literaryAgent: report.sections.literaryAgentQualityGrade,
          militaryExpert: report.sections.militaryExpertQualityGrade,
          combinedTeam: report.sections.combinedTeamQualityGrade,
        },
        immutabilityUnchanged: immutability.unchanged,
        militaryExpertCommerciallyDisabled:
          getExpertCatalogEntry("military_expert")?.selectionEnabled === false,
        militaryExpertLocalStudioOnly: isStudioMilitaryExpertLocalOverrideEnabled(),
        markdownPath,
        jsonPath,
      },
      null,
      2,
    ),
  );

  if (!immutability.unchanged) {
    console.error("Immutability verification failed:", immutability.violations.join(", "));
    process.exit(3);
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      status: "STORYDNA_CROSS_EXPERT_AUDIT_BLOCKED",
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
});
