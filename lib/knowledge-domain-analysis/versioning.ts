import {
  KNOWLEDGE_DOMAIN_ANALYSIS_CONTRACT_VERSION,
  KDA_IS_AUTHOR_INTENT,
  KDA_IS_EXPERT_ACTIVATION,
  KDA_IS_EXPERT_FINDING,
  KDA_IS_GRADING,
  KDA_IS_MANUSCRIPT_EVIDENCE,
  KDA_IS_MANUSCRIPT_SHARING_CONSENT,
  KDA_IS_ROADMAP_GENERATION,
  KDA_IS_SPECIALIST_ASSIGNMENT,
} from "./contract.ts";
import type { KnowledgeDomainAnalysisV1, KdaVersionChainEntry } from "./types.ts";

export function kdaMetadataFlags() {
  return {
    is_expert_finding: KDA_IS_EXPERT_FINDING,
    is_manuscript_evidence: KDA_IS_MANUSCRIPT_EVIDENCE,
    is_author_intent: KDA_IS_AUTHOR_INTENT,
    is_specialist_assignment: KDA_IS_SPECIALIST_ASSIGNMENT,
    is_manuscript_sharing_consent: KDA_IS_MANUSCRIPT_SHARING_CONSENT,
    is_expert_activation: KDA_IS_EXPERT_ACTIVATION,
    is_roadmap_generation: KDA_IS_ROADMAP_GENERATION,
    is_grading: KDA_IS_GRADING,
  };
}

export function assertKdaContractVersion(version: string): boolean {
  return version === KNOWLEDGE_DOMAIN_ANALYSIS_CONTRACT_VERSION;
}

export const IMMUTABLE_KDA_STATUSES = ["active", "updated", "superseded"] as const;

export function isImmutableKdaStatus(status: KnowledgeDomainAnalysisV1["status"]): boolean {
  return (IMMUTABLE_KDA_STATUSES as readonly string[]).includes(status);
}

export function assertKdaMutable(analysis: KnowledgeDomainAnalysisV1): {
  ok: boolean;
  error?: string;
} {
  if (isImmutableKdaStatus(analysis.status)) {
    return {
      ok: false,
      error: `Analysis ${analysis.analysis_id} is ${analysis.status} and cannot be mutated — create a superseding version.`,
    };
  }
  return { ok: true };
}

export type SupersedeKdaInput = {
  readonly prior: KnowledgeDomainAnalysisV1;
  readonly newAnalysisId: string;
  readonly triggerEvent: KnowledgeDomainAnalysisV1["trigger_event"];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updates: Partial<
    Pick<
      KnowledgeDomainAnalysisV1,
      | "domains"
      | "capability_mappings"
      | "recommendations"
      | "registry_gaps"
      | "author_responses"
      | "synthesis_confidence"
      | "provenance"
      | "status"
      | "audit_history"
    >
  >;
};

export function createSupersedingKda(input: SupersedeKdaInput): KnowledgeDomainAnalysisV1 {
  const { prior, newAnalysisId, triggerEvent, createdAt, updatedAt, updates } = input;

  return Object.freeze({
    ...prior,
    ...updates,
    analysis_id: newAnalysisId,
    contract_version: KNOWLEDGE_DOMAIN_ANALYSIS_CONTRACT_VERSION,
    supersedes_analysis_id: prior.analysis_id,
    superseded_by_analysis_id: null,
    created_at: createdAt,
    updated_at: updatedAt,
    activated_at: null,
    trigger_event: triggerEvent,
    status: updates.status ?? "draft",
    eic_confirmation: null,
    is_expert_finding: false,
    is_manuscript_evidence: false,
    is_author_intent: false,
    is_specialist_assignment: false,
    is_manuscript_sharing_consent: false,
    is_expert_activation: false,
    is_roadmap_generation: false,
    is_grading: false,
  });
}

export function linkSupersededKda(
  prior: KnowledgeDomainAnalysisV1,
  successorAnalysisId: string,
): KnowledgeDomainAnalysisV1 {
  return Object.freeze({
    ...prior,
    status: "superseded",
    superseded_by_analysis_id: successorAnalysisId,
    updated_at: prior.updated_at,
  });
}

export function buildKdaVersionChain(
  analyses: readonly KnowledgeDomainAnalysisV1[],
): readonly KdaVersionChainEntry[] {
  return Object.freeze(
    [...analyses]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((a) =>
        Object.freeze({
          analysis_id: a.analysis_id,
          status: a.status,
          supersedes_analysis_id: a.supersedes_analysis_id ?? null,
          superseded_by_analysis_id: a.superseded_by_analysis_id ?? null,
          created_at: a.created_at,
        }),
      ),
  );
}

export function extractKdaProvenanceSources(analysis: KnowledgeDomainAnalysisV1) {
  return Object.freeze({
    independent_read_id: analysis.independent_read_id,
    author_intent_id: analysis.author_intent_id ?? null,
    editorial_understanding_id: analysis.editorial_understanding_id ?? null,
    editorial_profile_id: analysis.editorial_profile_id ?? null,
    specialist_manuscript_access_count: analysis.provenance.specialist_manuscript_access_count,
  });
}
