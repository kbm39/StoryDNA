/**
 * Persist blocked-run diagnostics (dev only, gitignored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { GenerationMeta } from "../ai/shared.ts";
import { reviewFailureDiagnosticsEnabled } from "../commercial-review-diagnostics.ts";
import type { CommercialRubricPayload } from "../commercial-fiction-rubric.ts";
import type { ConcernAssessment } from "./types.ts";
import type { GateRunResult } from "./gate.ts";
import type { NormalizeRubricResult } from "./normalize-rubric-against-gate.ts";

export interface BlockedRunDiagnostics {
  capturedAt: string;
  manuscriptId: string;
  manuscriptVersionId: string | null;
  failurePhase: "normalization" | "post_scoring" | "combined_validation";
  callA: {
    finish_reason: string | null;
    input_tokens: number | null;
    output_tokens: number | null;
    outputTruncated: boolean;
    memo_excerpt: string;
    memo_validation_ok: boolean;
    canonical_count_sentence: string | null;
  };
  semanticGate: {
    comparison_mode: string;
    assessor_call_count: number;
    concerns_extracted: number;
    assessments: ConcernAssessment[];
    gate_prompt_chars: number;
    pre_scoring_gate_valid: boolean;
  };
  callB: {
    finish_reason: string | null;
    input_tokens: number | null;
    output_tokens: number | null;
    outputTruncated: boolean;
    rubric_retry_attempted: boolean;
    raw_rubric: CommercialRubricPayload;
  };
  normalization: {
    raw_score: number;
    normalized_preview_score: number;
    dispositions: NormalizeRubricResult["dispositions"];
    adjustments_summary: NormalizeRubricResult["adjustmentsSummary"];
    root_issue_cap_adjustments: NormalizeRubricResult["rootIssueCapAdjustments"];
    valid: boolean;
  };
  validation_errors: string[];
}

export function extractCanonicalCountSentence(memo: string, canonical: number): string | null {
  const re = new RegExp(`[^.\\n]*${canonical}[^.\\n]*words?[^.\\n]*\\.`, "i");
  const m = memo.match(re);
  return m?.[0]?.trim() ?? null;
}

export function writeBlockedRunDiagnosticArtifact(
  diagnostics: BlockedRunDiagnostics,
  filename = "blocked-run-latest.json",
): string | null {
  if (!reviewFailureDiagnosticsEnabled()) return null;
  const dir = join(process.cwd(), ".review-failure-diagnostics");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, filename);
  writeFileSync(path, JSON.stringify(diagnostics, null, 2));
  return path;
}

export function buildBlockedRunDiagnostics(args: {
  manuscriptId: string;
  manuscriptVersionId: string | null;
  memoContent: string;
  memoValidationOk: boolean;
  canonicalWordCount: number;
  memoGenerationMeta: GenerationMeta | null;
  gateResult: GateRunResult | null;
  gatePromptChars: number;
  rubricPayload: CommercialRubricPayload;
  rubricRawContent: string;
  rubricGenerationMeta: GenerationMeta | null;
  rubricRetryAttempted: boolean;
  normalization: NormalizeRubricResult;
  validationErrors: string[];
}): BlockedRunDiagnostics {
  return {
    capturedAt: new Date().toISOString(),
    manuscriptId: args.manuscriptId,
    manuscriptVersionId: args.manuscriptVersionId,
    failurePhase: args.normalization.valid ? "post_scoring" : "normalization",
    callA: {
      finish_reason: args.memoGenerationMeta?.finishReason ?? null,
      input_tokens: args.memoGenerationMeta?.inputTokens ?? null,
      output_tokens: args.memoGenerationMeta?.outputTokens ?? null,
      outputTruncated: args.memoGenerationMeta?.outputTruncated ?? false,
      memo_excerpt: args.memoContent.slice(0, 2000),
      memo_validation_ok: args.memoValidationOk,
      canonical_count_sentence: extractCanonicalCountSentence(
        args.memoContent,
        args.canonicalWordCount,
      ),
    },
    semanticGate: {
      comparison_mode: args.gateResult?.comparison_mode ?? "unknown",
      assessor_call_count: args.gateResult?.assessments.length ?? 0,
      concerns_extracted: args.gateResult?.extraction.concerns.length ?? 0,
      assessments: args.gateResult?.assessments ?? [],
      gate_prompt_chars: args.gatePromptChars,
      pre_scoring_gate_valid: args.gateResult?.scoring_gate.valid ?? false,
    },
    callB: {
      finish_reason: args.rubricGenerationMeta?.finishReason ?? null,
      input_tokens: args.rubricGenerationMeta?.inputTokens ?? null,
      output_tokens: args.rubricGenerationMeta?.outputTokens ?? null,
      outputTruncated: args.rubricGenerationMeta?.outputTruncated ?? false,
      rubric_retry_attempted: args.rubricRetryAttempted,
      raw_rubric: args.rubricPayload,
    },
    normalization: {
      raw_score: args.normalization.rawModelScore,
      normalized_preview_score: args.normalization.normalizedApplicationScore,
      dispositions: args.normalization.dispositions,
      adjustments_summary: args.normalization.adjustmentsSummary,
      root_issue_cap_adjustments: args.normalization.rootIssueCapAdjustments,
      valid: args.normalization.valid,
    },
    validation_errors: args.validationErrors,
  };
}
