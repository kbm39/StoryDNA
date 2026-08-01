import type { FollowUpDecisionInput, FollowUpDecisionResult } from "./types.ts";

const UNSURE_PATTERNS = [
  /^unsure$/i,
  /^i'?m not sure$/i,
  /^i don'?t know yet$/i,
  /^not sure yet$/i,
  /^still figuring (that )?out$/i,
];

const UNSAFE_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /\bon\w+\s*=/i,
];

const MIN_REQUIRED_LENGTH: Record<string, number> = {
  "eic_intake.primary_vision": 10,
  "eic_intake.creative_motivation": 5,
  "eic_intake.market_position": 1,
  "eic_intake.success_definition": 5,
};

const CLARIFICATION_THRESHOLDS: Record<string, number> = {
  "eic_intake.primary_vision": 0.39,
  "eic_intake.creative_motivation": 0.39,
  "eic_intake.target_reader": 0.39,
  "eic_intake.desired_reader_experience": 0.39,
  "eic_intake.market_position": 0.39,
  "eic_intake.success_definition": 0.39,
};

function isUnsureAnswer(answer: string): boolean {
  const trimmed = answer.trim();
  return UNSURE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function containsConcreteNouns(answer: string): boolean {
  const lower = answer.toLowerCase();
  return (
    /\b(reader|readers|audience|market|agent|publish|query|genre|success|experience)\b/.test(
      lower,
    ) || /\b(self[- ]publish|query[- ]ready|literary|commercial|thriller|romance)\b/.test(lower)
  );
}

export function scoreStageConfidence(input: {
  stage_id: string;
  author_answer: string | null;
  skipped: boolean;
  required: boolean;
  is_clarification_follow_up: boolean;
}): number {
  if (input.skipped) return 0;
  const answer = (input.author_answer ?? "").trim();
  if (!answer) return input.required ? 0.1 : 0;

  if (isUnsureAnswer(answer)) return 0.5;
  if (input.is_clarification_follow_up && answer.length >= 3) return 0.75;

  let score = 0.3;
  const minLen = MIN_REQUIRED_LENGTH[input.stage_id] ?? 5;
  if (answer.length >= minLen) score += 0.3;
  if (containsConcreteNouns(answer)) score += 0.15;
  if (answer.length >= 80) score += 0.1;
  if (answer.length <= 5) return Math.min(score, 0.25);

  return Math.min(score, 1);
}

function shouldReflect(answer: string, confidence: number): boolean {
  if (confidence < 0.4) return false;
  return answer.trim().length >= 80 || /[,;—–-]/.test(answer);
}

function clarificationQuestionForStage(stageId: string, answer: string): string | null {
  switch (stageId) {
    case "eic_intake.primary_vision":
      if (answer.trim().length < 10) {
        return "Could you say a bit more about what the manuscript is about?";
      }
      return null;
    case "eic_intake.market_position":
      if (!containsConcreteNouns(answer) && !isUnsureAnswer(answer)) {
        return "When you describe the market, do you have a specific reader or category in mind?";
      }
      return null;
    case "eic_intake.success_definition":
      if (answer.trim().length < 8) {
        return "When you say success at this stage, do you mean query-ready, self-publishing, or something else?";
      }
      return null;
    default:
      return null;
  }
}

export function evaluateFollowUpDecision(input: FollowUpDecisionInput): FollowUpDecisionResult {
  const answer = (input.author_answer ?? "").trim();

  if (input.skipped && !input.required) {
    return {
      outcome: "author_skipped_optional",
      response_type: "acknowledgment",
      confidence_score: 0,
      record_open_question: false,
      advance_stage: true,
    };
  }

  if (answer && UNSAFE_PATTERNS.some((pattern) => pattern.test(answer))) {
    return {
      outcome: "blocked_unsafe_or_invalid",
      response_type: null,
      confidence_score: 0,
      record_open_question: false,
      advance_stage: false,
    };
  }

  const confidence = scoreStageConfidence({
    stage_id: input.stage_id,
    author_answer: input.author_answer,
    skipped: input.skipped,
    required: input.required,
    is_clarification_follow_up: input.is_clarification_follow_up,
  });

  if (input.is_clarification_follow_up) {
    if (answer.length < 3) {
      return {
        outcome: "insufficient_answer",
        response_type: "acknowledgment",
        confidence_score: Math.max(confidence, 0.5),
        record_open_question: true,
        advance_stage: true,
      };
    }
    return {
      outcome: "acknowledge_and_continue",
      response_type: "acknowledgment",
      confidence_score: Math.max(confidence, 0.7),
      record_open_question: false,
      advance_stage: true,
    };
  }

  const threshold = CLARIFICATION_THRESHOLDS[input.stage_id] ?? 0.39;
  const minLen = MIN_REQUIRED_LENGTH[input.stage_id];

  if (input.required && minLen && answer.length > 0 && answer.length < minLen) {
    if (!input.clarification_already_used) {
      const question = clarificationQuestionForStage(input.stage_id, answer);
      if (question) {
        return {
          outcome: "clarify_once",
          response_type: "clarification",
          confidence_score: confidence,
          record_open_question: false,
          advance_stage: false,
        };
      }
    }
    return {
      outcome: "insufficient_answer",
      response_type: "acknowledgment",
      confidence_score: confidence,
      record_open_question: true,
      advance_stage: !input.required || isUnsureAnswer(answer),
    };
  }

  if (confidence < threshold && input.required && !isUnsureAnswer(answer)) {
    if (!input.clarification_already_used) {
      const question = clarificationQuestionForStage(input.stage_id, answer);
      if (question) {
        return {
          outcome: "clarify_once",
          response_type: "clarification",
          confidence_score: confidence,
          record_open_question: false,
          advance_stage: false,
        };
      }
    }
  }

  if (shouldReflect(answer, confidence)) {
    return {
      outcome: "reflect_and_continue",
      response_type: "reflection",
      confidence_score: confidence,
      record_open_question: confidence < 0.7,
      advance_stage: true,
    };
  }

  return {
    outcome: "acknowledge_and_continue",
    response_type: "acknowledgment",
    confidence_score: confidence,
    record_open_question: confidence >= 0.4 && confidence < 0.7,
    advance_stage: true,
  };
}
