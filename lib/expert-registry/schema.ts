/**
 * Expert definition validation — deterministic, no Zod dependency.
 */

import { isValidDefinitionHash } from "./definition-hash.ts";
import {
  EVIDENCE_PROFILES,
  isEvidenceProfileKey,
} from "./evidence-profiles.ts";
import { EVIDENCE_TYPES, MATERIAL_OUTPUT_TYPES } from "./evidence-types.ts";
import {
  EXPERT_CATEGORIES,
  EXPERT_LIFECYCLE_STATUSES,
  EXPERT_SCHEMA_VERSION,
  EXPERT_SCOPES,
  type EvidencePolicyOverrides,
  type ExpertDefinitionV1,
} from "./types.ts";

export interface ValidationResult {
  ok: true;
  definition: ExpertDefinitionV1;
}

export interface ValidationError {
  ok: false;
  errors: string[];
}

export type ExpertDefinitionValidation = ValidationResult | ValidationError;

const SECRET_KEY_PATTERN =
  /^(api[_-]?key|secret|token|password|credential|anthropic|openai|sk-[a-z0-9]+)$/i;

const SECRET_VALUE_PATTERN = /sk-[a-zA-Z0-9]{20,}/;

/** Minimum manuscript-like excerpt length to flag embedded text in definitions. */
const MANUSCRIPT_EMBED_MIN = 500;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pushIf(condition: boolean, errors: string[], message: string) {
  if (condition) errors.push(message);
}

function validateStringField(
  obj: Record<string, unknown>,
  key: string,
  errors: string[],
  label = key,
): string | null {
  const v = obj[key];
  if (typeof v !== "string" || !v.trim()) {
    errors.push(`${label} must be a non-empty string`);
    return null;
  }
  return v;
}

function validateStringArray(obj: Record<string, unknown>, key: string, errors: string[]): string[] {
  const v = obj[key];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    errors.push(`${key} must be an array of strings`);
    return [];
  }
  return v as string[];
}

function scanForSecrets(value: unknown, path: string, errors: string[]): void {
  if (typeof value === "string") {
    if (SECRET_VALUE_PATTERN.test(value)) {
      errors.push(`Secret-like value at ${path}`);
    }
    if (value.length >= MANUSCRIPT_EMBED_MIN && /\b(chapter|said|she|he)\b/i.test(value)) {
      errors.push(`Possible manuscript text embedded at ${path}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => scanForSecrets(item, `${path}[${i}]`, errors));
    return;
  }
  if (isObject(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(k)) {
        errors.push(`Forbidden secret-like key at ${path}.${k}`);
      }
      if (k === "provider_specific_config") {
        errors.push(`provider_specific_config is not allowed at ${path}`);
      }
      scanForSecrets(v, `${path}.${k}`, errors);
    }
  }
}

export function evidenceOverrideWeakensBaseline(
  profileKey: keyof typeof EVIDENCE_PROFILES,
  overrides: EvidencePolicyOverrides | undefined,
): string[] {
  if (!overrides) return [];
  const errors: string[] = [];
  const profile = EVIDENCE_PROFILES[profileKey];

  if (overrides.stricter_minimum_records) {
    for (const req of profile.per_output_requirements) {
      const overrideMin = overrides.stricter_minimum_records[req.output_type];
      if (overrideMin !== undefined && overrideMin < req.minimum_records) {
        errors.push(
          `Override weakens ${profileKey} minimum_records for ${req.output_type}: ${overrideMin} < ${req.minimum_records}`,
        );
      }
    }
  }

  if (overrides.stricter_manuscript_anchor) {
    const base = profile.manuscript_anchor_requirements;
    const o = overrides.stricter_manuscript_anchor;
    if (o.require_verification === false && base.require_verification) {
      errors.push(`Override weakens ${profileKey} manuscript verification requirement`);
    }
    if (o.require_locator === false && base.require_locator) {
      errors.push(`Override weakens ${profileKey} locator requirement`);
    }
    if (
      o.max_excerpt_words !== undefined &&
      o.max_excerpt_words > base.max_excerpt_words
    ) {
      errors.push(`Override weakens ${profileKey} max_excerpt_words`);
    }
  }

  if (overrides.additional_allowed_types) {
    for (const t of overrides.additional_allowed_types) {
      if (!(profile.allowed_evidence_types as readonly string[]).includes(t)) {
        // Additional types beyond profile are allowed (stricter expansion of types is ok)
        continue;
      }
    }
  }

  return errors;
}

export function mergedEvidenceMinimums(
  profileKeys: (keyof typeof EVIDENCE_PROFILES)[],
  overrides: EvidencePolicyOverrides | undefined,
): Map<string, number> {
  const mins = new Map<string, number>();
  for (const key of profileKeys) {
    for (const req of EVIDENCE_PROFILES[key].per_output_requirements) {
      const prev = mins.get(req.output_type) ?? 0;
      mins.set(req.output_type, Math.max(prev, req.minimum_records));
    }
  }
  if (overrides?.stricter_minimum_records) {
    for (const [outputType, min] of Object.entries(overrides.stricter_minimum_records)) {
      const prev = mins.get(outputType) ?? 0;
      mins.set(outputType, Math.max(prev, min));
    }
  }
  return mins;
}

export function validateExpertDefinition(input: unknown): ExpertDefinitionValidation {
  const errors: string[] = [];
  if (!isObject(input)) return { ok: false, errors: ["Definition must be an object"] };

  pushIf(input.schema_version !== EXPERT_SCHEMA_VERSION, errors, "Invalid schema_version");

  const identity = input.identity;
  if (!isObject(identity)) {
    errors.push("identity is required");
  } else {
    validateStringField(identity, "expert_key", errors);
    validateStringField(identity, "display_name", errors);
    validateStringField(identity, "category", errors);
    const cat = identity.category;
    if (typeof cat === "string" && !(EXPERT_CATEGORIES as readonly string[]).includes(cat)) {
      errors.push(`Unknown category: ${cat}`);
    }
  }

  if (!isObject(input.professional_standards)) {
    errors.push("professional_standards is required");
  } else {
    const ps = input.professional_standards;
    for (const field of [
      "principles",
      "ethics",
      "author_respect_rules",
      "evidence_standards",
      "verification_standards",
      "non_fabrication_rules",
      "contrary_evidence_obligations",
    ]) {
      validateStringArray(ps, field, errors);
      if (Array.isArray(ps[field]) && (ps[field] as string[]).length === 0) {
        errors.push(`professional_standards.${field} must not be empty`);
      }
    }
  }

  if (!isObject(input.evidence_policy)) {
    errors.push("evidence_policy is required");
  } else {
    const ep = input.evidence_policy;
    const profileRefs = ep.profile_refs;
    if (!Array.isArray(profileRefs) || profileRefs.length === 0) {
      errors.push("evidence_policy.profile_refs must include at least one profile");
    } else {
      for (const ref of profileRefs) {
        if (typeof ref !== "string" || !isEvidenceProfileKey(ref)) {
          errors.push(`Unknown evidence profile: ${String(ref)}`);
        }
      }
    }

    const perOutput = ep.per_output_requirements;
    if (!Array.isArray(perOutput) || perOutput.length === 0) {
      errors.push("evidence_policy.per_output_requirements must not be empty");
    } else {
      for (const req of perOutput) {
        if (!isObject(req)) continue;
        const ot = req.output_type;
        if (
          typeof ot !== "string" ||
          !(MATERIAL_OUTPUT_TYPES as readonly string[]).includes(ot)
        ) {
          errors.push(`Invalid output_type: ${String(ot)}`);
        }
        if (typeof req.minimum_records !== "number" || req.minimum_records < 1) {
          errors.push(`minimum_records must be >= 1 for ${String(ot)}`);
        }
      }
    }

    const allowed = ep.allowed_evidence_types;
    if (!Array.isArray(allowed) || allowed.length === 0) {
      errors.push("evidence_policy.allowed_evidence_types must not be empty");
    } else {
      for (const t of allowed) {
        if (!(EVIDENCE_TYPES as readonly string[]).includes(t as string)) {
          errors.push(`Unknown evidence type: ${String(t)}`);
        }
      }
    }

    const overrides = ep.expert_specific_overrides as EvidencePolicyOverrides | undefined;
    if (Array.isArray(profileRefs)) {
      for (const ref of profileRefs) {
        if (typeof ref === "string" && isEvidenceProfileKey(ref)) {
          errors.push(...evidenceOverrideWeakensBaseline(ref, overrides));
        }
      }
    }

    const mins = mergedEvidenceMinimums(
      (Array.isArray(profileRefs)
        ? profileRefs.filter((r): r is keyof typeof EVIDENCE_PROFILES =>
            typeof r === "string" && isEvidenceProfileKey(r),
          )
        : []),
      overrides,
    );
    for (const [, min] of mins) {
      if (min < 1) errors.push("Material findings require at least one evidence record");
    }
  }

  if (!isObject(input.knowledge)) {
    errors.push("knowledge is required");
  } else {
    const kn = input.knowledge;
    validateStringArray(kn, "competencies", errors);
    validateStringArray(kn, "limitations", errors);
    if (Array.isArray(kn.competencies) && (kn.competencies as string[]).length === 0) {
      errors.push("knowledge.competencies must not be empty");
    }
    if (Array.isArray(kn.limitations) && (kn.limitations as string[]).length === 0) {
      errors.push("knowledge.limitations must not be empty");
    }
    const pr = kn.professional_responsibility;
    if (!isObject(pr)) {
      errors.push("knowledge.professional_responsibility is required");
    } else {
      for (const field of ["should_evaluate", "may_evaluate", "must_not_evaluate"]) {
        validateStringArray(pr, field, errors);
      }
      if (Array.isArray(pr.should_evaluate) && (pr.should_evaluate as string[]).length === 0) {
        errors.push("professional_responsibility.should_evaluate must not be empty");
      }
      if (Array.isArray(pr.must_not_evaluate) && (pr.must_not_evaluate as string[]).length === 0) {
        errors.push("professional_responsibility.must_not_evaluate must not be empty");
      }
    }
    const dc = kn.domain_confidence;
    if (dc !== undefined) {
      if (!Array.isArray(dc)) {
        errors.push("knowledge.domain_confidence must be an array when present");
      } else {
        for (const entry of dc) {
          if (!isObject(entry)) continue;
          validateStringField(entry, "domain", errors, "domain_confidence.domain");
          const pct = entry.confidence_percent;
          if (
            pct !== undefined &&
            (typeof pct !== "number" || pct < 0 || pct > 100)
          ) {
            errors.push("domain_confidence.confidence_percent must be 0–100 when present");
          }
        }
      }
    }
  }

  if (isObject(input.versioning)) {
    const lc = input.versioning.lifecycle_status;
    if (
      typeof lc === "string" &&
      !(EXPERT_LIFECYCLE_STATUSES as readonly string[]).includes(lc)
    ) {
      errors.push(`Invalid lifecycle_status: ${lc}`);
    }
  }

  scanForSecrets(input, "definition", errors);

  if (errors.length > 0) return { ok: false, errors };

  return { ok: true, definition: input as unknown as ExpertDefinitionV1 };
}

export function validateExpertScope(scope: string): scope is (typeof EXPERT_SCOPES)[number] {
  return (EXPERT_SCOPES as readonly string[]).includes(scope);
}

export function validateLifecycleTransition(
  from: string,
  to: string,
): { ok: true } | { ok: false; error: string } {
  const allowed: Record<string, string[]> = {
    draft: ["active", "archived"],
    active: ["deprecated", "archived"],
    deprecated: ["archived"],
    archived: [],
  };
  if (!allowed[from]?.includes(to)) {
    return { ok: false, error: `Invalid lifecycle transition: ${from} → ${to}` };
  }
  return { ok: true };
}

export { isValidDefinitionHash };
