/**
 * Versioned, deterministic enum normalization for Military Expert generation payloads.
 * Only semantically exact one-to-one aliases are permitted — no fuzzy mapping.
 */

import {
  MILITARY_EXPERT_CONFIDENCE_LEVELS,
  MILITARY_EXPERT_SEVERITY_LEVELS,
} from "./contracts.ts";

export const MILITARY_EXPERT_ENUM_NORMALIZATION_VERSION =
  "military_expert_enum_normalization@v1" as const;

/** Confidence aliases — models often emit severity vocabulary in confidence fields. */
export const MILITARY_EXPERT_CONFIDENCE_ALIASES = Object.freeze({
  moderate: "medium",
} as const satisfies Record<string, (typeof MILITARY_EXPERT_CONFIDENCE_LEVELS)[number]>);

/** Severity aliases — models often emit confidence vocabulary in severity fields. */
export const MILITARY_EXPERT_SEVERITY_ALIASES = Object.freeze({
  medium: "moderate",
} as const satisfies Record<string, (typeof MILITARY_EXPERT_SEVERITY_LEVELS)[number]>);

export interface MilitaryExpertEnumNormalizationAudit {
  readonly path: string;
  readonly field: "confidence" | "severity" | "recommendation_type";
  readonly originalValue: string;
  readonly normalizedValue: string;
  readonly aliasVersion: typeof MILITARY_EXPERT_ENUM_NORMALIZATION_VERSION;
}

function normalizeConfidenceValue(
  value: unknown,
  path: string,
  audits: MilitaryExpertEnumNormalizationAudit[],
): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const allowed = MILITARY_EXPERT_CONFIDENCE_LEVELS as readonly string[];
  if (allowed.includes(trimmed)) return trimmed;
  const alias = MILITARY_EXPERT_CONFIDENCE_ALIASES[
    trimmed as keyof typeof MILITARY_EXPERT_CONFIDENCE_ALIASES
  ];
  if (alias) {
    audits.push({
      path,
      field: "confidence",
      originalValue: trimmed,
      normalizedValue: alias,
      aliasVersion: MILITARY_EXPERT_ENUM_NORMALIZATION_VERSION,
    });
    return alias;
  }
  return trimmed;
}

function normalizeSeverityValue(
  value: unknown,
  path: string,
  audits: MilitaryExpertEnumNormalizationAudit[],
): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const allowed = MILITARY_EXPERT_SEVERITY_LEVELS as readonly string[];
  if (allowed.includes(trimmed)) return trimmed;
  const alias = MILITARY_EXPERT_SEVERITY_ALIASES[
    trimmed as keyof typeof MILITARY_EXPERT_SEVERITY_ALIASES
  ];
  if (alias) {
    audits.push({
      path,
      field: "severity",
      originalValue: trimmed,
      normalizedValue: alias,
      aliasVersion: MILITARY_EXPERT_ENUM_NORMALIZATION_VERSION,
    });
    return alias;
  }
  return trimmed;
}

function normalizeFinding(
  raw: unknown,
  index: number,
  audits: MilitaryExpertEnumNormalizationAudit[],
): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const record = { ...(raw as Record<string, unknown>) };
  const prefix = `findings[${index}]`;
  if ("confidence" in record) {
    record.confidence = normalizeConfidenceValue(record.confidence, `${prefix}.confidence`, audits);
  }
  if ("severity" in record) {
    record.severity = normalizeSeverityValue(record.severity, `${prefix}.severity`, audits);
  }
  return record;
}

function normalizeCategoryAssessment(
  raw: unknown,
  index: number,
  audits: MilitaryExpertEnumNormalizationAudit[],
): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const record = { ...(raw as Record<string, unknown>) };
  const prefix = `category_assessments[${index}]`;
  if ("confidence" in record) {
    record.confidence = normalizeConfidenceValue(record.confidence, `${prefix}.confidence`, audits);
  }
  return record;
}

/** Apply approved enum aliases before schema validation. Recommendation types are never aliased. */
export function normalizeMilitaryExpertGenerationEnums(parsed: unknown): {
  normalized: unknown;
  audits: readonly MilitaryExpertEnumNormalizationAudit[];
} {
  const audits: MilitaryExpertEnumNormalizationAudit[] = [];
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { normalized: parsed, audits };
  }

  const root = { ...(parsed as Record<string, unknown>) };

  if (Array.isArray(root.findings)) {
    root.findings = root.findings.map((item, index) => normalizeFinding(item, index, audits));
  }

  if (Array.isArray(root.category_assessments)) {
    root.category_assessments = root.category_assessments.map((item, index) =>
      normalizeCategoryAssessment(item, index, audits),
    );
  }

  if (root.overall_realism_assessment && typeof root.overall_realism_assessment === "object") {
    const overall = {
      ...(root.overall_realism_assessment as Record<string, unknown>),
    };
    if ("confidence" in overall) {
      overall.confidence = normalizeConfidenceValue(
        overall.confidence,
        "overall_realism_assessment.confidence",
        audits,
      );
    }
    root.overall_realism_assessment = overall;
  }

  return { normalized: root, audits };
}
