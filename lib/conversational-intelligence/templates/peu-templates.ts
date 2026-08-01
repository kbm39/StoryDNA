import type { ResponseQualityLevel } from "../peu/types.ts";

export const MINIMAL_ACKNOWLEDGMENT = "Thank you. I've recorded that.";

function extractKeyPhrases(answer: string): string[] {
  const phrases: string[] = [];
  const trimmed = answer.trim();
  if (trimmed.length <= 80) phrases.push(trimmed);
  else {
    const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    phrases.push(...sentences.slice(0, 2).map((s) => s.trim()));
  }
  return phrases;
}

export function buildGroundedReflection(stageId: string, authorAnswer: string): string {
  const answer = authorAnswer.trim();
  const lower = answer.toLowerCase();

  if (stageId === "eic_intake.desired_reader_experience") {
    if (/admire.*cost|cost.*flaw|flaw.*choice/i.test(answer)) {
      return "You want readers to admire James while still recognizing the costs and flaws behind his choices.";
    }
    if (/cost|tactical|decision|feel/i.test(answer)) {
      return "You want readers to feel the cost of every tactical decision — that experience should guide the independent read focus.";
    }
  }

  if (stageId === "eic_intake.success_definition") {
    if (/query[- ]ready|hook|military|tactical|authentic/i.test(answer)) {
      return "You appear to be balancing commercial hook strength with tactical authenticity as dual success criteria. Both should inform the independent read focus.";
    }
  }

  if (stageId === "eic_intake.primary_vision") {
    if (/thriller|convoy|military|ambush/i.test(lower)) {
      return "You're positioning this as a military thriller centered on a convoy ambush — that framing will guide how I approach the independent read.";
    }
  }

  if (stageId === "eic_intake.creative_motivation") {
    return `I heard that you wrote this because ${answer.charAt(0).toLowerCase()}${answer.slice(1).replace(/\.$/, "")}.`;
  }

  if (stageId === "eic_intake.market_position") {
    return `It sounds like you're positioning this for ${answer.charAt(0).toLowerCase()}${answer.slice(1).replace(/\.$/, "")}.`;
  }

  if (stageId === "eic_intake.success_definition") {
    return `For you, success at this stage means ${answer.charAt(0).toLowerCase()}${answer.slice(1).replace(/\.$/, "")}.`;
  }

  if (/protagonist/i.test(answer)) {
    return "Your description places the protagonist at the center of the story, and during the independent read I should assess whether the manuscript consistently delivers that emphasis.";
  }

  if (answer.length < 20) {
    return MINIMAL_ACKNOWLEDGMENT;
  }

  const phrases = extractKeyPhrases(answer);
  const core = phrases[0] ?? answer.slice(0, 80);
  const normalizedCore = core.charAt(0).toLowerCase() + core.slice(1).replace(/\.$/, "");
  return `Your description emphasizes ${normalizedCore}, and during the independent read I should assess how consistently the manuscript supports that emphasis.`;
}

export function buildEditorialSynthesis(stageId: string, authorAnswer: string): string | null {
  const answer = authorAnswer.trim();
  if (stageId === "eic_intake.success_definition" && /query|hook|military|tactical/i.test(answer)) {
    return "You appear to be balancing commercial hook strength with tactical authenticity as dual success criteria. Both should inform the independent read focus.";
  }
  if (
    stageId === "eic_intake.desired_reader_experience" &&
    /admire|respect|idealiz|flaw|cost/i.test(answer)
  ) {
    return "You appear to be aiming for a protagonist readers can respect without idealizing. That balance should become one of the standards used during the independent read.";
  }
  if (answer.length >= 80 && /[,;]/.test(answer)) {
    const parts = answer.split(/[,;—–-]/).filter((p) => p.trim().length > 5);
    if (parts.length >= 2) {
      return `You're connecting ${parts[0]!.trim().toLowerCase()} with ${parts[1]!.trim().toLowerCase()} — both should inform the independent read focus.`;
    }
  }
  return null;
}

export function selectTemplateResponse(input: {
  stageId: string;
  authorAnswer: string;
  preferredLevel: ResponseQualityLevel;
}): { content: string; qualityLevel: ResponseQualityLevel } {
  if (input.preferredLevel === "editorial_synthesis") {
    const synthesis = buildEditorialSynthesis(input.stageId, input.authorAnswer);
    if (synthesis) {
      return { content: synthesis, qualityLevel: "editorial_synthesis" };
    }
  }

  return {
    content: buildGroundedReflection(input.stageId, input.authorAnswer),
    qualityLevel: "grounded_reflection",
  };
}

