/**
 * Bounded scene excerpt assembly for Phase 2A provider reviews.
 */

import type { MilitaryExpertSceneInventoryEntry } from "./contracts.ts";
import { formatAuthorLocator } from "./locator.ts";

export const SCENE_CONTEXT_CHARS_BEFORE = 800;
export const SCENE_CONTEXT_CHARS_AFTER = 800;
export const SCENE_EXCERPT_MAX_CHARS = 12_000;

export interface SceneExcerptAssemblyInput {
  readonly scene: MilitaryExpertSceneInventoryEntry;
  readonly manuscriptText: string;
  readonly authorIntent?: string | null;
  readonly settingContext?: string | null;
}

export interface SceneExcerptAssemblyResult {
  readonly sceneId: string;
  readonly locatorLabel: string;
  readonly twoSentenceDescription: string;
  readonly sceneTypes: readonly string[];
  readonly actionCategories: readonly string[];
  readonly participants: readonly string[];
  readonly settingContext: string | null;
  readonly authorIntent: string | null;
  readonly sceneExcerpt: string;
  readonly contextBefore: string;
  readonly contextAfter: string;
  readonly sceneStartOffset: number;
  readonly sceneEndOffset: number;
  readonly totalCharsSent: number;
}

export function validateSceneOffsets(
  scene: MilitaryExpertSceneInventoryEntry,
  manuscriptLength: number,
): { ok: true } | { ok: false; reason: string } {
  const start = scene.locator.internal_start_offset;
  const end = scene.locator.internal_end_offset;
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return { ok: false, reason: "Offsets must be integers." };
  }
  if (start < 0 || end <= start) {
    return { ok: false, reason: "Invalid offset range." };
  }
  if (end > manuscriptLength) {
    return { ok: false, reason: "End offset exceeds manuscript length." };
  }
  return { ok: true };
}

export function assembleSceneExcerpt(input: SceneExcerptAssemblyInput): SceneExcerptAssemblyResult {
  const { scene, manuscriptText } = input;
  const validation = validateSceneOffsets(scene, manuscriptText.length);
  if (!validation.ok) {
    throw new Error(`Scene offset validation failed for ${scene.scene_id}: ${validation.reason}`);
  }

  const sceneStart = scene.locator.internal_start_offset;
  const sceneEnd = scene.locator.internal_end_offset;
  const contextStart = Math.max(0, sceneStart - SCENE_CONTEXT_CHARS_BEFORE);
  const contextEnd = Math.min(manuscriptText.length, sceneEnd + SCENE_CONTEXT_CHARS_AFTER);

  const contextBefore = manuscriptText.slice(contextStart, sceneStart);
  const sceneExcerpt = manuscriptText.slice(sceneStart, sceneEnd);
  const contextAfter = manuscriptText.slice(sceneEnd, contextEnd);

  let boundedScene = sceneExcerpt;
  let boundedBefore = contextBefore;
  let boundedAfter = contextAfter;
  let total = boundedBefore.length + boundedScene.length + boundedAfter.length;

  if (total > SCENE_EXCERPT_MAX_CHARS) {
    const sceneBudget = Math.min(boundedScene.length, Math.floor(SCENE_EXCERPT_MAX_CHARS * 0.7));
    boundedScene = boundedScene.slice(0, sceneBudget);
    const remaining = SCENE_EXCERPT_MAX_CHARS - boundedScene.length;
    const halfContext = Math.floor(remaining / 2);
    boundedBefore = boundedBefore.slice(-halfContext);
    boundedAfter = boundedAfter.slice(0, remaining - halfContext);
    total = boundedBefore.length + boundedScene.length + boundedAfter.length;
  }

  return Object.freeze({
    sceneId: scene.scene_id,
    locatorLabel: formatAuthorLocator(scene.locator),
    twoSentenceDescription: scene.two_sentence_description,
    sceneTypes: scene.scene_types,
    actionCategories: scene.action_categories,
    participants: scene.participants,
    settingContext: input.settingContext ?? null,
    authorIntent: input.authorIntent ?? null,
    sceneExcerpt: boundedScene,
    contextBefore: boundedBefore,
    contextAfter: boundedAfter,
    sceneStartOffset: sceneStart,
    sceneEndOffset: sceneEnd,
    totalCharsSent: total,
  });
}

export function formatSceneExcerptForPrompt(excerpt: SceneExcerptAssemblyResult): string {
  const parts: string[] = [
    `Scene ID: ${excerpt.sceneId}`,
    `Locator: ${excerpt.locatorLabel}`,
    `Description: ${excerpt.twoSentenceDescription}`,
    `Scene types: ${excerpt.sceneTypes.join(", ")}`,
    `Action categories: ${excerpt.actionCategories.join(", ")}`,
    `Participants: ${excerpt.participants.join(", ") || "unspecified"}`,
  ];
  if (excerpt.settingContext) parts.push(`Setting context: ${excerpt.settingContext}`);
  if (excerpt.authorIntent) parts.push(`Author intent: ${excerpt.authorIntent}`);
  parts.push("--- CONTEXT BEFORE SCENE ---");
  parts.push(excerpt.contextBefore || "(none)");
  parts.push("--- SCENE EXCERPT ---");
  parts.push(excerpt.sceneExcerpt);
  parts.push("--- CONTEXT AFTER SCENE ---");
  parts.push(excerpt.contextAfter || "(none)");
  return parts.join("\n");
}
