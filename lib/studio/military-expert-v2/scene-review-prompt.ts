/**
 * Scene-specific Military Expert provider prompt for Phase 2A.
 */

import type { SceneExcerptAssemblyResult } from "./scene-excerpt.ts";
import { formatSceneExcerptForPrompt } from "./scene-excerpt.ts";
import {
  MILITARY_EXPERT_SCENE_CATEGORY_TAGS,
  MILITARY_EXPERT_SCENE_CONFIDENCE_LEVELS,
  MILITARY_EXPERT_SCENE_DETERMINATIONS,
  MILITARY_EXPERT_SCENE_REVIEW_CONTRACT_VERSION,
  MILITARY_EXPERT_REVISION_SIGNIFICANCE,
} from "./scene-review-contract.ts";

export const MILITARY_EXPERT_SCENE_REVIEW_PROMPT_VERSION =
  "military_expert_scene_review_prompt@v1" as const;

export function buildMilitaryExpertSceneReviewSystemPrompt(): string {
  return [
    "You are a military-authenticity editor reviewing ONE selected manuscript scene.",
    "You are NOT a general developmental editor, plot summarizer, tactical instructor, weapons instructor, or operational planner.",
    "",
    "Assess only domains relevant to the supplied scene:",
    "- battle or firefight sequence",
    "- movement and use of cover",
    "- breach or room-entry clarity",
    "- team coordination",
    "- command and control",
    "- radio and communications",
    "- weapons handling",
    "- timing and physical realism",
    "- convoy and vehicle contact",
    "- aviation insertion or extraction",
    "- casualty response and evacuation",
    "- intelligence and mission planning",
    "- military culture and chain of command",
    "",
    "REQUIRED BEHAVIOR:",
    "1. Identify at least one supported authenticity strength, OR explicitly state in authenticity_strengths: title='No supported strength', scene_specific_explanation='No notable authenticity strength could be supported from the supplied scene.'",
    "2. Identify supported authenticity concerns with scene-specific evidence.",
    "3. Explain why each point matters to a military-informed reader.",
    "4. Tie every strength and concern to the supplied scene only.",
    "5. Search for contrary evidence before confirming a concern.",
    "6. Use determination: confirmed OR author_review_required.",
    "7. Provide safe editorial revision guidance — never operational how-to.",
    "8. State confidence: high, medium, or low.",
    "9. Avoid book-level commentary.",
    "10. Do not discuss any scene not supplied.",
    "11. Do not invent events, equipment, dialogue, unit behavior, or injuries.",
    "",
    "SAFETY — DO NOT provide step-by-step real-world tactical instruction for:",
    "breaching, explosives, ambush execution, weapons employment, evasion, disabling security, causing injury or death.",
    "",
    "Allowed editorial guidance: clarify team roles, order of events, command responsibility, communications, injury consequences, character positioning, movement continuity, tactical credibility in context.",
    "",
    "OUTPUT: Structured JSON only. No preamble. No markdown wrapper. No trailing commentary.",
  ].join("\n");
}

export function buildMilitaryExpertSceneReviewUserPrompt(args: {
  excerpt: SceneExcerptAssemblyResult;
  inventoryId: string;
  selectionSnapshotId: string;
  sceneId: string;
  manuscriptId: string;
  manuscriptVersionId: string;
}): string {
  const excerptBlock = formatSceneExcerptForPrompt(args.excerpt);
  const schemaHint = buildSceneReviewJsonSchemaHint({
    inventoryId: args.inventoryId,
    selectionSnapshotId: args.selectionSnapshotId,
    sceneId: args.sceneId,
    manuscriptId: args.manuscriptId,
    manuscriptVersionId: args.manuscriptVersionId,
  });

  return [
    "Review the following selected scene for military authenticity.",
    "",
    excerptBlock,
    "",
    "Respond with a single JSON object matching this schema:",
    schemaHint,
  ].join("\n");
}

function buildSceneReviewJsonSchemaHint(ids: {
  inventoryId: string;
  selectionSnapshotId: string;
  sceneId: string;
  manuscriptId: string;
  manuscriptVersionId: string;
}): string {
  const categoryTags = MILITARY_EXPERT_SCENE_CATEGORY_TAGS.join("|");
  const confidence = MILITARY_EXPERT_SCENE_CONFIDENCE_LEVELS.join("|");
  const determination = MILITARY_EXPERT_SCENE_DETERMINATIONS.join("|");
  const significance = MILITARY_EXPERT_REVISION_SIGNIFICANCE.join("|");

  return JSON.stringify(
    {
      contract_version: MILITARY_EXPERT_SCENE_REVIEW_CONTRACT_VERSION,
      scene_id: ids.sceneId,
      inventory_id: ids.inventoryId,
      selection_snapshot_id: ids.selectionSnapshotId,
      manuscript_id: ids.manuscriptId,
      manuscript_version_id: ids.manuscriptVersionId,
      review_status: "complete|insufficient_evidence|outside_expertise",
      authenticity_strengths: [
        {
          title: "string",
          scene_specific_explanation: "string (specific, not vague)",
          why_it_matters: "string",
          manuscript_evidence_locator: "string",
          relevant_military_domains: [`${categoryTags}`],
          confidence,
          revision_significance: significance,
          determination,
        },
      ],
      authenticity_concerns: "same shape as strengths",
      supporting_evidence: [
        { excerpt_locator: "string", excerpt_text: "string", relevance: "string" },
      ],
      contrary_evidence: "same as supporting_evidence",
      safe_editorial_suggestions: [
        {
          suggestion: "string (editorial only, no tactical how-to)",
          rationale: "string",
          addresses_concern_title: "string|null",
        },
      ],
      realism_summary: "2-4 sentences, scene-specific",
      confidence,
      category_tags: [`${categoryTags}`],
    },
    null,
    2,
  );
}

export function buildMilitaryExpertSceneReviewRequest(args: {
  excerpt: SceneExcerptAssemblyResult;
  inventoryId: string;
  selectionSnapshotId: string;
  sceneId: string;
  manuscriptId: string;
  manuscriptVersionId: string;
  maxOutputTokens: number;
}): {
  systemPrompt: string;
  userPrompt: string;
  promptVersion: typeof MILITARY_EXPERT_SCENE_REVIEW_PROMPT_VERSION;
} {
  return Object.freeze({
    systemPrompt: buildMilitaryExpertSceneReviewSystemPrompt(),
    userPrompt: buildMilitaryExpertSceneReviewUserPrompt(args),
    promptVersion: MILITARY_EXPERT_SCENE_REVIEW_PROMPT_VERSION,
  });
}
