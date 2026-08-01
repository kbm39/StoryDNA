import { KNOWN_EXPERT_KEYS } from "@/lib/author-intent/expert-keys.ts";
import {
  AUTHOR_FRAMING_ALIGNMENTS,
  COMMERCIAL_ASSESSMENT_SCOPES,
  EDITORIAL_PROFILE_CONTRACT_VERSION,
  EDITORIAL_PROFILE_IS_AUTHOR_INTENT,
  EDITORIAL_PROFILE_IS_EXPERT_FINDING,
  EDITORIAL_PROFILE_IS_MANUSCRIPT_EVIDENCE,
  EVIDENCE_ENTRY_SOURCES,
  MAX_COMMERCIAL_CONFIDENCE,
  MAX_EDITORIAL_RISKS,
  MIN_EDITORIAL_CHARACTERISTICS,
  MIN_EDITORIAL_DOMAINS,
  MIN_EDITORIAL_STRENGTHS,
  MIN_EMOTIONAL_CHARACTERISTICS,
  MIN_INDEPENDENT_READ_COVERAGE_ACTIVATION,
  MIN_PROTECTED_ASSETS,
  MIN_STORY_IDENTITY_LOCATORS_HIGH,
  PROHIBITED_EVIDENCE_SOURCES,
  PROFILE_CONFIDENCE_LEVELS,
  type ProfileConfidenceLevel,
} from "./contract.ts";
import type {
  EditorialProfileV1,
  EditorialProfileValidationError,
  EditorialProfileValidationResult,
  EvidenceEntry,
  ProfileConfidenceBlock,
  StoryIdentityBlock,
} from "./types.ts";

function err(
  code: string,
  message: string,
  section?: string,
): EditorialProfileValidationError {
  return { code, message, section };
}

const EXPERT_KEY_SET = new Set<string>(KNOWN_EXPERT_KEYS);

export function isProhibitedEvidenceSource(source: string): boolean {
  return (PROHIBITED_EVIDENCE_SOURCES as readonly string[]).includes(source);
}

export function validateEvidenceEntry(
  evidence: EvidenceEntry,
  context: string,
): EditorialProfileValidationError[] {
  const errors: EditorialProfileValidationError[] = [];

  if (!evidence.evidence_id?.trim()) {
    errors.push(err("missing_evidence_id", `${context}: evidence_id is required`, context));
  }
  if (!evidence.observation?.trim()) {
    errors.push(err("missing_observation", `${context}: observation is required`, context));
  }
  if (!evidence.locator?.chapter_label?.trim()) {
    errors.push(err("missing_locator", `${context}: chapter_label is required`, context));
  }
  if (!(EVIDENCE_ENTRY_SOURCES as readonly string[]).includes(evidence.source)) {
    errors.push(
      err(
        "invalid_evidence_source",
        `${context}: evidence source must be manuscript for profile claims`,
        context,
      ),
    );
  }
  if (isProhibitedEvidenceSource(evidence.source)) {
    errors.push(
      err(
        "prohibited_evidence_source",
        `${context}: brief, understanding, intent, and expert artifacts cannot serve as evidence`,
        context,
      ),
    );
  }
  if (evidence.excerpt != null && evidence.excerpt.split(/\s+/).length > 50) {
    errors.push(
      err("excerpt_too_long", `${context}: excerpt must be ≤50 words`, context),
    );
  }

  return errors;
}

export function countSupportingLocators(evidence: readonly EvidenceEntry[]): number {
  return evidence.filter((e) => e.polarity === "supporting" || e.polarity === "neutral").length;
}

export function hasContraryEvidence(evidence: readonly EvidenceEntry[]): boolean {
  return evidence.some((e) => e.polarity === "contrary");
}

export function hasConflictingEvidence(evidence: readonly EvidenceEntry[]): boolean {
  const supporting = evidence.some((e) => e.polarity === "supporting");
  const contrary = evidence.some((e) => e.polarity === "contrary");
  return supporting && contrary;
}

function confidenceRank(level: ProfileConfidenceLevel): number {
  return level === "high" ? 3 : level === "medium" ? 2 : 1;
}

export function downgradeConfidence(level: ProfileConfidenceLevel): ProfileConfidenceLevel {
  if (level === "high") return "medium";
  if (level === "medium") return "low";
  return "low";
}

export function containsExpertKey(value: string): boolean {
  return EXPERT_KEY_SET.has(value);
}

export function scanForExpertKeysInRequirements(
  requirements: EditorialProfileV1["specialist_requirements"],
): string[] {
  const violations: string[] = [];
  for (const req of requirements) {
    if (containsExpertKey(req.domain_key)) {
      violations.push(req.domain_key);
    }
    if (containsExpertKey(req.justification)) {
      violations.push(`justification:${req.requirement_id}`);
    }
    if (containsExpertKey(req.evidence_summary)) {
      violations.push(`evidence_summary:${req.requirement_id}`);
    }
  }
  return violations;
}

export function validateStoryIdentity(
  block: StoryIdentityBlock,
): EditorialProfileValidationError[] {
  const errors: EditorialProfileValidationError[] = [];
  const section = "story_identity";

  if (!block.primary_identity?.identity_key?.trim()) {
    errors.push(err("missing_primary_identity", "Primary identity is required", section));
  }
  if (!block.identity_rationale?.trim()) {
    errors.push(err("missing_identity_rationale", "Identity rationale is required", section));
  }

  for (const e of block.evidence) {
    errors.push(...validateEvidenceEntry(e, section));
  }

  const locatorCount = countSupportingLocators(block.evidence);
  if (locatorCount === 0) {
    errors.push(err("identity_no_evidence", "Primary identity requires manuscript evidence", section));
  }
  if (block.confidence === "high" && locatorCount < MIN_STORY_IDENTITY_LOCATORS_HIGH) {
    errors.push(
      err(
        "identity_high_confidence_locators",
        `Primary identity high confidence requires ≥${MIN_STORY_IDENTITY_LOCATORS_HIGH} locators`,
        section,
      ),
    );
  }

  if (
    block.author_framing_alignment !== "aligned" &&
    !block.alignment_note?.trim()
  ) {
    errors.push(
      err(
        "alignment_note_required",
        "alignment_note is required when author_framing_alignment is not aligned",
        section,
      ),
    );
  }

  if (block.secondary_identities.length > 2) {
    errors.push(err("too_many_secondary_identities", "Maximum 2 secondary identities", section));
  }

  if (hasConflictingEvidence(block.evidence) && block.confidence === "high") {
    errors.push(
      err(
        "conflicting_evidence_high_confidence",
        "Conflicting evidence present — confidence cannot be high without downgrade",
        section,
      ),
    );
  }

  return errors;
}

export function validateStoryEngines(
  engines: EditorialProfileV1["story_engines"],
): EditorialProfileValidationError[] {
  const errors: EditorialProfileValidationError[] = [];
  const section = "story_engines";

  if (engines.length === 0) {
    errors.push(err("no_engines", "At least one story engine is required", section));
  }

  const primaryEngines = engines.filter((e) => e.role === "primary");
  if (primaryEngines.length > 1) {
    errors.push(err("multiple_primary_engines", "At most one primary engine allowed", section));
  }

  for (const engine of engines) {
    if (engine.evidence.length === 0) {
      errors.push(
        err("engine_missing_evidence", `Engine ${engine.engine_id} requires ≥1 locator`, section),
      );
    }
    for (const e of engine.evidence) {
      errors.push(...validateEvidenceEntry(e, section));
    }
    if (engine.role === "primary" && engine.confidence === "high") {
      if (countSupportingLocators(engine.evidence) < MIN_STORY_IDENTITY_LOCATORS_HIGH) {
        errors.push(
          err(
            "primary_engine_high_confidence",
            "Primary engine high confidence requires ≥2 locators",
            section,
          ),
        );
      }
    }
  }

  return errors;
}

export function validateEditorialCharacteristics(
  entries: EditorialProfileV1["editorial_characteristics"],
  mode: "draft" | "activation",
): EditorialProfileValidationError[] {
  const errors: EditorialProfileValidationError[] = [];
  const section = "editorial_characteristics";

  if (mode === "activation") {
    if (entries.length < MIN_EDITORIAL_CHARACTERISTICS) {
      errors.push(
        err(
          "insufficient_editorial_characteristics",
          `Minimum ${MIN_EDITORIAL_CHARACTERISTICS} editorial characteristics required for activation`,
          section,
        ),
      );
    }
    const domains = new Set(entries.map((e) => e.domain));
    if (domains.size < MIN_EDITORIAL_DOMAINS) {
      errors.push(
        err(
          "insufficient_editorial_domains",
          `Minimum ${MIN_EDITORIAL_DOMAINS} domains required for activation`,
          section,
        ),
      );
    }
    const strengths = entries.filter((e) => e.assessment === "strength");
    if (strengths.length < MIN_EDITORIAL_STRENGTHS) {
      errors.push(
        err(
          "insufficient_strengths",
          `Minimum ${MIN_EDITORIAL_STRENGTHS} strength assessments required — profile must not be deficit-only`,
          section,
        ),
      );
    }
  }

  for (const entry of entries) {
    if (["strength", "gap", "risk"].includes(entry.assessment) && entry.evidence.length === 0) {
      errors.push(
        err(
          "characteristic_evidence_required",
          `${entry.characteristic_id}: evidence required for ${entry.assessment}`,
          section,
        ),
      );
    }
    if (entry.assessment === "risk") {
      const matRank = ["critical", "high", "moderate", "low", "negligible"].indexOf(entry.materiality);
      if (matRank > 2) {
        errors.push(
          err(
            "risk_materiality_too_low",
            `${entry.characteristic_id}: risk assessments require materiality ≥ moderate`,
            section,
          ),
        );
      }
    }
    for (const e of entry.evidence) {
      errors.push(...validateEvidenceEntry(e, section));
    }
  }

  return errors;
}

export function validateTechnicalCharacteristics(
  entries: EditorialProfileV1["technical_characteristics"],
): EditorialProfileValidationError[] {
  const errors: EditorialProfileValidationError[] = [];
  const section = "technical_characteristics";

  for (const entry of entries) {
    const matRank = ["critical", "high", "moderate", "low", "negligible"].indexOf(entry.materiality);
    if (matRank <= 2 && entry.evidence.length === 0) {
      errors.push(
        err(
          "technical_evidence_required",
          `${entry.technical_id}: evidence required when materiality ≥ moderate`,
          section,
        ),
      );
    }
    if (entry.specialist_need === "critical") {
      if (entry.materiality !== "critical") {
        errors.push(
          err(
            "critical_need_requires_critical_materiality",
            `${entry.technical_id}: specialist_need critical requires materiality critical`,
            section,
          ),
        );
      }
      if (confidenceRank(entry.confidence) < confidenceRank("medium")) {
        errors.push(
          err(
            "critical_need_requires_medium_confidence",
            `${entry.technical_id}: specialist_need critical requires confidence ≥ medium`,
            section,
          ),
        );
      }
    }
    for (const e of entry.evidence) {
      errors.push(...validateEvidenceEntry(e, section));
    }
  }

  return errors;
}

export function validateEmotionalCharacteristics(
  entries: EditorialProfileV1["emotional_characteristics"],
  mode: "draft" | "activation",
): EditorialProfileValidationError[] {
  const errors: EditorialProfileValidationError[] = [];
  const section = "emotional_characteristics";

  if (mode === "activation") {
    if (entries.length < MIN_EMOTIONAL_CHARACTERISTICS) {
      errors.push(
        err(
          "insufficient_emotional_characteristics",
          `Minimum ${MIN_EMOTIONAL_CHARACTERISTICS} emotional characteristics required`,
          section,
        ),
      );
    }
    const effective = entries.filter((e) => e.execution_quality === "effective");
    if (effective.length === 0) {
      errors.push(
        err(
          "no_effective_emotion",
          "At least one effective emotional execution required for activation",
          section,
        ),
      );
    }
  }

  for (const entry of entries) {
    if (entry.execution_quality !== "not_assessable" && entry.evidence.length === 0) {
      errors.push(
        err(
          "emotional_evidence_required",
          `${entry.emotional_id}: evidence required when execution is assessable`,
          section,
        ),
      );
    }
    for (const e of entry.evidence) {
      errors.push(...validateEvidenceEntry(e, section));
    }
  }

  return errors;
}

export function validateProtectedAssets(
  assets: EditorialProfileV1["protected_assets"],
  mode: "draft" | "activation",
): EditorialProfileValidationError[] {
  const errors: EditorialProfileValidationError[] = [];
  const section = "protected_assets";

  if (mode === "activation" && assets.length < MIN_PROTECTED_ASSETS) {
    errors.push(
      err(
        "insufficient_protected_assets",
        `Minimum ${MIN_PROTECTED_ASSETS} protected assets required for activation`,
        section,
      ),
    );
  }

  for (const asset of assets) {
    if (asset.evidence.length === 0) {
      errors.push(
        err("asset_missing_evidence", `${asset.asset_id}: minimum 1 locator required`, section),
      );
    }
    if (asset.protection_level === "critical" && confidenceRank(asset.confidence) < confidenceRank("medium")) {
      errors.push(
        err(
          "critical_asset_confidence",
          `${asset.asset_id}: critical protection requires confidence ≥ medium`,
          section,
        ),
      );
    }
    for (const e of asset.evidence) {
      errors.push(...validateEvidenceEntry(e, section));
    }
  }

  return errors;
}

export function validateEditorialRisks(
  risks: EditorialProfileV1["editorial_risks"],
): EditorialProfileValidationError[] {
  const errors: EditorialProfileValidationError[] = [];
  const section = "editorial_risks";

  if (risks.length > MAX_EDITORIAL_RISKS) {
    errors.push(
      err("too_many_risks", `Maximum ${MAX_EDITORIAL_RISKS} active editorial risks`, section),
    );
  }

  for (const risk of risks) {
    if (["blocking", "significant"].includes(risk.severity) && risk.evidence.length === 0) {
      errors.push(
        err(
          "risk_evidence_required",
          `${risk.risk_id}: evidence required for ${risk.severity} severity`,
          section,
        ),
      );
    }
    for (const e of risk.evidence) {
      errors.push(...validateEvidenceEntry(e, section));
    }
  }

  return errors;
}

export function validateSpecialistRequirements(
  requirements: EditorialProfileV1["specialist_requirements"],
): EditorialProfileValidationError[] {
  const errors: EditorialProfileValidationError[] = [];
  const section = "specialist_requirements";

  const expertViolations = scanForExpertKeysInRequirements(requirements);
  if (expertViolations.length > 0) {
    errors.push(
      err(
        "expert_keys_forbidden",
        `Specialist requirements must use domain keys, not expert keys: ${expertViolations.join(", ")}`,
        section,
      ),
    );
  }

  for (const req of requirements) {
    if (!req.justification?.trim()) {
      errors.push(err("missing_justification", `${req.requirement_id}: justification required`, section));
    }
    if (req.requirement_level !== "none" && req.driving_characteristics.length === 0) {
      errors.push(
        err(
          "missing_driving_characteristics",
          `${req.requirement_id}: non-none requirements need driving_characteristics from demonstrated content`,
          section,
        ),
      );
    }
  }

  return errors;
}

export function validateCommercialCharacteristics(
  block: EditorialProfileV1["commercial_characteristics"],
): EditorialProfileValidationError[] {
  const errors: EditorialProfileValidationError[] = [];
  const section = "commercial_characteristics";

  if (block.commercial_assessment_scope !== "pre_expert_preliminary") {
    errors.push(
      err(
        "invalid_commercial_scope",
        "commercial_assessment_scope must be pre_expert_preliminary",
        section,
      ),
    );
  }

  if (confidenceRank(block.confidence) > confidenceRank(MAX_COMMERCIAL_CONFIDENCE)) {
    errors.push(
      err(
        "commercial_confidence_cap",
        "Pre-expert commercial confidence cannot exceed medium",
        section,
      ),
    );
  }

  for (const e of block.hook_evidence) {
    errors.push(...validateEvidenceEntry(e, section));
  }
  for (const comp of block.comp_alignment_signals) {
    if (comp.is_author_comp && comp.evidence.length === 0) {
      errors.push(
        err(
          "author_comp_requires_evidence",
          "Author comp signals require manuscript evidence or divergent alignment note",
          section,
        ),
      );
    }
    for (const e of comp.evidence) {
      errors.push(...validateEvidenceEntry(e, section));
    }
  }

  return errors;
}

export function computeAggregateConfidence(profile: EditorialProfileV1): ProfileConfidenceBlock {
  const sectionsAtLow: string[] = [];
  const gaps: string[] = [];

  const checkSection = (name: string, confidence: ProfileConfidenceLevel) => {
    if (confidence === "low") sectionsAtLow.push(name);
  };

  checkSection("story_identity", profile.story_identity.confidence);
  for (const engine of profile.story_engines) {
    if (engine.role === "primary") checkSection("story_engines", engine.confidence);
  }
  checkSection("commercial_characteristics", profile.commercial_characteristics.confidence);

  let overall: ProfileConfidenceLevel = "high";

  const coverage = profile.synthesis_confidence.independent_read_coverage;
  if (coverage < MIN_INDEPENDENT_READ_COVERAGE_ACTIVATION) {
    overall = "low";
    gaps.push(`Independent read coverage ${coverage}% below ${MIN_INDEPENDENT_READ_COVERAGE_ACTIVATION}%`);
  }

  if (sectionsAtLow.some((s) => s === "story_identity" || s === "story_engines")) {
    if (overall === "high") overall = "medium";
  }

  if (profile.commercial_characteristics.confidence === "medium" || profile.commercial_characteristics.confidence === "low") {
    if (overall === "high") overall = "medium";
  }

  if (sectionsAtLow.length >= 3) {
    overall = "low";
    gaps.push(`${sectionsAtLow.length} sections at low confidence`);
  }

  const evidenceDepth: ProfileConfidenceBlock["evidence_depth"] =
    coverage >= 80 ? "strong" : coverage >= 60 ? "adequate" : "thin";

  return {
    overall_confidence: overall,
    independent_read_coverage: coverage,
    sections_at_low_confidence: sectionsAtLow,
    evidence_depth: evidenceDepth,
    gaps_affecting_confidence: gaps,
  };
}

export function validateEditorialProfileContract(
  profile: EditorialProfileV1,
  mode: "structural" | "draft" | "activation" = "structural",
): EditorialProfileValidationResult {
  const errors: EditorialProfileValidationError[] = [];

  if (profile.contract_version !== EDITORIAL_PROFILE_CONTRACT_VERSION) {
    errors.push(err("invalid_contract_version", "contract_version must be storydna_editorial_profile@v1"));
  }
  if (!profile.profile_id?.trim()) errors.push(err("missing_profile_id", "profile_id is required"));
  if (!profile.manuscript_id?.trim()) errors.push(err("missing_manuscript_id", "manuscript_id is required"));
  if (!profile.manuscript_version_id?.trim()) {
    errors.push(err("missing_version_id", "manuscript_version_id is required"));
  }
  if (!profile.author_intent_id?.trim()) {
    errors.push(err("missing_author_intent_id", "author_intent_id is required"));
  }
  if (!profile.independent_read_id?.trim()) {
    errors.push(err("missing_independent_read_id", "independent_read_id is required"));
  }

  if (profile.is_expert_finding !== EDITORIAL_PROFILE_IS_EXPERT_FINDING) {
    errors.push(err("invalid_is_expert_finding", "is_expert_finding must be false"));
  }
  if (profile.is_manuscript_evidence !== EDITORIAL_PROFILE_IS_MANUSCRIPT_EVIDENCE) {
    errors.push(err("invalid_is_manuscript_evidence", "is_manuscript_evidence must be false"));
  }
  if (profile.is_author_intent !== EDITORIAL_PROFILE_IS_AUTHOR_INTENT) {
    errors.push(err("invalid_is_author_intent", "is_author_intent must be false"));
  }

  if (profile.provenance.specialist_manuscript_access_count > 0) {
    errors.push(
      err(
        "specialist_access_violation",
        "Profile synthesis requires zero specialist manuscript access",
      ),
    );
  }

  errors.push(...validateStoryIdentity(profile.story_identity));
  errors.push(...validateStoryEngines(profile.story_engines));

  const validationMode = mode === "structural" ? "draft" : mode;
  errors.push(...validateEditorialCharacteristics(profile.editorial_characteristics, validationMode));
  errors.push(...validateTechnicalCharacteristics(profile.technical_characteristics));
  errors.push(...validateEmotionalCharacteristics(profile.emotional_characteristics, validationMode));
  errors.push(...validateProtectedAssets(profile.protected_assets, validationMode));
  errors.push(...validateEditorialRisks(profile.editorial_risks));
  errors.push(...validateSpecialistRequirements(profile.specialist_requirements));
  errors.push(...validateCommercialCharacteristics(profile.commercial_characteristics));

  if (mode === "activation") {
    if (profile.synthesis_confidence.independent_read_coverage < MIN_INDEPENDENT_READ_COVERAGE_ACTIVATION) {
      errors.push(
        err(
          "insufficient_read_coverage",
          `Activation requires independent read coverage ≥ ${MIN_INDEPENDENT_READ_COVERAGE_ACTIVATION}%`,
        ),
      );
    }
    if (profile.protected_assets.length < MIN_PROTECTED_ASSETS) {
      errors.push(
        err("activation_protected_assets", `Activation requires ≥ ${MIN_PROTECTED_ASSETS} protected assets`),
      );
    }
  }

  if (profile.status === "blocked" && !profile.dispute_metadata) {
    errors.push(err("blocked_without_dispute", "blocked status requires dispute_metadata"));
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export function validateForDraft(profile: EditorialProfileV1): EditorialProfileValidationResult {
  return validateEditorialProfileContract(profile, "draft");
}

export function validateForActivation(profile: EditorialProfileV1): EditorialProfileValidationResult {
  return validateEditorialProfileContract(profile, "activation");
}

export function isValidProfileConfidence(value: string): value is ProfileConfidenceLevel {
  return (PROFILE_CONFIDENCE_LEVELS as readonly string[]).includes(value);
}

export function authorFramingAlignmentValid(value: string): boolean {
  return (AUTHOR_FRAMING_ALIGNMENTS as readonly string[]).includes(value);
}

export function commercialScopeValid(value: string): boolean {
  return (COMMERCIAL_ASSESSMENT_SCOPES as readonly string[]).includes(value);
}

/** Intent modifier cannot elevate none to critical without driving characteristics. */
export function validateIntentModifierDoesNotInventNeed(
  requirement: EditorialProfileV1["specialist_requirements"][number],
): EditorialProfileValidationError[] {
  if (
    requirement.author_intent_modifier === "elevates" &&
    requirement.requirement_level === "critical" &&
    requirement.driving_characteristics.length === 0
  ) {
    return [
      err(
        "intent_cannot_invent_need",
        `${requirement.requirement_id}: author intent cannot invent domain need without demonstrated characteristics`,
        "specialist_requirements",
      ),
    ];
  }
  return [];
}

export function detectProhibitedInputs(profile: EditorialProfileV1): EditorialProfileValidationError[] {
  const errors: EditorialProfileValidationError[] = [];
  const allEvidence: EvidenceEntry[] = [
    ...profile.story_identity.evidence,
    ...profile.story_engines.flatMap((e) => [...e.evidence]),
    ...profile.editorial_characteristics.flatMap((e) => [...e.evidence]),
    ...profile.technical_characteristics.flatMap((e) => [...e.evidence]),
    ...profile.emotional_characteristics.flatMap((e) => [...e.evidence]),
    ...profile.protected_assets.flatMap((e) => [...e.evidence]),
    ...profile.editorial_risks.flatMap((e) => [...e.evidence]),
    ...profile.commercial_characteristics.hook_evidence,
    ...profile.commercial_characteristics.comp_alignment_signals.flatMap((c) => [...c.evidence]),
  ];

  for (const e of allEvidence) {
    if (isProhibitedEvidenceSource(e.source)) {
      errors.push(
        err(
          "prohibited_input_detected",
          `Prohibited evidence source "${e.source}" — synthesis must abort`,
        ),
      );
    }
  }

  return errors;
}
