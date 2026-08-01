import { CONVERSATIONAL_RESPONSE_CONTRACT_VERSION } from "./contract.ts";
import { isStudioProgressiveEditorialUnderstandingEnabled } from "./peu/feature-flag.ts";
import { emitWithQualityGate } from "./peu/provider-fallback.ts";
import { RESPONSE_QUALITY_LEVEL_NUM } from "./peu/types.ts";
import { buildGroundedReflection, buildEditorialSynthesis } from "./templates/peu-templates.ts";
import type { ConversationalResponse } from "./types.ts";
import { validateConversationalResponse } from "./validation.ts";

const ACKNOWLEDGMENTS = [
  "Thank you — that's clear.",
  "I have what I need for this part.",
  "That gives me a solid picture of your intent here.",
] as const;

function pickAcknowledgment(stageId: string): string {
  if (stageId === "eic_intake.comparison_titles") {
    return "Noted — those comps will help with positioning.";
  }
  const index = Math.abs(hashString(stageId)) % ACKNOWLEDGMENTS.length;
  return ACKNOWLEDGMENTS[index]!;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function extractShortPhrase(answer: string, maxWords = 12): string {
  const normalized = answer.trim().replace(/\s+/g, " ");
  const words = normalized.split(" ");
  if (words.length <= maxWords) return normalized;
  return `${words.slice(0, maxWords).join(" ")}…`;
}

function buildLegacyReflection(stageId: string, authorAnswer: string): string {
  const phrase = extractShortPhrase(authorAnswer, 10);
  switch (stageId) {
    case "eic_intake.primary_vision":
      return `You described the manuscript as "${phrase}" — I'll keep that framing in mind.`;
    case "eic_intake.creative_motivation":
      return `I heard that you wrote this because ${phrase.charAt(0).toLowerCase()}${phrase.slice(1)}`;
    case "eic_intake.desired_reader_experience":
      return `You want readers to experience ${phrase.charAt(0).toLowerCase()}${phrase.slice(1)}`;
    case "eic_intake.market_position":
      return `It sounds like you're positioning this for ${phrase.charAt(0).toLowerCase()}${phrase.slice(1)}`;
    case "eic_intake.success_definition":
      return `For you, success at this stage means ${phrase.charAt(0).toLowerCase()}${phrase.slice(1)}`;
    default:
      return `You mentioned ${phrase.charAt(0).toLowerCase()}${phrase.slice(1)} — that's useful context.`;
  }
}

function buildReflection(stageId: string, authorAnswer: string): string {
  if (isStudioProgressiveEditorialUnderstandingEnabled()) {
    const synthesis = buildEditorialSynthesis(stageId, authorAnswer);
    if (synthesis) return synthesis;
    return buildGroundedReflection(stageId, authorAnswer);
  }
  return buildLegacyReflection(stageId, authorAnswer);
}

function responseTypeFromQuality(
  qualityLevel: string,
): "acknowledgment" | "reflection" | "type_b_synthesis" | "clarification" {
  switch (qualityLevel) {
    case "editorial_synthesis":
      return "type_b_synthesis";
    case "material_clarification":
      return "clarification";
    case "acknowledgment":
      return "acknowledgment";
    default:
      return "reflection";
  }
}

export function emitClarificationQuestion(stageId: string, authorAnswer: string): string {
  const trimmed = authorAnswer.trim();
  switch (stageId) {
    case "eic_intake.primary_vision":
      return "Could you say a bit more about what the manuscript is about?";
    case "eic_intake.market_position":
      if (/romance/i.test(trimmed)) {
        return "When you describe the story as a romance, do you mean romance is its primary genre, or that it is a thriller with a central romantic storyline?";
      }
      return trimmed.length > 0
        ? "When you describe the market, do you have a specific reader or category in mind?"
        : "Who do you see as the primary reader for this manuscript?";
    case "eic_intake.success_definition":
      return 'When you say success at this stage, do you mean query-ready, self-publishing, or something else?';
    default:
      return "Could you say a bit more so I understand what you mean?";
  }
}

export function emitConversationalResponse(input: {
  stage_id: string;
  response_type: "acknowledgment" | "reflection" | "clarification";
  author_answer?: string | null;
  clarification_question?: string;
  prior_author_turns?: readonly string[];
}): ConversationalResponse {
  let content: string;
  let grounded = false;
  let asksQuestion = false;
  let qualityLevel: 1 | 2 | 3 | 4 | undefined;
  let gateResult: "pass" | string = "pass";
  let failReason: string | null = null;
  let fallbackUsed = false;
  let repairAttempted = false;
  let resolvedType = input.response_type;

  switch (input.response_type) {
    case "acknowledgment":
      content = pickAcknowledgment(input.stage_id);
      qualityLevel = 1;
      break;
    case "reflection": {
      const authorAnswer = input.author_answer ?? "";
      grounded = Boolean(authorAnswer.trim());

      if (isStudioProgressiveEditorialUnderstandingEnabled() && grounded) {
        const emitted = emitWithQualityGate({
          stageId: input.stage_id,
          authorAnswer,
          priorAuthorTurns: input.prior_author_turns,
          preferredLevel: "grounded_reflection",
        });
        content = emitted.content;
        qualityLevel = RESPONSE_QUALITY_LEVEL_NUM[emitted.qualityLevel];
        gateResult = emitted.gateResult;
        failReason = emitted.failReason;
        fallbackUsed = emitted.fallbackUsed;
        repairAttempted = emitted.repairAttempted;
        resolvedType = responseTypeFromQuality(emitted.qualityLevel) as typeof input.response_type;
      } else {
        content = buildReflection(input.stage_id, authorAnswer);
        qualityLevel = 2;
      }
      break;
    }
    case "clarification":
      content =
        input.clarification_question ??
        emitClarificationQuestion(input.stage_id, input.author_answer ?? "");
      asksQuestion = true;
      qualityLevel = 4;

      if (isStudioProgressiveEditorialUnderstandingEnabled()) {
        const emitted = emitWithQualityGate({
          stageId: input.stage_id,
          authorAnswer: input.author_answer ?? "",
          priorAuthorTurns: input.prior_author_turns,
          candidateResponse: content,
          preferredLevel: "material_clarification",
        });
        content = emitted.content;
        gateResult = emitted.gateResult;
        failReason = emitted.failReason;
        fallbackUsed = emitted.fallbackUsed;
        repairAttempted = emitted.repairAttempted;
      }
      break;
  }

  const mappedType =
    resolvedType === "reflection" && qualityLevel === 3 ? "type_b_synthesis" : resolvedType;

  const response: ConversationalResponse = {
    contract_version: CONVERSATIONAL_RESPONSE_CONTRACT_VERSION,
    response_type: mappedType as ConversationalResponse["response_type"],
    content,
    stage_id: input.stage_id,
    grounded_in_author_text: grounded,
    asks_question: asksQuestion,
    ...(isStudioProgressiveEditorialUnderstandingEnabled()
      ? {
          quality_level: qualityLevel,
          gate_result: gateResult,
          fail_reason: failReason,
          fallback_used: fallbackUsed,
          repair_attempted: repairAttempted,
        }
      : {}),
  };

  const validation = validateConversationalResponse(response);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  return response;
}
