/**
 * EP-2 — Independent Read → Editorial Profile candidate synthesis.
 * Deterministic orchestration only; no provider calls, activation, or specialist access.
 */

import type { AuthorIntentRecord } from "@/lib/author-intent/types.ts";
import type { EditorialUnderstandingRecord } from "@/lib/editorial-understanding/types.ts";
import {
  EIC_INDEPENDENT_READ_CONTRACT_VERSION,
  MIN_INDEPENDENT_READ_COVERAGE_FOR_SYNTHESIS,
} from "@/lib/eic-independent-read/contract.ts";
import type {
  EicIndependentReadV1,
  IndependentReadEvidence,
} from "@/lib/eic-independent-read/types.ts";
import {
  COMMERCIAL_ASSESSMENT_SCOPES,
  EDITORIAL_PROFILE_CONTRACT_VERSION,
  MAJOR_EVALUATED_DOMAINS,
  MAX_COMMERCIAL_CONFIDENCE,
  type AuthorFramingAlignment,
  type EditorialProfileStatus,
  type IntentModifier,
  type ProfileConfidenceLevel,
  type RequirementLevel,
} from "./contract.ts";
import { isEditorialProfileSynthesisAllowed } from "./feature-flag.ts";
import {
  canTransitionEditorialProfileStatus,
  validateEditorialProfileStatusTransition,
} from "./lifecycle.ts";
import type {
  EditorialProfileV1,
  EditorialProfileValidationResult,
  EvidenceEntry,
  ManuscriptLocator,
} from "./types.ts";
import {
  computeAggregateConfidence,
  detectProhibitedInputs,
  validateEditorialProfileContract,
  validateForActivation,
  validateForDraft,
} from "./validation.ts";
import { freezeProfileSections } from "./versioning.ts";

export type ProfileSynthesisFramingEvidence = {
  readonly author_intent_id: string;
  readonly author_intent_type: string;
  readonly author_success_definition: string;
  readonly priority_domains: readonly string[];
  readonly editorial_understanding_id?: string | null;
  readonly understanding_market_position?: string | null;
  readonly understanding_primary_vision?: string | null;
  readonly manuscript_brief_id?: string | null;
};

export type BoundedEicSynthesisInput = {
  readonly independent_read_id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly coverage_percent: number;
  readonly framing: ProfileSynthesisFramingEvidence;
  readonly read: EicIndependentReadV1;
};

export type CreateProfileCandidateInput = {
  readonly profileId: string;
  readonly independentRead: EicIndependentReadV1;
  readonly authorIntent: AuthorIntentRecord;
  readonly editorialUnderstanding?: EditorialUnderstandingRecord | null;
  readonly manuscriptBriefId?: string | null;
  readonly generatedAt?: string;
  readonly priorStatus?: EditorialProfileStatus;
};

export type ProfileCandidateFailureCode =
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
  | "specialist_access_violation"
  | "prohibited_input"
  | "validation_failed"
  | "invalid_transition";

export type ProfileCandidateResult =
  | {
      readonly ok: true;
      readonly profile: EditorialProfileV1;
      readonly status: EditorialProfileStatus;
      readonly validation: EditorialProfileValidationResult;
      readonly synthesisInput: BoundedEicSynthesisInput;
    }
  | {
      readonly ok: false;
      readonly code: ProfileCandidateFailureCode;
      readonly message: string;
      readonly status: EditorialProfileStatus;
      readonly validation?: EditorialProfileValidationResult;
    };

const NON_ACTIVE_TERMINAL_STATUSES: readonly EditorialProfileStatus[] = [
  "draft",
  "incomplete_evidence",
  "awaiting_eic_confirmation",
  "blocked",
  "failed",
];

function toManuscriptLocator(locator: IndependentReadEvidence["locator"]): ManuscriptLocator {
  return {
    chapter_id: locator.chapter_id ?? null,
    chapter_label: locator.chapter_label,
    scene_id: locator.scene_id ?? null,
    paragraph_range: locator.paragraph_range ?? null,
    word_offset_start: locator.word_offset_start ?? null,
    word_offset_end: locator.word_offset_end ?? null,
  };
}

function mapReadEvidence(evidence: readonly IndependentReadEvidence[]): EvidenceEntry[] {
  return evidence.map((e) => ({
    evidence_id: e.evidence_id,
    locator: toManuscriptLocator(e.locator),
    excerpt: e.excerpt ?? null,
    observation: e.observation,
    polarity: e.polarity,
    source: "manuscript" as const,
  }));
}

function readHasGroundedEvidence(read: EicIndependentReadV1): boolean {
  const identityGrounded =
    read.story_identity.evidence.length > 0 &&
    read.story_identity.evidence.every(
      (e) => e.grounded_in_manuscript === true && e.source === "manuscript",
    );

  if (!identityGrounded) return false;

  const engineGrounded = read.story_engines.some(
    (engine) =>
      engine.evidence.length > 0 &&
      engine.evidence.every(
        (e) => e.grounded_in_manuscript === true && e.source === "manuscript",
      ),
  );

  return engineGrounded;
}

export function buildFramingEvidence(input: {
  authorIntent: AuthorIntentRecord;
  editorialUnderstanding?: EditorialUnderstandingRecord | null;
  manuscriptBriefId?: string | null;
}): ProfileSynthesisFramingEvidence {
  return Object.freeze({
    author_intent_id: input.authorIntent.id,
    author_intent_type: input.authorIntent.intent_type,
    author_success_definition: input.authorIntent.author_success_definition,
    priority_domains: [...input.authorIntent.priority_domains],
    editorial_understanding_id: input.editorialUnderstanding?.understanding_id ?? null,
    understanding_market_position: input.editorialUnderstanding?.market_position ?? null,
    understanding_primary_vision: input.editorialUnderstanding?.primary_vision ?? null,
    manuscript_brief_id: input.manuscriptBriefId ?? null,
  });
}

export function buildBoundedSynthesisInput(input: {
  independentRead: EicIndependentReadV1;
  authorIntent: AuthorIntentRecord;
  editorialUnderstanding?: EditorialUnderstandingRecord | null;
  manuscriptBriefId?: string | null;
}): BoundedEicSynthesisInput {
  return Object.freeze({
    independent_read_id: input.independentRead.independent_read_id,
    manuscript_id: input.independentRead.manuscript_id,
    manuscript_version_id: input.independentRead.manuscript_version_id,
    coverage_percent: input.independentRead.coverage_percent,
    framing: buildFramingEvidence(input),
    read: input.independentRead,
  });
}

function inferAuthorFramingAlignment(input: {
  read: EicIndependentReadV1;
  framing: ProfileSynthesisFramingEvidence;
}): { alignment: AuthorFramingAlignment; note: string | null } {
  const authorMarket =
    input.framing.understanding_market_position?.trim().toLowerCase() ?? "";
  const authorComp =
    input.read.commercial_signals.author_market_framing?.trim().toLowerCase() ?? "";
  const demonstratedIdentity = input.read.story_identity.identity_key.toString().toLowerCase();

  if (!authorMarket && !authorComp) {
    return { alignment: "aligned", note: null };
  }

  const authorTokens = `${authorMarket} ${authorComp}`.split(/\s+/).filter(Boolean);
  const matchesDemonstrated = authorTokens.some(
    (token) => demonstratedIdentity.includes(token) || token.includes(demonstratedIdentity),
  );

  if (matchesDemonstrated) {
    return { alignment: "aligned", note: null };
  }

  if (authorMarket || authorComp) {
    const noteParts = [
      authorMarket ? `Author market framing: "${input.framing.understanding_market_position}"` : null,
      authorComp ? `Author comp framing: "${input.read.commercial_signals.author_market_framing}"` : null,
      `Demonstrated identity: ${input.read.story_identity.label}`,
    ].filter(Boolean);
    return {
      alignment: "divergent",
      note: noteParts.join("; "),
    };
  }

  return { alignment: "partially_aligned", note: "Limited author framing available for comparison" };
}

function inferIntentModifier(
  domainKey: string,
  framing: ProfileSynthesisFramingEvidence,
  baseLevel: RequirementLevel,
): IntentModifier {
  if (baseLevel === "none") return "not_applicable";
  const priority = framing.priority_domains.map((d) => d.toLowerCase());
  const domain = domainKey.toLowerCase();
  const intentType = framing.author_intent_type.toLowerCase();

  if (
    priority.some((p) => domain.includes(p) || p.includes(domain)) ||
    (intentType.includes("military") && domain.includes("military")) ||
    (intentType.includes("medical") && domain.includes("medicine")) ||
    (intentType.includes("financial") && domain.includes("financial"))
  ) {
    return "elevates";
  }
  return "neutral";
}

function buildSpecialistRequirements(
  read: EicIndependentReadV1,
  framing: ProfileSynthesisFramingEvidence,
): EditorialProfileV1["specialist_requirements"] {
  const fromTechnical = read.technical_characteristics.map((tc) => ({
    requirement_id: `sr-${tc.technical_id}`,
    domain_key: tc.domain_key,
    requirement_level: mapSpecialistNeedToRequirement(tc.specialist_need),
    justification: tc.specialist_need_rationale,
    driving_characteristics: [tc.technical_id],
    evidence_summary: tc.observation,
    confidence: tc.confidence,
    author_intent_modifier: inferIntentModifier(
      String(tc.domain_key),
      framing,
      mapSpecialistNeedToRequirement(tc.specialist_need),
    ),
    publication_state_modifier: "neutral" as const,
    series_context_modifier: "not_applicable" as const,
  }));

  const coveredDomains = new Set(fromTechnical.map((r) => String(r.domain_key)));

  const noneEntries = MAJOR_EVALUATED_DOMAINS.filter((d) => !coveredDomains.has(d)).map(
    (domainKey) => ({
      requirement_id: `sr-none-${domainKey}`,
      domain_key: domainKey,
      requirement_level: "none" as const,
      justification: `No demonstrated ${domainKey.replace(/_/g, " ")} content in independent read coverage`,
      driving_characteristics: [] as readonly string[],
      evidence_summary: "Evaluated — no on-page signals in read coverage",
      confidence: "high" as const,
      author_intent_modifier: "not_applicable" as const,
      publication_state_modifier: "neutral" as const,
      series_context_modifier: "not_applicable" as const,
    }),
  );

  return [...fromTechnical, ...noneEntries];
}

function mapSpecialistNeedToRequirement(need: string): RequirementLevel {
  switch (need) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    default:
      return "none";
  }
}

function capCommercialConfidence(level: ProfileConfidenceLevel): ProfileConfidenceLevel {
  const order: ProfileConfidenceLevel[] = ["low", "medium", "high"];
  const maxIdx = order.indexOf(MAX_COMMERCIAL_CONFIDENCE);
  return order[Math.min(order.indexOf(level), maxIdx)] ?? "medium";
}

function resolveCandidateStatus(
  profile: EditorialProfileV1,
): EditorialProfileStatus {
  const prohibited = detectProhibitedInputs(profile);
  if (prohibited.length > 0) return "failed";

  const draftResult = validateForDraft(profile);
  if (!draftResult.ok) return "failed";

  const activationResult = validateForActivation(profile);
  if (activationResult.ok) return "awaiting_eic_confirmation";

  return "incomplete_evidence";
}

function assertNonActiveStatus(status: EditorialProfileStatus): void {
  if (status === "active" || status === "updated" || status === "superseded") {
    throw new Error(`Profile candidate synthesis must not end in active status (got ${status})`);
  }
  if (!(NON_ACTIVE_TERMINAL_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Profile candidate synthesis ended in unexpected status: ${status}`);
  }
}

export function synthesizeProfileFromBoundedInput(input: {
  profileId: string;
  synthesisInput: BoundedEicSynthesisInput;
  generatedAt: string;
}): EditorialProfileV1 {
  const { read, framing } = input.synthesisInput;
  const alignment = inferAuthorFramingAlignment({ read, framing });

  const storyIdentityEvidence = mapReadEvidence(read.story_identity.evidence);

  const profile: EditorialProfileV1 = {
    contract_version: EDITORIAL_PROFILE_CONTRACT_VERSION,
    profile_id: input.profileId,
    manuscript_id: read.manuscript_id,
    manuscript_version_id: read.manuscript_version_id,
    author_intent_id: framing.author_intent_id,
    independent_read_id: read.independent_read_id,
    editorial_understanding_id: framing.editorial_understanding_id ?? null,
    manuscript_brief_id: framing.manuscript_brief_id ?? null,
    status: "generating",
    dispute_metadata: null,
    supersedes_profile_id: null,
    superseded_by_profile_id: null,
    generated_at: input.generatedAt,
    activated_at: null,
    trigger_event: "independent_read_complete",
    synthesis_confidence: {
      overall_confidence: "medium",
      independent_read_coverage: read.coverage_percent,
      sections_at_low_confidence: [],
      evidence_depth: "adequate",
      gaps_affecting_confidence: [],
    },
    story_identity: {
      primary_identity: {
        identity_key: read.story_identity.identity_key,
        label: read.story_identity.label,
        demonstration_summary: read.story_identity.demonstration_summary,
      },
      secondary_identities: (read.story_identity.secondary_identities ?? []).map((s) => ({
        identity_key: s.identity_key,
        label: s.label,
        demonstration_summary: s.demonstration_summary,
      })),
      identity_rationale: `EIC synthesis from independent read observations for ${read.story_identity.label}`,
      evidence: storyIdentityEvidence,
      confidence: read.story_identity.confidence,
      author_framing_alignment: alignment.alignment,
      alignment_note: alignment.note,
    },
    story_engines: read.story_engines.map((engine) => ({
      engine_id: engine.engine_id,
      engine_key: engine.engine_key,
      label: engine.label,
      role: engine.role,
      demonstration_summary: engine.demonstration_summary,
      evidence: mapReadEvidence(engine.evidence),
      confidence: engine.confidence,
      materiality: engine.materiality,
    })),
    editorial_characteristics: read.editorial_characteristics.map((entry) => ({
      characteristic_id: entry.characteristic_id,
      domain: entry.domain,
      label: entry.label,
      assessment: entry.assessment,
      summary: entry.summary,
      evidence: mapReadEvidence(entry.evidence),
      confidence: entry.confidence,
      materiality: entry.materiality,
    })),
    technical_characteristics: read.technical_characteristics.map((entry) => ({
      technical_id: entry.technical_id,
      domain_key: entry.domain_key,
      label: entry.label,
      observation: entry.observation,
      materiality: entry.materiality,
      confidence: entry.confidence,
      evidence: mapReadEvidence(entry.evidence),
      specialist_need: entry.specialist_need,
      specialist_need_rationale: entry.specialist_need_rationale,
    })),
    emotional_characteristics: read.emotional_characteristics.map((entry) => ({
      emotional_id: entry.emotional_id,
      emotion_key: entry.emotion_key,
      label: entry.label,
      intensity: entry.intensity,
      execution_quality: entry.execution_quality,
      summary: entry.summary,
      evidence: mapReadEvidence(entry.evidence),
      confidence: entry.confidence,
      materiality: entry.materiality,
    })),
    protected_assets: read.protected_assets.map((asset) => ({
      asset_id: asset.asset_id,
      category: asset.category,
      label: asset.label,
      description: asset.description,
      evidence: mapReadEvidence(asset.evidence),
      protection_level: asset.protection_level,
      linked_engine_id: asset.linked_engine_id ?? null,
      linked_emotional_id: asset.linked_emotional_id ?? null,
      confidence: asset.confidence,
    })),
    editorial_risks: read.editorial_risks.map((risk) => ({
      risk_id: risk.risk_id,
      label: risk.label,
      description: risk.description,
      severity: risk.severity,
      likelihood: risk.likelihood,
      materiality: risk.materiality,
      evidence: mapReadEvidence(risk.evidence),
      confidence: risk.confidence,
      mitigation_direction: risk.mitigation_direction,
      blocks_specialist_coverage: risk.blocks_specialist_coverage ?? null,
    })),
    specialist_requirements: buildSpecialistRequirements(read, framing),
    commercial_characteristics: {
      commercial_assessment_scope: COMMERCIAL_ASSESSMENT_SCOPES[0],
      hook_strength: read.commercial_signals.hook_strength,
      hook_evidence: mapReadEvidence(read.commercial_signals.hook_evidence),
      comp_alignment_signals: [],
      market_lane_fit: read.commercial_signals.market_lane_fit,
      market_lane_rationale: read.commercial_signals.market_lane_rationale,
      differentiation_signals: [...read.commercial_signals.differentiation_signals],
      commercial_risks: [...read.commercial_signals.commercial_risks],
      readiness_signal: read.commercial_signals.readiness_signal,
      confidence: capCommercialConfidence(read.commercial_signals.confidence),
      author_market_framing_alignment: alignment.alignment,
    },
    roadmap_inputs: {
      destination_alignment:
        read.vision_alignment?.destination_alignment ?? "substantially_aligned",
      alignment_source: read.vision_alignment?.alignment_source ?? "independent_read",
      primary_story_identity_key: String(read.story_identity.identity_key),
      primary_engine_key: String(read.story_engines.find((e) => e.role === "primary")?.engine_key ?? ""),
      top_protected_asset_ids: read.protected_assets.slice(0, 3).map((a) => a.asset_id),
      top_editorial_risk_ids: read.editorial_risks.slice(0, 3).map((r) => r.risk_id),
      specialist_requirements_summary: buildSpecialistRequirements(read, framing)
        .filter((r) => r.requirement_level !== "none")
        .map((r, idx) => ({
          domain_key: String(r.domain_key),
          requirement_level: r.requirement_level,
          priority_rank: idx + 1,
        })),
      distance_input_signals: [],
      readiness_input_signals: [],
      sequencing_hints: [],
      roi_hints: [],
      next_action_hints: [],
      regression_risk: "medium",
      coverage_completeness: read.coverage_percent,
    },
    provenance: {
      author_intent_id: framing.author_intent_id,
      independent_read_id: read.independent_read_id,
      editorial_understanding_id: framing.editorial_understanding_id ?? null,
      manuscript_brief_id: framing.manuscript_brief_id ?? null,
      synthesis_timestamp: input.generatedAt,
      independent_read_coverage: read.coverage_percent,
      specialist_manuscript_access_count: 0,
    },
    is_expert_finding: false,
    is_manuscript_evidence: false,
    is_author_intent: false,
  };

  const withConfidence = {
    ...profile,
    synthesis_confidence: computeAggregateConfidence(profile),
  };

  return freezeProfileSections(withConfidence);
}

export function validateIndependentReadForSynthesis(
  read: EicIndependentReadV1 | null | undefined,
  expected: { manuscriptId: string; manuscriptVersionId: string },
):
  | { ok: true }
  | { ok: false; code: ProfileCandidateFailureCode; message: string } {
  if (!read) {
    return { ok: false, code: "read_missing", message: "Independent read artifact is required" };
  }

  if (read.contract_version !== EIC_INDEPENDENT_READ_CONTRACT_VERSION) {
    return {
      ok: false,
      code: "read_unverifiable",
      message: "Independent read contract version mismatch",
    };
  }

  if (read.status === "failed") {
    return { ok: false, code: "read_failed", message: "Independent read status is failed" };
  }
  if (read.status === "stale") {
    return { ok: false, code: "read_stale", message: "Independent read is stale for current version" };
  }
  if (read.status !== "complete") {
    return {
      ok: false,
      code: "read_incomplete",
      message: `Independent read status must be complete (got ${read.status})`,
    };
  }

  if (read.manuscript_id !== expected.manuscriptId) {
    return {
      ok: false,
      code: "manuscript_mismatch",
      message: "Independent read manuscript_id does not match expected manuscript",
    };
  }

  if (read.manuscript_version_id !== expected.manuscriptVersionId) {
    return {
      ok: false,
      code: "version_mismatch",
      message: "Independent read manuscript_version_id does not match expected version",
    };
  }

  if (read.coverage_percent < MIN_INDEPENDENT_READ_COVERAGE_FOR_SYNTHESIS) {
    return {
      ok: false,
      code: "read_unverifiable",
      message: "Independent read coverage is below minimum for synthesis",
    };
  }

  if (read.specialist_manuscript_access_count > 0) {
    return {
      ok: false,
      code: "specialist_access_violation",
      message: "Specialist manuscript access must be zero before profile synthesis",
    };
  }

  if (!readHasGroundedEvidence(read)) {
    return {
      ok: false,
      code: "read_unverifiable",
      message: "Independent read lacks grounded manuscript evidence for synthesis",
    };
  }

  return { ok: true };
}

export function createEditorialProfileCandidateFromIndependentRead(
  input: CreateProfileCandidateInput,
): ProfileCandidateResult {
  if (!isEditorialProfileSynthesisAllowed()) {
    return {
      ok: false,
      code: "feature_flag_disabled",
      message: "Editorial profile synthesis is disabled (STUDIO_EDITORIAL_PROFILE_ENABLED)",
      status: "not_started",
    };
  }

  const expectedManuscriptId = input.authorIntent.manuscript_id;
  const expectedVersionId = input.authorIntent.manuscript_version_id;

  const readCheck = validateIndependentReadForSynthesis(input.independentRead, {
    manuscriptId: expectedManuscriptId,
    manuscriptVersionId: expectedVersionId,
  });
  if (!readCheck.ok) {
    return {
      ok: false,
      code: readCheck.code,
      message: readCheck.message,
      status: "awaiting_independent_read",
    };
  }

  if (input.authorIntent.manuscript_id !== expectedManuscriptId) {
    return {
      ok: false,
      code: "intent_mismatch",
      message: "Author intent manuscript_id mismatch",
      status: "blocked",
    };
  }

  if (input.editorialUnderstanding) {
    const u = input.editorialUnderstanding;
    if (
      u.manuscript_id !== expectedManuscriptId ||
      u.manuscript_version_id !== expectedVersionId
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
        message: "Editorial understanding must be confirmed before profile synthesis",
        status: "blocked",
      };
    }
  }

  const generatedAt = input.generatedAt ?? new Date().toISOString();

  const synthesisInput = buildBoundedSynthesisInput({
    independentRead: input.independentRead,
    authorIntent: input.authorIntent,
    editorialUnderstanding: input.editorialUnderstanding,
    manuscriptBriefId: input.manuscriptBriefId,
  });

  let profile = synthesizeProfileFromBoundedInput({
    profileId: input.profileId,
    synthesisInput,
    generatedAt,
  });

  const prohibited = detectProhibitedInputs(profile);
  if (prohibited.length > 0) {
    return {
      ok: false,
      code: "prohibited_input",
      message: prohibited.map((e) => e.message).join("; "),
      status: "failed",
      validation: { ok: false, errors: prohibited },
    };
  }

  const finalStatus = resolveCandidateStatus(profile);
  assertNonActiveStatus(finalStatus);

  if (input.priorStatus != null) {
    const transition = validateEditorialProfileStatusTransition(input.priorStatus, finalStatus);
    if (!transition.ok && input.priorStatus !== finalStatus) {
      const allowed = canTransitionEditorialProfileStatus(input.priorStatus, finalStatus);
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

  profile = freezeProfileSections({ ...profile, status: finalStatus });

  const validation = validateEditorialProfileContract(profile, "draft");

  if (!validation.ok && finalStatus !== "failed" && finalStatus !== "incomplete_evidence") {
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
    profile,
    status: finalStatus,
    validation,
    synthesisInput,
  };
}

export { NON_ACTIVE_TERMINAL_STATUSES };
