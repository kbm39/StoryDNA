/**
 * Cross-scene synthesis provider prompt for Phase 2B.
 */

import {
  MILITARY_EXPERT_SCENE_CATEGORY_TAGS,
  MILITARY_EXPERT_SCENE_CONFIDENCE_LEVELS,
  MILITARY_EXPERT_SCENE_DETERMINATIONS,
  MILITARY_EXPERT_REVISION_SIGNIFICANCE,
} from "./scene-review-contract.ts";
import {
  MILITARY_EXPERT_SYNTHESIS_KINDS,
  MILITARY_EXPERT_V2_SYNTHESIS_CONTRACT_VERSION,
} from "./synthesis-contract.ts";
import type { MilitaryExpertV2SynthesisInput } from "./synthesis-input.ts";
import { PHASE2B_SYNTHESIS_MAX_OUTPUT_TOKENS } from "./synthesis-budget.ts";

export const MILITARY_EXPERT_V2_SYNTHESIS_PROMPT_VERSION =
  "military_expert_v2_synthesis_prompt@v1" as const;

export function buildMilitaryExpertV2SynthesisSystemPrompt(): string {
  return [
    "You are the senior Military Expert synthesizing completed scene-level authenticity reviews into an author-facing editorial report.",
    "You must NOT independently re-review the full manuscript.",
    "You may ONLY synthesize from the supplied scene-review records.",
    "",
    "REQUIRED TASKS:",
    "1. Identify recurring authenticity strengths across scenes.",
    "2. Identify recurring authenticity concerns across scenes.",
    "3. Merge true duplicates; preserve distinct concerns affecting different scenes.",
    "4. Rank issues by military-authenticity impact, recurrence, scene importance, reader confusion, and revision significance.",
    "5. Preserve source-scene provenance on every finding.",
    "6. Distinguish confirmed findings from author_review_required.",
    "7. Identify top revision priorities.",
    "8. Explain what the manuscript does well militarily.",
    "9. State report scope honestly using supplied coverage counts.",
    "",
    "Do NOT:",
    "- invent new scene facts or findings unsupported by scene reviews;",
    "- erase minority or scene-specific concerns;",
    "- convert insufficient-evidence scenes into confirmed judgments;",
    "- provide tactical how-to instructions;",
    "- discuss unselected scenes as reviewed.",
    "",
    "Book-level findings must reference at least three scene reviews OR be documented as cross_scene_pattern.",
    "Every finding must include source_scene_ids and source_scene_review_ids.",
    "",
    "OUTPUT: Exactly one valid JSON object. No markdown fences. No preamble. No trailing commentary.",
    "Keep each finding explanation concise (2-4 sentences). Limit cross-scene findings to the most important distinct patterns.",
  ].join("\n");
}

function buildSynthesisJsonSchemaHint(ids: {
  synthesisId: string;
  inventoryId: string;
  selectionSnapshotId: string;
  manuscriptId: string;
  manuscriptVersionId: string;
  input: MilitaryExpertV2SynthesisInput;
}): string {
  const domains = MILITARY_EXPERT_SCENE_CATEGORY_TAGS.join("|");
  const confidence = MILITARY_EXPERT_SCENE_CONFIDENCE_LEVELS.join("|");
  const determination = MILITARY_EXPERT_SCENE_DETERMINATIONS.join("|");
  const significance = MILITARY_EXPERT_REVISION_SIGNIFICANCE.join("|");
  const kinds = MILITARY_EXPERT_SYNTHESIS_KINDS.join("|");

  return JSON.stringify(
    {
      contract_version: MILITARY_EXPERT_V2_SYNTHESIS_CONTRACT_VERSION,
      synthesis_id: ids.synthesisId,
      inventory_id: ids.inventoryId,
      selection_snapshot_id: ids.selectionSnapshotId,
      manuscript_id: ids.manuscriptId,
      manuscript_version_id: ids.manuscriptVersionId,
      source_scene_review_ids: ids.input.scene_summaries.map((s) => s.scene_review_id),
      selected_scene_count: ids.input.selected_scene_ids.length,
      terminal_scene_count: ids.input.coverage.terminalCount,
      complete_scene_count: ids.input.coverage.completeCount,
      insufficient_evidence_count: ids.input.coverage.insufficientEvidenceCount,
      recurring_strengths: [
        {
          title: "string",
          explanation: "string",
          source_scene_ids: ["ME-S-001"],
        },
      ],
      recurring_concerns: [
        {
          title: "string",
          explanation: "string",
          source_scene_ids: ["ME-S-001", "ME-S-002"],
        },
      ],
      single_scene_findings: [
        {
          finding_id: "sf_001",
          title: "string",
          plain_english_explanation: "string",
          source_scene_ids: ["ME-S-001"],
          source_scene_review_ids: ["sr_..."],
          best_locators: ["locator label"],
          military_domains: [domains.split("|")[0]],
          evidence_summary: "string",
          why_it_matters: "string",
          revision_significance: significance.split("|")[0],
          confidence,
          contrary_evidence_summary: "string",
          safe_editorial_guidance: "string",
          determination,
          synthesis_kind: kinds.split("|")[0],
        },
      ],
      cross_scene_findings: [],
      top_priority_findings: ["finding_id"],
      author_review_required_items: ["finding_id"],
      coverage_summary: {
        inventory_scene_count: ids.input.inventory_scene_count,
        selected_scene_count: ids.input.selected_scene_ids.length,
        terminal_scene_count: ids.input.coverage.terminalCount,
        complete_scene_count: ids.input.coverage.completeCount,
        insufficient_evidence_count: ids.input.coverage.insufficientEvidenceCount,
        not_selected_scene_count: ids.input.not_selected_scene_ids.length,
        scope_statement: "string",
      },
      overall_authenticity_assessment: "string",
      top_revision_priorities: ["string"],
      methodology_scope_statement: "string",
    },
    null,
    2,
  );
}

export function buildMilitaryExpertV2SynthesisUserPrompt(args: {
  synthesisId: string;
  input: MilitaryExpertV2SynthesisInput;
}): string {
  return [
    "Synthesize the following completed scene reviews into a cross-scene Military Expert report.",
    "Use ONLY the scene summaries below — do not invent manuscript content.",
    "",
    "Scene review summaries (JSON):",
    JSON.stringify(args.input.scene_summaries, null, 2),
    "",
    "Coverage context:",
    JSON.stringify(
      {
        inventory_scene_count: args.input.inventory_scene_count,
        selected_scene_ids: args.input.selected_scene_ids,
        not_selected_scene_ids: args.input.not_selected_scene_ids,
        coverage: args.input.coverage,
      },
      null,
      2,
    ),
    "",
    `Required identifiers: synthesis_id=${args.synthesisId}, inventory_id=${args.input.inventory_id}, selection_snapshot_id=${args.input.selection_snapshot_id}, manuscript_id=${args.input.manuscript_id}, manuscript_version_id=${args.input.manuscript_version_id}`,
    "",
    "Respond with one JSON object using snake_case keys matching military_expert_v2_synthesis@v1, including:",
    "recurring_strengths, recurring_concerns, single_scene_findings, cross_scene_findings, top_priority_findings, author_review_required_items, coverage_summary, overall_authenticity_assessment, top_revision_priorities, methodology_scope_statement.",
    "Each finding needs: finding_id, title, plain_english_explanation, source_scene_ids, source_scene_review_ids, best_locators, military_domains, evidence_summary, why_it_matters, revision_significance, confidence, contrary_evidence_summary, safe_editorial_guidance, determination, synthesis_kind.",
  ].join("\n");
}

export function buildMilitaryExpertV2SynthesisGenerationRequest(args: {
  synthesisId: string;
  input: MilitaryExpertV2SynthesisInput;
  manuscriptHash: string;
  correlationId: string;
}) {
  return Object.freeze({
    systemPrompt: buildMilitaryExpertV2SynthesisSystemPrompt(),
    userPrompt: buildMilitaryExpertV2SynthesisUserPrompt({
      synthesisId: args.synthesisId,
      input: args.input,
    }),
    maxOutputTokens: PHASE2B_SYNTHESIS_MAX_OUTPUT_TOKENS,
    correlationId: args.correlationId,
    manuscriptHash: args.manuscriptHash,
    promptVersion: MILITARY_EXPERT_V2_SYNTHESIS_PROMPT_VERSION,
    outputSchemaVersion: MILITARY_EXPERT_V2_SYNTHESIS_CONTRACT_VERSION,
  });
}
