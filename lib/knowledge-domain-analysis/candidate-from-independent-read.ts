/**
 * KDA-2 — Independent Read → Knowledge Domain Analysis candidate synthesis.
 * Deterministic orchestration only; no provider calls, activation, or specialist access.
 */

import type { AuthorIntentRecord } from "@/lib/author-intent/types.ts";
import type { EditorialUnderstandingRecord } from "@/lib/editorial-understanding/types.ts";
import type { EicIndependentReadV1 } from "@/lib/eic-independent-read/types.ts";
import { validateIndependentReadForSynthesis } from "@/lib/editorial-profile/candidate-from-independent-read.ts";
import { appendAuditEvent, createAuditEvent } from "./audit.ts";
import {
  buildBoundedKdaSynthesisInput,
  synthesizeKdaFromBoundedInput,
  type BoundedKdaSynthesisInput,
} from "./domain-synthesis.ts";
import type { KnowledgeDomainAnalysisStatus } from "./contract.ts";
import { MIN_INDEPENDENT_READ_COVERAGE_CONFIRMATION } from "./contract.ts";
import { isStudioKnowledgeDomainAnalysisEnabled } from "./feature-flag.ts";
import {
  canTransitionKdaStatus,
  validateKdaStatusTransition,
} from "./lifecycle.ts";
import type { KnowledgeDomainAnalysisV1, KdaValidationResult } from "./types.ts";
import {
  validateForDraft,
  validateForEicConfirmation,
  validateKdaContract,
} from "./validation.ts";

export type CreateKdaCandidateInput = {
  readonly analysisId: string;
  readonly eicExecutionId: string;
  readonly independentRead: EicIndependentReadV1 | null | undefined;
  readonly authorIntent?: AuthorIntentRecord | null;
  readonly editorialUnderstanding?: EditorialUnderstandingRecord | null;
  readonly manuscriptBriefId?: string | null;
  readonly expectedManuscriptId: string;
  readonly expectedManuscriptVersionId: string;
  readonly generatedAt?: string;
  readonly priorStatus?: KnowledgeDomainAnalysisStatus;
};

export type KdaCandidateFailureCode =
  | "feature_flag_disabled"
  | "read_missing"
  | "read_incomplete"
  | "read_failed"
  | "read_stale"
  | "read_unverifiable"
  | "manuscript_mismatch"
  | "version_mismatch"
  | "intent_mismatch"
  | "understanding_mismatch"
  | "missing_provenance"
  | "specialist_access_violation"
  | "prohibited_input"
  | "validation_failed"
  | "invalid_transition"
  | "blocked";

export type KdaCandidateResult =
  | {
      readonly ok: true;
      readonly analysis: KnowledgeDomainAnalysisV1;
      readonly status: KnowledgeDomainAnalysisStatus;
      readonly validation: KdaValidationResult;
      readonly synthesisInput: BoundedKdaSynthesisInput;
    }
  | {
      readonly ok: false;
      readonly code: KdaCandidateFailureCode;
      readonly message: string;
      readonly status: KnowledgeDomainAnalysisStatus;
      readonly validation?: KdaValidationResult;
    };

export const NON_ACTIVE_KDA_CANDIDATE_STATUSES: readonly KnowledgeDomainAnalysisStatus[] =
  Object.freeze([
    "draft",
    "incomplete_evidence",
    "awaiting_eic_confirmation",
    "blocked",
    "failed",
  ]);

function assertNonActiveKdaStatus(status: KnowledgeDomainAnalysisStatus): void {
  if (status === "active" || status === "updated" || status === "superseded") {
    throw new Error(`KDA candidate synthesis must not end in active status (got ${status})`);
  }
  if (!(NON_ACTIVE_KDA_CANDIDATE_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`KDA candidate synthesis ended in unexpected status: ${status}`);
  }
}

function mapReadFailureCode(
  code: string,
): KdaCandidateFailureCode {
  if (code === "read_missing") return "read_missing";
  if (code === "read_failed") return "read_failed";
  if (code === "read_stale") return "read_stale";
  if (code === "read_incomplete") return "read_incomplete";
  if (code === "manuscript_mismatch") return "manuscript_mismatch";
  if (code === "version_mismatch") return "version_mismatch";
  if (code === "specialist_access_violation") return "specialist_access_violation";
  return "read_unverifiable";
}

export function validateIndependentReadForKdaSynthesis(
  read: EicIndependentReadV1 | null | undefined,
  expected: { manuscriptId: string; manuscriptVersionId: string },
):
  | { readonly ok: true }
  | { readonly ok: false; readonly code: KdaCandidateFailureCode; readonly message: string } {
  if (!read) {
    return { ok: false, code: "read_missing", message: "Independent read artifact is required" };
  }
  if (!read.independent_read_id?.trim()) {
    return { ok: false, code: "missing_provenance", message: "Independent read identity is required" };
  }

  const base = validateIndependentReadForSynthesis(read, expected);
  if (!base.ok) {
    return { ok: false, code: mapReadFailureCode(base.code), message: base.message };
  }

  return { ok: true };
}

function resolveCandidateStatus(analysis: KnowledgeDomainAnalysisV1): KnowledgeDomainAnalysisStatus {
  const draftResult = validateForDraft(analysis);
  if (!draftResult.ok) return "failed";

  if (analysis.domains.length === 0) return "incomplete_evidence";

  const confirmationResult = validateForEicConfirmation(analysis);
  if (confirmationResult.ok) return "awaiting_eic_confirmation";

  if (analysis.provenance.read_coverage_percent < MIN_INDEPENDENT_READ_COVERAGE_CONFIRMATION) {
    return "incomplete_evidence";
  }

  const hasIncompleteDomains = analysis.domains.some(
    (d) =>
      d.centrality === "insufficient_evidence" ||
      d.centrality === "speculative" ||
      d.confidence === "unknown" ||
      d.evidence.length === 0,
  );
  if (hasIncompleteDomains || analysis.synthesis_confidence.overall_confidence === "low") {
    return "incomplete_evidence";
  }

  return "draft";
}

export function createKnowledgeDomainAnalysisCandidateFromIndependentRead(
  input: CreateKdaCandidateInput,
): KdaCandidateResult {
  if (!isStudioKnowledgeDomainAnalysisEnabled()) {
    return {
      ok: false,
      code: "feature_flag_disabled",
      message: "Knowledge domain analysis is disabled (STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_ENABLED)",
      status: "not_started",
    };
  }

  const readCheck = validateIndependentReadForKdaSynthesis(input.independentRead, {
    manuscriptId: input.expectedManuscriptId,
    manuscriptVersionId: input.expectedManuscriptVersionId,
  });
  if (!readCheck.ok) {
    return {
      ok: false,
      code: readCheck.code,
      message: readCheck.message,
      status:
        readCheck.code === "read_missing" || readCheck.code === "read_incomplete"
          ? "awaiting_independent_read"
          : readCheck.code === "read_failed"
            ? "failed"
            : "blocked",
    };
  }

  const read = input.independentRead!;

  if (input.authorIntent) {
    if (input.authorIntent.manuscript_id !== input.expectedManuscriptId) {
      return {
        ok: false,
        code: "intent_mismatch",
        message: "Author intent manuscript_id mismatch",
        status: "blocked",
      };
    }
    if (input.authorIntent.manuscript_version_id !== input.expectedManuscriptVersionId) {
      return {
        ok: false,
        code: "intent_mismatch",
        message: "Author intent manuscript_version_id mismatch",
        status: "blocked",
      };
    }
  }

  if (input.editorialUnderstanding) {
    const u = input.editorialUnderstanding;
    if (
      u.manuscript_id !== input.expectedManuscriptId ||
      u.manuscript_version_id !== input.expectedManuscriptVersionId
    ) {
      return {
        ok: false,
        code: "understanding_mismatch",
        message: "Editorial understanding scope does not match manuscript version",
        status: "blocked",
      };
    }
    if (u.status !== "confirmed") {
      return {
        ok: false,
        code: "understanding_mismatch",
        message: "Editorial understanding must be confirmed before KDA synthesis",
        status: "blocked",
      };
    }
  }

  const generatedAt = input.generatedAt ?? new Date().toISOString();

  const synthesisInput = buildBoundedKdaSynthesisInput({
    independentRead: read,
    authorIntent: input.authorIntent,
    editorialUnderstanding: input.editorialUnderstanding,
    manuscriptBriefId: input.manuscriptBriefId,
  });

  let analysis = synthesizeKdaFromBoundedInput({
    analysisId: input.analysisId,
    eicExecutionId: input.eicExecutionId,
    synthesisInput,
    generatedAt,
  });

  const finalStatus = resolveCandidateStatus(analysis);
  assertNonActiveKdaStatus(finalStatus);

  if (input.priorStatus != null) {
    const transition = validateKdaStatusTransition(input.priorStatus, finalStatus);
    if (!transition.ok && input.priorStatus !== finalStatus) {
      const allowed = canTransitionKdaStatus(input.priorStatus, finalStatus);
      if (!allowed) {
        return {
          ok: false,
          code: "invalid_transition",
          message: transition.reason,
          status: "failed",
        };
      }
    }
  }

  const statusEvent = createAuditEvent({
    event_id: `audit-${input.analysisId}-status`,
    event_type: finalStatus === "failed" ? "failed" : "domain_added",
    timestamp: generatedAt,
    actor: "system",
    summary: `KDA candidate resolved to ${finalStatus}`,
    related_ids: Object.freeze([input.analysisId]),
    prior_state: "generating",
    new_state: finalStatus,
  });

  analysis = Object.freeze({
    ...appendAuditEvent(analysis, statusEvent),
    status: finalStatus,
    updated_at: generatedAt,
  });

  const validation = validateKdaContract(analysis, "draft");

  if (finalStatus === "failed") {
    return {
      ok: false,
      code: "validation_failed",
      message: validation.ok ? "KDA candidate failed structural validation" : validation.errors.map((e) => e.message).join("; "),
      status: "failed",
      validation,
    };
  }

  if (!validation.ok && finalStatus !== "incomplete_evidence" && finalStatus !== "blocked") {
    return {
      ok: false,
      code: "validation_failed",
      message: validation.errors.map((e) => e.message).join("; "),
      status: "failed",
      validation,
    };
  }

  return {
    ok: true,
    analysis,
    status: finalStatus,
    validation,
    synthesisInput,
  };
}

export {
  buildBoundedKdaSynthesisInput,
  synthesizeKdaFromBoundedInput,
  type BoundedKdaSynthesisInput,
};
