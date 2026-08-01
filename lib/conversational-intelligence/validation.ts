import {
  CONVERSATIONAL_RESPONSE_CONTRACT_VERSION,
  CONVERSATIONAL_RESPONSE_TYPES,
} from "./contract.ts";
import type { ConversationalResponse } from "./types.ts";

const MAX_ACKNOWLEDGMENT_LENGTH = 280;
const MAX_REFLECTION_LENGTH = 420;
const MAX_CLARIFICATION_LENGTH = 420;
const QUESTION_MARK = "?";

export function validateConversationalResponse(
  response: ConversationalResponse,
): { ok: true } | { ok: false; error: string } {
  if (response.contract_version !== CONVERSATIONAL_RESPONSE_CONTRACT_VERSION) {
    return { ok: false, error: "Invalid conversational response contract version." };
  }

  if (!(CONVERSATIONAL_RESPONSE_TYPES as readonly string[]).includes(response.response_type)) {
    return { ok: false, error: "Unknown conversational response type." };
  }

  const content = response.content.trim();
  if (!content) {
    return { ok: false, error: "Response content is required." };
  }

  if (!response.stage_id.trim()) {
    return { ok: false, error: "Stage ID is required." };
  }

  switch (response.response_type) {
    case "acknowledgment": {
      if (content.length > MAX_ACKNOWLEDGMENT_LENGTH) {
        return { ok: false, error: "Acknowledgment exceeds maximum length." };
      }
      if (content.includes(QUESTION_MARK)) {
        return { ok: false, error: "Acknowledgments must not contain questions." };
      }
      if (response.asks_question) {
        return { ok: false, error: "Acknowledgments must not ask questions." };
      }
      break;
    }
    case "reflection": {
      if (content.length > MAX_REFLECTION_LENGTH) {
        return { ok: false, error: "Reflection exceeds maximum length." };
      }
      if (content.includes(QUESTION_MARK)) {
        return { ok: false, error: "Reflections must not contain questions." };
      }
      if (response.asks_question) {
        return { ok: false, error: "Reflections must not ask questions." };
      }
      if (!response.grounded_in_author_text) {
        return { ok: false, error: "Reflections must be grounded in author text." };
      }
      break;
    }
    case "type_b_synthesis": {
      if (content.length > MAX_REFLECTION_LENGTH) {
        return { ok: false, error: "Synthesis exceeds maximum length." };
      }
      if (content.includes(QUESTION_MARK)) {
        return { ok: false, error: "Synthesis must not contain questions." };
      }
      if (response.asks_question) {
        return { ok: false, error: "Synthesis must not ask questions." };
      }
      if (!response.grounded_in_author_text) {
        return { ok: false, error: "Synthesis must be grounded in author text." };
      }
      break;
    }
    case "clarification": {
      if (content.length > MAX_CLARIFICATION_LENGTH) {
        return { ok: false, error: "Clarification exceeds maximum length." };
      }
      if (!content.includes(QUESTION_MARK)) {
        return { ok: false, error: "Clarifications must contain a question." };
      }
      if (!response.asks_question) {
        return { ok: false, error: "Clarifications must ask a question." };
      }
      const questionCount = (content.match(/\?/g) ?? []).length;
      if (questionCount > 1) {
        return { ok: false, error: "Clarifications must ask exactly one question." };
      }
      if (/,.*\band\b.*\?/i.test(content)) {
        return { ok: false, error: "Clarifications must not ask compound questions." };
      }
      break;
    }
  }

  return { ok: true };
}
