/**
 * EP-5 — Author-facing Editorial Profile read model.
 * Deterministic transformation from active authoritative profile; no provider calls.
 */

import {
  ACTIVE_AUTHORITATIVE_PROFILE_STATUSES,
  AUTHOR_FACING_CONFIDENCE_LABELS,
  AUTHOR_FACING_CONTROL_STATEMENT,
  AUTHOR_FACING_EVIDENCE_BASIS_LABELS,
  AUTHOR_FACING_PROFILE_OPENING_COPY,
  AUTHOR_FACING_ROADMAP_NOT_GENERATED,
  AUTHOR_FACING_SECTION_ORDER,
  AUTHOR_FACING_SECTION_TITLES,
  AUTHOR_FACING_SPECIALIST_FRAMING,
  DOMAIN_KEY_AUTHOR_LABELS,
  mapProfileConfidenceToAuthorFacing,
} from "./author-facing-contract.ts";
import type {
  AuthorFacingConfidenceSummary,
  AuthorFacingEditorialProfileReadModel,
  AuthorFacingEditorialUnderstanding,
  AuthorFacingEditorialRiskEntry,
  AuthorFacingEvidenceReference,
  AuthorFacingImprovementOpportunity,
  AuthorFacingManuscriptCharacteristic,
  AuthorFacingProtectedAssetEntry,
  AuthorFacingRoadmapPreparation,
  AuthorFacingSectionEnvelope,
  AuthorFacingSpecialistRecommendation,
  AuthorFacingStrengthEntry,
  AuthorFacingWhatHappensNext,
  CreateAuthorFacingEditorialProfileReadModelInput,
  CreateAuthorFacingEditorialProfileReadModelResult,
} from "./author-facing-types.ts";
import {
  validateAuthorFacingEditorialProfileReadModel,
  validateNoExpertKeysInRecommendations,
  validateStrengthTraceability,
} from "./author-facing-validation.ts";
import { EDITORIAL_PROFILE_CONTRACT_VERSION } from "./contract.ts";
import { isStudioEditorialProfileEnabled } from "./feature-flag.ts";
import type {
  EditorialCharacteristicEntry,
  EditorialProfileV1,
  EditorialRiskEntry,
  EmotionalCharacteristicEntry,
  EvidenceEntry,
  ProtectedAssetEntry,
  SpecialistRequirementEntry,
  StoryEngineEntry,
  TechnicalCharacteristicEntry,
} from "./types.ts";
import { hasConflictingEvidence } from "./validation.ts";

function deepFreeze<T extends object>(value: T): T {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) {
      if (nested && typeof nested === "object") deepFreeze(nested as object);
    }
  }
  return Object.freeze(value);
}

function toEvidenceRef(entry: EvidenceEntry): AuthorFacingEvidenceReference {
  return Object.freeze({
    evidence_id: entry.evidence_id,
    locator_label: entry.locator.chapter_label,
    observation: entry.observation,
    excerpt: entry.excerpt ?? null,
    evidence_basis: "manuscript",
    has_contrary_signal: entry.polarity === "contrary",
  });
}

function confidenceLabel(level: ReturnType<typeof mapProfileConfidenceToAuthorFacing>): string {
  return AUTHOR_FACING_CONFIDENCE_LABELS[level];
}

function alignmentSummary(alignment: EditorialProfileV1["story_identity"]["author_framing_alignment"]): string {
  switch (alignment) {
    case "aligned":
      return "What you told me aligns with what the manuscript demonstrates.";
    case "partially_aligned":
      return "What you told me partially aligns with what the manuscript demonstrates.";
    case "divergent":
      return "What you told me differs from what the manuscript currently demonstrates.";
    default:
      return "Alignment between your stated intention and the manuscript is still being assessed.";
  }
}

function destinationLabel(alignment: EditorialProfileV1["roadmap_inputs"]["destination_alignment"]): string {
  switch (alignment) {
    case "strongly_aligned":
      return "Your manuscript appears strongly aligned with your stated editorial destination.";
    case "substantially_aligned":
      return "Your manuscript appears substantially aligned with your stated editorial destination.";
    case "partially_aligned":
      return "Your manuscript is partially aligned with your stated editorial destination.";
    case "materially_misaligned":
      return "There is meaningful distance between your stated destination and what the manuscript currently demonstrates.";
    default:
      return "Destination alignment is being assessed from your goals and the manuscript.";
  }
}

function domainLabel(domainKey: string): string {
  return DOMAIN_KEY_AUTHOR_LABELS[domainKey] ?? domainKey.replace(/_/g, " ");
}

function buildEditorialUnderstanding(
  profile: EditorialProfileV1,
  authorIntentionSummary: string | null,
): AuthorFacingEditorialUnderstanding {
  const primaryEngine = profile.story_engines.find((e) => e.role === "primary");
  const effectiveEmotions = profile.emotional_characteristics.filter(
    (e) => e.execution_quality === "effective",
  );

  const narrativeDrivers = profile.story_engines.map(
    (engine) => `${engine.label}: ${engine.demonstration_summary}`,
  );

  const emotionalExperience = effectiveEmotions.length
    ? effectiveEmotions.map((e) => `${e.label} — ${e.summary}`)
    : profile.emotional_characteristics.map((e) => `${e.label} — ${e.summary}`);

  const alignmentDifferences =
    profile.story_identity.author_framing_alignment !== "aligned" && profile.story_identity.alignment_note
      ? [profile.story_identity.alignment_note]
      : [];

  const uncertaintyNotes: string[] = [];
  if (profile.story_identity.confidence === "low") {
    uncertaintyNotes.push("Story identity classification remains preliminary.");
  }
  if (primaryEngine?.confidence === "low") {
    uncertaintyNotes.push("Primary narrative driver remains preliminary.");
  }
  for (const gap of profile.synthesis_confidence.gaps_affecting_confidence) {
    uncertaintyNotes.push(gap);
  }

  const synthesisNarrative = [
    `On the page, this reads as ${profile.story_identity.primary_identity.label.toLowerCase()}.`,
    primaryEngine
      ? `What keeps the pages turning is ${primaryEngine.label.toLowerCase()} — ${primaryEngine.demonstration_summary.toLowerCase()}.`
      : null,
    effectiveEmotions.length
      ? `The reader experience appears designed to deliver ${effectiveEmotions.map((e) => e.label.toLowerCase()).join(" and ")}.`
      : null,
    alignmentDifferences.length
      ? "Your stated intention and current execution may differ in ways worth discussing."
      : "Your stated intention and what the manuscript demonstrates appear to align.",
  ]
    .filter(Boolean)
    .join(" ");

  return Object.freeze({
    opening_copy: AUTHOR_FACING_PROFILE_OPENING_COPY,
    story_kind: `${profile.story_identity.primary_identity.label} — ${profile.story_identity.primary_identity.demonstration_summary}`,
    narrative_drivers: Object.freeze(narrativeDrivers),
    emotional_experience: Object.freeze(emotionalExperience),
    author_intention_summary: authorIntentionSummary,
    alignment_summary: alignmentSummary(profile.story_identity.author_framing_alignment),
    alignment_differences: Object.freeze(alignmentDifferences),
    synthesis_narrative: synthesisNarrative,
    uncertainty_notes: Object.freeze(uncertaintyNotes),
    manuscript_supported: Object.freeze([
      profile.story_identity.primary_identity.demonstration_summary,
      ...profile.story_engines.map((e) => e.demonstration_summary),
    ]),
    author_stated_intention: Object.freeze(
      authorIntentionSummary ? [authorIntentionSummary] : [],
    ),
    eic_synthesis: Object.freeze([profile.story_identity.identity_rationale]),
    unresolved_differences: Object.freeze(alignmentDifferences),
  });
}

function buildStrengths(profile: EditorialProfileV1): readonly AuthorFacingStrengthEntry[] {
  const protectedIds = new Set(profile.protected_assets.map((a) => a.asset_id));
  const strengthCharacteristics = profile.editorial_characteristics.filter(
    (e) => e.assessment === "strength",
  );

  return Object.freeze(
    strengthCharacteristics.map((entry) => {
      const confidence = mapProfileConfidenceToAuthorFacing(entry.confidence, entry.evidence.length > 0);
      const relatedAsset = profile.protected_assets.find(
        (a) => a.label.toLowerCase().includes(entry.label.toLowerCase()) || a.category === entry.domain,
      );

      return Object.freeze({
        entry_id: entry.characteristic_id,
        statement: entry.label,
        why_it_works: entry.summary,
        evidence: Object.freeze(entry.evidence.map(toEvidenceRef)),
        confidence,
        confidence_label: confidenceLabel(confidence),
        uncertainty_notes: Object.freeze(
          confidence === "limited" ? ["This strength is supported by limited manuscript evidence so far."] : [],
        ),
        source_section: "editorial_characteristics",
        may_become_protected_asset: !relatedAsset && entry.materiality !== "negligible",
        related_protected_asset_id: relatedAsset?.asset_id ?? null,
      });
    }),
  );
}

function buildProtectedAssets(profile: EditorialProfileV1): readonly AuthorFacingProtectedAssetEntry[] {
  return Object.freeze(
    profile.protected_assets.map((asset: ProtectedAssetEntry) => {
      const confidence = mapProfileConfidenceToAuthorFacing(asset.confidence, asset.evidence.length > 0);
      const linkedEngine = asset.linked_engine_id
        ? profile.story_engines.find((e) => e.engine_id === asset.linked_engine_id)
        : null;

      return Object.freeze({
        asset_id: asset.asset_id,
        what_to_protect: asset.label,
        why_it_matters: asset.description,
        evidence: Object.freeze(asset.evidence.map(toEvidenceRef)),
        confidence,
        confidence_label: confidenceLabel(confidence),
        avoid_damaging: `Later editorial work should preserve this ${asset.category} element that supports ${linkedEngine?.label ?? "the manuscript's core appeal"}.`,
        related_characteristic: linkedEngine?.label ?? null,
      });
    }),
  );
}

function buildImprovementOpportunities(
  profile: EditorialProfileV1,
): readonly AuthorFacingImprovementOpportunity[] {
  const editorial = profile.editorial_characteristics.filter((e) =>
    ["developing", "gap"].includes(e.assessment),
  );

  return Object.freeze(
    editorial.map((entry: EditorialCharacteristicEntry) => {
      const confidence = mapProfileConfidenceToAuthorFacing(
        entry.confidence,
        entry.assessment === "developing" || entry.evidence.length > 0,
      );
      const relatedRisks = profile.editorial_risks
        .filter((r) => r.description.toLowerCase().includes(entry.domain))
        .map((r) => r.risk_id);
      const relatedTechnical = profile.technical_characteristics.find(
        (t) => t.specialist_need !== "none" && t.domain_key.includes(entry.domain),
      );

      return Object.freeze({
        entry_id: entry.characteristic_id,
        description: entry.label,
        why_it_matters: entry.summary,
        evidence: Object.freeze(entry.evidence.map(toEvidenceRef)),
        reader_effect:
          entry.assessment === "gap"
            ? "Strengthening this area may improve reader engagement and payoff."
            : "Further development here may sharpen the reader experience.",
        confidence,
        confidence_label: confidenceLabel(confidence),
        uncertainty_notes: Object.freeze(
          confidence === "limited" ? ["This opportunity is noted with limited supporting evidence."] : [],
        ),
        related_protected_asset_ids: Object.freeze(
          profile.protected_assets
            .filter((a) => a.category === entry.domain || a.label.toLowerCase().includes(entry.label.toLowerCase()))
            .map((a) => a.asset_id),
        ),
        related_risk_ids: Object.freeze(relatedRisks),
        may_benefit_from_specialist: Boolean(relatedTechnical),
      });
    }),
  );
}

function buildEditorialRisks(profile: EditorialProfileV1): readonly AuthorFacingEditorialRiskEntry[] {
  return Object.freeze(
    profile.editorial_risks.map((risk: EditorialRiskEntry) => {
      const confidence = mapProfileConfidenceToAuthorFacing(risk.confidence, risk.evidence.length > 0);
      const conflicting = hasConflictingEvidence(risk.evidence);
      const uncertaintyNotes: string[] = [];
      if (confidence === "limited") {
        uncertaintyNotes.push("This risk is noted with limited confidence — it is not yet an established fact.");
      }
      if (conflicting) {
        uncertaintyNotes.push("The independent read found conflicting signals for this risk.");
      }

      return Object.freeze({
        risk_id: risk.risk_id,
        risk_description: risk.label,
        evidence: Object.freeze(risk.evidence.map(toEvidenceRef)),
        why_it_matters: risk.description,
        potential_effect: `${risk.severity} severity with ${risk.likelihood} likelihood — ${risk.mitigation_direction}`,
        confidence,
        confidence_label: confidenceLabel(confidence),
        uncertainty_notes: Object.freeze(uncertaintyNotes),
        conflicting_evidence: conflicting,
        related_protected_asset_ids: Object.freeze([]),
        may_need_specialist_evaluation: Boolean(risk.blocks_specialist_coverage),
      });
    }),
  );
}

function buildManuscriptCharacteristics(
  profile: EditorialProfileV1,
): readonly AuthorFacingManuscriptCharacteristic[] {
  const items: AuthorFacingManuscriptCharacteristic[] = [];

  items.push(
    Object.freeze({
      characteristic_id: "si-primary",
      name: profile.story_identity.primary_identity.label,
      interpretation: profile.story_identity.primary_identity.demonstration_summary,
      why_it_matters: "Story identity shapes editorial expectations and market positioning.",
      evidence: Object.freeze(profile.story_identity.evidence.map(toEvidenceRef)),
      confidence: mapProfileConfidenceToAuthorFacing(
        profile.story_identity.confidence,
        profile.story_identity.evidence.length > 0,
      ),
      confidence_label: confidenceLabel(
        mapProfileConfidenceToAuthorFacing(
          profile.story_identity.confidence,
          profile.story_identity.evidence.length > 0,
        ),
      ),
      uncertainty_notes: Object.freeze(
        profile.story_identity.confidence === "low" ? ["Story identity remains preliminary."] : [],
      ),
      interpretation_mode: "demonstrated",
      category: "story_identity",
    }),
  );

  for (const engine of profile.story_engines) {
    items.push(
      Object.freeze({
        characteristic_id: engine.engine_id,
        name: engine.label,
        interpretation: engine.demonstration_summary,
        why_it_matters: `This ${engine.role} narrative engine drives reader engagement.`,
        evidence: Object.freeze(engine.evidence.map(toEvidenceRef)),
        confidence: mapProfileConfidenceToAuthorFacing(engine.confidence, engine.evidence.length > 0),
        confidence_label: confidenceLabel(
          mapProfileConfidenceToAuthorFacing(engine.confidence, engine.evidence.length > 0),
        ),
        uncertainty_notes: Object.freeze(
          engine.confidence === "low" ? ["This engine identification remains preliminary."] : [],
        ),
        interpretation_mode: "demonstrated",
        category: "story_engine",
      }),
    );
  }

  for (const entry of profile.editorial_characteristics) {
    items.push(
      Object.freeze({
        characteristic_id: entry.characteristic_id,
        name: entry.label,
        interpretation: entry.summary,
        why_it_matters: `Editorial assessment in ${entry.domain}.`,
        evidence: Object.freeze(entry.evidence.map(toEvidenceRef)),
        confidence: mapProfileConfidenceToAuthorFacing(
          entry.confidence,
          entry.assessment === "developing" || entry.evidence.length > 0,
        ),
        confidence_label: confidenceLabel(
          mapProfileConfidenceToAuthorFacing(
            entry.confidence,
            entry.assessment === "developing" || entry.evidence.length > 0,
          ),
        ),
        uncertainty_notes: Object.freeze(
          entry.confidence === "low" ? ["This craft assessment remains preliminary."] : [],
        ),
        interpretation_mode: entry.assessment === "strength" ? "evaluative" : "descriptive",
        category: "editorial",
      }),
    );
  }

  for (const entry of profile.technical_characteristics) {
    items.push(
      Object.freeze({
        characteristic_id: entry.technical_id,
        name: domainLabel(entry.domain_key),
        interpretation: entry.observation,
        why_it_matters: "Technical accuracy needs may affect specialist support planning.",
        evidence: Object.freeze(entry.evidence.map(toEvidenceRef)),
        confidence: mapProfileConfidenceToAuthorFacing(entry.confidence, entry.evidence.length > 0),
        confidence_label: confidenceLabel(
          mapProfileConfidenceToAuthorFacing(entry.confidence, entry.evidence.length > 0),
        ),
        uncertainty_notes: Object.freeze(
          entry.confidence === "low" ? ["Technical assessment remains preliminary."] : [],
        ),
        interpretation_mode: "demonstrated",
        category: "technical",
      }),
    );
  }

  for (const entry of profile.emotional_characteristics) {
    items.push(
      Object.freeze({
        characteristic_id: entry.emotional_id,
        name: entry.label,
        interpretation: entry.summary,
        why_it_matters: "Emotional delivery shapes reader experience.",
        evidence: Object.freeze(entry.evidence.map(toEvidenceRef)),
        confidence: mapProfileConfidenceToAuthorFacing(
          entry.confidence,
          entry.execution_quality === "not_assessable" || entry.evidence.length > 0,
        ),
        confidence_label: confidenceLabel(
          mapProfileConfidenceToAuthorFacing(
            entry.confidence,
            entry.execution_quality === "not_assessable" || entry.evidence.length > 0,
          ),
        ),
        uncertainty_notes: Object.freeze(
          entry.execution_quality === "not_assessable" ? ["Emotional execution not yet fully assessable."] : [],
        ),
        interpretation_mode: entry.execution_quality === "not_assessable" ? "inferred" : "evaluative",
        category: "emotional",
      }),
    );
  }

  const commercial = profile.commercial_characteristics;
  items.push(
    Object.freeze({
      characteristic_id: "commercial-preliminary",
      name: "Commercial positioning (preliminary)",
      interpretation: `${commercial.market_lane_rationale} Hook strength: ${commercial.hook_strength.replace(/_/g, " ")}.`,
      why_it_matters: "Pre-expert commercial signals inform distance to your stated destination — not a final market verdict.",
      evidence: Object.freeze(commercial.hook_evidence.map(toEvidenceRef)),
      confidence: mapProfileConfidenceToAuthorFacing(
        commercial.confidence,
        commercial.hook_evidence.length > 0,
      ),
      confidence_label: confidenceLabel(
        mapProfileConfidenceToAuthorFacing(commercial.confidence, commercial.hook_evidence.length > 0),
      ),
      uncertainty_notes: Object.freeze([
        "Commercial assessment is preliminary until after structural editorial work and specialist input.",
      ]),
      interpretation_mode: "preliminary",
      category: "commercial",
    }),
  );

  return Object.freeze(items);
}

function buildSpecialistRecommendations(
  profile: EditorialProfileV1,
): readonly AuthorFacingSpecialistRecommendation[] {
  const activeRequirements = profile.specialist_requirements.filter((r) => r.requirement_level !== "none");

  return Object.freeze(
    activeRequirements.map((req: SpecialistRequirementEntry) => {
      const confidence = mapProfileConfidenceToAuthorFacing(req.confidence, req.driving_characteristics.length > 0);
      const sequencingHint = profile.roadmap_inputs.sequencing_hints.find((h) =>
        h.rationale.toLowerCase().includes(req.domain_key.replace(/_/g, " ")),
      );

      return Object.freeze({
        recommendation_id: req.requirement_id,
        demonstrated_need: req.justification,
        capability_area: domainLabel(req.domain_key),
        why_it_may_help: `${AUTHOR_FACING_SPECIALIST_FRAMING} ${req.evidence_summary}`,
        evidence_summary: req.evidence_summary,
        confidence,
        confidence_label: confidenceLabel(confidence),
        uncertainty_notes: Object.freeze(
          confidence === "limited" ? ["Specialist need remains preliminary pending further review."] : [],
        ),
        suggested_timing: sequencingHint?.rationale ?? null,
        related_protected_asset_ids: Object.freeze(profile.roadmap_inputs.top_protected_asset_ids),
        related_opportunity_ids: Object.freeze(req.driving_characteristics),
        related_risk_ids: Object.freeze(profile.roadmap_inputs.top_editorial_risk_ids),
        specialist_not_activated: true as const,
        manuscript_sharing_not_authorized: true as const,
      });
    }),
  );
}

function buildRoadmapPreparation(profile: EditorialProfileV1): AuthorFacingRoadmapPreparation {
  const overall = mapProfileConfidenceToAuthorFacing(
    profile.synthesis_confidence.overall_confidence,
    profile.synthesis_confidence.independent_read_coverage >= 60,
  );

  return Object.freeze({
    likely_destination: destinationLabel(profile.roadmap_inputs.destination_alignment),
    current_editorial_position: `${AUTHOR_FACING_ROADMAP_NOT_GENERATED} ${profile.roadmap_inputs.alignment_source ? `Alignment source: ${AUTHOR_FACING_EVIDENCE_BASIS_LABELS.alignment_comparison}.` : ""}`.trim(),
    protected_strengths: Object.freeze(
      profile.protected_assets.map((a) => a.label),
    ),
    principal_improvement_areas: Object.freeze(
      profile.editorial_characteristics
        .filter((e) => ["developing", "gap", "risk"].includes(e.assessment))
        .map((e) => e.label),
    ),
    possible_sequencing: Object.freeze(
      profile.roadmap_inputs.sequencing_hints.map((h) => h.rationale),
    ),
    readiness_considerations: Object.freeze(
      profile.roadmap_inputs.readiness_input_signals.map((s) => s.signal_key.replace(/_/g, " ")),
    ),
    confidence: overall,
    confidence_label: confidenceLabel(overall),
    unresolved_questions: Object.freeze(profile.synthesis_confidence.gaps_affecting_confidence),
    roadmap_generated: false as const,
    no_final_next_best_action: true as const,
  });
}

function buildConfidenceSummary(profile: EditorialProfileV1): AuthorFacingConfidenceSummary {
  const overall = mapProfileConfidenceToAuthorFacing(
    profile.synthesis_confidence.overall_confidence,
    profile.synthesis_confidence.independent_read_coverage >= 60,
  );

  const uncertaintyExplanations: string[] = [];
  if (profile.synthesis_confidence.evidence_depth === "thin") {
    uncertaintyExplanations.push("The manuscript provides limited evidence in some areas.");
  }
  if (profile.story_identity.author_framing_alignment === "divergent") {
    uncertaintyExplanations.push("Your intention and current execution differ in ways that affect confidence.");
  }
  if (profile.synthesis_confidence.sections_at_low_confidence.length > 0) {
    uncertaintyExplanations.push(
      `Several areas remain at limited confidence: ${profile.synthesis_confidence.sections_at_low_confidence.join(", ")}.`,
    );
  }
  for (const gap of profile.synthesis_confidence.gaps_affecting_confidence) {
    uncertaintyExplanations.push(gap);
  }

  const conflicts: string[] = [];
  if (hasConflictingEvidence(profile.story_identity.evidence)) {
    conflicts.push("Story identity evidence includes conflicting signals.");
  }
  for (const engine of profile.story_engines) {
    if (hasConflictingEvidence(engine.evidence)) {
      conflicts.push(`${engine.label} evidence includes conflicting signals.`);
    }
  }
  for (const risk of profile.editorial_risks) {
    if (hasConflictingEvidence(risk.evidence)) {
      conflicts.push(`${risk.label} evidence includes conflicting signals.`);
    }
  }

  return Object.freeze({
    overall_confidence: overall,
    overall_confidence_label: confidenceLabel(overall),
    read_coverage_note: `Independent read coverage: ${profile.synthesis_confidence.independent_read_coverage}% (${profile.synthesis_confidence.evidence_depth} evidence depth).`,
    evidence_depth_note: `Evidence depth is ${profile.synthesis_confidence.evidence_depth}.`,
    sections_with_limited_confidence: Object.freeze(
      profile.synthesis_confidence.sections_at_low_confidence,
    ),
    gaps_affecting_confidence: Object.freeze(profile.synthesis_confidence.gaps_affecting_confidence),
    uncertainty_explanations: Object.freeze(uncertaintyExplanations),
    unresolved_conflicts: Object.freeze(conflicts),
  });
}

function buildWhatHappensNext(): AuthorFacingWhatHappensNext {
  return Object.freeze({
    summary:
      "This profile represents my current authoritative understanding of your manuscript. No specialist has been activated, no manuscript has been shared, and recommendations remain recommendations until you choose otherwise.",
    no_specialist_activated: true as const,
    no_manuscript_shared: true as const,
    recommendations_are_recommendations: true as const,
    author_retains_final_authority: true as const,
    roadmap_is_later_step: true as const,
    author_control_statement: AUTHOR_FACING_CONTROL_STATEMENT,
  });
}

function buildSections(model: Omit<AuthorFacingEditorialProfileReadModel, "sections">): readonly AuthorFacingSectionEnvelope<unknown>[] {
  const contentByKey: Record<(typeof AUTHOR_FACING_SECTION_ORDER)[number], unknown> = {
    editorial_understanding: model.editorial_understanding,
    what_is_working: model.what_is_working,
    protected_assets: model.protected_assets,
    improvement_opportunities: model.improvement_opportunities,
    editorial_risks: model.editorial_risks,
    manuscript_characteristics: model.manuscript_characteristics,
    recommended_specialist_support: model.recommended_specialist_support,
    roadmap_preparation: model.roadmap_preparation,
    confidence_and_uncertainty: model.confidence_and_uncertainty,
    what_happens_next: model.what_happens_next,
  };

  return Object.freeze(
    AUTHOR_FACING_SECTION_ORDER.map((sectionKey, index) =>
      Object.freeze({
        section_key: sectionKey,
        display_order: index + 1,
        title: AUTHOR_FACING_SECTION_TITLES[sectionKey],
        content: contentByKey[sectionKey],
      }),
    ),
  );
}

function isActiveAuthoritativeProfile(profile: EditorialProfileV1): boolean {
  return (ACTIVE_AUTHORITATIVE_PROFILE_STATUSES as readonly string[]).includes(profile.status);
}

export function transformActiveProfileToAuthorFacingReadModel(
  profile: EditorialProfileV1,
  options: {
    presentationTimestamp: string;
    authorIntentionSummary?: string | null;
  },
): AuthorFacingEditorialProfileReadModel {
  const editorialUnderstanding = buildEditorialUnderstanding(profile, options.authorIntentionSummary ?? null);
  const whatIsWorking = buildStrengths(profile);
  const protectedAssets = buildProtectedAssets(profile);
  const improvementOpportunities = buildImprovementOpportunities(profile);
  const editorialRisks = buildEditorialRisks(profile);
  const manuscriptCharacteristics = buildManuscriptCharacteristics(profile);
  const recommendedSpecialistSupport = buildSpecialistRecommendations(profile);
  const roadmapPreparation = buildRoadmapPreparation(profile);
  const confidenceAndUncertainty = buildConfidenceSummary(profile);
  const whatHappensNext = buildWhatHappensNext();

  const partial: Omit<AuthorFacingEditorialProfileReadModel, "sections"> = {
    contract_version: EDITORIAL_PROFILE_CONTRACT_VERSION,
    read_model_kind: "author_facing_editorial_profile",
    profile_id: profile.profile_id,
    manuscript_id: profile.manuscript_id,
    manuscript_version_id: profile.manuscript_version_id,
    is_active_authoritative: true,
    source_profile_status: profile.status as "active" | "updated",
    source_generated_at: profile.generated_at,
    source_activated_at: profile.activated_at ?? null,
    presentation_timestamp: options.presentationTimestamp,
    provenance: Object.freeze({
      author_intent_id: profile.author_intent_id,
      independent_read_id: profile.independent_read_id,
      editorial_understanding_id: profile.editorial_understanding_id ?? null,
      manuscript_brief_id: profile.manuscript_brief_id ?? null,
    }),
    editorial_understanding: editorialUnderstanding,
    what_is_working: whatIsWorking,
    protected_assets: protectedAssets,
    improvement_opportunities: improvementOpportunities,
    editorial_risks: editorialRisks,
    manuscript_characteristics: manuscriptCharacteristics,
    recommended_specialist_support: recommendedSpecialistSupport,
    roadmap_preparation: roadmapPreparation,
    confidence_and_uncertainty: confidenceAndUncertainty,
    what_happens_next: whatHappensNext,
    capability_status: Object.freeze({
      specialists_executed: false as const,
      manuscript_sharing_granted: false as const,
      roadmap_generated: false as const,
      grade_assigned: false as const,
    }),
    author_control_statement: AUTHOR_FACING_CONTROL_STATEMENT,
  };

  const readModel = deepFreeze({
    ...partial,
    sections: buildSections(partial),
  });

  return readModel;
}

export function createAuthorFacingEditorialProfileReadModel(
  input: CreateAuthorFacingEditorialProfileReadModelInput,
): CreateAuthorFacingEditorialProfileReadModelResult {
  if (!isStudioEditorialProfileEnabled()) {
    return {
      ok: false,
      code: "feature_flag_disabled",
      message: "Author-facing editorial profile is unavailable (feature flag disabled)",
    };
  }

  if (!input.profile) {
    return {
      ok: false,
      code: "missing_profile",
      message: "Active editorial profile is required",
    };
  }

  const profile = input.profile;

  if (!isActiveAuthoritativeProfile(profile)) {
    return {
      ok: false,
      code: "non_active_profile",
      message: `Author-facing read model requires active authoritative profile (got ${profile.status})`,
    };
  }

  if (profile.manuscript_id !== input.expectedManuscriptId) {
    return {
      ok: false,
      code: "manuscript_mismatch",
      message: "Profile manuscript_id does not match expected manuscript",
    };
  }

  if (profile.manuscript_version_id !== input.expectedManuscriptVersionId) {
    return {
      ok: false,
      code: "version_mismatch",
      message: "Profile manuscript_version_id does not match expected version",
    };
  }

  if (!profile.author_intent_id?.trim() || !profile.independent_read_id?.trim()) {
    return {
      ok: false,
      code: "missing_provenance",
      message: "Profile requires author_intent_id and independent_read_id for author-facing presentation",
    };
  }

  const presentationTimestamp = input.presentationTimestamp ?? new Date().toISOString();

  const readModel = transformActiveProfileToAuthorFacingReadModel(profile, {
    presentationTimestamp,
    authorIntentionSummary: input.authorIntentionSummary,
  });

  const validation = validateAuthorFacingEditorialProfileReadModel(readModel);
  if (!validation.ok) {
    return {
      ok: false,
      code: "presentation_validation_failed",
      message: validation.errors.map((e) => e.message).join("; "),
      validation,
    };
  }

  const strengthValidation = validateStrengthTraceability(readModel.what_is_working);
  if (!strengthValidation.ok) {
    return {
      ok: false,
      code: "presentation_validation_failed",
      message: strengthValidation.errors.map((e) => e.message).join("; "),
      validation: strengthValidation,
    };
  }

  const expertValidation = validateNoExpertKeysInRecommendations(
    readModel.recommended_specialist_support,
    profile.specialist_requirements,
  );
  if (!expertValidation.ok) {
    return {
      ok: false,
      code: "presentation_validation_failed",
      message: expertValidation.errors.map((e) => e.message).join("; "),
      validation: expertValidation,
    };
  }

  return { ok: true, readModel };
}

export {
  ACTIVE_AUTHORITATIVE_PROFILE_STATUSES,
  AUTHOR_FACING_SECTION_ORDER,
  buildEditorialUnderstanding,
  buildStrengths,
  isActiveAuthoritativeProfile,
};
