import type { GateFailReason } from "./types.ts";

const MARKET_DEMOGRAPHIC_PATTERNS = [
  /\baged?\s+\d+\s*[–-]\s*\d+\b/i,
  /\bprimarily (male|female) readership\b/i,
  /\bmass-market paperback\b/i,
  /\bdemographic\b/i,
  /\btarget audience aged\b/i,
];

const INVENTED_TRAUMA_PATTERNS = [
  /\bptsd\b/i,
  /\btrauma arc\b/i,
  /\bgrappling with\b/i,
  /\bcombat deployments?\b/i,
];

const COMMON_WORDS = new Set([
  "I", "The", "This", "When", "You", "So", "That", "What", "Have", "Does", "Mean",
  "Primary", "Genre", "Thriller", "Romance", "Both", "For", "And", "With", "Your",
]);

function extractNamedEntities(text: string): string[] {
  const matches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) ?? [];
  return matches.filter((m) => !COMMON_WORDS.has(m));
}

function wordsInSource(word: string, sources: readonly string[]): boolean {
  const lower = word.toLowerCase();
  return sources.some((s) => s.toLowerCase().includes(lower));
}

export type GroundingResult = {
  readonly grounded: boolean;
  readonly fail_reason: GateFailReason | null;
};

export function validateGrounding(input: {
  response: string;
  authorTurn: string;
  priorAuthorTurns?: readonly string[];
}): GroundingResult {
  const sources = [input.authorTurn, ...(input.priorAuthorTurns ?? [])];
  const combinedSource = sources.join(" ").toLowerCase();
  const response = input.response;

  for (const pattern of INVENTED_TRAUMA_PATTERNS) {
    if (pattern.test(response) && !pattern.test(combinedSource)) {
      return { grounded: false, fail_reason: "INVENTED_INTERPRETATION" };
    }
  }

  for (const pattern of MARKET_DEMOGRAPHIC_PATTERNS) {
    if (pattern.test(response) && !pattern.test(combinedSource)) {
      return { grounded: false, fail_reason: "UNSUPPORTED_MARKET_CONCLUSION" };
    }
  }

  const responseEntities = extractNamedEntities(response);
  for (const entity of responseEntities) {
    const parts = entity.split(/\s+/);
    for (const part of parts) {
      if (part.length >= 3 && !wordsInSource(part, sources)) {
        const isCommonWord = /^(That|What|Have|Does|Mean|Primary|Genre|Thriller|Romance)$/i.test(
          part,
        );
        if (!isCommonWord) {
          return { grounded: false, fail_reason: "INVENTED_INTERPRETATION" };
        }
      }
    }
  }

  if (
    /\bmanuscript (shows|proves|demonstrates|contains)\b/i.test(response) ||
    /\bon the page\b/i.test(response) ||
    /\bevidence (shows|suggests)\b/i.test(response)
  ) {
    return { grounded: false, fail_reason: "FRAMING_EVIDENCE_BOUNDARY_VIOLATION" };
  }

  return { grounded: true, fail_reason: null };
}
