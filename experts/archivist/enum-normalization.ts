/**
 * Safe enum casing/alias folding for Archivist output. No confidence or
 * classification upgrades. No fuzzy mapping.
 */

import {
  ARCHIVIST_AUTHORITIES,
  ARCHIVIST_CLASSIFICATIONS,
  ARCHIVIST_CONFIDENCE_LEVELS,
  ARCHIVIST_ENTITY_RESOLUTIONS,
  ARCHIVIST_ENTITY_TYPES,
  ARCHIVIST_EVIDENCE_ROLES,
  ARCHIVIST_EVIDENCE_SOURCE_KINDS,
  ARCHIVIST_EVIDENCE_VERIFICATION_STATUSES,
  ARCHIVIST_FACT_STATUSES,
  ARCHIVIST_FACT_TYPES,
  ARCHIVIST_ISSUE_TYPES,
  ARCHIVIST_SEVERITY_LEVELS,
  ARCHIVIST_AUTHOR_ACTIONS,
} from "./contracts.ts";

export const ARCHIVIST_ENUM_NORMALIZATION_VERSION = "archivist_enum_normalization@v1" as const;

const CONFIDENCE_ALIASES: Record<string, (typeof ARCHIVIST_CONFIDENCE_LEVELS)[number]> = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  INSUFFICIENT: "insufficient",
  INSUFFICIENT_EVIDENCE: "insufficient",
  moderate: "medium",
  MODERATE: "medium",
};

const SEVERITY_ALIASES: Record<string, (typeof ARCHIVIST_SEVERITY_LEVELS)[number]> = {
  CRITICAL: "critical",
  MAJOR: "major",
  MODERATE: "moderate",
  MINOR: "minor",
  medium: "moderate",
  MEDIUM: "moderate",
};

export interface ArchivistEnumNormalizationAudit {
  readonly path: string;
  readonly originalValue: string;
  readonly normalizedValue: string;
}

function foldAllowed(
  value: unknown,
  allowed: readonly string[],
  aliases: Record<string, string> | null,
  path: string,
  audits: ArchivistEnumNormalizationAudit[],
): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (allowed.includes(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (allowed.includes(lower)) {
    if (lower !== trimmed) {
      audits.push({ path, originalValue: trimmed, normalizedValue: lower });
    }
    return lower;
  }
  const alias = aliases?.[trimmed] ?? aliases?.[lower];
  if (alias && allowed.includes(alias)) {
    audits.push({ path, originalValue: trimmed, normalizedValue: alias });
    return alias;
  }
  return trimmed;
}

export function normalizeArchivistEnumValue(
  value: unknown,
  kind:
    | "classification"
    | "severity"
    | "confidence"
    | "issue_type"
    | "fact_type"
    | "authority"
    | "entity_type"
    | "entity_resolution"
    | "evidence_role"
    | "verification_status"
    | "source_kind"
    | "fact_status"
    | "author_action",
  path: string,
  audits: ArchivistEnumNormalizationAudit[],
): unknown {
  switch (kind) {
    case "classification":
      return foldAllowed(value, ARCHIVIST_CLASSIFICATIONS, null, path, audits);
    case "severity":
      return foldAllowed(value, ARCHIVIST_SEVERITY_LEVELS, SEVERITY_ALIASES, path, audits);
    case "confidence":
      return foldAllowed(value, ARCHIVIST_CONFIDENCE_LEVELS, CONFIDENCE_ALIASES, path, audits);
    case "issue_type":
      return foldAllowed(value, ARCHIVIST_ISSUE_TYPES, null, path, audits);
    case "fact_type":
      return foldAllowed(value, ARCHIVIST_FACT_TYPES, null, path, audits);
    case "authority":
      return foldAllowed(value, ARCHIVIST_AUTHORITIES, null, path, audits);
    case "entity_type":
      return foldAllowed(value, ARCHIVIST_ENTITY_TYPES, null, path, audits);
    case "entity_resolution":
      return foldAllowed(value, ARCHIVIST_ENTITY_RESOLUTIONS, null, path, audits);
    case "evidence_role":
      return foldAllowed(value, ARCHIVIST_EVIDENCE_ROLES, null, path, audits);
    case "verification_status":
      return foldAllowed(value, ARCHIVIST_EVIDENCE_VERIFICATION_STATUSES, null, path, audits);
    case "source_kind":
      return foldAllowed(value, ARCHIVIST_EVIDENCE_SOURCE_KINDS, null, path, audits);
    case "fact_status":
      return foldAllowed(value, ARCHIVIST_FACT_STATUSES, null, path, audits);
    case "author_action":
      return foldAllowed(value, ARCHIVIST_AUTHOR_ACTIONS, null, path, audits);
    default:
      return value;
  }
}
