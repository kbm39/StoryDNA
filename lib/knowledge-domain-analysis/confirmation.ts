import { KNOWLEDGE_DOMAIN_ANALYSIS_CONTRACT_VERSION } from "./contract.ts";
import { KDA_AUTHOR_CONTROL, KDA_ACTIVATION_BOUNDARIES } from "./contract.ts";
import type { KdaEicConfirmationRecord, KdaValidationResult, KnowledgeDomainAnalysisV1 } from "./types.ts";
import { validateForEicConfirmation, validateKdaEicConfirmationRecord } from "./validation.ts";

export type BuildKdaConfirmationInput = {
  readonly analysis: KnowledgeDomainAnalysisV1;
  readonly confirmationId: string;
  readonly eicExecutionId: string;
  readonly confirmedAt: string;
  readonly relatedEditorialProfileId?: string | null;
  readonly relatedEditorialProfileStatus?: string | null;
  readonly reason: string;
};

/** KDA-side confirmation record only — joint orchestration deferred to KDA-10. */
export function buildKdaEicConfirmationRecord(
  input: BuildKdaConfirmationInput,
): { readonly ok: true; readonly record: KdaEicConfirmationRecord } | { readonly ok: false; readonly validation: KdaValidationResult } {
  const validation = validateForEicConfirmation(input.analysis);

  const gapIds = input.analysis.registry_gaps.map((g) => g.gap_id);
  const recommendationViolations: string[] = [];
  for (const rec of input.analysis.recommendations) {
    if (rec.activation_status !== "not_activated") {
      recommendationViolations.push(`${rec.recommendation_id}: activation`);
    }
    if (rec.consent_status !== "not_requested") {
      recommendationViolations.push(`${rec.recommendation_id}: consent`);
    }
    if (rec.manuscript_access_status !== "not_shared") {
      recommendationViolations.push(`${rec.recommendation_id}: sharing`);
    }
  }

  const ready =
    validation.ok &&
    input.analysis.status === "awaiting_eic_confirmation" &&
    recommendationViolations.length === 0;

  const record: KdaEicConfirmationRecord = Object.freeze({
    confirmation_id: input.confirmationId,
    contract_version: KNOWLEDGE_DOMAIN_ANALYSIS_CONTRACT_VERSION,
    analysis_id: input.analysis.analysis_id,
    analysis_version_status: input.analysis.status,
    related_editorial_profile_id: input.relatedEditorialProfileId ?? null,
    related_editorial_profile_status: input.relatedEditorialProfileStatus ?? null,
    manuscript_id: input.analysis.manuscript_id,
    manuscript_version_id: input.analysis.manuscript_version_id,
    candidate_status_before: input.analysis.status,
    resulting_status: ready ? "active" : input.analysis.status,
    eic_execution_id: input.eicExecutionId,
    confirmed_at: input.confirmedAt,
    readiness: Object.freeze({
      ready,
      confirmation_validation_passed: validation.ok,
    }),
    validation_findings: validation.ok ? [] : validation.errors,
    unresolved_uncertainty: Object.freeze(
      input.analysis.domains.flatMap((d) => [...d.uncertainty_notes]),
    ),
    unresolved_conflicts: Object.freeze(
      input.analysis.domains.flatMap((d) =>
        d.conflicting_evidence.map((c) => c.description),
      ),
    ),
    domain_sufficiency: Object.freeze({
      sufficient: input.analysis.domains.length > 0,
      gaps: input.analysis.domains.length === 0 ? ["no_domains"] : [],
    }),
    capability_mapping_sufficiency: Object.freeze({
      sufficient: input.analysis.capability_mappings.length >= input.analysis.domains.filter((d) =>
        ["central", "substantial_supporting", "limited_scene_specific"].includes(d.centrality),
      ).length,
      gaps: [],
    }),
    registry_gap_acknowledgment: Object.freeze({
      acknowledged: gapIds.length === 0 || gapIds.every((id) =>
        input.analysis.recommendations.some((r) => r.registry_gap_id === id),
      ),
      gap_ids: Object.freeze([...gapIds]),
    }),
    recommendation_boundary_validation: Object.freeze({
      passed: recommendationViolations.length === 0,
      violations: Object.freeze([...recommendationViolations]),
    }),
    provenance_sufficiency: Object.freeze({
      sufficient: Boolean(input.analysis.provenance.independent_read_id),
      gaps: input.analysis.provenance.independent_read_id ? [] : ["missing_read"],
    }),
    reason: input.reason,
    failure: ready
      ? null
      : Object.freeze({
          code: "not_ready_for_confirmation",
          message: "KDA artifact not ready for EIC confirmation",
        }),
    author_control: Object.freeze({
      ...KDA_AUTHOR_CONTROL,
      ...KDA_ACTIVATION_BOUNDARIES,
    }),
    specialist_manuscript_access_granted: false,
    expert_activation_performed: false,
    roadmap_generated: false,
    grade_assigned: false,
    superseded_analysis_id: input.analysis.supersedes_analysis_id ?? null,
  });

  const recordValidation = validateKdaEicConfirmationRecord(record);
  if (!recordValidation.ok) {
    return { ok: false, validation: recordValidation };
  }

  if (!validation.ok) {
    return { ok: false, validation };
  }

  return { ok: true, record };
}
