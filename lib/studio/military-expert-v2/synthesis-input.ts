/**
 * Deterministic synthesis input assembly from persisted scene reviews.
 */

import type { MilitaryExpertSceneInventoryDocument } from "./contracts.ts";
import { formatAuthorLocator } from "./locator.ts";
import type { MilitaryExpertSceneReviewDocument } from "./scene-review-contract.ts";
import type { SceneReviewCoverageMetrics } from "./scene-review-coverage.ts";
import type { PersistedSceneReviewRow } from "./scene-review-persistence.ts";
import { scoreMilitaryDepth } from "./scene-review-quality.ts";

export const MILITARY_EXPERT_V2_SYNTHESIS_INPUT_VERSION =
  "military_expert_v2_synthesis_input@v1" as const;

export interface SynthesisInputSceneSummary {
  readonly scene_id: string;
  readonly scene_review_id: string;
  readonly review_status: string;
  readonly locator_label: string;
  readonly scene_types: readonly string[];
  readonly action_categories: readonly string[];
  readonly participants: readonly string[];
  readonly realism_summary: string | null;
  readonly confidence: string | null;
  readonly category_tags: readonly string[];
  readonly authenticity_strengths: readonly {
    readonly title: string;
    readonly explanation: string;
    readonly why_it_matters: string;
    readonly determination: string;
    readonly confidence: string;
    readonly locator: string;
    readonly domains: readonly string[];
  }[];
  readonly authenticity_concerns: readonly {
    readonly title: string;
    readonly explanation: string;
    readonly why_it_matters: string;
    readonly determination: string;
    readonly confidence: string;
    readonly locator: string;
    readonly domains: readonly string[];
  }[];
  readonly supporting_evidence_summaries: readonly string[];
  readonly contrary_evidence_summaries: readonly string[];
  readonly editorial_suggestions: readonly string[];
  readonly quality_scores: Readonly<Record<string, string>> | null;
  readonly insufficient_evidence: boolean;
}

export interface MilitaryExpertV2SynthesisInput {
  readonly input_version: typeof MILITARY_EXPERT_V2_SYNTHESIS_INPUT_VERSION;
  readonly inventory_id: string;
  readonly selection_snapshot_id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly inventory_scene_count: number;
  readonly selected_scene_ids: readonly string[];
  readonly not_selected_scene_ids: readonly string[];
  readonly coverage: SceneReviewCoverageMetrics;
  readonly scene_summaries: readonly SynthesisInputSceneSummary[];
}

function summarizeEvidence(
  doc: MilitaryExpertSceneReviewDocument,
): readonly string[] {
  return doc.supporting_evidence.map(
    (e) => `[${e.excerpt_locator}] ${e.relevance}`,
  );
}

function summarizeContrary(
  doc: MilitaryExpertSceneReviewDocument,
): readonly string[] {
  return doc.contrary_evidence.map(
    (e) => `[${e.excerpt_locator}] ${e.relevance}`,
  );
}

function mapAuthenticityPoints(
  points: MilitaryExpertSceneReviewDocument["authenticity_strengths"],
) {
  return points.map((p) =>
    Object.freeze({
      title: p.title,
      explanation: p.scene_specific_explanation,
      why_it_matters: p.why_it_matters,
      determination: p.determination,
      confidence: p.confidence,
      locator: p.manuscript_evidence_locator,
      domains: [...p.relevant_military_domains],
    }),
  );
}

function buildSceneSummary(
  scene: MilitaryExpertSceneInventoryDocument["scenes"][number],
  review: PersistedSceneReviewRow,
): SynthesisInputSceneSummary {
  const doc = review.document;
  const insufficient = review.reviewStatus === "insufficient_evidence";

  if (!doc || insufficient) {
    return Object.freeze({
      scene_id: scene.scene_id,
      scene_review_id: review.sceneReviewId,
      review_status: review.reviewStatus,
      locator_label: formatAuthorLocator(scene.locator),
      scene_types: [...scene.scene_types],
      action_categories: [...scene.action_categories],
      participants: [...scene.participants],
      realism_summary: doc?.realism_summary ?? null,
      confidence: doc?.confidence ?? null,
      category_tags: doc ? [...doc.category_tags] : [],
      authenticity_strengths: [],
      authenticity_concerns: [],
      supporting_evidence_summaries: [],
      contrary_evidence_summaries: [],
      editorial_suggestions: [],
      quality_scores: null,
      insufficient_evidence: insufficient,
    });
  }

  const scorecard = scoreMilitaryDepth(doc);

  return Object.freeze({
    scene_id: scene.scene_id,
    scene_review_id: review.sceneReviewId,
    review_status: review.reviewStatus,
    locator_label: formatAuthorLocator(scene.locator),
    scene_types: [...scene.scene_types],
    action_categories: [...scene.action_categories],
    participants: [...scene.participants],
    realism_summary: doc.realism_summary,
    confidence: doc.confidence,
    category_tags: [...doc.category_tags],
    authenticity_strengths: Object.freeze(mapAuthenticityPoints(doc.authenticity_strengths)),
    authenticity_concerns: Object.freeze(mapAuthenticityPoints(doc.authenticity_concerns)),
    supporting_evidence_summaries: Object.freeze(summarizeEvidence(doc)),
    contrary_evidence_summaries: Object.freeze(summarizeContrary(doc)),
    editorial_suggestions: Object.freeze(
      doc.safe_editorial_suggestions.map((s) => s.suggestion),
    ),
    quality_scores: Object.freeze({ ...scorecard.scores }),
    insufficient_evidence: false,
  });
}

export function assembleMilitaryExpertV2SynthesisInput(args: {
  inventory: MilitaryExpertSceneInventoryDocument;
  selectedSceneIds: readonly string[];
  reviews: readonly PersistedSceneReviewRow[];
  coverage: SceneReviewCoverageMetrics;
}): MilitaryExpertV2SynthesisInput {
  const selectedSet = new Set(args.selectedSceneIds);
  const reviewByScene = new Map(args.reviews.map((r) => [r.sceneId, r]));
  const sceneById = new Map(args.inventory.scenes.map((s) => [s.scene_id, s]));

  const sceneSummaries = args.selectedSceneIds.map((sceneId) => {
    const scene = sceneById.get(sceneId);
    const review = reviewByScene.get(sceneId);
    if (!scene || !review) {
      throw new Error(`Missing scene or review for ${sceneId}`);
    }
    return buildSceneSummary(scene, review);
  });

  const notSelected = args.inventory.scenes
    .filter((s) => !selectedSet.has(s.scene_id))
    .map((s) => s.scene_id);

  return Object.freeze({
    input_version: MILITARY_EXPERT_V2_SYNTHESIS_INPUT_VERSION,
    inventory_id: args.inventory.inventory_id,
    selection_snapshot_id: args.coverage.selectionSnapshotId,
    manuscript_id: args.inventory.manuscript_id,
    manuscript_version_id: args.inventory.manuscript_version_id,
    inventory_scene_count: args.inventory.scenes.length,
    selected_scene_ids: Object.freeze([...args.selectedSceneIds]),
    not_selected_scene_ids: Object.freeze(notSelected),
    coverage: args.coverage,
    scene_summaries: Object.freeze(sceneSummaries),
  });
}

export function estimateSynthesisInputCharCount(input: MilitaryExpertV2SynthesisInput): number {
  return JSON.stringify(input).length;
}

const PROMPT_TEXT_LIMIT = 320;

function truncateForPrompt(text: string, limit = PROMPT_TEXT_LIMIT): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit - 1)}…`;
}

/** Compact scene summaries for provider prompts — omits raw evidence lists. */
export function compactSceneSummariesForPrompt(
  input: MilitaryExpertV2SynthesisInput,
): readonly Record<string, unknown>[] {
  return input.scene_summaries.map((scene) =>
    Object.freeze({
      scene_id: scene.scene_id,
      scene_review_id: scene.scene_review_id,
      review_status: scene.review_status,
      locator_label: scene.locator_label,
      scene_types: scene.scene_types,
      action_categories: scene.action_categories,
      realism_summary: scene.realism_summary
        ? truncateForPrompt(scene.realism_summary, 240)
        : null,
      confidence: scene.confidence,
      insufficient_evidence: scene.insufficient_evidence,
      authenticity_strengths: scene.authenticity_strengths.map((s) =>
        Object.freeze({
          title: s.title,
          explanation: truncateForPrompt(s.explanation, 220),
          why_it_matters: truncateForPrompt(s.why_it_matters, 180),
          determination: s.determination,
          confidence: s.confidence,
          locator: s.locator,
        }),
      ),
      authenticity_concerns: scene.authenticity_concerns.map((c) =>
        Object.freeze({
          title: c.title,
          explanation: truncateForPrompt(c.explanation, 220),
          why_it_matters: truncateForPrompt(c.why_it_matters, 180),
          determination: c.determination,
          confidence: c.confidence,
          locator: c.locator,
        }),
      ),
      editorial_suggestions: scene.editorial_suggestions
        .slice(0, 3)
        .map((s) => truncateForPrompt(s, 160)),
    }),
  );
}
