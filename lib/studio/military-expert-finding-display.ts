/**
 * Author-facing Military Expert finding display model.
 */

import type { MilitaryExpertUnresolvedConfidenceField } from "@/experts/military-expert/contracts.ts";
import {
  parsePersistedMilitaryExpertFindingContent,
  type PersistedMilitaryExpertFindingContent,
} from "@/lib/studio/military-expert-finding-content.ts";

export const MILITARY_EXPERT_NOT_PROVIDED = "Not provided in this review." as const;

export const MILITARY_EXPERT_INVESTIGATE_BEFORE_REVISING =
  "Investigate before revising." as const;

export type MilitaryExpertFindingAuthorStatus = "confirmed" | "author_review_required";

export interface MilitaryExpertEvidenceDisplayItem {
  readonly excerpt: string;
  readonly location: string | null;
}

export interface MilitaryExpertEvidenceDisplay {
  readonly heading: "Supporting evidence" | "Contrary evidence";
  readonly items: readonly MilitaryExpertEvidenceDisplayItem[];
  readonly summary: string;
}

export interface MilitaryExpertFindingDisplayItem {
  readonly findingId: string;
  readonly findingIndex: number;
  readonly status: MilitaryExpertFindingAuthorStatus;
  readonly statusLabel: "Confirmed Finding" | "AUTHOR REVIEW REQUIRED";
  readonly title: string;
  readonly severity: string;
  readonly confidence: string;
  readonly concern: string;
  readonly whyItMatters: string;
  readonly supportingEvidence: MilitaryExpertEvidenceDisplay;
  readonly contraryEvidence: MilitaryExpertEvidenceDisplay | null;
  readonly uncertaintyExplanation: string;
  readonly couldNotVerify: readonly string[];
  readonly recommendedAction: string;
  readonly revisionGuidance: string;
  readonly contentPersisted: boolean;
}

export interface MilitaryExpertFindingDisplayInput {
  readonly findingId: string;
  readonly findingIndex: number;
  readonly findingStatus: string;
  readonly category: string;
  readonly severity: string;
  readonly confidence: string;
  readonly findingContent: unknown;
}

const MAX_VISIBLE_EVIDENCE_ITEMS = 2;

export function buildMilitaryExpertFindingDisplayItem(
  input: MilitaryExpertFindingDisplayInput,
): MilitaryExpertFindingDisplayItem {
  const status: MilitaryExpertFindingAuthorStatus =
    input.findingStatus === "author_review_required" ? "author_review_required" : "confirmed";
  const parsed = parsePersistedMilitaryExpertFindingContent(input.findingContent);
  const structuralTitle = `${input.category.replace(/_/g, " ")} (${input.severity})`;

  if (!parsed) {
    return buildLegacyFindingDisplayItem({
      ...input,
      status,
      structuralTitle,
    });
  }

  return buildPersistedFindingDisplayItem({
    ...input,
    status,
    content: parsed,
  });
}

function buildPersistedFindingDisplayItem(args: {
  findingId: string;
  findingIndex: number;
  status: MilitaryExpertFindingAuthorStatus;
  severity: string;
  confidence: string;
  content: PersistedMilitaryExpertFindingContent;
}): MilitaryExpertFindingDisplayItem {
  const supportingEvidence = buildEvidenceDisplay(
    "Supporting evidence",
    args.content.manuscript_evidence,
  );
  const contraryEvidence =
    args.content.contrary_evidence && args.content.contrary_evidence.length > 0
      ? buildEvidenceDisplay("Contrary evidence", args.content.contrary_evidence)
      : args.status === "author_review_required" &&
          args.content.missing_confidence_fields.includes("contrary_evidence")
        ? null
        : args.content.contrary_evidence
          ? buildEvidenceDisplay("Contrary evidence", args.content.contrary_evidence)
          : null;

  const whyItMatters = combineWhyItMatters(
    args.content.operational_impact,
    args.content.story_impact,
  );

  return Object.freeze({
    findingId: args.findingId,
    findingIndex: args.findingIndex,
    status: args.status,
    statusLabel:
      args.status === "author_review_required" ? "AUTHOR REVIEW REQUIRED" : "Confirmed Finding",
    title: nonEmptyOr(args.content.title, MILITARY_EXPERT_NOT_PROVIDED),
    severity: args.severity,
    confidence: args.confidence,
    concern: nonEmptyOr(args.content.observation, MILITARY_EXPERT_NOT_PROVIDED),
    whyItMatters,
    supportingEvidence,
    contraryEvidence,
    uncertaintyExplanation: nonEmptyOr(
      args.content.uncertainty_note,
      args.status === "author_review_required" &&
        args.content.missing_confidence_fields.includes("uncertainty_note")
        ? MILITARY_EXPERT_NOT_PROVIDED
        : args.content.uncertainty_note ?? MILITARY_EXPERT_NOT_PROVIDED,
    ),
    couldNotVerify: args.content.missing_confidence_fields.map(describeMissingField),
    recommendedAction:
      args.status === "author_review_required"
        ? MILITARY_EXPERT_INVESTIGATE_BEFORE_REVISING
        : nonEmptyOr(args.content.recommendation, MILITARY_EXPERT_NOT_PROVIDED),
    revisionGuidance: nonEmptyOr(args.content.preservation_note, MILITARY_EXPERT_NOT_PROVIDED),
    contentPersisted: true,
  });
}

function buildLegacyFindingDisplayItem(args: {
  findingId: string;
  findingIndex: number;
  status: MilitaryExpertFindingAuthorStatus;
  structuralTitle: string;
  severity: string;
  confidence: string;
}): MilitaryExpertFindingDisplayItem {
  const emptyEvidence = buildEvidenceDisplay("Supporting evidence", []);
  return Object.freeze({
    findingId: args.findingId,
    findingIndex: args.findingIndex,
    status: args.status,
    statusLabel:
      args.status === "author_review_required" ? "AUTHOR REVIEW REQUIRED" : "Confirmed Finding",
    title: args.structuralTitle,
    severity: args.severity,
    confidence: args.confidence,
    concern: MILITARY_EXPERT_NOT_PROVIDED,
    whyItMatters: MILITARY_EXPERT_NOT_PROVIDED,
    supportingEvidence: emptyEvidence,
    contraryEvidence: null,
    uncertaintyExplanation: MILITARY_EXPERT_NOT_PROVIDED,
    couldNotVerify:
      args.status === "author_review_required"
        ? ["contrary evidence not verified", "uncertainty explanation not completed"]
        : [],
    recommendedAction:
      args.status === "author_review_required"
        ? MILITARY_EXPERT_INVESTIGATE_BEFORE_REVISING
        : MILITARY_EXPERT_NOT_PROVIDED,
    revisionGuidance: MILITARY_EXPERT_NOT_PROVIDED,
    contentPersisted: false,
  });
}

function combineWhyItMatters(operationalImpact: string, storyImpact: string): string {
  const parts = [operationalImpact.trim(), storyImpact.trim()].filter(Boolean);
  if (parts.length === 0) return MILITARY_EXPERT_NOT_PROVIDED;
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[1]}`;
}

function buildEvidenceDisplay(
  heading: MilitaryExpertEvidenceDisplay["heading"],
  records: readonly { excerpt: string; locator?: string }[],
): MilitaryExpertEvidenceDisplay {
  const items = records
    .map((record) =>
      Object.freeze({
        excerpt: record.excerpt.trim(),
        location: record.locator?.trim() ? record.locator.trim() : null,
      }),
    )
    .filter((item) => item.excerpt.length > 0);

  if (items.length === 0) {
    return Object.freeze({
      heading,
      items: [],
      summary: MILITARY_EXPERT_NOT_PROVIDED,
    });
  }

  const visibleItems = items.slice(0, MAX_VISIBLE_EVIDENCE_ITEMS);
  const summary =
    items.length === 1
      ? formatEvidenceItemSummary(visibleItems[0]!)
      : `${items.length} ${heading.toLowerCase()} excerpts recorded.`;

  return Object.freeze({
    heading,
    items: visibleItems,
    summary,
  });
}

function formatEvidenceItemSummary(item: MilitaryExpertEvidenceDisplayItem): string {
  if (item.location) return `${item.location}: ${item.excerpt}`;
  return item.excerpt;
}

function describeMissingField(field: MilitaryExpertUnresolvedConfidenceField): string {
  return field === "contrary_evidence"
    ? "contrary evidence not verified"
    : "uncertainty explanation not completed";
}

function nonEmptyOr(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function buildMilitaryExpertFindingDisplayItems(
  findings: readonly MilitaryExpertFindingDisplayInput[],
): readonly MilitaryExpertFindingDisplayItem[] {
  return findings.map(buildMilitaryExpertFindingDisplayItem);
}
