/**
 * Final V2 report structure assembly and V1 review mapping.
 */

import type {
  MilitaryExpertFinding,
  MilitaryExpertReview,
} from "@/experts/military-expert/contracts.ts";
import { MILITARY_EXPERT_RUNTIME_DEFINITION_HASH } from "@/experts/military-expert/generation-contract.ts";
import {
  MILITARY_EXPERT_KEY,
  MILITARY_EXPERT_VERSION,
} from "@/experts/military-expert/contracts.ts";
import type { MilitaryExpertSceneInventoryDocument } from "./contracts.ts";
import { formatAuthorLocator } from "./locator.ts";
import type { MilitaryExpertSceneReviewDocument } from "./scene-review-contract.ts";
import {
  allSynthesisFindings,
  type MilitaryExpertSynthesisFinding,
  type MilitaryExpertV2SynthesisDocument,
} from "./synthesis-contract.ts";
import type { MilitaryExpertV2SynthesisInput } from "./synthesis-input.ts";
import type { PersistedSceneReviewRow } from "./scene-review-persistence.ts";

export interface MilitaryExpertV2ReportFinding {
  readonly findingId: string;
  readonly title: string;
  readonly plainEnglishExplanation: string;
  readonly whyItMatters: string;
  readonly determination: "confirmed" | "author_review_required";
  readonly synthesisKind: string;
  readonly sourceSceneIds: readonly string[];
  readonly sourceSceneReviewIds: readonly string[];
  readonly bestLocators: readonly string[];
  readonly revisionSignificance: string;
  readonly confidence: string;
  readonly safeEditorialGuidance: string;
}

export interface MilitaryExpertV2SceneAppendixEntry {
  readonly sceneId: string;
  readonly locator: string;
  readonly sceneTypes: readonly string[];
  readonly status: string;
  readonly realismSummary: string | null;
  readonly strengths: readonly {
    readonly title: string;
    readonly explanation: string;
    readonly whyItMatters: string;
    readonly determination: string;
    readonly confidence: string;
  }[];
  readonly concerns: readonly {
    readonly title: string;
    readonly explanation: string;
    readonly whyItMatters: string;
    readonly determination: string;
    readonly confidence: string;
  }[];
  readonly contraryEvidence: readonly string[];
  readonly editorialSuggestions: readonly string[];
  readonly confidence: string | null;
}

export interface MilitaryExpertV2SceneInventoryEntry {
  readonly sceneId: string;
  readonly status: "reviewed" | "insufficient_evidence" | "not_selected";
  readonly locator: string;
}

export interface MilitaryExpertV2SynthesisReport {
  readonly synthesisId: string;
  readonly selectionSnapshotId: string;
  readonly inventoryId: string;
  readonly selectedSceneCount: number;
  readonly inventorySceneCount: number;
  readonly scopeBlock: string;
  readonly overallAssessment: string;
  readonly recurringStrengths: readonly { readonly title: string; readonly explanation: string }[];
  readonly recurringConcerns: readonly { readonly title: string; readonly explanation: string }[];
  readonly topPriorityFindings: readonly MilitaryExpertV2ReportFinding[];
  readonly confirmedFindings: readonly MilitaryExpertV2ReportFinding[];
  readonly authorReviewRequiredFindings: readonly MilitaryExpertV2ReportFinding[];
  readonly topRevisionPriorities: readonly string[];
  readonly sceneInventory: readonly MilitaryExpertV2SceneInventoryEntry[];
  readonly sceneAppendix: readonly MilitaryExpertV2SceneAppendixEntry[];
  readonly methodologyScopeStatement: string;
}

function mapFinding(f: MilitaryExpertSynthesisFinding): MilitaryExpertV2ReportFinding {
  return Object.freeze({
    findingId: f.finding_id,
    title: f.title,
    plainEnglishExplanation: f.plain_english_explanation,
    whyItMatters: f.why_it_matters,
    determination: f.determination,
    synthesisKind: f.synthesis_kind,
    sourceSceneIds: Object.freeze([...f.source_scene_ids]),
    sourceSceneReviewIds: Object.freeze([...f.source_scene_review_ids]),
    bestLocators: Object.freeze([...f.best_locators]),
    revisionSignificance: f.revision_significance,
    confidence: f.confidence,
    safeEditorialGuidance: f.safe_editorial_guidance,
  });
}

export function buildScopeBlock(args: {
  inventorySceneCount: number;
  selectedSceneCount: number;
  completeCount: number;
  insufficientEvidenceCount: number;
  notSelectedCount: number;
}): string {
  return [
    `StoryDNA identified ${args.inventorySceneCount} military or tactical scenes.`,
    `You selected ${args.selectedSceneCount} for detailed review.`,
    `All ${args.selectedSceneCount} selected scenes reached an allowed terminal review status.`,
    `${args.completeCount} received complete assessments and ${args.insufficientEvidenceCount} had insufficient evidence.`,
    `The remaining ${args.notSelectedCount} inventory scenes were not selected and were not evaluated in detail.`,
  ].join(" ");
}

function buildSceneAppendix(
  inventory: MilitaryExpertSceneInventoryDocument,
  selectedSceneIds: readonly string[],
  reviews: readonly PersistedSceneReviewRow[],
): readonly MilitaryExpertV2SceneAppendixEntry[] {
  const reviewByScene = new Map(reviews.map((r) => [r.sceneId, r]));
  const selectedSet = new Set(selectedSceneIds);

  return Object.freeze(
    inventory.scenes
      .filter((s) => selectedSet.has(s.scene_id))
      .map((scene) => {
        const review = reviewByScene.get(scene.scene_id);
        const doc = review?.document;
        const mapPoints = (
          points: MilitaryExpertSceneReviewDocument["authenticity_strengths"],
        ) =>
          points.map((p) =>
            Object.freeze({
              title: p.title,
              explanation: p.scene_specific_explanation,
              whyItMatters: p.why_it_matters,
              determination: p.determination,
              confidence: p.confidence,
            }),
          );

        return Object.freeze({
          sceneId: scene.scene_id,
          locator: formatAuthorLocator(scene.locator),
          sceneTypes: Object.freeze([...scene.scene_types]),
          status: review?.reviewStatus ?? "not started",
          realismSummary: doc?.realism_summary ?? null,
          strengths: Object.freeze(doc ? mapPoints(doc.authenticity_strengths) : []),
          concerns: Object.freeze(doc ? mapPoints(doc.authenticity_concerns) : []),
          contraryEvidence: Object.freeze(
            doc ? doc.contrary_evidence.map((e) => e.relevance) : [],
          ),
          editorialSuggestions: Object.freeze(
            doc ? doc.safe_editorial_suggestions.map((s) => s.suggestion) : [],
          ),
          confidence: doc?.confidence ?? null,
        });
      }),
  );
}

function buildSceneInventory(
  inventory: MilitaryExpertSceneInventoryDocument,
  selectedSceneIds: readonly string[],
  reviews: readonly PersistedSceneReviewRow[],
): readonly MilitaryExpertV2SceneInventoryEntry[] {
  const selectedSet = new Set(selectedSceneIds);
  const reviewByScene = new Map(reviews.map((r) => [r.sceneId, r]));

  return Object.freeze(
    inventory.scenes.map((scene) => {
      let status: MilitaryExpertV2SceneInventoryEntry["status"] = "not_selected";
      if (selectedSet.has(scene.scene_id)) {
        const reviewStatus = reviewByScene.get(scene.scene_id)?.reviewStatus;
        status =
          reviewStatus === "insufficient_evidence" ? "insufficient_evidence" : "reviewed";
      }
      return Object.freeze({
        sceneId: scene.scene_id,
        status,
        locator: formatAuthorLocator(scene.locator),
      });
    }),
  );
}

export function buildMilitaryExpertV2SynthesisReport(args: {
  synthesis: MilitaryExpertV2SynthesisDocument;
  inventory: MilitaryExpertSceneInventoryDocument;
  selectedSceneIds: readonly string[];
  reviews: readonly PersistedSceneReviewRow[];
  input: MilitaryExpertV2SynthesisInput;
}): MilitaryExpertV2SynthesisReport {
  const allFindings = allSynthesisFindings(args.synthesis);
  const findingById = new Map(allFindings.map((f) => [f.finding_id, f]));

  const topPriority = args.synthesis.top_priority_findings
    .map((id) => findingById.get(id))
    .filter((f): f is MilitaryExpertSynthesisFinding => f !== undefined)
    .map(mapFinding);

  const confirmed = allFindings
    .filter((f) => f.determination === "confirmed")
    .map(mapFinding);
  const arr = allFindings
    .filter((f) => f.determination === "author_review_required")
    .map(mapFinding);

  const notSelectedCount = args.input.not_selected_scene_ids.length;

  return Object.freeze({
    synthesisId: args.synthesis.synthesis_id,
    selectionSnapshotId: args.synthesis.selection_snapshot_id,
    inventoryId: args.synthesis.inventory_id,
    selectedSceneCount: args.synthesis.selected_scene_count,
    inventorySceneCount: args.input.inventory_scene_count,
    scopeBlock:
      args.synthesis.coverage_summary.scope_statement ||
      buildScopeBlock({
        inventorySceneCount: args.input.inventory_scene_count,
        selectedSceneCount: args.synthesis.selected_scene_count,
        completeCount: args.synthesis.complete_scene_count,
        insufficientEvidenceCount: args.synthesis.insufficient_evidence_count,
        notSelectedCount,
      }),
    overallAssessment: args.synthesis.overall_authenticity_assessment,
    recurringStrengths: Object.freeze(
      args.synthesis.recurring_strengths.map((s) =>
        Object.freeze({ title: s.title, explanation: s.explanation }),
      ),
    ),
    recurringConcerns: Object.freeze(
      args.synthesis.recurring_concerns.map((c) =>
        Object.freeze({ title: c.title, explanation: c.explanation }),
      ),
    ),
    topPriorityFindings: Object.freeze(topPriority),
    confirmedFindings: Object.freeze(confirmed),
    authorReviewRequiredFindings: Object.freeze(arr),
    topRevisionPriorities: Object.freeze([...args.synthesis.top_revision_priorities]),
    sceneInventory: buildSceneInventory(args.inventory, args.selectedSceneIds, args.reviews),
    sceneAppendix: buildSceneAppendix(args.inventory, args.selectedSceneIds, args.reviews),
    methodologyScopeStatement: args.synthesis.methodology_scope_statement,
  });
}

function mapSignificanceToSeverity(
  significance: string,
): MilitaryExpertFinding["severity"] {
  switch (significance) {
    case "critical":
      return "critical";
    case "important":
      return "major";
    case "minor":
      return "minor";
    default:
      return "informational";
  }
}

function mapDomainToCategory(
  domains: readonly string[],
): MilitaryExpertFinding["category"] {
  const domain = domains[0] ?? "overall_operational_realism";
  const mapping: Record<string, MilitaryExpertFinding["category"]> = {
    firefight_or_battle: "operations_and_tactics",
    movement_and_cover: "operations_and_tactics",
    room_entry_or_breach: "operations_and_tactics",
    team_coordination: "operations_and_tactics",
    command_and_control: "command_and_organization",
    radio_and_communications: "communications_and_terminology",
    weapons_handling: "weapons_and_equipment",
    timing_and_physical_realism: "logistics_and_timing",
    convoy_and_vehicle_contact: "operations_and_tactics",
    aviation: "operations_and_tactics",
    casualty_response: "human_performance",
    intelligence_and_planning: "intelligence_and_opsec",
    military_culture: "military_culture",
    other: "overall_operational_realism",
  };
  return mapping[domain] ?? "overall_operational_realism";
}

export function mapSynthesisToMilitaryExpertReview(args: {
  synthesis: MilitaryExpertV2SynthesisDocument;
  report: MilitaryExpertV2SynthesisReport;
}): MilitaryExpertReview {
  const findings: MilitaryExpertFinding[] = allSynthesisFindings(args.synthesis).map((f) => ({
    finding_id: f.finding_id,
    category: mapDomainToCategory(f.military_domains),
    title: f.title,
    observation: f.plain_english_explanation,
    manuscript_evidence: f.best_locators.map((loc) => ({
      excerpt: f.evidence_summary,
      locator: loc,
    })),
    contrary_evidence: f.contrary_evidence_summary
      ? [{ excerpt: f.contrary_evidence_summary, locator: f.best_locators[0] }]
      : undefined,
    evidence_location: f.best_locators[0],
    confidence: f.confidence,
    severity: mapSignificanceToSeverity(f.revision_significance),
    realism_status:
      f.determination === "author_review_required" ? "context_dependent" : "probable_concern",
    operational_impact: f.why_it_matters,
    story_impact: f.why_it_matters,
    recommendation: f.safe_editorial_guidance,
    recommendation_type: "clarify",
    preservation_note: "",
    author_challenge_allowed: true,
    finding_status:
      f.determination === "author_review_required" ? "author_review_required" : "validated",
  }));

  const arrCount = findings.filter((f) => f.finding_status === "author_review_required").length;

  return Object.freeze({
    expert_key: MILITARY_EXPERT_KEY,
    expert_version: MILITARY_EXPERT_VERSION,
    definition_hash: MILITARY_EXPERT_RUNTIME_DEFINITION_HASH,
    manuscript_version_id: args.synthesis.manuscript_version_id,
    review_scope: "scene",
    review_status:
      arrCount > 0 ? "completed_with_author_review_required" : "complete",
    summary: args.report.overallAssessment,
    strengths: args.report.recurringStrengths.map((s) => s.title),
    findings,
    category_assessments: [],
    overall_realism_assessment: {
      conclusion: args.report.overallAssessment,
      confidence: "medium",
      primary_strengths: args.report.recurringStrengths.map((s) => s.title),
      primary_concerns: args.report.recurringConcerns.map((c) => c.title),
      preservation_priorities: [],
    },
    critical_issues: args.report.topRevisionPriorities.slice(0, 3),
    priority_actions: [...args.report.topRevisionPriorities],
    verification_requests: [],
    escalation_recommendations: [],
    uncertainty_summary: args.report.methodologyScopeStatement,
    author_challenge_supported: true,
    next_step: "Review scene appendix and prioritized findings.",
    provenance: {
      validator_version: "military_expert_v2_synthesis@v1",
      normalization_version: "military_expert_v2_synthesis@v1",
      definition_hash: MILITARY_EXPERT_RUNTIME_DEFINITION_HASH,
    },
  });
}

export interface MilitaryExpertV2ReportProvenance {
  readonly sourceSceneIds: readonly string[];
  readonly sourceSceneReviewIds: readonly string[];
  readonly synthesisKind: string;
  readonly primaryLocator: string | null;
  readonly coverageScope: string;
}

export function buildV2FindingProvenance(
  finding: MilitaryExpertSynthesisFinding,
  scopeBlock: string,
): MilitaryExpertV2ReportProvenance {
  return Object.freeze({
    sourceSceneIds: Object.freeze([...finding.source_scene_ids]),
    sourceSceneReviewIds: Object.freeze([...finding.source_scene_review_ids]),
    synthesisKind: finding.synthesis_kind,
    primaryLocator: finding.best_locators[0] ?? null,
    coverageScope: scopeBlock,
  });
}
