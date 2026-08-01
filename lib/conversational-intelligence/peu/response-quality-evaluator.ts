import {
  classifyResponseQuality,
  evaluateAdvancementQualityGate,
  qualityLevelToNumber,
} from "./advancement-quality-gate.ts";
import type { AdvancementGateResult, ResponseQualityLevel } from "./types.ts";

export type ResponseQualityEvaluation = AdvancementGateResult & {
  readonly level: 1 | 2 | 3 | 4;
};

export function evaluateResponseQuality(input: {
  candidate: string;
  authorTurn: string;
  stageId: string;
  priorAuthorTurns?: readonly string[];
  asksQuestion?: boolean;
  authorDeclaredUnsure?: boolean;
  clarificationAlreadyUsed?: boolean;
}): ResponseQualityEvaluation {
  const qualityLevel = classifyResponseQuality({
    response: input.candidate,
    authorTurn: input.authorTurn,
    stageId: input.stageId,
    asksQuestion: Boolean(input.asksQuestion),
  });

  const gate = evaluateAdvancementQualityGate({
    candidateResponse: input.candidate,
    authorTurn: input.authorTurn,
    priorAuthorTurns: input.priorAuthorTurns,
    stageId: input.stageId,
    qualityLevel,
    authorDeclaredUnsure: input.authorDeclaredUnsure,
    clarificationAlreadyUsed: input.clarificationAlreadyUsed,
  });

  return {
    ...gate,
    level: qualityLevelToNumber(qualityLevel),
  };
}

export { classifyResponseQuality, evaluateAdvancementQualityGate, qualityLevelToNumber };
