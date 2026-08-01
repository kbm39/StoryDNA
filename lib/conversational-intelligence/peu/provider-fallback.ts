import { CONVERSATIONAL_INTELLIGENCE_PROVIDER_MODEL } from "../contract.ts";
import { evaluateAdvancementQualityGate } from "./advancement-quality-gate.ts";
import {
  MINIMAL_ACKNOWLEDGMENT,
  selectTemplateResponse,
} from "../templates/peu-templates.ts";
import type { GateFailReason, ProviderResponseSchema, ResponseQualityLevel } from "./types.ts";

export type EmissionResult = {
  readonly content: string;
  readonly qualityLevel: ResponseQualityLevel;
  readonly gateResult: "pass" | GateFailReason;
  readonly failReason: GateFailReason | null;
  readonly fallbackUsed: boolean;
  readonly repairAttempted: boolean;
  readonly providerModel: string;
};

export function validateProviderResponseSchema(
  value: unknown,
): value is ProviderResponseSchema {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.quality_level === "number" &&
    obj.quality_level >= 1 &&
    obj.quality_level <= 4 &&
    typeof obj.response_text === "string" &&
    Array.isArray(obj.grounded_claims) &&
    Array.isArray(obj.uncertainty_notes) &&
    obj.gate_result === "pass" &&
    obj.fail_reason === null
  );
}

function qualityLevelFromNumber(n: number): ResponseQualityLevel {
  switch (n) {
    case 1:
      return "acknowledgment";
    case 3:
      return "editorial_synthesis";
    case 4:
      return "material_clarification";
    default:
      return "grounded_reflection";
  }
}

export function emitWithQualityGate(input: {
  stageId: string;
  authorAnswer: string;
  priorAuthorTurns?: readonly string[];
  preferredLevel?: ResponseQualityLevel;
  candidateResponse?: string;
  providerResponse?: unknown;
  maxRepairs?: number;
}): EmissionResult {
  const maxRepairs = input.maxRepairs ?? 1;
  let repairAttempted = false;
  let fallbackUsed = false;
  let providerModel = CONVERSATIONAL_INTELLIGENCE_PROVIDER_MODEL;

  if (input.providerResponse && validateProviderResponseSchema(input.providerResponse)) {
    providerModel = "provider-schema@v1";
    const qualityLevel = qualityLevelFromNumber(input.providerResponse.quality_level);
    const gate = evaluateAdvancementQualityGate({
      candidateResponse: input.providerResponse.response_text,
      authorTurn: input.authorAnswer,
      priorAuthorTurns: input.priorAuthorTurns,
      stageId: input.stageId,
      qualityLevel,
    });

    if (gate.gate_result === "pass") {
      return {
        content: input.providerResponse.response_text,
        qualityLevel,
        gateResult: "pass",
        failReason: null,
        fallbackUsed: false,
        repairAttempted: false,
        providerModel,
      };
    }

    repairAttempted = maxRepairs > 0;
  }

  let candidate =
    input.candidateResponse ??
    selectTemplateResponse({
      stageId: input.stageId,
      authorAnswer: input.authorAnswer,
      preferredLevel: input.preferredLevel ?? "grounded_reflection",
    }).content;

  let qualityLevel =
    input.preferredLevel ??
    selectTemplateResponse({
      stageId: input.stageId,
      authorAnswer: input.authorAnswer,
      preferredLevel: "grounded_reflection",
    }).qualityLevel;

  let gate = evaluateAdvancementQualityGate({
    candidateResponse: candidate,
    authorTurn: input.authorAnswer,
    priorAuthorTurns: input.priorAuthorTurns,
    stageId: input.stageId,
    qualityLevel,
  });

  if (gate.gate_result !== "pass" && maxRepairs > 0 && !repairAttempted) {
    repairAttempted = true;
    const repaired = selectTemplateResponse({
      stageId: input.stageId,
      authorAnswer: input.authorAnswer,
      preferredLevel: "editorial_synthesis",
    });
    candidate = repaired.content;
    qualityLevel = repaired.qualityLevel;
    gate = evaluateAdvancementQualityGate({
      candidateResponse: candidate,
      authorTurn: input.authorAnswer,
      priorAuthorTurns: input.priorAuthorTurns,
      stageId: input.stageId,
      qualityLevel,
    });
  }

  if (gate.gate_result !== "pass") {
    fallbackUsed = true;
    const template = selectTemplateResponse({
      stageId: input.stageId,
      authorAnswer: input.authorAnswer,
      preferredLevel: "grounded_reflection",
    });
    const fallbackGate = evaluateAdvancementQualityGate({
      candidateResponse: template.content,
      authorTurn: input.authorAnswer,
      priorAuthorTurns: input.priorAuthorTurns,
      stageId: input.stageId,
      qualityLevel: template.qualityLevel,
    });
    if (fallbackGate.gate_result === "pass") {
      return {
        content: template.content,
        qualityLevel: template.qualityLevel,
        gateResult: "pass",
        failReason: null,
        fallbackUsed: true,
        repairAttempted,
        providerModel,
      };
    }

    return {
      content: MINIMAL_ACKNOWLEDGMENT,
      qualityLevel: "acknowledgment",
      gateResult: "pass",
      failReason: null,
      fallbackUsed: true,
      repairAttempted,
      providerModel,
    };
  }

  return {
    content: candidate,
    qualityLevel,
    gateResult: "pass",
    failReason: null,
    fallbackUsed,
    repairAttempted,
    providerModel,
  };
}
