/** Calibration benchmark fixtures from Amendment 002 implementation spec. */

import type { GateFailReason } from "./types.ts";

export type BenchmarkFixture = {
  readonly id: number;
  readonly name: string;
  readonly authorInput: string;
  readonly candidateResponse: string;
  readonly stageId: string;
  readonly expected: "pass" | GateFailReason;
  readonly asksQuestion?: boolean;
};

export const PEU_BENCHMARK_FIXTURES: readonly BenchmarkFixture[] = [
  {
    id: 1,
    name: "Empty acknowledgment on substantive answer",
    authorInput: "I want readers to feel the cost of every tactical decision.",
    candidateResponse: "Thank you. I've recorded that.",
    stageId: "eic_intake.desired_reader_experience",
    expected: "INSUFFICIENT_EDITORIAL_ADVANCEMENT",
  },
  {
    id: 2,
    name: "Simple paraphrase",
    authorInput: "This is a military thriller about a convoy ambush in Afghanistan.",
    candidateResponse:
      "You described the manuscript as a military thriller about a convoy ambush in Afghanistan.",
    stageId: "eic_intake.primary_vision",
    expected: "INSUFFICIENT_EDITORIAL_ADVANCEMENT",
  },
  {
    id: 3,
    name: "Useful reflection (Level 2)",
    authorInput:
      "I want readers to admire James while still recognizing the costs and flaws behind his choices.",
    candidateResponse:
      "You want readers to admire James while still recognizing the costs and flaws behind his choices.",
    stageId: "eic_intake.desired_reader_experience",
    expected: "pass",
  },
  {
    id: 4,
    name: "Grounded synthesis (Level 3)",
    authorInput:
      "Success means query-ready. I need the opening to hook agents but the military detail has to be right.",
    candidateResponse:
      "You appear to be balancing commercial hook strength with tactical authenticity as dual success criteria. Both should inform the independent read focus.",
    stageId: "eic_intake.success_definition",
    expected: "pass",
  },
  {
    id: 5,
    name: "Necessary clarification (Level 4)",
    authorInput: "It's a romance.",
    candidateResponse:
      "When you describe the story as a romance, do you mean romance is its primary genre, or that it is a thriller with a central romantic storyline?",
    stageId: "eic_intake.market_position",
    expected: "pass",
    asksQuestion: true,
  },
  {
    id: 6,
    name: "Unnecessary clarification",
    authorInput: "I'm not sure about market position yet — say unsure if needed.",
    candidateResponse: "Can you tell me more about which bookstore shelf you imagine?",
    stageId: "eic_intake.market_position",
    expected: "UNNECESSARY_CLARIFICATION",
    asksQuestion: true,
  },
  {
    id: 7,
    name: "Invented interpretation",
    authorInput: "The protagonist is a pilot.",
    candidateResponse:
      "So your protagonist is grappling with PTSD from combat deployments — that trauma arc should guide the read.",
    stageId: "eic_intake.primary_vision",
    expected: "INVENTED_INTERPRETATION",
  },
  {
    id: 8,
    name: "Excessive praise",
    authorInput: "I wrote this because I had a story I needed to tell.",
    candidateResponse: "What a brilliant and powerful concept! Agents will love this.",
    stageId: "eic_intake.creative_motivation",
    expected: "EMPTY_PRAISE",
  },
  {
    id: 9,
    name: "Therapy-like response",
    authorInput: "This book cost me a lot emotionally to write.",
    candidateResponse:
      "It sounds like you're going through a lot, and that's completely valid. Have you considered what healing might look like?",
    stageId: "eic_intake.creative_motivation",
    expected: "THERAPY_LANGUAGE",
  },
  {
    id: 10,
    name: "Unsupported market conclusion",
    authorInput: "I think fans of Lee Child might enjoy it.",
    candidateResponse:
      "So you're targeting the mass-market paperback thriller audience aged 45–65 with primarily male readership.",
    stageId: "eic_intake.market_position",
    expected: "UNSUPPORTED_MARKET_CONCLUSION",
  },
  {
    id: 11,
    name: "Shallow priority echo (observed bad response)",
    authorInput: "john Nichols is the protagonist",
    candidateResponse:
      "You want john Nichols is the protagonist — that's a clear editorial priority.",
    stageId: "eic_intake.primary_vision",
    expected: "RESPONSE_GRAMMAR_INVALID",
  },
] as const;
