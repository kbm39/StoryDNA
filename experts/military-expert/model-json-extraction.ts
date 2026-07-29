/**
 * Strict extraction of a single top-level JSON object from model text output.
 * Accepts surrounding whitespace and one optional Markdown code fence wrapper.
 * Rejects trailing prose, multiple payloads, and ambiguous trailing material.
 */

export type ModelJsonTrailingCategory =
  | "none"
  | "whitespace_only"
  | "closing_markdown_fence"
  | "explanatory_prose"
  | "second_json_object"
  | "partial_duplicate_json"
  | "other";

export type ModelJsonExtractionResult = {
  readonly jsonText: string;
  readonly trailingContent: string;
  readonly trailingCategory: ModelJsonTrailingCategory;
  readonly multiplePayloads: boolean;
};

export type MilitaryExpertTrailingCommentaryNormalizationEvent = {
  readonly trailing_character_count: number;
  readonly normalization_attempted: boolean;
  readonly normalization_succeeded: boolean;
  readonly second_payload_detected: boolean;
};

export type MilitaryExpertTrailingMarkdownSummaryNormalizationEvent = {
  readonly trailing_character_count: number;
  readonly normalization_attempted: boolean;
  readonly normalization_succeeded: boolean;
  readonly second_payload_detected: boolean;
};

const UNSAFE_TRAILING_COMMENTARY_PATTERNS: readonly RegExp[] = [
  /\{/,
  /\[/,
  /^\s*```/m,
  /"findings"\s*:/,
  /"summary"\s*:/,
  /"category(_assessments)?"\s*:/,
  /"manuscript_evidence"/,
  /"contrary_evidence"/,
  /"finding_id"/,
  /"overall_realism_assessment"/,
  /\bcorrect(ed|ion)\b/i,
  /\bupdated (finding|report|assessment)\b/i,
  /\brevised (finding|report)\b/i,
  /\badditional finding/i,
];

const UNSAFE_TRAILING_MARKDOWN_SUMMARY_PATTERNS: readonly RegExp[] = [
  ...UNSAFE_TRAILING_COMMENTARY_PATTERNS,
  /\b(?:supersedes?|replaces?|supplements?|contradicts?)\b/i,
  /\bnew (?:finding|issue|concern|evidence)\b/i,
  /\b(?:severity|confidence)\s*(?:should be|is actually|must be|changed to|upgraded to|downgraded to)\b/i,
  /\b(?:recommend(?:ation)?|disposition)\s*(?:should be|changed to|instead)\b/i,
  /\b(?:finding|issue)\s*(?:id|#)\s*[:=]\s*[a-z0-9-]+/i,
];

const MARKDOWN_SUMMARY_STRUCTURE_PATTERN =
  /(?:^|\n)\s*(?:#{1,6}\s|[-*+]\s|\d+\.\s|\*\*[^*\n]+\*\*)/m;

const MARKDOWN_AUTHOR_SUMMARY_CUE_PATTERN =
  /\b(?:summary for (?:the )?author|author-facing summary|key takeaways|report summary)\b/i;

const OPENING_MARKDOWN_FENCE_ONLY = /^```(?:json)?[ \t]*$/i;

function normalizeModelText(raw: string): string {
  return raw.replace(/\r\n/g, "\n").trim();
}

/** Find the end index (exclusive) of a top-level JSON object starting at `{`. */
export function findTopLevelJsonObjectEnd(text: string, startIndex: number): number | null {
  if (text[startIndex] !== "{") return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      depth += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return i + 1;
      }
    }
  }

  return null;
}

const CLOSING_MARKDOWN_FENCE_LINE = /^\s*```(?:json)?[ \t]*(?:\n|$)/i;
const CLOSING_MARKDOWN_FENCE_ONLY = /^```(?:json)?[ \t]*$/i;

function stripLeadingMarkdownFence(text: string): string {
  return text.replace(/^```(?:json)?[ \t]*\n?/i, "");
}

function stripAllowedTrailingMarkdownFence(trailing: string): string {
  let rest = trailing;
  while (CLOSING_MARKDOWN_FENCE_LINE.test(rest)) {
    rest = rest.replace(CLOSING_MARKDOWN_FENCE_LINE, "");
  }
  return rest;
}

function classifyTrailingContent(trailing: string): ModelJsonTrailingCategory {
  const trimmed = trailing.trim();
  if (trimmed.length === 0) {
    return trailing.length === 0 ? "none" : "whitespace_only";
  }
  if (CLOSING_MARKDOWN_FENCE_ONLY.test(trimmed)) {
    return "closing_markdown_fence";
  }
  if (/^\{/.test(trimmed)) {
    return "second_json_object";
  }
  if (/^[\[{]/.test(trimmed) || /\}\s*$/.test(trimmed)) {
    return "partial_duplicate_json";
  }
  return "explanatory_prose";
}

function detectMultiplePayloads(fullText: string, jsonEnd: number): boolean {
  if (/\}\s*\{/.test(fullText.slice(0, jsonEnd))) {
    return true;
  }
  const trailing = fullText.slice(jsonEnd).trim();
  if (!trailing) return false;
  const afterFence = stripAllowedTrailingMarkdownFence(trailing).trim();
  return /^\{/.test(afterFence);
}

/**
 * Extract one JSON object from model output.
 * Allowed wrappers: surrounding whitespace; optional ```json fence around the object.
 * Allowed trailing material after the object: whitespace; one closing ``` line.
 */
export function extractStrictModelJsonObject(raw: string): ModelJsonExtractionResult {
  const normalized = normalizeModelText(raw);

  const wholeFenceMatch = normalized.match(
    /^```(?:json)?[ \t]*\n([\s\S]*?)\n?```(?:json)?[ \t]*$/i,
  );
  const candidate = wholeFenceMatch ? wholeFenceMatch[1]!.trim() : stripLeadingMarkdownFence(normalized);

  const start = candidate.indexOf("{");
  if (start === -1) {
    const trailingCategory = classifyTrailingContent(candidate);
    return {
      jsonText: candidate,
      trailingContent: candidate,
      trailingCategory,
      multiplePayloads: false,
    };
  }

  const end = findTopLevelJsonObjectEnd(candidate, start);
  if (end === null) {
    return {
      jsonText: candidate.slice(start),
      trailingContent: "",
      trailingCategory: "other",
      multiplePayloads: false,
    };
  }

  const jsonText = candidate.slice(start, end);
  let trailingContent = candidate.slice(end);
  const rawTrailingAfterJson = trailingContent;
  trailingContent = stripAllowedTrailingMarkdownFence(trailingContent).trim();

  let trailingCategory = classifyTrailingContent(trailingContent);
  if (
    trailingContent.length > 0 &&
    /^\s*```(?:json)?[ \t]*(?:\n|$)/i.test(rawTrailingAfterJson.trim())
  ) {
    trailingCategory = "other";
  }

  return {
    jsonText,
    trailingContent,
    trailingCategory,
    multiplePayloads: detectMultiplePayloads(candidate, end),
  };
}

export function isAllowedModelJsonTrailing(category: ModelJsonTrailingCategory): boolean {
  return (
    category === "none" ||
    category === "whitespace_only" ||
    category === "closing_markdown_fence"
  );
}

/** True when trailing prose looks like structured report content, evidence, or corrections. */
export function isUnsafeTrailingCommentaryContent(trailing: string): boolean {
  const trimmed = trailing.trim();
  if (!trimmed) return false;
  return UNSAFE_TRAILING_COMMENTARY_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** True when trailing material uses Markdown headings, lists, emphasis, or author-summary cues. */
export function isRecognizableMarkdownSummaryProse(trailing: string): boolean {
  const trimmed = trailing.trim();
  if (!trimmed) return false;
  return (
    MARKDOWN_SUMMARY_STRUCTURE_PATTERN.test(trimmed) ||
    MARKDOWN_AUTHOR_SUMMARY_CUE_PATTERN.test(trimmed)
  );
}

function extractKnownFindingIds(jsonText: string): readonly string[] {
  try {
    const parsed = JSON.parse(jsonText) as { findings?: Array<{ finding_id?: unknown }> };
    if (!Array.isArray(parsed.findings)) return [];
    return parsed.findings
      .map((finding) => (typeof finding.finding_id === "string" ? finding.finding_id.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function hasQuotedEvidenceAbsentFromJson(trailing: string, jsonText: string): boolean {
  const jsonLower = jsonText.toLowerCase();
  const quoted = trailing.match(/"([^"\\]{20,})"/g) ?? [];
  for (const fragment of quoted) {
    const inner = fragment.slice(1, -1).trim().toLowerCase();
    if (inner.length >= 20 && !jsonLower.includes(inner)) {
      return true;
    }
  }
  return false;
}

function hasUnknownFindingIdentifiers(trailing: string, jsonText: string): boolean {
  const knownIds = new Set(extractKnownFindingIds(jsonText).map((id) => id.toLowerCase()));
  if (knownIds.size === 0) return false;

  const explicitMentions =
    trailing.match(/\b(?:finding(?:\s+id)?|issue(?:\s+id)?)\s*[:#=]\s*([a-z0-9-]+)/gi) ?? [];
  for (const mention of explicitMentions) {
    const idMatch = mention.match(/[:#=]\s*([a-z0-9-]+)/i);
    const id = idMatch?.[1]?.toLowerCase();
    if (id && !knownIds.has(id)) {
      return true;
    }
  }

  const candidates = trailing.match(/\b[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b/gi) ?? [];
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    if (knownIds.has(lower)) continue;
    const idx = trailing.toLowerCase().indexOf(lower);
    const context = trailing
      .slice(Math.max(0, idx - 40), idx + lower.length + 40)
      .toLowerCase();
    if (/\bfinding\b|\bissue\b|\bid\b/.test(context)) {
      return true;
    }
  }
  return false;
}

/** True when trailing Markdown summary introduces or changes report content. */
export function isUnsafeTrailingMarkdownSummaryContent(
  trailing: string,
  jsonText: string,
): boolean {
  const trimmed = trailing.trim();
  if (!trimmed) return false;
  if (UNSAFE_TRAILING_MARKDOWN_SUMMARY_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }
  if (hasQuotedEvidenceAbsentFromJson(trimmed, jsonText)) {
    return true;
  }
  if (hasUnknownFindingIdentifiers(trimmed, jsonText)) {
    return true;
  }
  return false;
}

function resolveJsonCandidate(normalized: string): string {
  const wholeFenceMatch = normalized.match(
    /^```(?:json)?[ \t]*\n([\s\S]*?)\n?```(?:json)?[ \t]*$/i,
  );
  return wholeFenceMatch ? wholeFenceMatch[1]!.trim() : stripLeadingMarkdownFence(normalized);
}

function hasDisallowedLeadingContentBeforeJson(candidate: string, jsonStart: number): boolean {
  const leading = candidate.slice(0, jsonStart).trim();
  if (!leading) return false;
  return !OPENING_MARKDOWN_FENCE_ONLY.test(leading);
}

export function buildTrailingCommentaryNormalizationEvent(args: {
  trailingCharacterCount: number;
  attempted: boolean;
  succeeded: boolean;
  secondPayloadDetected: boolean;
}): MilitaryExpertTrailingCommentaryNormalizationEvent {
  return Object.freeze({
    trailing_character_count: args.trailingCharacterCount,
    normalization_attempted: args.attempted,
    normalization_succeeded: args.succeeded,
    second_payload_detected: args.secondPayloadDetected,
  });
}

export function buildTrailingMarkdownSummaryNormalizationEvent(args: {
  trailingCharacterCount: number;
  attempted: boolean;
  succeeded: boolean;
  secondPayloadDetected: boolean;
}): MilitaryExpertTrailingMarkdownSummaryNormalizationEvent {
  return Object.freeze({
    trailing_character_count: args.trailingCharacterCount,
    normalization_attempted: args.attempted,
    normalization_succeeded: args.succeeded,
    second_payload_detected: args.secondPayloadDetected,
  });
}

/**
 * Evaluate whether plain trailing commentary may be stripped after a complete JSON object.
 * Fail closed on ambiguity, structured trailing content, or leading prose before JSON.
 */
export function evaluateTrailingCommentaryStripEligibility(
  raw: string,
  extraction: ModelJsonExtractionResult,
): { eligible: true } | { eligible: false; unsafeStructuredTrailing: boolean } {
  const normalized = normalizeModelText(raw);
  const candidate = resolveJsonCandidate(normalized);
  const start = candidate.indexOf("{");

  if (start === -1 || extraction.multiplePayloads) {
    return { eligible: false, unsafeStructuredTrailing: false };
  }

  if (hasDisallowedLeadingContentBeforeJson(candidate, start)) {
    return { eligible: false, unsafeStructuredTrailing: false };
  }

  const end = findTopLevelJsonObjectEnd(candidate, start);
  if (end === null) {
    return { eligible: false, unsafeStructuredTrailing: false };
  }

  if (extraction.trailingContent.length === 0 || isAllowedModelJsonTrailing(extraction.trailingCategory)) {
    return { eligible: false, unsafeStructuredTrailing: false };
  }

  if (extraction.trailingCategory !== "explanatory_prose") {
    return { eligible: false, unsafeStructuredTrailing: false };
  }

  if (isRecognizableMarkdownSummaryProse(extraction.trailingContent)) {
    return { eligible: false, unsafeStructuredTrailing: false };
  }

  if (isUnsafeTrailingCommentaryContent(extraction.trailingContent)) {
    return { eligible: false, unsafeStructuredTrailing: true };
  }

  try {
    JSON.parse(extraction.jsonText);
  } catch {
    return { eligible: false, unsafeStructuredTrailing: false };
  }

  return { eligible: true };
}

/**
 * Evaluate whether a post-JSON Markdown author summary may be stripped after a complete JSON object.
 * Fail closed on ambiguity, new findings, evidence, severity changes, or corrections.
 */
export function evaluateTrailingMarkdownSummaryStripEligibility(
  raw: string,
  extraction: ModelJsonExtractionResult,
): { eligible: true } | { eligible: false; unsafeStructuredTrailing: boolean } {
  const normalized = normalizeModelText(raw);
  const candidate = resolveJsonCandidate(normalized);
  const start = candidate.indexOf("{");

  if (start === -1 || extraction.multiplePayloads) {
    return { eligible: false, unsafeStructuredTrailing: false };
  }

  if (hasDisallowedLeadingContentBeforeJson(candidate, start)) {
    return { eligible: false, unsafeStructuredTrailing: false };
  }

  const end = findTopLevelJsonObjectEnd(candidate, start);
  if (end === null) {
    return { eligible: false, unsafeStructuredTrailing: false };
  }

  if (extraction.trailingContent.length === 0 || isAllowedModelJsonTrailing(extraction.trailingCategory)) {
    return { eligible: false, unsafeStructuredTrailing: false };
  }

  if (
    extraction.trailingCategory === "second_json_object" ||
    extraction.trailingCategory === "partial_duplicate_json"
  ) {
    return { eligible: false, unsafeStructuredTrailing: false };
  }

  if (!isRecognizableMarkdownSummaryProse(extraction.trailingContent)) {
    return { eligible: false, unsafeStructuredTrailing: false };
  }

  if (isUnsafeTrailingMarkdownSummaryContent(extraction.trailingContent, extraction.jsonText)) {
    return { eligible: false, unsafeStructuredTrailing: true };
  }

  try {
    JSON.parse(extraction.jsonText);
  } catch {
    return { eligible: false, unsafeStructuredTrailing: false };
  }

  return { eligible: true };
}

/** Sanitize text for safe diagnostic logging (redact long quoted strings). */
export function sanitizeModelTextSample(text: string, maxLen = 100): string {
  const redacted = text.replace(/"[^"\\]{8,}"/g, '"[redacted]"');
  if (redacted.length <= maxLen) return redacted;
  return `${redacted.slice(0, maxLen)}…`;
}
