import { RECONCILIATION_MAX_BATCH_SIZE } from "./constants.ts";
import type {
  BookGraphFact,
  ContradictionPair,
  ReconciliationBatch,
  ReconciliationItem,
} from "./types.ts";

function temporalRelationship(
  left: BookGraphFact,
  right: BookGraphFact,
): ReconciliationItem["temporal_relationship"] {
  const leftChapter = left.temporal_scope.chapter ?? left.locators[0]?.chapter;
  const rightChapter = right.temporal_scope.chapter ?? right.locators[0]?.chapter;
  if (!leftChapter || !rightChapter) return "unknown";
  return leftChapter === rightChapter ? "same_time" : "earlier_later";
}

export function buildReconciliationItems(
  pairs: readonly ContradictionPair[],
): ReconciliationItem[] {
  return pairs.map((pair) => ({
    schema: "archivist_global_reconciliation@v1",
    pair_id: pair.id,
    entity_identity: {
      alias: pair.left.alias,
      entity_id: pair.left.entity_id,
      canonical_name: pair.left.entity_id ? pair.left.alias : undefined,
      entity_type: pair.left.entity_type,
    },
    fact_history: [pair.left, pair.right],
    temporal_relationship: temporalRelationship(pair.left, pair.right),
    locators: [...pair.left.locators, ...pair.right.locators],
    excerpts: [
      ...pair.left.evidence.map((item) => item.excerpt),
      ...pair.right.evidence.map((item) => item.excerpt),
    ],
    comparison: {
      fact_type: pair.left.fact_type,
      left_value: pair.left.value,
      right_value: pair.right.value,
      kind: pair.kind,
    },
  }));
}

export function batchReconciliationItems(
  items: readonly ReconciliationItem[],
  maxBatchSize = RECONCILIATION_MAX_BATCH_SIZE,
): ReconciliationBatch[] {
  const batches: ReconciliationBatch[] = [];
  for (let i = 0; i < items.length; i += maxBatchSize) {
    const slice = items.slice(i, i + maxBatchSize);
    batches.push({
      batch_id: `reconcile-${String(batches.length + 1).padStart(2, "0")}`,
      items: slice,
    });
  }
  return batches;
}

export const MAX_SAFE_RECONCILIATION_BATCH_SIZE = RECONCILIATION_MAX_BATCH_SIZE;
