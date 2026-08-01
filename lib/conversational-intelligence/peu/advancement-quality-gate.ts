import { detectAntiEcho } from "./anti-echo.ts";
import {
  countQuestions,
  detectEmptyPraise,
  detectTherapyLanguage,
  isCompoundQuestion,
  isUnnecessaryClarification,
} from "./clarification-rules.ts";
import { validateGrounding } from "./grounding-validator.ts";
import type {
  AdvancementGateInput,
  AdvancementGateResult,
  GateFailReason,
  ResponseQualityLevel,
} from "./types.ts";
import { RESPONSE_QUALITY_LEVEL_NUM } from "./types.ts";

const MAX_SENTENCES: Record<ResponseQualityLevel, number> = {
  acknowledgment: 2,
  grounded_reflection: 4,
  editorial_synthesis: 4,
  material_clarification: 3,
};

function countSentences(text: string): number {
  return text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
}

function isSubstantiveAnswer(authorTurn: string): boolean {
  const trimmed = authorTurn.trim();
  if (trimmed.length <= 5) return false;
  if (/^thank/i.test(trimmed)) return false;
  return trimmed.length >= 20 || /[,;—–-]/.test(trimmed);
}

export function evaluateAdvancementQualityGate(
  input: AdvancementGateInput,
): AdvancementGateResult {
  const { candidateResponse, authorTurn, qualityLevel } = input;
  const substantive =
    input.isSubstantiveAnswer ?? isSubstantiveAnswer(authorTurn);

  const fail = (reason: GateFailReason): AdvancementGateResult => ({
    gate_result: reason,
    quality_level: qualityLevel,
    fail_reason: reason,
  });

  if (!candidateResponse.trim()) {
    return fail("RESPONSE_NOT_GROUNDED");
  }

  const sentenceCount = countSentences(candidateResponse);
  if (sentenceCount > MAX_SENTENCES[qualityLevel]) {
    return fail("RESPONSE_TOO_VERBOSE");
  }

  const praise = detectEmptyPraise(candidateResponse);
  if (praise) return fail(praise);

  const therapy = detectTherapyLanguage(candidateResponse);
  if (therapy) return fail(therapy);

  if (qualityLevel === "material_clarification") {
    if (countQuestions(candidateResponse) === 0) {
      return fail("RESPONSE_NOT_GROUNDED");
    }
    if (isCompoundQuestion(candidateResponse)) {
      return fail("MULTIPLE_CLARIFICATIONS");
    }
    if (
      isUnnecessaryClarification({
        stageId: input.stageId,
        authorTurn,
        qualityLevel,
      })
    ) {
      return fail("UNNECESSARY_CLARIFICATION");
    }
    return { gate_result: "pass", quality_level: qualityLevel, fail_reason: null };
  }

  if (qualityLevel === "acknowledgment" && substantive) {
    return fail("INSUFFICIENT_EDITORIAL_ADVANCEMENT");
  }

  const grounding = validateGrounding({
    response: candidateResponse,
    authorTurn,
    priorAuthorTurns: input.priorAuthorTurns,
  });
  if (!grounding.grounded && grounding.fail_reason) {
    return fail(grounding.fail_reason);
  }

  if (qualityLevel === "grounded_reflection" || qualityLevel === "editorial_synthesis") {
    const antiEcho = detectAntiEcho(candidateResponse, authorTurn);
    if (antiEcho.triggered) {
      return fail("INSUFFICIENT_EDITORIAL_ADVANCEMENT");
    }
  }

  if (qualityLevel === "editorial_synthesis") {
    const hasConnection =
      /\b(both|balance|dual|while|and|should inform|should guide|should become|independent read)\b/i.test(
        candidateResponse,
      );
    if (!hasConnection && substantive) {
      return fail("RESPONSE_NOT_GROUNDED");
    }
  }

  return { gate_result: "pass", quality_level: qualityLevel, fail_reason: null };
}

export function classifyResponseQuality(input: {
  response: string;
  authorTurn: string;
  stageId: string;
  asksQuestion: boolean;
}): ResponseQualityLevel {
  if (input.asksQuestion || input.response.includes("?")) {
    return "material_clarification";
  }

  const synthesisMarkers =
    /\b(appear to be|balancing|both should|dual success|should inform|should become|independent read)\b/i;
  if (synthesisMarkers.test(input.response)) {
    return "editorial_synthesis";
  }

  const ackPatterns = /^(thank you|noted|i have what i need|that gives me)/i;
  if (ackPatterns.test(input.response.trim())) {
    return "acknowledgment";
  }

  return "grounded_reflection";
}

export function qualityLevelToNumber(level: ResponseQualityLevel): 1 | 2 | 3 | 4 {
  return RESPONSE_QUALITY_LEVEL_NUM[level];
}
