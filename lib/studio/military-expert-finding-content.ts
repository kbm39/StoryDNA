/**
 * Serialized Military Expert finding content for Studio draft persistence.
 */

import type {
  MilitaryExpertEvidenceRecord,
  MilitaryExpertFinding,
  MilitaryExpertUnresolvedConfidenceField,
} from "@/experts/military-expert/contracts.ts";

export interface PersistedMilitaryExpertFindingContent {
  readonly title: string;
  readonly observation: string;
  readonly operational_impact: string;
  readonly story_impact: string;
  readonly recommendation: string;
  readonly recommendation_type: string;
  readonly preservation_note: string;
  readonly manuscript_evidence: readonly MilitaryExpertEvidenceRecord[];
  readonly contrary_evidence?: readonly MilitaryExpertEvidenceRecord[];
  readonly uncertainty_note?: string;
  readonly missing_confidence_fields: readonly MilitaryExpertUnresolvedConfidenceField[];
}

export function serializeMilitaryExpertFindingContent(
  finding: MilitaryExpertFinding,
  missingConfidenceFields: readonly MilitaryExpertUnresolvedConfidenceField[] = [],
): PersistedMilitaryExpertFindingContent {
  return Object.freeze({
    title: finding.title,
    observation: finding.observation,
    operational_impact: finding.operational_impact,
    story_impact: finding.story_impact,
    recommendation: finding.recommendation,
    recommendation_type: finding.recommendation_type,
    preservation_note: finding.preservation_note,
    manuscript_evidence: finding.manuscript_evidence ?? [],
    contrary_evidence: finding.contrary_evidence,
    uncertainty_note: finding.uncertainty_note,
    missing_confidence_fields: missingConfidenceFields,
  });
}

export function parsePersistedMilitaryExpertFindingContent(
  raw: unknown,
): PersistedMilitaryExpertFindingContent | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.title !== "string" || typeof record.observation !== "string") return null;

  return Object.freeze({
    title: record.title,
    observation: record.observation,
    operational_impact: String(record.operational_impact ?? ""),
    story_impact: String(record.story_impact ?? ""),
    recommendation: String(record.recommendation ?? ""),
    recommendation_type: String(record.recommendation_type ?? ""),
    preservation_note: String(record.preservation_note ?? ""),
    manuscript_evidence: parseEvidenceList(record.manuscript_evidence),
    contrary_evidence: parseEvidenceList(record.contrary_evidence),
    uncertainty_note:
      typeof record.uncertainty_note === "string" ? record.uncertainty_note : undefined,
    missing_confidence_fields: parseMissingFields(record.missing_confidence_fields),
  });
}

function parseEvidenceList(raw: unknown): readonly MilitaryExpertEvidenceRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.excerpt !== "string") return [];
    return [
      Object.freeze({
        excerpt: record.excerpt,
        locator: typeof record.locator === "string" ? record.locator : undefined,
        verification_note:
          typeof record.verification_note === "string" ? record.verification_note : undefined,
      }),
    ];
  });
}

function parseMissingFields(
  raw: unknown,
): readonly MilitaryExpertUnresolvedConfidenceField[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (field): field is MilitaryExpertUnresolvedConfidenceField =>
      field === "contrary_evidence" || field === "uncertainty_note",
  );
}
