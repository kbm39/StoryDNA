/**
 * Build minimal MilitaryExpertGenerationRequest for scene review provider calls.
 */

import { randomUUID } from "node:crypto";
import { MILITARY_EXPERT_KEY, MILITARY_EXPERT_VERSION } from "@/experts/military-expert/contracts.ts";
import type { MilitaryExpertGenerationRequest } from "@/experts/military-expert/generation-types.ts";
import { MILITARY_EXPERT_RUNTIME_DEFINITION_HASH } from "@/experts/military-expert/generation-contract.ts";
import {
  MILITARY_EXPERT_SCENE_REVIEW_PROMPT_VERSION,
  buildMilitaryExpertSceneReviewRequest,
} from "./scene-review-prompt.ts";
import type { SceneExcerptAssemblyResult } from "./scene-excerpt.ts";

export function buildSceneReviewGenerationRequest(args: {
  excerpt: SceneExcerptAssemblyResult;
  inventoryId: string;
  selectionSnapshotId: string;
  sceneId: string;
  manuscriptId: string;
  manuscriptVersionId: string;
  manuscriptHash: string;
  maxOutputTokens: number;
}): MilitaryExpertGenerationRequest {
  const correlationId = randomUUID();
  const prompts = buildMilitaryExpertSceneReviewRequest({
    excerpt: args.excerpt,
    inventoryId: args.inventoryId,
    selectionSnapshotId: args.selectionSnapshotId,
    sceneId: args.sceneId,
    manuscriptId: args.manuscriptId,
    manuscriptVersionId: args.manuscriptVersionId,
    maxOutputTokens: args.maxOutputTokens,
  });

  return Object.freeze({
    expertKey: MILITARY_EXPERT_KEY,
    expertVersion: MILITARY_EXPERT_VERSION,
    definitionHash: MILITARY_EXPERT_RUNTIME_DEFINITION_HASH,
    correlationId,
    manuscriptVersionId: args.manuscriptVersionId,
    reviewScope: "full_manuscript",
    canonicalWordCount: 0,
    manuscriptHash: args.manuscriptHash,
    systemPrompt: prompts.systemPrompt,
    reviewPrompt: prompts.userPrompt,
    responseFormat: "json_object",
    temperature: 0,
    maxOutputTokens: args.maxOutputTokens,
    safetyMetadata: Object.freeze({
      editorialOnly: true,
      noOperationalInstruction: true,
      noServiceHistoryClaims: true,
      noFabricatedSources: true,
    }),
    provenance: Object.freeze({
      promptVersion: MILITARY_EXPERT_SCENE_REVIEW_PROMPT_VERSION,
      outputSchemaVersion: "military_expert_scene_review@v1",
      builderVersion: "military_expert_v2_scene_review@v1",
      generationProfileId: "military_expert_v2_scene_review",
    }),
  });
}
