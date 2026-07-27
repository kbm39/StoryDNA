import type { StudioRevisionConflict, StudioRevisionExportItem } from "./export-types.ts";

let conflictCounter = 0;

function nextConflictId(): string {
  conflictCounter += 1;
  return `conflict-${conflictCounter}`;
}

export function detectRevisionExportConflicts(
  items: readonly StudioRevisionExportItem[],
): StudioRevisionConflict[] {
  const conflicts: StudioRevisionConflict[] = [];

  const byOriginal = new Map<string, StudioRevisionExportItem[]>();
  for (const item of items.filter((i) => !i.planningOnly)) {
    const key = item.revision.originalText.trim();
    if (!key) continue;
    const list = byOriginal.get(key) ?? [];
    list.push(item);
    byOriginal.set(key, list);
  }

  for (const [original, group] of byOriginal) {
    if (group.length < 2) continue;
    const finals = new Set(group.map((g) => g.revision.finalExportText));
    if (finals.size > 1) {
      conflicts.push({
        conflictId: nextConflictId(),
        affectedItemIds: group.map((g) => g.itemId),
        conflictType: "contradictory_replacement",
        severity: "high",
        explanation: `The same source excerpt appears in ${group.length} accepted decisions with different final text.`,
        recommendedAuthorAction: "Review each accepted decision and reconcile the intended final text before application.",
      });
    } else {
      conflicts.push({
        conflictId: nextConflictId(),
        affectedItemIds: group.map((g) => g.itemId),
        conflictType: "duplicate_target",
        severity: "medium",
        explanation: `Multiple accepted decisions target the identical source excerpt: "${original.slice(0, 80)}${original.length > 80 ? "…" : ""}"`,
        recommendedAuthorAction: "Confirm whether duplicate accepted recommendations should merge into one application.",
      });
    }
  }

  for (const item of items.filter((i) => !i.planningOnly)) {
    if (!item.applicability.sourceTextMatchesActiveVersion) {
      conflicts.push({
        conflictId: nextConflictId(),
        affectedItemIds: [item.itemId],
        conflictType: "source_text_mismatch",
        severity: "high",
        explanation: `Accepted revision ${item.itemId} source text does not match the active manuscript (${item.applicability.sourceTextMatchState}).`,
        recommendedAuthorAction: "Re-open this decision or regenerate recommendations against the current manuscript version.",
      });
    }

    if (item.source.manuscriptVersionId && item.applicability.conflictReasons.includes("stale_manuscript_version")) {
      conflicts.push({
        conflictId: nextConflictId(),
        affectedItemIds: [item.itemId],
        conflictType: "stale_manuscript_version",
        severity: "high",
        explanation: `Accepted revision ${item.itemId} was recorded against a non-active manuscript version.`,
        recommendedAuthorAction: "Verify the decision still applies to the current manuscript before export or application.",
      });
    }

    if (item.applicability.sourceTextMatchState === "MULTIPLE_MATCHES") {
      conflicts.push({
        conflictId: nextConflictId(),
        affectedItemIds: [item.itemId],
        conflictType: "ambiguous_locator",
        severity: "medium",
        explanation: `Source excerpt for ${item.itemId} appears multiple times in the active manuscript.`,
        recommendedAuthorAction: "Add a precise locator or edit the decision before automatic application.",
      });
    }
  }

  const approved = items.filter((i) => !i.planningOnly);
  for (let i = 0; i < approved.length; i++) {
    for (let j = i + 1; j < approved.length; j++) {
      const a = approved[i]!;
      const b = approved[j]!;
      if (
        a.manuscriptLocation.startOffset !== null &&
        a.manuscriptLocation.endOffset !== null &&
        b.manuscriptLocation.startOffset !== null &&
        b.manuscriptLocation.endOffset !== null &&
        a.manuscriptLocation.startOffset < b.manuscriptLocation.endOffset &&
        b.manuscriptLocation.startOffset < a.manuscriptLocation.endOffset
      ) {
        conflicts.push({
          conflictId: nextConflictId(),
          affectedItemIds: [a.itemId, b.itemId],
          conflictType: "overlapping_location",
          severity: "high",
          explanation: `Accepted revisions ${a.itemId} and ${b.itemId} overlap in manuscript offsets.`,
          recommendedAuthorAction: "Resolve overlapping accepted changes before applying automatically.",
        });
      }
    }
  }

  return conflicts;
}

export function attachConflictReasons(
  items: readonly StudioRevisionExportItem[],
  conflicts: readonly StudioRevisionConflict[],
): StudioRevisionExportItem[] {
  const reasonsByItem = new Map<string, string[]>();
  for (const conflict of conflicts) {
    for (const id of conflict.affectedItemIds) {
      const list = reasonsByItem.get(id) ?? [];
      list.push(conflict.conflictType);
      reasonsByItem.set(id, list);
    }
  }

  return items.map((item) =>
    Object.freeze({
      ...item,
      applicability: Object.freeze({
        ...item.applicability,
        conflictReasons: Object.freeze(reasonsByItem.get(item.itemId) ?? item.applicability.conflictReasons),
      }),
    }),
  );
}
