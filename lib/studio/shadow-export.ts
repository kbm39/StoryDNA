import type { StudioShadowManuscript } from "./shadow-types.ts";

export const SHADOW_NON_CANONICAL_HEADER =
  "NON-CANONICAL SHADOW PREVIEW\nThe canonical manuscript has not been changed.\n" as const;

export function generateShadowMarkdownDownload(shadow: StudioShadowManuscript): string {
  const lines = [
    SHADOW_NON_CANONICAL_HEADER,
    `# Shadow Manuscript Preview`,
    "",
    `Book: ${shadow.manuscript.title}`,
    `Generated: ${shadow.generatedAt}`,
    `Source Version: ${shadow.source.sourceVersionLabel ?? shadow.source.activeVersionId ?? "—"}`,
    `Applied Revisions: ${shadow.application.appliedRevisionCount}`,
    `Skipped: ${shadow.application.skippedRevisionCount}`,
    `Blocked/Failed: ${shadow.application.failedRevisionCount}`,
    `Source Word Count: ${shadow.source.sourceWordCount}`,
    `Shadow Word Count: ${shadow.application.finalWordCount}`,
    `Net Word Change: ${shadow.application.netWordChange}`,
    "",
    "## Shadow Text",
    "",
    shadow.shadowText,
    "",
    "## Applied Items",
    "",
  ];

  for (const item of shadow.appliedItems) {
    lines.push(
      `### ${item.revisionCandidateId}`,
      `- Expert: ${item.expertName}`,
      `- State: ${item.applicationState}`,
      `- Original: ${item.originalText}`,
      `- Final: ${item.finalText}`,
      "",
    );
  }

  if (shadow.skippedItems.length > 0) {
    lines.push("## Skipped Items", "");
    for (const item of shadow.skippedItems) {
      lines.push(`- ${item.revisionCandidateId}: ${item.applicationReason}`);
    }
    lines.push("");
  }

  if (shadow.failedItems.length > 0) {
    lines.push("## Blocked or Failed Items", "");
    for (const item of shadow.failedItems) {
      lines.push(`- ${item.revisionCandidateId}: ${item.applicationReason}`);
    }
  }

  return lines.join("\n");
}

export function generateShadowApplicationReportMarkdown(shadow: StudioShadowManuscript): string {
  const lines = [
    SHADOW_NON_CANONICAL_HEADER,
    "# Shadow Application Report",
    "",
    `Status: ${shadow.application.applicationStatus}`,
    `Conflicts: ${shadow.application.conflictCount}`,
    `Unresolved conflicts: ${shadow.application.unresolvedConflictCount}`,
    "",
    "## Integrity",
    `- Canonical manuscript modified: ${shadow.integrity.canonicalManuscriptModified}`,
    `- Ready for promotion review: ${shadow.integrity.readyForPromotionReview}`,
    "",
  ];

  if (shadow.integrity.blockingReasons.length > 0) {
    lines.push("### Blocking Reasons", "");
    for (const reason of shadow.integrity.blockingReasons) {
      lines.push(`- ${reason}`);
    }
  }

  return lines.join("\n");
}

export function buildShadowPreviewFilename(title: string, generatedAt: string, ext: "md" | "json"): string {
  const safe = title.replace(/[^\w \-]+/g, "").trim().replace(/\s+/g, "-") || "manuscript";
  const date = generatedAt.slice(0, 10);
  return `${safe}-shadow-preview-${date}.${ext}`;
}
