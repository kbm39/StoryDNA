import type {
  ReckoningRule8Metrics,
  ReckoningRule8PrimaryOutcome,
  ReckoningRule8VerifiedCase,
} from "./types.ts";

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function emptyBucket() {
  return {
    total: 0,
    detected: 0,
    extracted_but_missed: 0,
    partially_extracted: 0,
    not_extracted: 0,
    end_to_end_recall: 0,
    extraction_coverage: 0,
  };
}

function countOutcome(
  cases: ReckoningRule8VerifiedCase[],
  outcome: ReckoningRule8PrimaryOutcome,
): number {
  return cases.filter((item) => item.primary_outcome === outcome).length;
}

export function scoreVerifiedCases(cases: ReckoningRule8VerifiedCase[]): ReckoningRule8Metrics {
  const detected = countOutcome(cases, "DETECTED");
  const extractedButMissed = countOutcome(cases, "EXTRACTED_BUT_MISSED");
  const partiallyExtracted = countOutcome(cases, "PARTIALLY_EXTRACTED");
  const notExtracted = countOutcome(cases, "NOT_EXTRACTED");
  const total = cases.length;
  const sufficient = detected + extractedButMissed;
  const byType: ReckoningRule8Metrics["by_reasoning_type"] = {};
  for (const item of cases) {
    const key = item.required_reasoning_type;
    const bucket = byType[key] ?? emptyBucket();
    bucket.total += 1;
    if (item.primary_outcome === "DETECTED") bucket.detected += 1;
    if (item.primary_outcome === "EXTRACTED_BUT_MISSED") bucket.extracted_but_missed += 1;
    if (item.primary_outcome === "PARTIALLY_EXTRACTED") bucket.partially_extracted += 1;
    if (item.primary_outcome === "NOT_EXTRACTED") bucket.not_extracted += 1;
    bucket.end_to_end_recall = ratio(bucket.detected, bucket.total);
    bucket.extraction_coverage = ratio(bucket.detected + bucket.extracted_but_missed, bucket.total);
    byType[key] = bucket;
  }
  return {
    total_verified_defects: total,
    detected,
    extracted_but_missed: extractedButMissed,
    partially_extracted: partiallyExtracted,
    not_extracted: notExtracted,
    end_to_end_recall: ratio(detected, total),
    extraction_coverage: ratio(detected + extractedButMissed, total),
    reasoning_recall_given_sufficient_extraction:
      sufficient === 0 ? null : ratio(detected, sufficient),
    by_reasoning_type: byType,
  };
}

export function countExcerptWords(excerpt: string): number {
  return excerpt.trim().split(/\s+/).filter(Boolean).length;
}
