import type { AssessmentConfidence, ConcernStatus, SemanticAssessmentResult } from "./types.ts";

const VALID_STATUSES: ConcernStatus[] = [
  "RESOLVED",
  "STALE_CRITIQUE",
  "SUBSTANTIALLY_IMPROVED",
  "PARTIALLY_IMPROVED",
  "UNCHANGED",
  "WORSENED",
  "NOT_ASSESSABLE",
];

const VALID_CONFIDENCE: AssessmentConfidence[] = ["high", "medium", "low"];

/** Validate AI semantic assessor JSON output. */
export function parseSemanticAssessmentJson(raw: unknown): SemanticAssessmentResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const status = o.status;
  if (typeof status !== "string" || !VALID_STATUSES.includes(status as ConcernStatus)) {
    return null;
  }

  const confidence = o.confidence;
  if (typeof confidence !== "string" || !VALID_CONFIDENCE.includes(confidence as AssessmentConfidence)) {
    return null;
  }

  if (typeof o.explanation !== "string" || !o.explanation.trim()) return null;
  if (typeof o.original_basis_still_present !== "boolean") return null;

  const narrowed =
    o.narrowed_current_finding == null
      ? null
      : typeof o.narrowed_current_finding === "string"
        ? o.narrowed_current_finding
        : null;

  const revision =
    o.revision_that_addresses_it == null
      ? null
      : typeof o.revision_that_addresses_it === "string"
        ? o.revision_that_addresses_it
        : null;

  return {
    status: status as ConcernStatus,
    confidence: confidence as AssessmentConfidence,
    original_basis_still_present: o.original_basis_still_present,
    narrowed_current_finding: narrowed,
    revision_that_addresses_it: revision,
    explanation: o.explanation.trim(),
  };
}

/** JSON schema description for the semantic assessor prompt. */
export const SEMANTIC_ASSESSOR_JSON_CONTRACT = `Return ONLY a JSON object with these fields:
{
  "status": "RESOLVED" | "STALE_CRITIQUE" | "SUBSTANTIALLY_IMPROVED" | "PARTIALLY_IMPROVED" | "UNCHANGED" | "WORSENED" | "NOT_ASSESSABLE",
  "confidence": "high" | "medium" | "low",
  "original_basis_still_present": boolean,
  "narrowed_current_finding": string | null,
  "revision_that_addresses_it": string | null,
  "explanation": string
}
Do NOT assign a manuscript letter grade or overall score.`;
