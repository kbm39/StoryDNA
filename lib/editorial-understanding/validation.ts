import {
  CONFIRMATION_GATE_MIN_OVERALL_CONFIDENCE,
  EDITORIAL_UNDERSTANDING_CONTRACT_VERSION,
  EDITORIAL_UNDERSTANDING_IS_AUTHOR_INTENT,
  EDITORIAL_UNDERSTANDING_IS_CANON,
  EDITORIAL_UNDERSTANDING_IS_EVIDENCE,
  EDITORIAL_UNDERSTANDING_STATUSES,
  UNDERSTANDING_FIELD_WEIGHTS,
} from "./contract.ts";
import type {
  EditorialUnderstandingDraftInput,
  EditorialUnderstandingRecord,
  EditorialUnderstandingValidationError,
  EditorialUnderstandingValidationResult,
  FieldConfidenceMap,
  StageTurnRecord,
  UnderstandingConfidence,
} from "./types.ts";

function err(code: string, message: string): EditorialUnderstandingValidationError {
  return { code, message };
}

export function validateEditorialUnderstandingDraft(
  input: EditorialUnderstandingDraftInput,
): EditorialUnderstandingValidationResult {
  const errors: EditorialUnderstandingValidationError[] = [];
  if (!input.manuscript_id?.trim()) errors.push(err("missing_manuscript_id", "Manuscript ID is required"));
  if (!input.manuscript_version_id?.trim()) {
    errors.push(err("missing_version_id", "Manuscript version ID is required"));
  }
  if (!input.book_id?.trim()) errors.push(err("missing_book_id", "Book ID is required"));
  if (!input.created_by?.trim()) errors.push(err("missing_creator", "Creator is required"));
  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export function computeOverallConfidence(byField: FieldConfidenceMap): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [field, weight] of Object.entries(UNDERSTANDING_FIELD_WEIGHTS)) {
    const score = byField[field as keyof FieldConfidenceMap];
    if (score == null) continue;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

export function buildFieldConfidenceFromStages(
  stageTurns: readonly StageTurnRecord[],
): FieldConfidenceMap {
  const map: FieldConfidenceMap = {
    primary_vision: null,
    target_reader: null,
    desired_reader_experience: null,
    market_position: null,
    creative_motivation: null,
    success_definition: null,
  };

  for (const turn of stageTurns) {
    if (!turn.understanding_field || turn.skipped) continue;
    const existing = map[turn.understanding_field];
    const score = turn.confidence_score ?? 0;
    if (existing == null || score > existing) {
      map[turn.understanding_field] = score;
    }
    if (turn.understanding_field === "market_position" && map.target_reader == null) {
      map.target_reader = score;
    }
  }

  return map;
}

export function buildUnderstandingConfidence(
  stageTurns: readonly StageTurnRecord[],
  confirmedAt: string | null = null,
  confirmedBy: string | null = null,
): UnderstandingConfidence {
  const by_field = buildFieldConfidenceFromStages(stageTurns);
  return {
    overall: computeOverallConfidence(by_field),
    by_field,
    confirmed_at: confirmedAt,
    confirmed_by: confirmedBy,
  };
}

export function validateConfirmationEligibility(record: EditorialUnderstandingRecord): {
  ok: boolean;
  error?: string;
} {
  if (record.status === "confirmed") {
    return { ok: false, error: "Editorial understanding is already confirmed." };
  }

  const requiredFields: Array<keyof Pick<
    EditorialUnderstandingRecord,
    "primary_vision" | "creative_motivation" | "market_position" | "success_definition"
  >> = ["primary_vision", "creative_motivation", "market_position", "success_definition"];

  for (const field of requiredFields) {
    if (!record[field]?.trim()) {
      return { ok: false, error: `Required field missing: ${field}` };
    }
  }

  if (record.confidence.overall < CONFIRMATION_GATE_MIN_OVERALL_CONFIDENCE) {
    return { ok: false, error: "Overall confidence is below confirmation threshold." };
  }

  return { ok: true };
}

export function buildUnderstandingSummary(record: EditorialUnderstandingRecord): string {
  const readerExperience =
    record.desired_reader_experience?.trim() ||
    "You skipped this — that's fine.";

  return [
    "Here's what I understand about your project:",
    "",
    `Your story: ${record.primary_vision ?? ""}`,
    "",
    `Your reader: ${record.target_reader ?? record.market_position ?? ""}`,
    "",
    `The experience you want: ${readerExperience}`,
    "",
    `Market position: ${record.market_position ?? ""}`,
    "",
    `Why you wrote it: ${record.creative_motivation ?? ""}`,
    "",
    `Success for you: ${record.success_definition ?? ""}`,
    "",
    "Did I understand you correctly?",
  ].join("\n");
}

export function isValidUnderstandingStatus(value: string): boolean {
  return (EDITORIAL_UNDERSTANDING_STATUSES as readonly string[]).includes(value);
}

export function assertUnderstandingContractVersion(version: string): boolean {
  return version === EDITORIAL_UNDERSTANDING_CONTRACT_VERSION;
}

export function understandingMetadataFlags() {
  return {
    is_manuscript_evidence: EDITORIAL_UNDERSTANDING_IS_EVIDENCE,
    is_author_intent: EDITORIAL_UNDERSTANDING_IS_AUTHOR_INTENT,
    is_canon: EDITORIAL_UNDERSTANDING_IS_CANON,
  };
}

export function confirmedUnderstandingIsImmutable(status: EditorialUnderstandingRecord["status"]): boolean {
  return status === "confirmed";
}
