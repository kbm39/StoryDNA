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
  trailingContent = stripAllowedTrailingMarkdownFence(trailingContent).trim();

  return {
    jsonText,
    trailingContent,
    trailingCategory: classifyTrailingContent(trailingContent),
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

/** Sanitize text for safe diagnostic logging (redact long quoted strings). */
export function sanitizeModelTextSample(text: string, maxLen = 100): string {
  const redacted = text.replace(/"[^"\\]{8,}"/g, '"[redacted]"');
  if (redacted.length <= maxLen) return redacted;
  return `${redacted.slice(0, maxLen)}…`;
}
