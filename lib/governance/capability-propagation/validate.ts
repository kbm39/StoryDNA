/**
 * Runtime validation for storydna_capability_propagation_review@v1.
 * Deterministic validation — no external schema library.
 */

import { isValidClassification } from "./classifications.ts";
import {
  CAPABILITY_CLASSIFICATIONS,
  CAPABILITY_PROPAGATION_CONTRACT_VERSION,
  CAPABILITY_REVIEW_STATUSES,
  PROPAGATION_DECISIONS,
  STORYDNA_EXPERT_KEYS,
  type CapabilityPropagationReviewBlock,
  type CapabilityPropagationReviewV1,
  type CapabilityRegistryEntry,
  type CapabilityRegistryV1,
  type ConstitutionComplianceBlock,
  type NoNewCapabilityDeclaration,
  type RetrospectiveExpertAssessment,
} from "./types.ts";

export type ValidationSuccess<T> = { ok: true; value: T };
export type ValidationFailure = { ok: false; errors: string[] };
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pushIf(condition: boolean, errors: string[], message: string) {
  if (condition) errors.push(message);
}

function requireString(obj: Record<string, unknown>, key: string, errors: string[]): string {
  const v = obj[key];
  if (typeof v !== "string" || !v.trim()) {
    errors.push(`${key} must be a non-empty string`);
    return "";
  }
  return v.trim();
}

function requireStringArray(obj: Record<string, unknown>, key: string, errors: string[]): string[] {
  const v = obj[key];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || !x.trim())) {
    errors.push(`${key} must be an array of non-empty strings`);
    return [];
  }
  return v.map((x) => (x as string).trim());
}

function requireBoolean(obj: Record<string, unknown>, key: string, errors: string[]): boolean {
  const v = obj[key];
  if (typeof v !== "boolean") {
    errors.push(`${key} must be a boolean`);
    return false;
  }
  return v;
}

function requireNumber(obj: Record<string, unknown>, key: string, errors: string[]): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    errors.push(`${key} must be a finite number`);
    return 0;
  }
  return v;
}

function requireEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  errors: string[],
): T {
  const v = requireString(obj, key, errors);
  if (v && !allowed.includes(v as T)) {
    errors.push(`${key} must be one of: ${allowed.join(", ")}`);
  }
  return v as T;
}

function validateRetrospectiveAssessment(
  raw: unknown,
  index: number,
  errors: string[],
): RetrospectiveExpertAssessment | null {
  if (!isObject(raw)) {
    errors.push(`retrospective_expert_assessments[${index}] must be an object`);
    return null;
  }
  const expert_key = requireString(raw, "expert_key", errors);
  if (expert_key && !STORYDNA_EXPERT_KEYS.includes(expert_key as never)) {
    errors.push(`retrospective_expert_assessments[${index}].expert_key is unknown`);
  }
  const applicable = requireString(raw, "applicable", errors);
  if (applicable && !["yes", "no", "later"].includes(applicable)) {
    errors.push(
      `retrospective_expert_assessments[${index}].applicable must be yes, no, or later`,
    );
  }
  requireString(raw, "reason", errors);
  return raw as unknown as RetrospectiveExpertAssessment;
}

export function validateCapabilityPropagationReview(
  input: unknown,
): ValidationResult<CapabilityPropagationReviewV1> {
  const errors: string[] = [];
  if (!isObject(input)) {
    return { ok: false, errors: ["Review must be an object"] };
  }

  const contract_version = requireString(input, "contract_version", errors);
  pushIf(
    contract_version !== CAPABILITY_PROPAGATION_CONTRACT_VERSION,
    errors,
    `contract_version must be ${CAPABILITY_PROPAGATION_CONTRACT_VERSION}`,
  );

  requireString(input, "capability_id", errors);
  requireString(input, "capability_name", errors);
  requireString(input, "capability_description", errors);
  requireString(input, "source_expert_key", errors);
  requireString(input, "source_feature", errors);
  requireString(input, "introduced_in_commit", errors);
  requireString(input, "introduced_at", errors);
  requireString(input, "current_implementation_scope", errors);

  const proposed_classification = requireEnum(
    input,
    "proposed_classification",
    CAPABILITY_CLASSIFICATIONS,
    errors,
  );
  const final_classification = requireEnum(
    input,
    "final_classification",
    CAPABILITY_CLASSIFICATIONS,
    errors,
  );

  requireStringArray(input, "affected_existing_experts", errors);
  requireStringArray(input, "affected_future_expert_families", errors);
  requireString(input, "editor_in_chief_impact", errors);
  requireString(input, "platform_impact", errors);
  requireString(input, "author_experience_impact", errors);
  requireString(input, "report_impact", errors);
  requireString(input, "revision_board_impact", errors);
  requireString(input, "series_continuity_impact", errors);
  requireString(input, "publication_state_impact", errors);
  requireString(input, "canon_impact", errors);
  requireString(input, "cost_impact", errors);
  requireString(input, "runtime_impact", errors);
  requireString(input, "safety_impact", errors);
  requireString(input, "certification_impact", errors);
  requireString(input, "schema_impact", errors);
  requireBoolean(input, "migration_required", errors);
  requireString(input, "backward_compatibility_impact", errors);
  requireString(input, "historical_data_impact", errors);

  const propagation_decision = requireEnum(
    input,
    "propagation_decision",
    PROPAGATION_DECISIONS,
    errors,
  );
  requireString(input, "propagation_reason", errors);
  requireStringArray(input, "exclusions", errors);
  requireStringArray(input, "required_follow_up_tasks", errors);
  requireStringArray(input, "constitution_sections", errors);
  requireString(input, "reviewed_by", errors);
  requireString(input, "reviewed_at", errors);
  requireEnum(input, "status", CAPABILITY_REVIEW_STATUSES, errors);
  requireNumber(input, "version", errors);

  if (final_classification === "expert_specific") {
    const isolation = input.isolation_reason;
    if (typeof isolation !== "string" || !isolation.trim()) {
      errors.push(
        "isolation_reason is required when final_classification is expert_specific",
      );
    }
  }

  if (final_classification === "editor_in_chief_owned") {
    const forbiddenJudgment = [
      "propagate_to_all_experts",
      "propagate_to_expert_family",
    ];
    if (forbiddenJudgment.includes(propagation_decision)) {
      errors.push(
        "editor_in_chief_owned capabilities cannot use expert propagation decisions; use move_to_editor_in_chief",
      );
    }
  }

  if (final_classification === "platform_wide") {
    const affected = requireStringArray(input, "affected_existing_experts", errors);
    const exclusions = requireStringArray(input, "exclusions", errors);
    if (affected.length === 0 && exclusions.length === 0) {
      errors.push(
        "platform_wide capabilities must list affected_existing_experts or explicit exclusions",
      );
    }
  }

  const retrospectiveRaw = input.retrospective_expert_assessments;
  if (retrospectiveRaw !== undefined) {
    if (!Array.isArray(retrospectiveRaw)) {
      errors.push("retrospective_expert_assessments must be an array when present");
    } else if (retrospectiveRaw.length > 0) {
      retrospectiveRaw.forEach((item, i) => validateRetrospectiveAssessment(item, i, errors));
    }
  } else if (requireStringArray(input, "affected_existing_experts", errors).length > 0) {
    errors.push(
      "retrospective_expert_assessments is required when affected_existing_experts is non-empty",
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: input as unknown as CapabilityPropagationReviewV1 };
}

export function validateCapabilityRegistryEntry(
  input: unknown,
): ValidationResult<CapabilityRegistryEntry> {
  const errors: string[] = [];
  if (!isObject(input)) {
    return { ok: false, errors: ["Registry entry must be an object"] };
  }

  requireString(input, "capability_id", errors);
  requireString(input, "name", errors);
  requireString(input, "first_implementation", errors);
  const classification = requireString(input, "current_classification", errors);
  if (classification && !isValidClassification(classification)) {
    errors.push("current_classification is invalid");
  }
  requireStringArray(input, "experts_using", errors);
  requireStringArray(input, "experts_evaluated_excluded", errors);
  requireString(input, "constitutional_review_status", errors);
  requireString(input, "certification_status", errors);
  requireString(input, "source_documentation", errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: input as unknown as CapabilityRegistryEntry };
}

export function validateCapabilityRegistry(
  input: unknown,
): ValidationResult<CapabilityRegistryV1> {
  const errors: string[] = [];
  if (!isObject(input)) {
    return { ok: false, errors: ["Registry must be an object"] };
  }

  const version = requireString(input, "registry_version", errors);
  pushIf(version !== "storydna_capability_registry@v1", errors, "registry_version invalid");

  requireString(input, "constitution_version", errors);
  requireString(input, "amendment_version", errors);
  requireString(input, "updated_at", errors);

  const caps = input.capabilities;
  if (!Array.isArray(caps)) {
    errors.push("capabilities must be an array");
    return { ok: false, errors };
  }

  const ids = new Set<string>();
  caps.forEach((cap, index) => {
    const result = validateCapabilityRegistryEntry(cap);
    if (!result.ok) {
      result.errors.forEach((e) => errors.push(`capabilities[${index}]: ${e}`));
      return;
    }
    if (ids.has(result.value.capability_id)) {
      errors.push(`Duplicate capability_id: ${result.value.capability_id}`);
    }
    ids.add(result.value.capability_id);
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: input as unknown as CapabilityRegistryV1 };
}

export function validateNoNewCapabilityDeclaration(
  input: unknown,
): ValidationResult<NoNewCapabilityDeclaration> {
  const errors: string[] = [];
  if (!isObject(input)) {
    return { ok: false, errors: ["Declaration must be an object"] };
  }
  if (input.no_new_capability !== true) {
    errors.push("no_new_capability must be true");
  }
  requireString(input, "rationale", errors);
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: input as NoNewCapabilityDeclaration };
}

export function validateConstitutionComplianceBlock(
  input: unknown,
): ValidationResult<ConstitutionComplianceBlock> {
  const errors: string[] = [];
  if (!isObject(input)) {
    return { ok: false, errors: ["Constitution Compliance block must be an object"] };
  }

  requireStringArray(input, "applicable_sections", errors);
  requireString(input, "compliance_explanation", errors);
  const amendment = requireString(input, "amendment_required", errors);
  if (amendment && amendment !== "Yes" && amendment !== "No") {
    errors.push("amendment_required must be Yes or No");
  }
  requireString(input, "backward_compatibility_impact", errors);
  requireString(input, "certification_impact", errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: input as unknown as ConstitutionComplianceBlock };
}

export function validateCapabilityPropagationReviewBlock(
  input: unknown,
): ValidationResult<CapabilityPropagationReviewBlock> {
  const errors: string[] = [];
  if (!isObject(input)) {
    return { ok: false, errors: ["Capability Propagation Review block must be an object"] };
  }

  requireString(input, "new_capability_introduced", errors);
  requireString(input, "existing_capability_modified", errors);
  const classification = requireString(input, "classification", errors);
  if (classification && !isValidClassification(classification)) {
    errors.push("classification is invalid");
  }
  requireStringArray(input, "existing_experts_evaluated", errors);
  requireStringArray(input, "future_experts_affected", errors);
  requireString(input, "editor_in_chief_impact", errors);
  requireString(input, "platform_impact", errors);
  requireString(input, "certification_impact", errors);
  requireEnum(input, "propagation_decision", PROPAGATION_DECISIONS, errors);
  requireString(input, "review_artifact_path", errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: input as unknown as CapabilityPropagationReviewBlock };
}
