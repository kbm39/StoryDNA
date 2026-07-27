import type { StudioRevisionExport, StudioRevisionExportItem } from "./export-types.ts";

function block(text: string): string {
  return text.trim() || "(empty)";
}

function renderItemSection(item: StudioRevisionExportItem, index: number): string {
  const lines = [
    `## Revision ${index}`,
    "",
    `Expert: ${item.expert.expertName}`,
    `Location: ${item.manuscriptLocation.locatorLabel ?? "Unavailable"}`,
    `Decision: ${item.revision.disposition === "deferred" ? "Saved for Later (planning only)" : item.revision.disposition}`,
    `Revision Type: ${item.revision.revisionType}`,
    "",
    "### Original",
    block(item.revision.originalText),
    "",
    "### Expert Suggestion",
    block(item.revision.expertSuggestedText),
    "",
    "### Kevin's Final Text",
    block(item.revision.finalExportText),
    "",
    "### Why the Expert Recommended It",
    block(item.revision.explanation),
    "",
    "### Kevin's Note",
    item.revision.authorNote?.trim() ? block(item.revision.authorNote) : "None",
    "",
    "### Application Readiness",
    `- Source match state: ${item.applicability.sourceTextMatchState}`,
    `- Locator state: ${item.applicability.locatorResolution}${item.applicability.locatorResolved ? "" : " (unresolved)"}`,
    `- Safe to apply later: ${item.applicability.safeToApplyLater ? "Yes" : "No"}`,
    `- Conflicts: ${item.applicability.conflictReasons.length ? item.applicability.conflictReasons.join(", ") : "None"}`,
    "",
  ];
  return lines.join("\n");
}

export function generateStudioRevisionMarkdownExport(manifest: StudioRevisionExport): string {
  const m = manifest.manuscript;
  const lines = [
    "# Accepted Revision Decisions",
    "",
    `Book: ${m.title}`,
    `Series: ${m.seriesName ?? "Standalone"}`,
    `Volume: ${m.volumeNumber ?? "—"}`,
    `Active Version: ${m.activeVersionLabel ?? m.activeVersionId ?? "—"}`,
    `Generated Date: ${manifest.generatedAt}`,
    "",
    "## Integrity Notice",
    manifest.integrity.warning,
    "",
    "## Summary",
    `- Total candidates: ${manifest.summary.totalCandidates}`,
    `- Included items: ${manifest.summary.includedItems}`,
    `- Accepted unchanged: ${manifest.summary.acceptedUnchanged}`,
    `- Accepted with changes: ${manifest.summary.acceptedModified}`,
    `- Deferred included: ${manifest.summary.deferredIncluded}`,
    `- Excluded rejected: ${manifest.summary.excludedRejected}`,
    `- Excluded pending: ${manifest.summary.excludedPending}`,
    `- Unresolved locators: ${manifest.summary.unresolvedLocatorCount}`,
    `- Conflicts: ${manifest.summary.conflictCount}`,
    `- Safe for later application: ${manifest.summary.safeForLaterApplication}`,
    `- Not safe for automatic application: ${manifest.summary.notSafeForAutomaticApplication}`,
    "",
  ];

  if (manifest.conflicts.length > 0) {
    lines.push("## Conflicts Requiring Attention", "");
    for (const conflict of manifest.conflicts) {
      lines.push(
        `### ${conflict.conflictType}`,
        `Severity: ${conflict.severity}`,
        `Affected items: ${conflict.affectedItemIds.join(", ")}`,
        conflict.explanation,
        `Recommended action: ${conflict.recommendedAuthorAction}`,
        "",
      );
    }
  }

  if (manifest.items.length === 0 && manifest.planningItems.length === 0) {
    lines.push(
      "No accepted revisions are ready to export. Review recommendations in the Revision Board and accept or edit the changes you want to keep.",
      "",
    );
    return lines.join("\n");
  }

  manifest.items.forEach((item, idx) => {
    lines.push(renderItemSection(item, idx + 1));
  });

  if (manifest.planningItems.length > 0) {
    lines.push("## Saved for Later (Planning Only — Not Approved)", "");
    manifest.planningItems.forEach((item, idx) => {
      lines.push(renderItemSection(item, idx + 1));
    });
  }

  return lines.join("\n");
}
