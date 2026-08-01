import type { GateFailReason } from "./types.ts";

const EMPTY_PRAISE_PATTERNS = [
  /\bbrilliant\b/i,
  /\bpowerful concept\b/i,
  /\bagents will love\b/i,
  /\bbestseller\b/i,
  /\bamazing\b/i,
  /\bincredible\b/i,
  /\bwhat a (great|wonderful|fantastic)\b/i,
];

const THERAPY_PATTERNS = [
  /\bgoing through a lot\b/i,
  /\bcompletely valid\b/i,
  /\bhealing might look like\b/i,
  /\bhave you considered (what|how)\b/i,
  /\bthat's okay to feel\b/i,
  /\byour feelings\b/i,
  /\bself[- ]care\b/i,
];

const UNSURE_PATTERNS = [
  /^unsure$/i,
  /^i'?m not sure\b/i,
  /^not sure yet$/i,
  /say unsure if needed/i,
  /still figuring (that )?out/i,
];

export function authorDeclaredUnsure(authorTurn: string): boolean {
  const trimmed = authorTurn.trim();
  return UNSURE_PATTERNS.some((p) => p.test(trimmed));
}

export function isMaterialAmbiguity(stageId: string, authorTurn: string): boolean {
  const trimmed = authorTurn.trim();
  if (authorDeclaredUnsure(trimmed)) return false;

  if (
    stageId === "eic_intake.market_position" &&
    /^it'?s a romance\.?$/i.test(trimmed)
  ) {
    return true;
  }

  if (stageId === "eic_intake.market_position") {
    return trimmed.length <= 5;
  }

  if (stageId === "eic_intake.primary_vision" && trimmed.length < 10) {
    return true;
  }

  if (stageId === "eic_intake.success_definition" && trimmed.length < 8) {
    return true;
  }

  return false;
}

export function shouldEmitClarification(input: {
  stageId: string;
  authorTurn: string;
  clarificationAlreadyUsed: boolean;
}): boolean {
  if (input.clarificationAlreadyUsed) return false;
  if (authorDeclaredUnsure(input.authorTurn)) return false;
  return isMaterialAmbiguity(input.stageId, input.authorTurn);
}

export function detectEmptyPraise(response: string): GateFailReason | null {
  return EMPTY_PRAISE_PATTERNS.some((p) => p.test(response)) ? "EMPTY_PRAISE" : null;
}

export function detectTherapyLanguage(response: string): GateFailReason | null {
  return THERAPY_PATTERNS.some((p) => p.test(response)) ? "THERAPY_LANGUAGE" : null;
}

export function countQuestions(response: string): number {
  return (response.match(/\?/g) ?? []).length;
}

export function isCompoundQuestion(response: string): boolean {
  if (countQuestions(response) > 1) return true;
  return /,.*\band\b.*\?/i.test(response);
}

export function clarificationQuestionForStage(stageId: string, authorTurn: string): string {
  switch (stageId) {
    case "eic_intake.primary_vision":
      return "Could you say a bit more about what the manuscript is about?";
    case "eic_intake.market_position":
      if (/romance/i.test(authorTurn)) {
        return "When you describe the story as a romance, do you mean romance is its primary genre, or that it is a thriller with a central romantic storyline?";
      }
      return "When you describe the market, do you have a specific reader or category in mind?";
    case "eic_intake.success_definition":
      return "When you say success at this stage, do you mean query-ready, self-publishing, or something else?";
    default:
      return "Could you say a bit more so I understand what you mean?";
  }
}

export function isUnnecessaryClarification(input: {
  stageId: string;
  authorTurn: string;
  qualityLevel: string;
}): boolean {
  if (input.qualityLevel !== "material_clarification") return false;
  if (authorDeclaredUnsure(input.authorTurn)) return true;
  if (!isMaterialAmbiguity(input.stageId, input.authorTurn)) return true;
  return false;
}
