/**
 * Deterministic pre-repair for Literary Agent memos whose only defect is a
 * missing canonical current-total sentence. Does not weaken validation.
 */

import { applyCanonicalCurrentTotalOpener } from "./commercial-review-repair.ts";
import {
  validateMemoBeforeRubric,
} from "./commercial-review-generation.ts";
import type { CommercialMemoValidationOutcome } from "./commercial-review-pipeline.ts";
import { canonicalManuscriptLengthSentence } from "./word-count-reporting.ts";
import { hasExactCanonicalStatement } from "./word-count-validation.ts";

export interface MemoFirstPassValidationDiagnostics {
  firstPassOk: boolean;
  firstPassRepairKind: "word_count" | "prose_grade" | null;
  firstPassError: string | null;
  firstPassWordCountErrors: string[];
  firstPassWordCountContradictionCount: number;
  deterministicOpenerAttempted: boolean;
  deterministicOpenerSucceeded: boolean;
  modelRepairRequired: boolean;
  modelRepairInvoked: boolean;
}

export interface ResolvedPreRepairMemoValidation {
  memoContent: string;
  validation: CommercialMemoValidationOutcome;
  diagnostics: MemoFirstPassValidationDiagnostics;
  modelRepairRequired: boolean;
}

function missingCanonicalSentenceError(canonicalWordCount: number): string {
  return `Memo must include exactly one current-total sentence: "${canonicalManuscriptLengthSentence(canonicalWordCount)}"`;
}

function exactCanonicalSentenceCount(memo: string, canonicalWordCount: number): number {
  const required = canonicalManuscriptLengthSentence(canonicalWordCount);
  const escaped = required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (memo.match(new RegExp(escaped, "gi")) ?? []).length;
}

/**
 * True only when first-pass validation failed solely because the exact
 * canonical current-total sentence is absent (count === 0). Duplicates,
 * contradictory claims, cut math, grades, structure, and mixed failures
 * are not eligible.
 */
export function isMissingCanonicalOpenerOnlyFailure(
  outcome: CommercialMemoValidationOutcome,
  memoContent: string,
  canonicalWordCount: number,
): boolean {
  if (outcome.ok) return false;
  if (!outcome.repairable) return false;
  if (outcome.repairKind !== "word_count") return false;
  if (outcome.proseGradeConflict) return false;
  if ((outcome.wordCountContradictions?.length ?? 0) > 0) return false;
  const errors = outcome.wordCountErrors ?? [];
  if (errors.length !== 1) return false;
  if (errors[0] !== missingCanonicalSentenceError(canonicalWordCount)) return false;
  if (hasExactCanonicalStatement(memoContent, canonicalWordCount)) return false;
  return exactCanonicalSentenceCount(memoContent, canonicalWordCount) === 0;
}

export function serializeMemoValidationDiagnostics(
  diagnostics: MemoFirstPassValidationDiagnostics,
): Record<string, unknown> {
  return {
    first_pass_ok: diagnostics.firstPassOk,
    first_pass_repair_kind: diagnostics.firstPassRepairKind,
    first_pass_error: diagnostics.firstPassError,
    first_pass_word_count_errors: diagnostics.firstPassWordCountErrors,
    first_pass_word_count_contradiction_count: diagnostics.firstPassWordCountContradictionCount,
    deterministic_opener_attempted: diagnostics.deterministicOpenerAttempted,
    deterministic_opener_succeeded: diagnostics.deterministicOpenerSucceeded,
    model_repair_invoked: diagnostics.modelRepairInvoked,
  };
}

function baseDiagnostics(
  firstPass: CommercialMemoValidationOutcome,
): Omit<
  MemoFirstPassValidationDiagnostics,
  | "deterministicOpenerAttempted"
  | "deterministicOpenerSucceeded"
  | "modelRepairRequired"
  | "modelRepairInvoked"
> {
  return {
    firstPassOk: firstPass.ok,
    firstPassRepairKind: firstPass.repairKind ?? null,
    firstPassError: firstPass.error ?? null,
    firstPassWordCountErrors: firstPass.wordCountErrors ?? [],
    firstPassWordCountContradictionCount: firstPass.wordCountContradictions?.length ?? 0,
  };
}

/**
 * First-pass validate, then — only for a missing canonical opener — apply the
 * existing deterministic opener and re-run the full memo validator.
 */
export function resolvePreRepairMemoValidation(args: {
  memoContent: string;
  canonicalWordCount: number;
}): ResolvedPreRepairMemoValidation {
  const firstPass = validateMemoBeforeRubric({
    memoContent: args.memoContent,
    canonicalWordCount: args.canonicalWordCount,
  });
  const first = baseDiagnostics(firstPass);

  if (firstPass.ok) {
    const diagnostics: MemoFirstPassValidationDiagnostics = {
      ...first,
      deterministicOpenerAttempted: false,
      deterministicOpenerSucceeded: false,
      modelRepairRequired: false,
      modelRepairInvoked: false,
    };
    return {
      memoContent: args.memoContent,
      validation: firstPass,
      diagnostics,
      modelRepairRequired: false,
    };
  }

  if (
    !isMissingCanonicalOpenerOnlyFailure(
      firstPass,
      args.memoContent,
      args.canonicalWordCount,
    )
  ) {
    const modelRepairRequired = Boolean(firstPass.repairable);
    const diagnostics: MemoFirstPassValidationDiagnostics = {
      ...first,
      deterministicOpenerAttempted: false,
      deterministicOpenerSucceeded: false,
      modelRepairRequired,
      modelRepairInvoked: false,
    };
    return {
      memoContent: args.memoContent,
      validation: firstPass,
      diagnostics,
      modelRepairRequired,
    };
  }

  const normalized = applyCanonicalCurrentTotalOpener(
    args.memoContent,
    args.canonicalWordCount,
  );
  const secondPass = validateMemoBeforeRubric({
    memoContent: normalized,
    canonicalWordCount: args.canonicalWordCount,
  });

  if (secondPass.ok) {
    const diagnostics: MemoFirstPassValidationDiagnostics = {
      ...first,
      deterministicOpenerAttempted: true,
      deterministicOpenerSucceeded: true,
      modelRepairRequired: false,
      modelRepairInvoked: false,
    };
    return {
      memoContent: normalized,
      validation: secondPass,
      diagnostics,
      modelRepairRequired: false,
    };
  }

  const modelRepairRequired = Boolean(firstPass.repairable);
  const diagnostics: MemoFirstPassValidationDiagnostics = {
    ...first,
    deterministicOpenerAttempted: true,
    deterministicOpenerSucceeded: false,
    modelRepairRequired,
    modelRepairInvoked: false,
  };
  return {
    memoContent: args.memoContent,
    validation: firstPass,
    diagnostics,
    modelRepairRequired,
  };
}

export function markModelRepairInvoked(
  diagnostics: MemoFirstPassValidationDiagnostics,
): MemoFirstPassValidationDiagnostics {
  return {
    ...diagnostics,
    modelRepairInvoked: true,
    modelRepairRequired: true,
  };
}
