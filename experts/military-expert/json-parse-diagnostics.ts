import { sanitizeModelTextSample } from "./model-json-extraction.ts";
import type { MilitaryExpertRawGenerationResponse } from "./generation-types.ts";

export type JsonTextTerminationState =
  | "closed_object"
  | "inside_string"
  | "inside_structure"
  | "empty";

export type MilitaryExpertJsonParseDiagnostics = {
  readonly responseLength: number;
  readonly finishStatus: MilitaryExpertRawGenerationResponse["finishStatus"];
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly maxOutputTokens: number | null;
  readonly endsWithClosingBrace: boolean;
  readonly terminationState: JsonTextTerminationState;
  readonly parserErrorPosition: number | null;
  readonly sanitizedPrefix: string;
  readonly sanitizedSuffix: string;
};

const UNTERMINATED_STRING_PATTERN = /Unterminated string in JSON at position (\d+)/i;
const UNEXPECTED_END_PATTERN = /Unexpected end of JSON input/i;

export function analyzeJsonTextTermination(jsonText: string): JsonTextTerminationState {
  const trimmed = jsonText.trim();
  if (!trimmed) return "empty";

  let inString = false;
  let escaped = false;
  let depth = 0;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
  }

  if (inString) return "inside_string";
  if (depth === 0 && trimmed.endsWith("}")) return "closed_object";
  return "inside_structure";
}

export function extractParserErrorPosition(message: string): number | null {
  const match = message.match(UNTERMINATED_STRING_PATTERN);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function looksLikeTruncatedJsonParseError(message: string): boolean {
  return (
    UNTERMINATED_STRING_PATTERN.test(message) ||
    UNEXPECTED_END_PATTERN.test(message)
  );
}

export function isLikelyProviderOutputTruncation(args: {
  raw: MilitaryExpertRawGenerationResponse;
  jsonText: string;
  parseErrorMessage?: string;
  maxOutputTokens?: number;
}): boolean {
  if (args.raw.finishStatus === "truncated") return true;

  const outputTokens = args.raw.outputTokens ?? null;
  const maxOutputTokens = args.maxOutputTokens ?? null;
  if (
    outputTokens != null &&
    maxOutputTokens != null &&
    outputTokens >= Math.floor(maxOutputTokens * 0.92)
  ) {
    return true;
  }

  const termination = analyzeJsonTextTermination(args.jsonText);
  const parseErrorMessage = args.parseErrorMessage ?? "";
  if (termination === "inside_string") {
    return looksLikeTruncatedJsonParseError(parseErrorMessage);
  }

  if (termination === "inside_structure") {
    return UNEXPECTED_END_PATTERN.test(parseErrorMessage);
  }

  return false;
}

export function buildMilitaryExpertJsonParseDiagnostics(args: {
  raw: MilitaryExpertRawGenerationResponse;
  jsonText: string;
  parseErrorMessage?: string;
  maxOutputTokens?: number;
}): MilitaryExpertJsonParseDiagnostics {
  const trimmed = args.jsonText.trim();
  const nonWhitespace = trimmed.replace(/\s+$/u, "");
  return Object.freeze({
    responseLength: args.raw.responseText.length,
    finishStatus: args.raw.finishStatus,
    inputTokens: args.raw.inputTokens ?? null,
    outputTokens: args.raw.outputTokens ?? null,
    maxOutputTokens: args.maxOutputTokens ?? null,
    endsWithClosingBrace: nonWhitespace.endsWith("}"),
    terminationState: analyzeJsonTextTermination(args.jsonText),
    parserErrorPosition: args.parseErrorMessage
      ? extractParserErrorPosition(args.parseErrorMessage)
      : null,
    sanitizedPrefix: sanitizeModelTextSample(args.raw.responseText.slice(0, 120), 100),
    sanitizedSuffix: sanitizeModelTextSample(args.raw.responseText.slice(-120), 100),
  });
}
