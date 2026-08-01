import {
  DOMAIN_CENTRALITY_LEVELS,
  FRAMING_ONLY_KDA_EVIDENCE_SOURCES,
  KDA_ACTIVATION_BOUNDARIES,
  KDA_AUTHOR_CONTROL,
  KDA_CONFIDENCE_LEVELS,
  KDA_IS_AUTHOR_INTENT,
  KDA_IS_EXPERT_ACTIVATION,
  KDA_IS_EXPERT_FINDING,
  KDA_IS_GRADING,
  KDA_IS_MANUSCRIPT_EVIDENCE,
  KDA_IS_MANUSCRIPT_SHARING_CONSENT,
  KDA_IS_ROADMAP_GENERATION,
  KDA_IS_SPECIALIST_ASSIGNMENT,
  KDA_MATERIALITY_LEVELS,
  KNOWLEDGE_DOMAIN_ANALYSIS_CONTRACT_VERSION,
  MIN_INDEPENDENT_READ_COVERAGE_CONFIRMATION,
  PLACEHOLDER_EVIDENCE_PATTERNS,
  POST_APPROVAL_EVIDENCE_SOURCES,
  PRIMARY_DOMAIN_EVIDENCE_SOURCES,
} from "./contract.ts";
import type {
  ActivationStatus,
  ConsentStatus,
  ManuscriptAccessStatus,
} from "./contract.ts";
import type {
  AuthorResponseEntry,
  CapabilityMappingEntry,
  DomainEntry,
  KdaEicConfirmationRecord,
  KdaEvidenceEntry,
  KdaValidationError,
  KdaValidationResult,
  KnowledgeDomainAnalysisV1,
  ProfileProjectionBundle,
  ProfileProjectionEntry,
  RegistryGapEntry,
  SpecialistRecommendation,
} from "./types.ts";

export type KdaValidationMode =
  | "structural"
  | "draft"
  | "awaiting_eic_confirmation"
  | "activation";

function err(code: string, message: string, section?: string): KdaValidationError {
  return { code, message, section };
}

export function isPlaceholderEvidence(text: string): boolean {
  const trimmed = text.trim();
  return PLACEHOLDER_EVIDENCE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isFramingOnlyEvidenceSource(source: KdaEvidenceEntry["source"]): boolean {
  return (FRAMING_ONLY_KDA_EVIDENCE_SOURCES as readonly string[]).includes(source);
}

export function isPostApprovalEvidenceSource(source: KdaEvidenceEntry["source"]): boolean {
  return (POST_APPROVAL_EVIDENCE_SOURCES as readonly string[]).includes(source);
}

export function hasPrimaryDomainEvidence(evidence: readonly KdaEvidenceEntry[]): boolean {
  return evidence.some((e) =>
    (PRIMARY_DOMAIN_EVIDENCE_SOURCES as readonly string[]).includes(e.source),
  );
}

export function validateKdaEvidenceEntry(
  evidence: KdaEvidenceEntry,
  context: string,
  options: { readonly requireNonPlaceholder?: boolean } = {},
): KdaValidationError[] {
  const errors: KdaValidationError[] = [];

  if (!evidence.evidence_id?.trim()) {
    errors.push(err("missing_evidence_id", `${context}: evidence_id is required`, context));
  }
  if (!evidence.observation?.trim()) {
    errors.push(err("missing_observation", `${context}: observation is required`, context));
  }
  if (!evidence.locator?.chapter_label?.trim()) {
    errors.push(err("missing_locator", `${context}: chapter_label is required`, context));
  }
  if (!(KDA_CONFIDENCE_LEVELS as readonly string[]).includes(evidence.confidence)) {
    errors.push(err("invalid_evidence_confidence", `${context}: invalid confidence`, context));
  }
  if (options.requireNonPlaceholder && isPlaceholderEvidence(evidence.observation)) {
    errors.push(
      err(
        "placeholder_evidence",
        `${context}: placeholder evidence rejected when meaningful examples required`,
        context,
      ),
    );
  }
  if (isPostApprovalEvidenceSource(evidence.source)) {
    errors.push(
      err(
        "post_approval_evidence_in_pre_expert",
        `${context}: specialist finding evidence cannot appear in pre-expert KDA`,
        context,
      ),
    );
  }
  if (evidence.excerpt != null && evidence.excerpt.split(/\s+/).length > 50) {
    errors.push(err("excerpt_too_long", `${context}: excerpt must be ≤50 words`, context));
  }

  return errors;
}

export function validateDomainEntry(
  domain: DomainEntry,
  mode: KdaValidationMode,
): KdaValidationError[] {
  const errors: KdaValidationError[] = [];
  const section = `domain:${domain.domain_id}`;

  if (!domain.domain_id?.trim()) errors.push(err("missing_domain_id", "domain_id required", section));
  if (!domain.domain_key?.trim()) errors.push(err("missing_domain_key", "domain_key required", section));
  if (!domain.author_facing_name?.trim()) {
    errors.push(err("missing_author_facing_name", "author_facing_name required", section));
  }
  if (!domain.description?.trim()) {
    errors.push(err("missing_domain_description", "description required", section));
  }
  if (!(DOMAIN_CENTRALITY_LEVELS as readonly string[]).includes(domain.centrality)) {
    errors.push(err("invalid_centrality", "invalid centrality", section));
  }
  if (!(KDA_MATERIALITY_LEVELS as readonly string[]).includes(domain.materiality)) {
    errors.push(err("invalid_materiality", "invalid materiality", section));
  }
  if (!(KDA_CONFIDENCE_LEVELS as readonly string[]).includes(domain.confidence)) {
    errors.push(err("invalid_confidence", "invalid confidence", section));
  }

  const materialCentrality = [
    "central",
    "substantial_supporting",
    "limited_scene_specific",
  ] as const;
  const materialMateriality = ["critical", "high", "moderate"] as const;
  const isMaterialDomain =
    (materialCentrality as readonly string[]).includes(domain.centrality) &&
    (materialMateriality as readonly string[]).includes(domain.materiality);

  for (const e of domain.evidence) {
    errors.push(
      ...validateKdaEvidenceEntry(e, section, {
        requireNonPlaceholder: isMaterialDomain && mode !== "structural",
      }),
    );
  }

  if (isMaterialDomain && domain.evidence.length === 0) {
    errors.push(err("material_domain_missing_evidence", "Material domain requires evidence", section));
  }
  if (isMaterialDomain && !hasPrimaryDomainEvidence(domain.evidence)) {
    errors.push(
      err(
        "material_domain_framing_only_evidence",
        "Material domain cannot rely on framing-only evidence",
        section,
      ),
    );
  }
  if (domain.centrality === "speculative" && domain.recommendation_status === "proposed") {
    errors.push(err("speculative_domain_recommendation", "Speculative domain cannot drive recommendation", section));
  }
  if (domain.centrality === "insufficient_evidence" && domain.recommendation_status === "proposed") {
    errors.push(
      err("insufficient_evidence_recommendation", "Insufficient-evidence domain cannot drive recommendation", section),
    );
  }
  if (domain.confidence === "low" || domain.confidence === "unknown") {
    if (domain.recommendation_status === "proposed" || domain.recommendation_status === "approved_for_team") {
      errors.push(
        err("low_confidence_recommendation", "Low/unknown confidence domain cannot drive recommendation", section),
      );
    }
  }

  return errors;
}

export function validateCapabilityMapping(
  mapping: CapabilityMappingEntry,
): KdaValidationError[] {
  const errors: KdaValidationError[] = [];
  const section = `capability_mapping:${mapping.mapping_id}`;

  if (!mapping.mapping_id?.trim()) errors.push(err("missing_mapping_id", "mapping_id required", section));
  if (!mapping.domain_id?.trim()) errors.push(err("missing_domain_id", "domain_id required", section));
  if (!mapping.capability_key?.trim()) {
    errors.push(err("missing_capability_key", "capability_key required", section));
  }
  if (!mapping.relevance_reason?.trim()) {
    errors.push(err("missing_relevance_reason", "relevance_reason required", section));
  }

  if (mapping.is_available && mapping.registry_gap_id) {
    errors.push(err("available_with_gap", "Available mapping cannot reference registry gap", section));
  }
  if (!mapping.is_registered && mapping.is_assignable) {
    errors.push(err("unregistered_assignable", "Unregistered capability cannot be assignable", section));
  }

  return errors;
}

export function validateRegistryGap(gap: RegistryGapEntry): KdaValidationError[] {
  const errors: KdaValidationError[] = [];
  const section = `registry_gap:${gap.gap_id}`;

  if (!gap.gap_id?.trim()) errors.push(err("missing_gap_id", "gap_id required", section));
  if (!gap.domain_id?.trim()) errors.push(err("missing_domain_id", "domain_id required", section));
  if (!gap.required_capability_key?.trim()) {
    errors.push(err("missing_required_capability", "required_capability_key required", section));
  }
  if (!gap.author_facing_explanation?.trim()) {
    errors.push(err("missing_gap_explanation", "author_facing_explanation required", section));
  }
  if (gap.unresolved_staffing_status !== true) {
    errors.push(err("gap_must_be_unresolved", "registry gap must have unresolved_staffing_status true", section));
  }

  return errors;
}

export function validateSpecialistRecommendation(
  recommendation: SpecialistRecommendation,
  mode: KdaValidationMode,
): KdaValidationError[] {
  const errors: KdaValidationError[] = [];
  const section = `recommendation:${recommendation.recommendation_id}`;

  if (!recommendation.recommendation_id?.trim()) {
    errors.push(err("missing_recommendation_id", "recommendation_id required", section));
  }
  if (!recommendation.domain_id?.trim()) {
    errors.push(err("missing_domain_id", "domain_id required", section));
  }
  if (!recommendation.demonstrated_need?.trim()) {
    errors.push(err("missing_demonstrated_need", "demonstrated_need required", section));
  }
  if (!recommendation.author_facing_explanation?.trim()) {
    errors.push(err("missing_author_explanation", "author_facing_explanation required", section));
  }
  if (!recommendation.capability_rationale?.trim()) {
    errors.push(err("missing_capability_rationale", "capability_rationale required", section));
  }
  if (!recommendation.candidate_capability_key?.trim()) {
    errors.push(err("missing_candidate_capability", "candidate_capability_key required", section));
  }

  if (recommendation.author_facing_explanation.trim() === recommendation.candidate_capability_key) {
    errors.push(
      err("raw_key_as_explanation", "Raw capability key cannot be sole author-facing explanation", section),
    );
  }
  if (/^domain:\s*\w+/i.test(recommendation.author_facing_explanation.trim())) {
    errors.push(err("raw_classification_primary", "Raw classification cannot be primary explanation", section));
  }

  if (recommendation.manuscript_evidence_ids.length === 0 && mode !== "structural") {
    errors.push(err("missing_recommendation_evidence", "Recommendation requires manuscript evidence refs", section));
  }

  if (recommendation.activation_status !== "not_activated") {
    errors.push(err("implied_activation", "Pre-consent recommendation must be not_activated", section));
  }
  if (recommendation.consent_status !== "not_requested") {
    errors.push(err("implied_consent", "Pre-consent recommendation must have consent not_requested", section));
  }
  if (recommendation.manuscript_access_status !== "not_shared") {
    errors.push(err("implied_manuscript_sharing", "Pre-consent recommendation must have not_shared access", section));
  }
  if (recommendation.commercial_enablement_status === "commercially_enabled") {
    errors.push(err("commercial_enablement", "KDA must not commercially enable experts", section));
  }

  if (
    recommendation.availability === "registry_gap" &&
    !recommendation.registry_gap_id?.trim()
  ) {
    errors.push(err("gap_without_id", "Registry gap recommendation requires registry_gap_id", section));
  }

  return errors;
}

export function validateAuthorResponse(response: AuthorResponseEntry): KdaValidationError[] {
  const errors: KdaValidationError[] = [];
  const section = `author_response:${response.response_id}`;

  if (!response.response_id?.trim()) errors.push(err("missing_response_id", "response_id required", section));
  if (!response.target_id?.trim()) errors.push(err("missing_target_id", "target_id required", section));
  if (!response.audit_event_id?.trim()) {
    errors.push(err("missing_audit_event_id", "audit_event_id required", section));
  }

  if (response.response_type === "disagree" && !response.preserves_eic_conclusion) {
    errors.push(
      err(
        "disagree_must_preserve_conclusion",
        "Disagree response must preserve EIC conclusion visibility",
        section,
      ),
    );
  }
  if (response.response_type === "disagree" && !response.effects.conflict_remains_visible) {
    errors.push(err("disagree_conflict_visibility", "Disagree must keep conflict visible", section));
  }
  if (!response.preserves_manuscript_evidence) {
    errors.push(err("evidence_erased", "Author response must preserve manuscript evidence", section));
  }

  return errors;
}

export function validateKdaConstitutionalFlags(analysis: KnowledgeDomainAnalysisV1): KdaValidationError[] {
  const errors: KdaValidationError[] = [];

  if (analysis.is_expert_finding !== KDA_IS_EXPERT_FINDING) {
    errors.push(err("invalid_is_expert_finding", "is_expert_finding must be false"));
  }
  if (analysis.is_manuscript_evidence !== KDA_IS_MANUSCRIPT_EVIDENCE) {
    errors.push(err("invalid_is_manuscript_evidence", "is_manuscript_evidence must be false"));
  }
  if (analysis.is_author_intent !== KDA_IS_AUTHOR_INTENT) {
    errors.push(err("invalid_is_author_intent", "is_author_intent must be false"));
  }
  if (analysis.is_specialist_assignment !== KDA_IS_SPECIALIST_ASSIGNMENT) {
    errors.push(err("invalid_is_specialist_assignment", "is_specialist_assignment must be false"));
  }
  if (analysis.is_manuscript_sharing_consent !== KDA_IS_MANUSCRIPT_SHARING_CONSENT) {
    errors.push(err("invalid_is_sharing_consent", "is_manuscript_sharing_consent must be false"));
  }
  if (analysis.is_expert_activation !== KDA_IS_EXPERT_ACTIVATION) {
    errors.push(err("invalid_is_expert_activation", "is_expert_activation must be false"));
  }
  if (analysis.is_roadmap_generation !== KDA_IS_ROADMAP_GENERATION) {
    errors.push(err("invalid_is_roadmap_generation", "is_roadmap_generation must be false"));
  }
  if (analysis.is_grading !== KDA_IS_GRADING) {
    errors.push(err("invalid_is_grading", "is_grading must be false"));
  }

  if (analysis.provenance.specialist_manuscript_access_count > 0) {
    errors.push(err("specialist_access_violation", "KDA requires zero specialist manuscript access"));
  }

  return errors;
}

export function validateKdaContract(
  analysis: KnowledgeDomainAnalysisV1,
  mode: KdaValidationMode = "draft",
): KdaValidationResult {
  const errors: KdaValidationError[] = [];

  if (analysis.contract_version !== KNOWLEDGE_DOMAIN_ANALYSIS_CONTRACT_VERSION) {
    errors.push(err("invalid_contract_version", "contract_version must be storydna_knowledge_domain_analysis@v1"));
  }
  if (!analysis.analysis_id?.trim()) errors.push(err("missing_analysis_id", "analysis_id is required"));
  if (!analysis.manuscript_id?.trim()) errors.push(err("missing_manuscript_id", "manuscript_id is required"));
  if (!analysis.manuscript_version_id?.trim()) {
    errors.push(err("missing_manuscript_version_id", "manuscript_version_id is required"));
  }
  if (!analysis.independent_read_id?.trim()) {
    errors.push(err("missing_independent_read_id", "independent_read_id is required"));
  }
  if (!analysis.eic_execution_id?.trim()) {
    errors.push(err("missing_eic_execution_id", "eic_execution_id is required"));
  }
  if (!analysis.provenance.independent_read_id?.trim()) {
    errors.push(err("missing_provenance_read_id", "provenance.independent_read_id is required"));
  }
  if (analysis.independent_read_id !== analysis.provenance.independent_read_id) {
    errors.push(err("read_id_mismatch", "independent_read_id must match provenance"));
  }

  errors.push(...validateKdaConstitutionalFlags(analysis));

  for (const domain of analysis.domains) {
    errors.push(...validateDomainEntry(domain, mode));
  }
  for (const mapping of analysis.capability_mappings) {
    errors.push(...validateCapabilityMapping(mapping));
  }
  for (const gap of analysis.registry_gaps) {
    errors.push(...validateRegistryGap(gap));
  }
  for (const rec of analysis.recommendations) {
    errors.push(...validateSpecialistRecommendation(rec, mode));
  }
  for (const response of analysis.author_responses) {
    errors.push(...validateAuthorResponse(response));
  }

  if (mode === "awaiting_eic_confirmation" || mode === "activation") {
    if (analysis.provenance.read_coverage_percent < MIN_INDEPENDENT_READ_COVERAGE_CONFIRMATION) {
      errors.push(
        err(
          "insufficient_read_coverage",
          `Confirmation requires read coverage ≥ ${MIN_INDEPENDENT_READ_COVERAGE_CONFIRMATION}%`,
        ),
      );
    }
  }

  if (mode === "activation") {
    if (!analysis.eic_confirmation) {
      errors.push(err("missing_eic_confirmation", "Active analysis requires eic_confirmation record"));
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export function validateForDraft(analysis: KnowledgeDomainAnalysisV1): KdaValidationResult {
  return validateKdaContract(analysis, "draft");
}

export function validateForEicConfirmation(analysis: KnowledgeDomainAnalysisV1): KdaValidationResult {
  return validateKdaContract(analysis, "awaiting_eic_confirmation");
}

export function validateForActivation(analysis: KnowledgeDomainAnalysisV1): KdaValidationResult {
  return validateKdaContract(analysis, "activation");
}

export function validateKdaEicConfirmationRecord(
  record: KdaEicConfirmationRecord,
): KdaValidationResult {
  const errors: KdaValidationError[] = [];

  if (record.contract_version !== KNOWLEDGE_DOMAIN_ANALYSIS_CONTRACT_VERSION) {
    errors.push(err("invalid_confirmation_contract", "confirmation contract_version mismatch"));
  }
  if (!record.confirmation_id?.trim()) {
    errors.push(err("missing_confirmation_id", "confirmation_id required"));
  }
  if (record.specialist_manuscript_access_granted !== false) {
    errors.push(err("confirmation_grants_access", "Confirmation must not grant manuscript access"));
  }
  if (record.expert_activation_performed !== false) {
    errors.push(err("confirmation_activates_expert", "Confirmation must not activate experts"));
  }
  if (record.roadmap_generated !== false) {
    errors.push(err("confirmation_generates_roadmap", "Confirmation must not generate roadmap"));
  }
  if (record.grade_assigned !== false) {
    errors.push(err("confirmation_assigns_grade", "Confirmation must not assign grade"));
  }
  if (!record.related_editorial_profile_id && record.resulting_status === "active") {
    errors.push(
      err(
        "missing_dual_confirmation_linkage",
        "Active confirmation should link related Editorial Profile for joint gate",
      ),
    );
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export function validateProfileProjectionEntry(entry: ProfileProjectionEntry): KdaValidationError[] {
  const errors: KdaValidationError[] = [];
  const section = `projection:${entry.projection_id}`;

  if (!entry.source_analysis_id?.trim()) {
    errors.push(err("missing_source_analysis_id", "source_analysis_id required", section));
  }
  if (!entry.source_domain_id?.trim()) {
    errors.push(err("missing_source_domain_id", "source_domain_id required", section));
  }
  if (entry.evidence_ids.length === 0) {
    errors.push(err("missing_projection_evidence", "projection requires evidence references", section));
  }

  return errors;
}

export function validateProfileProjectionBundle(bundle: ProfileProjectionBundle): KdaValidationResult {
  const errors: KdaValidationError[] = [];

  if (!bundle.source_analysis_id?.trim()) {
    errors.push(err("missing_bundle_analysis_id", "source_analysis_id required"));
  }
  for (const projection of bundle.projections) {
    if (projection.source_analysis_id !== bundle.source_analysis_id) {
      errors.push(err("projection_analysis_mismatch", "All projections must share source_analysis_id"));
    }
    errors.push(...validateProfileProjectionEntry(projection));
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export function detectRegistryGapSubstitution(
  analysis: KnowledgeDomainAnalysisV1,
): KdaValidationError[] {
  const errors: KdaValidationError[] = [];
  const gapCapabilities = new Set(analysis.registry_gaps.map((g) => g.required_capability_key));

  for (const rec of analysis.recommendations) {
    if (
      gapCapabilities.has("police_procedure") &&
      rec.candidate_capability_key === "military_operations" &&
      rec.recommendation_status === "proposed"
    ) {
      errors.push(
        err(
          "military_substitution_police",
          "Military capability cannot substitute for Police Procedure registry gap",
        ),
      );
    }
    if (
      gapCapabilities.has("organized_crime") &&
      (rec.candidate_capability_key === "military_operations" ||
        rec.candidate_capability_key === "criminal_law_prosecutorial") &&
      rec.recommendation_status === "proposed"
    ) {
      errors.push(
        err(
          "substitution_organized_crime",
          "Unrelated capability cannot substitute for Organized Crime registry gap",
        ),
      );
    }
  }

  return errors;
}

export function getKdaAuthorControlSnapshot() {
  return Object.freeze({ ...KDA_AUTHOR_CONTROL, ...KDA_ACTIVATION_BOUNDARIES });
}

export const DEFAULT_RECOMMENDATION_BOUNDARIES = {
  consent_status: "not_requested" as ConsentStatus,
  activation_status: "not_activated" as ActivationStatus,
  manuscript_access_status: "not_shared" as ManuscriptAccessStatus,
};
