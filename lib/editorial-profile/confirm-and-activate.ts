/**
 * EP-3 — EIC confirmation and profile activation gate.
 * Deterministic orchestration only; no provider calls, specialist access, or roadmap generation.
 */

import {
  EDITORIAL_PROFILE_ACTIVATION_BOUNDARIES,
  EDITORIAL_PROFILE_CONTRACT_VERSION,
  EIC_CONFIRMATION_SECTION_ORDER,
  type EicConfirmationSectionKey,
  type EditorialProfileStatus,
} from "./contract.ts";
import { isStudioEditorialProfileEnabled } from "./feature-flag.ts";
import {
  canAttemptActivation,
  validateActivationTransition,
  validateEditorialProfileStatusTransition,
} from "./lifecycle.ts";
import type {
  EditorialProfileEicConfirmationRecord,
  EditorialProfileSectionConfirmation,
  EditorialProfileV1,
  EditorialProfileValidationResult,
} from "./types.ts";
import {
  detectProhibitedInputs,
  hasConflictingEvidence,
  scanForExpertKeysInRequirements,
  validateEditorialProfileContract,
  validateForActivation,
} from "./validation.ts";
import {
  extractProvenanceSources,
  freezeProfileSections,
  linkSupersededProfile,
} from "./versioning.ts";

export type ConfirmAndActivateFailureCode =
  | "feature_flag_disabled"
  | "missing_candidate"
  | "structurally_invalid"
  | "manuscript_mismatch"
  | "version_mismatch"
  | "missing_provenance"
  | "unverifiable_provenance"
  | "ineligible_state"
  | "already_active"
  | "blocked"
  | "superseded"
  | "failed_status"
  | "activation_validation_failed"
  | "invalid_transition"
  | "prohibited_input"
  | "unsupported_conclusion"
  | "cross_version_conflict"
  | "supersession_unsafe";

export type ConfirmAndActivateEditorialProfileInput = {
  readonly confirmationId: string;
  readonly profile: EditorialProfileV1 | null | undefined;
  readonly eicIdentity: string;
  readonly expectedManuscriptId: string;
  readonly expectedManuscriptVersionId: string;
  readonly priorActiveProfile?: EditorialProfileV1 | null;
  readonly confirmedAt?: string;
};

export type ConfirmAndActivateEditorialProfileResult =
  | {
      readonly ok: true;
      readonly profile: EditorialProfileV1;
      readonly priorSuperseded: EditorialProfileV1 | null;
      readonly confirmation: EditorialProfileEicConfirmationRecord;
    }
  | {
      readonly ok: false;
      readonly code: ConfirmAndActivateFailureCode;
      readonly message: string;
      readonly status: EditorialProfileStatus;
      readonly profile: EditorialProfileV1 | null;
      readonly confirmation: EditorialProfileEicConfirmationRecord;
      readonly validation?: EditorialProfileValidationResult;
    };

export type SubmitForEicConfirmationInput = {
  readonly profile: EditorialProfileV1 | null | undefined;
};

export type SubmitForEicConfirmationResult =
  | {
      readonly ok: true;
      readonly profile: EditorialProfileV1;
      readonly status: "awaiting_eic_confirmation";
      readonly validation: EditorialProfileValidationResult;
    }
  | {
      readonly ok: false;
      readonly code: ConfirmAndActivateFailureCode | "not_activation_ready";
      readonly message: string;
      readonly status: EditorialProfileStatus;
      readonly profile: EditorialProfileV1 | null;
      readonly validation?: EditorialProfileValidationResult;
    };

function sectionConfirmation(
  sectionKey: EicConfirmationSectionKey,
  displayOrder: number,
  input: Omit<EditorialProfileSectionConfirmation, "section_key" | "display_order">,
): EditorialProfileSectionConfirmation {
  return Object.freeze({
    section_key: sectionKey,
    display_order: displayOrder,
    ...input,
  });
}

function collectProfileConflicts(profile: EditorialProfileV1): string[] {
  const conflicts: string[] = [];

  if (hasConflictingEvidence(profile.story_identity.evidence)) {
    conflicts.push("story_identity: supporting and contrary evidence both present");
  }

  for (const engine of profile.story_engines) {
    if (hasConflictingEvidence(engine.evidence)) {
      conflicts.push(`story_engines:${engine.engine_id}: conflicting evidence polarity`);
    }
  }

  return conflicts;
}

function collectProfileUncertainty(profile: EditorialProfileV1): string[] {
  const notes: string[] = [];

  if (profile.story_identity.confidence === "low") {
    notes.push("story_identity at low confidence");
  }

  for (const section of profile.synthesis_confidence.sections_at_low_confidence) {
    notes.push(`${section} at low confidence`);
  }

  for (const gap of profile.synthesis_confidence.gaps_affecting_confidence) {
    notes.push(gap);
  }

  return notes;
}

function validateProvenance(profile: EditorialProfileV1): {
  sufficient: boolean;
  gaps: string[];
} {
  const gaps: string[] = [];
  const provenance = extractProvenanceSources(profile);

  if (!provenance.author_intent_id?.trim()) gaps.push("missing author_intent_id");
  if (!provenance.independent_read_id?.trim()) gaps.push("missing independent_read_id");
  if (provenance.author_intent_id !== profile.author_intent_id) {
    gaps.push("provenance author_intent_id mismatch");
  }
  if (provenance.independent_read_id !== profile.independent_read_id) {
    gaps.push("provenance independent_read_id mismatch");
  }
  if (provenance.specialist_manuscript_access_count > 0) {
    gaps.push("specialist manuscript access must be zero");
  }

  return { sufficient: gaps.length === 0, gaps };
}

function validateEvidenceSufficiency(profile: EditorialProfileV1): {
  sufficient: boolean;
  gaps: string[];
} {
  const gaps: string[] = [];

  if (profile.story_identity.evidence.length === 0) {
    gaps.push("story_identity lacks manuscript evidence");
  }

  if (profile.protected_assets.length === 0) {
    gaps.push("no protected assets identified");
  }

  for (const risk of profile.editorial_risks) {
    if (["blocking", "significant"].includes(risk.severity) && risk.evidence.length === 0) {
      gaps.push(`${risk.risk_id}: ${risk.severity} risk without evidence`);
    }
  }

  return { sufficient: gaps.length === 0, gaps };
}

function buildSectionConfirmations(
  profile: EditorialProfileV1,
  activationResult: EditorialProfileValidationResult,
): readonly EditorialProfileSectionConfirmation[] {
  const conflicts = collectProfileConflicts(profile);
  const uncertainty = collectProfileUncertainty(profile);
  const strengths = profile.editorial_characteristics.filter((e) => e.assessment === "strength");
  const opportunities = profile.editorial_characteristics.filter((e) =>
    ["developing", "gap"].includes(e.assessment),
  );
  const expertViolations = scanForExpertKeysInRequirements(profile.specialist_requirements);

  const understandingConfirmed =
    profile.story_identity.evidence.length > 0 &&
    profile.story_engines.length > 0 &&
    profile.story_identity.identity_rationale.trim().length > 0;

  const workingConfirmed = strengths.length >= 2;

  const protectedConfirmed =
    profile.protected_assets.length >= 2 &&
    profile.protected_assets.every((a) => a.evidence.length > 0);

  const opportunitiesConfirmed = opportunities.every(
    (e) => e.assessment === "developing" || e.evidence.length > 0,
  );

  const risksConfirmed = profile.editorial_risks.every(
    (r) => !["blocking", "significant"].includes(r.severity) || r.evidence.length > 0,
  );

  const specialistConfirmed =
    expertViolations.length === 0 &&
    profile.specialist_requirements.every(
      (r) =>
        r.requirement_level === "none" ||
        (r.justification.trim().length > 0 && r.driving_characteristics.length > 0),
    );

  const roadmapConfirmed =
    profile.roadmap_inputs.coverage_completeness >= 0 &&
    !profile.roadmap_inputs.sequencing_hints.some((h) => h.hint_key.includes("roadmap_exists"));

  const activationReady = activationResult.ok;

  const sections: EditorialProfileSectionConfirmation[] = [
    sectionConfirmation("manuscript_understanding", 1, {
      confirmed: understandingConfirmed,
      summary: `${profile.story_identity.primary_identity.label} with ${profile.story_engines.length} engine(s)`,
      findings: understandingConfirmed
        ? ["Story identity and engines grounded in manuscript evidence"]
        : ["Story identity or engines lack sufficient evidence"],
      uncertainty_notes: uncertainty.filter((n) => n.includes("story")),
      conflicts: conflicts.filter((c) => c.startsWith("story_")),
    }),
    sectionConfirmation("what_is_working", 2, {
      confirmed: workingConfirmed,
      summary: `${strengths.length} editorial strength(s) identified`,
      findings: strengths.map((s) => `${s.domain}: ${s.label}`),
      uncertainty_notes: [],
      conflicts: [],
    }),
    sectionConfirmation("protected_assets", 3, {
      confirmed: protectedConfirmed,
      summary: `${profile.protected_assets.length} protected asset(s)`,
      findings: profile.protected_assets.map((a) => `${a.category}: ${a.label}`),
      uncertainty_notes: profile.protected_assets
        .filter((a) => a.confidence === "low")
        .map((a) => `${a.asset_id} at low confidence`),
      conflicts: [],
    }),
    sectionConfirmation("improvement_opportunities", 4, {
      confirmed: opportunitiesConfirmed,
      summary: `${opportunities.length} development area(s)`,
      findings: opportunities.map((e) => `${e.domain}: ${e.assessment}`),
      uncertainty_notes: [],
      conflicts: [],
    }),
    sectionConfirmation("editorial_risks", 5, {
      confirmed: risksConfirmed,
      summary: `${profile.editorial_risks.length} editorial risk(s)`,
      findings: profile.editorial_risks.map((r) => `${r.severity}: ${r.label}`),
      uncertainty_notes: profile.editorial_risks
        .filter((r) => r.confidence === "low")
        .map((r) => `${r.risk_id} at low confidence`),
      conflicts: [],
    }),
    sectionConfirmation("specialist_requirements", 6, {
      confirmed: specialistConfirmed,
      summary: `${profile.specialist_requirements.filter((r) => r.requirement_level !== "none").length} domain need(s) — no expert keys`,
      findings: profile.specialist_requirements
        .filter((r) => r.requirement_level !== "none")
        .map((r) => `${r.domain_key}: ${r.requirement_level}`),
      uncertainty_notes: expertViolations.length > 0 ? [`Expert keys forbidden: ${expertViolations.join(", ")}`] : [],
      conflicts: [],
    }),
    sectionConfirmation("roadmap_inputs", 7, {
      confirmed: roadmapConfirmed,
      summary: "Roadmap input hints only — no roadmap generated",
      findings: [
        `destination_alignment: ${profile.roadmap_inputs.destination_alignment}`,
        `${profile.roadmap_inputs.specialist_requirements_summary.length} requirement summary entries`,
      ],
      uncertainty_notes: profile.roadmap_inputs.sequencing_hints
        .filter((h) => h.preliminary)
        .map((h) => `${h.hint_key} marked preliminary`),
      conflicts: [],
    }),
    sectionConfirmation("activation_readiness", 8, {
      confirmed: activationReady,
      summary: activationReady ? "All activation thresholds satisfied" : "Activation thresholds not met",
      findings: activationReady
        ? ["validateForActivation passed"]
        : activationResult.ok
          ? []
          : activationResult.errors.map((e) => e.message),
      uncertainty_notes: uncertainty,
      conflicts,
    }),
  ];

  return Object.freeze(sections);
}

function buildConfirmationRecord(input: {
  confirmationId: string;
  profile: EditorialProfileV1;
  candidateStatusBefore: EditorialProfileStatus;
  resultingStatus: EditorialProfileStatus;
  eicIdentity: string;
  confirmedAt: string;
  activationResult: EditorialProfileValidationResult;
  structuralResult: EditorialProfileValidationResult;
  reason: string;
  failure: { code: ConfirmAndActivateFailureCode; message: string } | null;
  supersededProfileId: string | null;
}): EditorialProfileEicConfirmationRecord {
  const validationFindings = [
    ...(input.structuralResult.ok ? [] : input.structuralResult.errors),
    ...(input.activationResult.ok ? [] : input.activationResult.errors),
  ];

  const evidenceSufficiency = validateEvidenceSufficiency(input.profile);
  const provenanceSufficiency = validateProvenance(input.profile);
  const sectionConfirmations = buildSectionConfirmations(input.profile, input.activationResult);

  return Object.freeze({
    confirmation_id: input.confirmationId,
    contract_version: EDITORIAL_PROFILE_CONTRACT_VERSION,
    profile_id: input.profile.profile_id,
    manuscript_id: input.profile.manuscript_id,
    manuscript_version_id: input.profile.manuscript_version_id,
    candidate_status_before: input.candidateStatusBefore,
    resulting_status: input.resultingStatus,
    eic_identity: input.eicIdentity,
    confirmed_at: input.confirmedAt,
    readiness: Object.freeze({
      ready: input.activationResult.ok && input.failure == null,
      activation_validation_passed: input.activationResult.ok,
    }),
    validation_findings: Object.freeze(validationFindings),
    unresolved_uncertainty: Object.freeze(collectProfileUncertainty(input.profile)),
    unresolved_conflicts: Object.freeze(collectProfileConflicts(input.profile)),
    section_confirmations: sectionConfirmations,
    evidence_sufficiency: Object.freeze(evidenceSufficiency),
    provenance_sufficiency: Object.freeze(provenanceSufficiency),
    reason: input.reason,
    failure: input.failure,
    author_control: Object.freeze({ ...EDITORIAL_PROFILE_ACTIVATION_BOUNDARIES }),
    specialist_manuscript_access_granted: false as const,
    roadmap_generated: false as const,
    superseded_profile_id: input.supersededProfileId,
  });
}

function transitionProfileStatus(
  profile: EditorialProfileV1,
  to: EditorialProfileStatus,
): { ok: true; profile: EditorialProfileV1 } | { ok: false; reason: string } {
  const from = profile.status;
  const transitionCheck =
    to === "active"
      ? validateActivationTransition(from, to)
      : validateEditorialProfileStatusTransition(from, to);

  if (!transitionCheck.ok) {
    return { ok: false, reason: transitionCheck.reason };
  }

  return {
    ok: true,
    profile: freezeProfileSections({ ...profile, status: to }),
  };
}

function resolveRefusalStatus(
  profile: EditorialProfileV1,
  code: ConfirmAndActivateFailureCode,
): EditorialProfileStatus {
  if (code === "prohibited_input" || code === "unsupported_conclusion") {
    return "failed";
  }
  if (profile.status === "awaiting_eic_confirmation") {
    return "awaiting_eic_confirmation";
  }
  return profile.status;
}

export function submitEditorialProfileForEicConfirmation(
  input: SubmitForEicConfirmationInput,
): SubmitForEicConfirmationResult {
  if (!input.profile) {
    return {
      ok: false,
      code: "missing_candidate",
      message: "Editorial profile candidate is required",
      status: "not_started",
      profile: null,
    };
  }

  const profile = input.profile;

  if (profile.status !== "draft") {
    return {
      ok: false,
      code: "ineligible_state",
      message: `Only draft profiles may submit for EIC confirmation (got ${profile.status})`,
      status: profile.status,
      profile,
    };
  }

  const structural = validateEditorialProfileContract(profile, "draft");
  if (!structural.ok) {
    return {
      ok: false,
      code: "structurally_invalid",
      message: structural.errors.map((e) => e.message).join("; "),
      status: profile.status,
      profile,
      validation: structural,
    };
  }

  const activation = validateForActivation(profile);
  if (!activation.ok) {
    return {
      ok: false,
      code: "not_activation_ready",
      message: activation.errors.map((e) => e.message).join("; "),
      status: profile.status,
      profile,
      validation: activation,
    };
  }

  const transitioned = transitionProfileStatus(profile, "awaiting_eic_confirmation");
  if (!transitioned.ok) {
    return {
      ok: false,
      code: "invalid_transition",
      message: transitioned.reason,
      status: profile.status,
      profile,
    };
  }

  return {
    ok: true,
    profile: transitioned.profile,
    status: "awaiting_eic_confirmation",
    validation: activation,
  };
}

export function confirmAndActivateEditorialProfile(
  input: ConfirmAndActivateEditorialProfileInput,
): ConfirmAndActivateEditorialProfileResult {
  const confirmedAt = input.confirmedAt ?? new Date().toISOString();

  const fail = (
    code: ConfirmAndActivateFailureCode,
    message: string,
    status: EditorialProfileStatus,
    profile: EditorialProfileV1 | null,
    extras: {
      activationResult?: EditorialProfileValidationResult;
      structuralResult?: EditorialProfileValidationResult;
      reason?: string;
    } = {},
  ): ConfirmAndActivateEditorialProfileResult => {
    const structuralResult =
      extras.structuralResult ??
      (profile ? validateEditorialProfileContract(profile, "structural") : { ok: false, errors: [] });
    const activationResult =
      extras.activationResult ??
      (profile ? validateForActivation(profile) : { ok: false, errors: [] });

    const confirmation = profile
      ? buildConfirmationRecord({
          confirmationId: input.confirmationId,
          profile,
          candidateStatusBefore: profile.status,
          resultingStatus: status,
          eicIdentity: input.eicIdentity,
          confirmedAt,
          activationResult,
          structuralResult,
          reason: extras.reason ?? message,
          failure: { code, message },
          supersededProfileId: null,
        })
      : buildConfirmationRecord({
          confirmationId: input.confirmationId,
          profile: {
            contract_version: EDITORIAL_PROFILE_CONTRACT_VERSION,
            profile_id: "",
            manuscript_id: input.expectedManuscriptId,
            manuscript_version_id: input.expectedManuscriptVersionId,
            author_intent_id: "",
            independent_read_id: "",
            status: "not_started",
            generated_at: confirmedAt,
            trigger_event: "independent_read_complete",
            synthesis_confidence: {
              overall_confidence: "low",
              independent_read_coverage: 0,
              sections_at_low_confidence: [],
              evidence_depth: "thin",
              gaps_affecting_confidence: [],
            },
            story_identity: {
              primary_identity: { identity_key: "", label: "", demonstration_summary: "" },
              secondary_identities: [],
              identity_rationale: "",
              evidence: [],
              confidence: "low",
              author_framing_alignment: "aligned",
            },
            story_engines: [],
            editorial_characteristics: [],
            technical_characteristics: [],
            emotional_characteristics: [],
            protected_assets: [],
            editorial_risks: [],
            specialist_requirements: [],
            commercial_characteristics: {
              commercial_assessment_scope: "pre_expert_preliminary",
              hook_strength: "not_assessable",
              hook_evidence: [],
              comp_alignment_signals: [],
              market_lane_fit: "not_assessable",
              market_lane_rationale: "",
              differentiation_signals: [],
              commercial_risks: [],
              readiness_signal: "not_assessable",
              confidence: "low",
              author_market_framing_alignment: "aligned",
            },
            roadmap_inputs: {
              destination_alignment: "partially_aligned",
              alignment_source: "",
              primary_story_identity_key: "",
              primary_engine_key: "",
              top_protected_asset_ids: [],
              top_editorial_risk_ids: [],
              specialist_requirements_summary: [],
              distance_input_signals: [],
              readiness_input_signals: [],
              sequencing_hints: [],
              roi_hints: [],
              next_action_hints: [],
              regression_risk: "medium",
              coverage_completeness: 0,
            },
            provenance: {
              author_intent_id: "",
              independent_read_id: "",
              synthesis_timestamp: confirmedAt,
              independent_read_coverage: 0,
              specialist_manuscript_access_count: 0,
            },
            is_expert_finding: false,
            is_manuscript_evidence: false,
            is_author_intent: false,
          },
          candidateStatusBefore: "not_started",
          resultingStatus: status,
          eicIdentity: input.eicIdentity,
          confirmedAt,
          activationResult,
          structuralResult,
          reason: extras.reason ?? message,
          failure: { code, message },
          supersededProfileId: null,
        });

    return {
      ok: false,
      code,
      message,
      status,
      profile,
      confirmation,
      validation: activationResult.ok ? structuralResult : activationResult,
    };
  };

  if (!isStudioEditorialProfileEnabled()) {
    return fail(
      "feature_flag_disabled",
      "Editorial profile activation is disabled (STUDIO_EDITORIAL_PROFILE_ENABLED)",
      "not_started",
      input.profile ?? null,
    );
  }

  if (!input.profile) {
    return fail("missing_candidate", "Editorial profile candidate is required", "not_started", null);
  }

  const profile = input.profile;
  const candidateStatusBefore = profile.status;

  if (profile.manuscript_id !== input.expectedManuscriptId) {
    return fail(
      "manuscript_mismatch",
      "Profile manuscript_id does not match expected manuscript",
      resolveRefusalStatus(profile, "manuscript_mismatch"),
      profile,
    );
  }

  if (profile.manuscript_version_id !== input.expectedManuscriptVersionId) {
    return fail(
      "version_mismatch",
      "Profile manuscript_version_id does not match expected version",
      resolveRefusalStatus(profile, "version_mismatch"),
      profile,
    );
  }

  const provenanceCheck = validateProvenance(profile);
  if (!provenanceCheck.sufficient) {
    return fail(
      "unverifiable_provenance",
      provenanceCheck.gaps.join("; "),
      resolveRefusalStatus(profile, "unverifiable_provenance"),
      profile,
    );
  }

  if (!profile.author_intent_id?.trim() || !profile.independent_read_id?.trim()) {
    return fail(
      "missing_provenance",
      "Profile requires author_intent_id and independent_read_id",
      resolveRefusalStatus(profile, "missing_provenance"),
      profile,
    );
  }

  if (profile.status === "active" || profile.status === "updated") {
    return fail(
      "already_active",
      "Profile is already active and cannot be re-activated",
      profile.status,
      profile,
    );
  }

  if (profile.status === "blocked") {
    return fail("blocked", "Blocked profile cannot activate", "blocked", profile);
  }

  if (profile.status === "superseded") {
    return fail("superseded", "Superseded profile cannot reactivate", "superseded", profile);
  }

  if (profile.status === "failed") {
    return fail("failed_status", "Failed profile cannot activate without regeneration", "failed", profile);
  }

  if (!canAttemptActivation(profile.status)) {
    return fail(
      "ineligible_state",
      `Profile cannot activate from status "${profile.status}" — EIC confirmation required`,
      profile.status,
      profile,
    );
  }

  const prohibited = detectProhibitedInputs(profile);
  if (prohibited.length > 0) {
    const structuralResult: EditorialProfileValidationResult = { ok: false, errors: prohibited };
    const failedTransition = transitionProfileStatus(profile, "failed");
    const failedProfile = failedTransition.ok
      ? failedTransition.profile
      : freezeProfileSections({ ...profile, status: "failed" });

    return fail(
      "prohibited_input",
      prohibited.map((e) => e.message).join("; "),
      "failed",
      failedProfile,
      { structuralResult, reason: "Prohibited evidence source detected" },
    );
  }

  const structuralResult = validateEditorialProfileContract(profile, "structural");
  if (!structuralResult.ok) {
    return fail(
      "structurally_invalid",
      structuralResult.errors.map((e) => e.message).join("; "),
      resolveRefusalStatus(profile, "structurally_invalid"),
      profile,
      { structuralResult },
    );
  }

  const activationResult = validateForActivation(profile);
  if (!activationResult.ok) {
    return fail(
      "activation_validation_failed",
      activationResult.errors.map((e) => e.message).join("; "),
      "awaiting_eic_confirmation",
      profile,
      { activationResult, reason: "Activation-readiness validation failed" },
    );
  }

  const evidenceCheck = validateEvidenceSufficiency(profile);
  if (!evidenceCheck.sufficient) {
    return fail(
      "unsupported_conclusion",
      evidenceCheck.gaps.join("; "),
      "awaiting_eic_confirmation",
      profile,
      { activationResult, reason: "Unsupported conclusions without evidence" },
    );
  }

  const sectionConfirmations = buildSectionConfirmations(profile, activationResult);
  const unconfirmedRequired = sectionConfirmations.filter((s) => !s.confirmed);
  if (unconfirmedRequired.length > 0) {
    return fail(
      "unsupported_conclusion",
      `Section confirmation incomplete: ${unconfirmedRequired.map((s) => s.section_key).join(", ")}`,
      "awaiting_eic_confirmation",
      profile,
      { activationResult, reason: "EIC section confirmation did not pass" },
    );
  }

  if (input.priorActiveProfile) {
    const prior = input.priorActiveProfile;

    if (prior.manuscript_id !== profile.manuscript_id) {
      return fail(
        "cross_version_conflict",
        "Prior active profile belongs to a different manuscript",
        "awaiting_eic_confirmation",
        profile,
        { activationResult },
      );
    }

    if (prior.status === "active" && prior.profile_id === profile.profile_id) {
      return fail(
        "already_active",
        "Profile is already the active authoritative version",
        "active",
        profile,
        { activationResult },
      );
    }
  }

  const activatedProfile = freezeProfileSections({
    ...profile,
    status: "active",
    activated_at: confirmedAt,
  });

  const transitionCheck = validateActivationTransition(candidateStatusBefore, "active");
  if (!transitionCheck.ok) {
    return fail(
      "invalid_transition",
      transitionCheck.reason,
      profile.status,
      profile,
      { activationResult },
    );
  }

  let priorSuperseded: EditorialProfileV1 | null = null;
  let supersededProfileId: string | null = null;

  if (
    input.priorActiveProfile &&
    input.priorActiveProfile.status === "active" &&
    input.priorActiveProfile.manuscript_id === profile.manuscript_id &&
    input.priorActiveProfile.manuscript_version_id === profile.manuscript_version_id &&
    input.priorActiveProfile.profile_id !== profile.profile_id
  ) {
    priorSuperseded = linkSupersededProfile(input.priorActiveProfile, profile.profile_id);
    supersededProfileId = priorSuperseded.profile_id;
  }

  const confirmation = buildConfirmationRecord({
    confirmationId: input.confirmationId,
    profile: activatedProfile,
    candidateStatusBefore,
    resultingStatus: "active",
    eicIdentity: input.eicIdentity,
    confirmedAt,
    activationResult,
    structuralResult,
    reason: "EIC confirmation passed — profile activated as authoritative version",
    failure: null,
    supersededProfileId,
  });

  return {
    ok: true,
    profile: activatedProfile,
    priorSuperseded,
    confirmation,
  };
}

export {
  buildSectionConfirmations,
  collectProfileConflicts,
  collectProfileUncertainty,
  EIC_CONFIRMATION_SECTION_ORDER,
  validateEvidenceSufficiency,
  validateProvenance,
};
