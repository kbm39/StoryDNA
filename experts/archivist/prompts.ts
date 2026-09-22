/**
 * Deterministic Archivist prompt builders — stubs, not sent to providers.
 */

import { STORY_GROUNDING } from "@/lib/ai/shared.ts";
import type { ReviewerDefinition } from "@/lib/ai/review-engine.ts";
import {
  ARCHIVIST_EXPERT_KEY,
  ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS,
  ARCHIVIST_REVIEW_SCHEMA,
} from "./contracts.ts";
import { ARCHIVIST_CONSTITUTION_RULE_SUMMARIES, ARCHIVIST_PURPOSE } from "./constitution.ts";

export interface ArchivistReviewPromptInput {
  def: ReviewerDefinition;
  manuscriptVersionId: string;
  manuscriptId: string;
  contentHash: string;
  manuscriptText: string;
  seriesId?: string | null;
}

export function buildArchivistSystemPrompt(def: ReviewerDefinition): string {
  const personality = def.personality;
  return [
    def.system,
    `You are ${personality.archetype}.`,
    personality.traits.length ? `You are ${personality.traits.join(", ")}.` : "",
    personality.voiceNotes,
    "",
    "ARCHIVIST CONSTITUTION — non-negotiable:",
    ...ARCHIVIST_CONSTITUTION_RULE_SUMMARIES.map((rule) => `- ${rule}`),
    "",
    `Mission: ${ARCHIVIST_PURPOSE}`,
    `Authoritative stored schema: ${ARCHIVIST_REVIEW_SCHEMA}`,
    `Model-facing schema: archivist_model_output@v1 — findings, canon_delta, entity_ambiguities, summary only.`,
    `Expert key ${ARCHIVIST_EXPERT_KEY} is StoryDNA-owned and must not be invented.`,
    `Evidence excerpts may not exceed ${ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS} words.`,
    "Never emit accepted canon. Canon delta status is always candidate.",
    "Do not emit author_challenge_supported or author_action. StoryDNA sets those.",
    "Do not assign letter grades.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function buildArchivistReviewPrompt(input: ArchivistReviewPromptInput): string {
  return [
    input.def.intro,
    "",
    STORY_GROUNDING,
    "",
    `Manuscript id: ${input.manuscriptId}`,
    `Manuscript version: ${input.manuscriptVersionId}`,
    `Content hash: ${input.contentHash}`,
    input.seriesId ? `Series id: ${input.seriesId}` : "Series id: none (standalone)",
    "",
    "Manuscript:",
    input.manuscriptText,
  ].join("\n");
}

export function buildArchivistRevisionCandidatesPrompt(_args: { reviewMemo: string }): string {
  void _args;
  return "Archivist does not generate revision candidates in v1.0.0-draft.";
}
