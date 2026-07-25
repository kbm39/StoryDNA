/**
 * Deterministic Military Expert prompt builders (PR 2 — draft, not sent to providers).
 */

import { STORY_GROUNDING, buildAuthorIntentBlock, authoritativeWordCountBlock } from "@/lib/ai/shared.ts";
import type { ReviewerDefinition } from "@/lib/ai/review-engine.ts";
import type { AuthorIntent } from "@/lib/types.ts";
import {
  MILITARY_EXPERT_CATEGORIES,
  MILITARY_EXPERT_KEY,
  MILITARY_EXPERT_MAX_EVIDENCE_EXCERPT_WORDS,
  type MilitaryExpertReviewScope,
} from "./contracts.ts";
import { militaryExpertOutputSchemaPromptBlock } from "./output-schema.ts";

const CATEGORY_DISPLAY: Record<(typeof MILITARY_EXPERT_CATEGORIES)[number], string> = {
  command_and_organization: "Command & Organization",
  operations_and_tactics: "Operations & Tactics",
  weapons_and_equipment: "Weapons & Equipment",
  intelligence_and_opsec: "Intelligence & OPSEC",
  logistics_and_timing: "Logistics & Timing",
  human_performance: "Human Performance",
  communications_and_terminology: "Communications & Terminology",
  military_culture: "Military Culture",
  rules_authority_and_coordination: "Rules, Authority & Coordination",
  overall_operational_realism: "Overall Operational Realism",
};

export interface MilitaryExpertReviewPromptInput {
  def: ReviewerDefinition;
  intent?: AuthorIntent | null;
  manuscriptVersionId: string;
  reviewScope: MilitaryExpertReviewScope;
  manuscriptText: string;
  canonicalWordCount: number;
  manuscriptHash: string;
  genreContext?: string | null;
  countryPeriod?: string | null;
}

function categoryDefinitionsBlock(def: ReviewerDefinition): string {
  return MILITARY_EXPERT_CATEGORIES.map((key) => {
    const category = def.evaluationFramework.categories.find((item) => item.key === key);
    const questions = category?.questions.map((question) => `   - ${question}`).join("\n") ?? "";
    return `• ${CATEGORY_DISPLAY[key]} (${key})\n${questions}`;
  }).join("\n");
}

/** Build the Military Expert system prompt from the authoritative definition. */
export function buildMilitaryExpertSystemPrompt(def: ReviewerDefinition): string {
  const personality = def.personality;
  const character = [
    "YOUR PROFESSIONAL CHARACTER — stay in this voice throughout:",
    `You are ${personality.archetype}.`,
    personality.traits.length ? `You are ${personality.traits.join(", ")}.` : "",
    `${personality.voiceNotes} (Directness: ${personality.directness}; warmth: ${personality.warmth}; humor: ${personality.humor}.)`,
  ]
    .filter(Boolean)
    .join(" ");

  const philosophy = def.communicationPhilosophy.length
    ? `\n\nHOW YOU COMMUNICATE — non-negotiable:\n${def.communicationPhilosophy.map((item) => `- ${item}`).join("\n")}`
    : "";

  const charter = [
    "MILITARY EXPERT CHARTER",
    `- Expert key: ${MILITARY_EXPERT_KEY}`,
    `- Mission: ${def.mission}`,
    `- Preserve dramatic intent, pacing, character intent, emotional stakes, and genre expectations unless realism materially requires change.`,
    `- Distinguish confirmed error, probable concern, context-dependent concern, plausible-but-unusual, accurate, insufficient evidence, and outside expertise.`,
    `- Search for contrary evidence before confirming a criticism.`,
    `- Every negative finding requires manuscript evidence, confidence, operational impact, recommendation, preservation note, and contrary-evidence handling.`,
    `- Return insufficient_evidence rather than asserting unsupported concerns.`,
    `- Author may challenge any finding; author_challenge_supported must be true.`,
  ].join("\n");

  const boundaries = [
    "DOMAIN BOUNDARIES",
    `- In scope: ${def.expertise.inScope.join("; ")}`,
    `- Out of scope: ${def.expertise.outOfScope.join("; ")}`,
  ].join("\n");

  const safety = [
    "SAFETY AND EVIDENCE LIMITS",
    "- Provide editorial critique and high-level alternatives only.",
    "- Do not provide step-by-step operational instructions, weapons instruction, targeting optimization, or evasion guidance.",
    "- Do not claim personal military service, classified knowledge, or fabricated sources.",
    "- Do not assign letter grades or school-style percentages.",
    "- Do not invent missing country, period, doctrine, or manuscript context.",
    `- Evidence excerpts must be <= ${MILITARY_EXPERT_MAX_EVIDENCE_EXCERPT_WORDS} words with locators when possible.`,
  ].join("\n");

  const output = [
    "OUTPUT REQUIREMENT",
    "- Respond with ONE strict JSON object matching the Military Expert output schema.",
    "- No markdown wrapper. No prose outside the JSON object.",
  ].join("\n");

  return [
    def.system,
    "",
    character,
    philosophy,
    "",
    charter,
    "",
    boundaries,
    "",
    safety,
    "",
    output,
  ].join("\n");
}

/** Build the Military Expert review prompt for a bounded manuscript scope. */
export function buildMilitaryExpertReviewPrompt(input: MilitaryExpertReviewPromptInput): string {
  const def = input.def;
  const metadata = [
    "MANUSCRIPT METADATA",
    `- manuscript_version_id: ${input.manuscriptVersionId}`,
    `- review_scope: ${input.reviewScope}`,
    `- canonical_word_count: ${input.canonicalWordCount}`,
    `- manuscript_hash: ${input.manuscriptHash}`,
    `- genre_context: ${input.genreContext?.trim() || "not supplied — do not invent genre context"}`,
    `- country_period: ${input.countryPeriod?.trim() || "not supplied — mark context-dependent or insufficient_evidence rather than guessing"}`,
  ].join("\n");

  const framework = [
    "EVALUATION CATEGORIES",
    categoryDefinitionsBlock(def),
  ].join("\n");

  const findingRules = [
    "FINDING REQUIREMENTS",
    "- Negative findings require manuscript evidence, contrary evidence or explicit no-contrary-evidence statement, confidence, operational impact, recommendation, and preservation note.",
    "- outside_expertise findings must name escalation_expert.",
    "- insufficient_evidence findings must not carry score deductions.",
    "- accurate findings must not carry negative score deductions.",
    "- critical severity requires high confidence or explicit escalation_expert.",
  ].join("\n");

  const escalation = [
    "ESCALATION BEHAVIOR",
    "- Escalate country-specific, historical, classified, medical, legal, or police-specific claims to the appropriate specialist.",
    "- Use verification_requests when Librarian or author confirmation is needed.",
    "- Use escalation_recommendations when another expert should review the material.",
  ].join("\n");

  const intentBlock = def.capabilities.usesAuthorIntent
    ? `\n\n${buildAuthorIntentBlock(input.intent ?? null)}`
    : "";
  const grounding = def.grounding ? `\n\n${STORY_GROUNDING}` : "";
  const wordCountBlock = authoritativeWordCountBlock(input.canonicalWordCount);

  return [
    metadata,
    "",
    `YOUR MISSION\n${def.mission}`,
    "",
    framework,
    "",
    findingRules,
    "",
    escalation,
    "",
    def.intro,
    "",
    militaryExpertOutputSchemaPromptBlock(),
    "",
    def.tone,
    wordCountBlock,
    intentBlock,
    grounding,
    "",
    "MANUSCRIPT TEXT — review only this supplied scope; do not invent missing passages:",
    input.manuscriptText.trim(),
  ].join("\n");
}

/** Revision candidates are disabled in v1 draft — deterministic placeholder only. */
export function buildMilitaryExpertRevisionCandidatesPrompt(_args: {
  reviewMemo: string;
}): string {
  void _args;
  return [
    "Military Expert revision candidates are disabled in v1 draft.",
    "Return an empty JSON array if invoked in a test harness.",
  ].join(" ");
}
