import {
  AUTHOR_FACING_CONTROL_STATEMENT,
  AUTHOR_FACING_PROFILE_OPENING_COPY,
  AUTHOR_FACING_SECTION_ORDER,
  AUTHOR_FACING_SECTION_TITLES,
  AUTHOR_FACING_SPECIALIST_FRAMING,
} from "./author-facing-contract.ts";
import type {
  AuthorFacingEditorialProfileReadModel,
  AuthorFacingReadModelValidationError,
  AuthorFacingReadModelValidationResult,
} from "./author-facing-types.ts";
import { scanForExpertKeysInRequirements } from "./validation.ts";

function err(
  code: string,
  message: string,
  section?: string,
): AuthorFacingReadModelValidationError {
  return { code, message, section };
}

const PROHIBITED_INTERNAL_KEYS = [
  "trigger_event",
  "provider_model",
  "feature_flag",
  "validation_errors",
  "stack_trace",
  "status",
  "supersedes_profile_id",
  "superseded_by_profile_id",
] as const;

/** Allowed on read-model envelope — not treated as internal leakage. */
const READ_MODEL_ENVELOPE_KEYS = new Set([
  "contract_version",
  "read_model_kind",
  "profile_id",
  "manuscript_id",
  "manuscript_version_id",
  "is_active_authoritative",
  "source_profile_status",
  "source_generated_at",
  "source_activated_at",
  "presentation_timestamp",
  "provenance",
  "sections",
  "editorial_understanding",
  "what_is_working",
  "protected_assets",
  "improvement_opportunities",
  "editorial_risks",
  "manuscript_characteristics",
  "recommended_specialist_support",
  "roadmap_preparation",
  "confidence_and_uncertainty",
  "what_happens_next",
  "capability_status",
  "author_control_statement",
]);

const GRADE_PATTERN = /\bgrade\b|\bletter grade\b|\b[A-F][+-]?\s*grade/i;
const CONSENT_IMPLIED_PATTERN =
  /\b(you have authorized|manuscript sharing approved|specialist activated|experts? (have|has) (been )?(activated|launched|engaged))\b/i;
const ROADMAP_COMPLETE_PATTERN =
  /\b(your (editorial )?roadmap (is|has been) (complete|generated|ready|finalized))\b/i;
const EXPERT_KEY_PATTERN =
  /\b(literary_agent|military_expert|developmental_editor|line_editor|character_expert)\b/;

function collectAuthorFacingStrings(value: unknown, path = ""): string[] {
  if (value == null) return [];
  if (typeof value === "string") return [value];
  if (typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectAuthorFacingStrings(item, `${path}[${index}]`));
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
    const isEnvelopeRoot = path === "";
    if (
      (PROHIBITED_INTERNAL_KEYS as readonly string[]).includes(key) ||
      ((key === "contract_version" || key === "status") && !isEnvelopeRoot)
    ) {
      if (!(isEnvelopeRoot && READ_MODEL_ENVELOPE_KEYS.has(key))) {
        return [`__internal_key__:${key}`];
      }
    }
    return collectAuthorFacingStrings(nested, path ? `${path}.${key}` : key);
  });
}

export function validateAuthorFacingEditorialProfileReadModel(
  model: AuthorFacingEditorialProfileReadModel,
): AuthorFacingReadModelValidationResult {
  const errors: AuthorFacingReadModelValidationError[] = [];

  if (model.read_model_kind !== "author_facing_editorial_profile") {
    errors.push(err("invalid_read_model_kind", "read_model_kind must be author_facing_editorial_profile"));
  }

  if (!model.is_active_authoritative) {
    errors.push(err("not_active_authoritative", "Read model must derive from active authoritative profile"));
  }

  if (!model.profile_id?.trim()) {
    errors.push(err("missing_profile_id", "profile_id is required"));
  }
  if (!model.manuscript_id?.trim()) {
    errors.push(err("missing_manuscript_id", "manuscript_id is required"));
  }
  if (!model.manuscript_version_id?.trim()) {
    errors.push(err("missing_version_id", "manuscript_version_id is required"));
  }

  if (model.sections.length !== AUTHOR_FACING_SECTION_ORDER.length) {
    errors.push(
      err(
        "section_count",
        `Expected ${AUTHOR_FACING_SECTION_ORDER.length} sections, got ${model.sections.length}`,
      ),
    );
  }

  for (let i = 0; i < model.sections.length; i++) {
    const section = model.sections[i];
    const expectedKey = AUTHOR_FACING_SECTION_ORDER[i];
    if (section.section_key !== expectedKey) {
      errors.push(
        err(
          "section_order",
          `Section ${i + 1} must be "${expectedKey}", got "${section.section_key}"`,
          section.section_key,
        ),
      );
    }
    if (section.display_order !== i + 1) {
      errors.push(
        err(
          "display_order",
          `Section "${section.section_key}" display_order must be ${i + 1}`,
          section.section_key,
        ),
      );
    }
    if (section.title !== AUTHOR_FACING_SECTION_TITLES[expectedKey]) {
      errors.push(
        err("section_title", `Section "${section.section_key}" has incorrect title`, section.section_key),
      );
    }
  }

  const firstSection = model.sections[0];
  if (firstSection?.section_key !== "editorial_understanding") {
    errors.push(err("opening_not_understanding", "Opening section must be Editorial Understanding"));
  }

  if (firstSection && GRADE_PATTERN.test(firstSection.title)) {
    errors.push(err("grade_first", "Grade must not appear as opening section"));
  }

  const riskIndex = model.sections.findIndex((s) => s.section_key === "editorial_risks");
  const workingIndex = model.sections.findIndex((s) => s.section_key === "what_is_working");
  const protectedIndex = model.sections.findIndex((s) => s.section_key === "protected_assets");
  const opportunitiesIndex = model.sections.findIndex((s) => s.section_key === "improvement_opportunities");

  if (workingIndex >= 0 && opportunitiesIndex >= 0 && workingIndex > opportunitiesIndex) {
    errors.push(
      err(
        "positive_first_violation",
        "What Is Working must appear before Improvement Opportunities",
        "what_is_working",
      ),
    );
  }

  if (protectedIndex >= 0 && riskIndex >= 0 && protectedIndex > riskIndex) {
    errors.push(
      err("protected_before_risks", "Protected Assets must appear before Editorial Risks", "protected_assets"),
    );
  }

  if (model.editorial_understanding.opening_copy !== AUTHOR_FACING_PROFILE_OPENING_COPY) {
    errors.push(err("missing_opening_copy", "Editorial Understanding must include required opening copy"));
  }

  for (const strength of model.what_is_working) {
    if (strength.evidence.length === 0) {
      errors.push(
        err("strength_without_evidence", `Strength ${strength.entry_id} lacks evidence`, "what_is_working"),
      );
    }
  }

  for (const asset of model.protected_assets) {
    if (asset.evidence.length === 0) {
      errors.push(
        err("asset_without_evidence", `Protected asset ${asset.asset_id} lacks evidence`, "protected_assets"),
      );
    }
    if (!asset.why_it_matters?.trim()) {
      errors.push(
        err("asset_without_rationale", `Protected asset ${asset.asset_id} lacks rationale`, "protected_assets"),
      );
    }
  }

  for (const risk of model.editorial_risks) {
    if (risk.confidence === "limited" && risk.uncertainty_notes.length === 0) {
      errors.push(
        err(
          "low_confidence_risk_hidden",
          `Risk ${risk.risk_id} at limited confidence must include uncertainty note`,
          "editorial_risks",
        ),
      );
    }
    if (risk.conflicting_evidence && !risk.uncertainty_notes.some((n) => n.toLowerCase().includes("conflict"))) {
      errors.push(
        err(
          "conflict_hidden",
          `Risk ${risk.risk_id} has conflicting evidence that must remain visible`,
          "editorial_risks",
        ),
      );
    }
  }

  for (const rec of model.recommended_specialist_support) {
    if (rec.specialist_not_activated !== true) {
      errors.push(
        err("implied_specialist_activation", "Specialist recommendation must state not activated", "recommended_specialist_support"),
      );
    }
    if (rec.manuscript_sharing_not_authorized !== true) {
      errors.push(
        err("implied_consent", "Specialist recommendation must state manuscript sharing not authorized", "recommended_specialist_support"),
      );
    }
    if (!rec.demonstrated_need?.trim() || !rec.why_it_may_help?.trim()) {
      errors.push(
        err("specialist_without_rationale", `Recommendation ${rec.recommendation_id} lacks rationale`, "recommended_specialist_support"),
      );
    }
  }

  if (model.roadmap_preparation.roadmap_generated !== false) {
    errors.push(err("false_roadmap_claim", "Roadmap Preparation must not claim roadmap is generated", "roadmap_preparation"));
  }
  if (model.roadmap_preparation.no_final_next_best_action !== true) {
    errors.push(err("invented_nba", "Roadmap Preparation must not invent a final Next Best Action", "roadmap_preparation"));
  }

  if (!model.author_control_statement.includes("retain final authority")) {
    errors.push(err("missing_author_control", "Author control statement is required"));
  }

  if (model.what_happens_next.author_control_statement !== AUTHOR_FACING_CONTROL_STATEMENT) {
    errors.push(err("missing_control_statement", "What Happens Next must include author control statement", "what_happens_next"));
  }

  if (model.capability_status.specialists_executed !== false) {
    errors.push(err("specialists_executed", "Capability status must confirm no specialists executed"));
  }
  if (model.capability_status.manuscript_sharing_granted !== false) {
    errors.push(err("sharing_granted", "Capability status must confirm no manuscript sharing"));
  }
  if (model.capability_status.roadmap_generated !== false) {
    errors.push(err("roadmap_generated", "Capability status must confirm no roadmap generated"));
  }
  if (model.capability_status.grade_assigned !== false) {
    errors.push(err("grade_assigned", "Capability status must confirm no grade assigned"));
  }

  const allStrings = collectAuthorFacingStrings(model);
  for (const text of allStrings) {
    if (text.startsWith("__internal_key__:")) {
      errors.push(err("internal_field_exposed", `Internal field exposed: ${text.replace("__internal_key__:", "")}`));
      continue;
    }
    if (CONSENT_IMPLIED_PATTERN.test(text)) {
      errors.push(err("implied_consent_language", "Presentation must not imply consent or activation"));
    }
    if (ROADMAP_COMPLETE_PATTERN.test(text)) {
      errors.push(err("false_roadmap_language", "Presentation must not claim completed roadmap"));
    }
    if (EXPERT_KEY_PATTERN.test(text)) {
      errors.push(err("expert_key_exposed", "Expert keys must not appear in author-facing copy"));
    }
  }

  for (const rec of model.recommended_specialist_support) {
    if (rec.capability_area.includes("_") && !rec.capability_area.includes(" ")) {
      errors.push(err("raw_domain_key", `Raw domain key exposed: ${rec.capability_area}`, "recommended_specialist_support"));
    }
  }

  if (!model.roadmap_preparation.likely_destination?.trim()) {
    errors.push(err("roadmap_missing_destination", "Roadmap preparation requires likely destination", "roadmap_preparation"));
  }

  if (model.confidence_and_uncertainty.overall_confidence_label.trim().length === 0) {
    errors.push(err("missing_confidence_label", "Confidence summary must include author-facing confidence label"));
  }

  if (
    model.confidence_and_uncertainty.unresolved_conflicts.length > 0 &&
    model.confidence_and_uncertainty.uncertainty_explanations.length === 0
  ) {
    errors.push(err("conflicts_silently_omitted", "Unresolved conflicts must appear in uncertainty explanations"));
  }

  if (model.provenance.author_intent_id.trim().length === 0 || model.provenance.independent_read_id.trim().length === 0) {
    errors.push(err("missing_provenance", "Provenance must preserve author_intent_id and independent_read_id"));
  }

  if (model.recommended_specialist_support.length > 0) {
    const hasFraming = allStrings.some((s) => s.includes("recommend support"));
    if (!hasFraming) {
      errors.push(err("missing_specialist_framing", "Specialist section must include professional framing language"));
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export function validateStrengthTraceability(
  strengths: AuthorFacingEditorialProfileReadModel["what_is_working"],
): AuthorFacingReadModelValidationResult {
  const errors: AuthorFacingReadModelValidationError[] = [];
  for (const strength of strengths) {
    if (!strength.statement?.trim() || !strength.why_it_works?.trim()) {
      errors.push(err("unsupported_strength", `Strength ${strength.entry_id} lacks supported conclusion`, "what_is_working"));
    }
    if (strength.evidence.length === 0) {
      errors.push(err("strength_untraceable", `Strength ${strength.entry_id} is not traceable to evidence`, "what_is_working"));
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export function validateNoExpertKeysInRecommendations(
  recommendations: AuthorFacingEditorialProfileReadModel["recommended_specialist_support"],
  sourceRequirements: readonly { domain_key: string; requirement_id: string }[],
): AuthorFacingReadModelValidationResult {
  const violations = scanForExpertKeysInRequirements(
    sourceRequirements as Parameters<typeof scanForExpertKeysInRequirements>[0],
  );
  if (violations.length > 0) {
    return {
      ok: false,
      errors: [err("expert_keys_in_source", `Source profile contains expert keys: ${violations.join(", ")}`)],
    };
  }
  for (const rec of recommendations) {
    if (EXPERT_KEY_PATTERN.test(rec.capability_area)) {
      return {
        ok: false,
        errors: [err("expert_key_in_recommendation", `Expert key in recommendation ${rec.recommendation_id}`)],
      };
    }
  }
  return { ok: true };
}

export {
  AUTHOR_FACING_CONTROL_STATEMENT,
  AUTHOR_FACING_PROFILE_OPENING_COPY,
  AUTHOR_FACING_SPECIALIST_FRAMING,
};
