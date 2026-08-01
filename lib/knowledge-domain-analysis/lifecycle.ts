import {
  KNOWLEDGE_DOMAIN_ANALYSIS_STATUSES,
  type KnowledgeDomainAnalysisStatus,
} from "./contract.ts";

export const KNOWLEDGE_DOMAIN_ANALYSIS_TRANSITIONS: Record<
  KnowledgeDomainAnalysisStatus,
  readonly KnowledgeDomainAnalysisStatus[]
> = {
  not_started: ["awaiting_independent_read", "blocked"],
  awaiting_independent_read: ["generating", "blocked"],
  generating: ["draft", "incomplete_evidence", "failed"],
  incomplete_evidence: ["generating", "draft", "blocked"],
  draft: ["awaiting_eic_confirmation", "generating", "failed"],
  awaiting_eic_confirmation: ["active", "draft", "failed"],
  active: ["updated", "superseded", "blocked"],
  updated: ["active", "superseded"],
  superseded: [],
  blocked: ["draft", "generating", "superseded"],
  failed: ["generating"],
};

export const TERMINAL_KDA_STATUSES: readonly KnowledgeDomainAnalysisStatus[] = Object.freeze([
  "superseded",
]);

export const ILLEGAL_DIRECT_ACTIVATION_SOURCES: readonly KnowledgeDomainAnalysisStatus[] =
  Object.freeze([
    "not_started",
    "awaiting_independent_read",
    "generating",
    "incomplete_evidence",
    "failed",
    "blocked",
    "superseded",
  ]);

export function isValidKnowledgeDomainAnalysisStatus(
  value: string,
): value is KnowledgeDomainAnalysisStatus {
  return (KNOWLEDGE_DOMAIN_ANALYSIS_STATUSES as readonly string[]).includes(value);
}

export function isTerminalKdaStatus(status: KnowledgeDomainAnalysisStatus): boolean {
  return TERMINAL_KDA_STATUSES.includes(status);
}

export function getAllowedKdaTransitions(
  from: KnowledgeDomainAnalysisStatus,
): readonly KnowledgeDomainAnalysisStatus[] {
  return KNOWLEDGE_DOMAIN_ANALYSIS_TRANSITIONS[from] ?? [];
}

export function canTransitionKdaStatus(
  from: KnowledgeDomainAnalysisStatus,
  to: KnowledgeDomainAnalysisStatus,
): boolean {
  if (from === to) return true;
  return getAllowedKdaTransitions(from).includes(to);
}

export type KdaStatusTransitionValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export function validateKdaStatusTransition(
  from: KnowledgeDomainAnalysisStatus,
  to: KnowledgeDomainAnalysisStatus,
): KdaStatusTransitionValidationResult {
  if (from === to) return { ok: true };
  if (isTerminalKdaStatus(from)) {
    return { ok: false, reason: `Cannot transition from terminal status "${from}".` };
  }
  if (!canTransitionKdaStatus(from, to)) {
    return {
      ok: false,
      reason: `Invalid transition from "${from}" to "${to}". Allowed: ${getAllowedKdaTransitions(from).join(", ") || "none"}.`,
    };
  }
  return { ok: true };
}

export const PRE_AUTHOR_EXPOSURE_KDA_STATUSES: readonly KnowledgeDomainAnalysisStatus[] =
  Object.freeze([
    "not_started",
    "awaiting_independent_read",
    "generating",
    "incomplete_evidence",
    "draft",
    "awaiting_eic_confirmation",
    "failed",
  ]);

export function isKdaAuthorExposedStatus(status: KnowledgeDomainAnalysisStatus): boolean {
  return !PRE_AUTHOR_EXPOSURE_KDA_STATUSES.includes(status);
}

export const KDA_ACTIVATION_SOURCE_STATUSES: readonly KnowledgeDomainAnalysisStatus[] =
  Object.freeze(["awaiting_eic_confirmation"]);

export function canAttemptKdaActivation(from: KnowledgeDomainAnalysisStatus): boolean {
  return KDA_ACTIVATION_SOURCE_STATUSES.includes(from);
}

export function validateKdaActivationTransition(
  from: KnowledgeDomainAnalysisStatus,
  to: KnowledgeDomainAnalysisStatus,
): KdaStatusTransitionValidationResult {
  if (to !== "active") {
    return validateKdaStatusTransition(from, to);
  }
  if (!canAttemptKdaActivation(from)) {
    return {
      ok: false,
      reason: `KDA cannot activate from "${from}" — EIC confirmation required (awaiting_eic_confirmation).`,
    };
  }
  if (ILLEGAL_DIRECT_ACTIVATION_SOURCES.includes(from)) {
    return {
      ok: false,
      reason: `Direct activation from "${from}" is prohibited.`,
    };
  }
  return validateKdaStatusTransition(from, to);
}

export function transitionKdaStatus(
  analysis: { readonly status: KnowledgeDomainAnalysisStatus },
  to: KnowledgeDomainAnalysisStatus,
): KnowledgeDomainAnalysisStatus {
  const result = validateKdaStatusTransition(analysis.status, to);
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return to;
}
