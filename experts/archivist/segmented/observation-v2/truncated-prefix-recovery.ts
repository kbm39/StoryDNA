/**
 * Deterministic V2 observations[] prefix recovery.
 * Recovers complete observation objects from truncated JSON only.
 * Does not synthesize fields. Does not rewrite excerpts. Does not call a provider.
 */

export const V2_TRUNCATED_PREFIX_RECOVERY_VERSION =
  "archivist_v2_truncated_prefix_recovery@v1" as const;

export const V2_TRUNCATION_RECOVERY_METHOD = "truncated_prefix_recovery" as const;

export interface V2TruncationRecoveryAudit {
  recovery_method: "truncated_prefix_recovery" | "none";
  normal_parse_failed: boolean;
  truncated: boolean;
  complete_objects_recovered: number;
  incomplete_objects_dropped: number;
  unknown_unrecoverable: boolean;
  original_finish_reason: string | null;
}

export interface V2TruncatedPrefixRecovery {
  invoked: boolean;
  ok: boolean;
  value: Record<string, unknown> | null;
  error: string | null;
  audit: V2TruncationRecoveryAudit;
}

export function emptyV2TruncationRecoveryAudit(
  finishReason?: string | null,
): V2TruncationRecoveryAudit {
  return {
    recovery_method: "none",
    normal_parse_failed: false,
    truncated: false,
    complete_objects_recovered: 0,
    incomplete_objects_dropped: 0,
    unknown_unrecoverable: false,
    original_finish_reason: finishReason ?? null,
  };
}

function unwrapFence(raw: string): string {
  const trimmed = raw.trim();
  const closed = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (closed) return closed[1]!.trim();
  const open = trimmed.match(/^```(?:json)?\s*([\s\S]*)$/i);
  if (open) return open[1]!.trim();
  return trimmed;
}

function matchingObjectEnd(text: string, start: number): number | null {
  if (text[start] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return null;
}

function completeStringField(text: string, key: string): string | null {
  const match = text.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  return match ? match[1]!.replace(/\\"/g, "\"") : null;
}

function recoverCompleteArrayElements(text: string, key: string): {
  found: boolean;
  items: unknown[];
  incomplete_tail: boolean;
  closed: boolean;
} {
  const match = text.search(new RegExp(`"${key}"\\s*:\\s*\\[`));
  if (match < 0) {
    return { found: false, items: [], incomplete_tail: false, closed: false };
  }
  const arrayStart = text.indexOf("[", match);
  if (arrayStart < 0) {
    return { found: true, items: [], incomplete_tail: true, closed: false };
  }
  const items: unknown[] = [];
  let i = arrayStart + 1;
  let incompleteTail = false;
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i]!)) i += 1;
    if (i >= text.length) {
      incompleteTail = true;
      break;
    }
    if (text[i] === "]") {
      return { found: true, items, incomplete_tail: false, closed: true };
    }
    if (text[i] !== "{") {
      incompleteTail = true;
      break;
    }
    const end = matchingObjectEnd(text, i);
    if (end == null) {
      incompleteTail = true;
      break;
    }
    try {
      items.push(JSON.parse(text.slice(i, end + 1)));
    } catch {
      incompleteTail = true;
      break;
    }
    i = end + 1;
  }
  return { found: true, items, incomplete_tail: incompleteTail, closed: false };
}

export function v2OutputLooksTruncated(raw: string, finishReason?: string | null): boolean {
  if (finishReason === "max_tokens") return true;
  const text = unwrapFence(raw);
  const open = (text.match(/[{[]/g) ?? []).length;
  const close = (text.match(/[}\]]/g) ?? []).length;
  if (text.includes("{") && open > close) return true;
  const observations = recoverCompleteArrayElements(text, "observations");
  return observations.found && observations.incomplete_tail;
}

export function recoverV2TruncatedObservations(
  raw: string,
  options?: { finishReason?: string | null },
): V2TruncatedPrefixRecovery {
  const finishReason = options?.finishReason ?? null;
  const baseAudit = emptyV2TruncationRecoveryAudit(finishReason);
  if (!v2OutputLooksTruncated(raw, finishReason)) {
    return {
      invoked: false,
      ok: false,
      value: null,
      error: "output is not demonstrably truncated",
      audit: { ...baseAudit, normal_parse_failed: true },
    };
  }

  const text = unwrapFence(raw);
  const recovered = recoverCompleteArrayElements(text, "observations");
  const incompleteDropped = recovered.incomplete_tail && !recovered.closed ? 1 : 0;
  const audit: V2TruncationRecoveryAudit = {
    recovery_method: V2_TRUNCATION_RECOVERY_METHOD,
    normal_parse_failed: true,
    truncated: true,
    complete_objects_recovered: recovered.items.length,
    incomplete_objects_dropped: incompleteDropped,
    unknown_unrecoverable: recovered.items.length === 0,
    original_finish_reason: finishReason,
  };

  if (!recovered.found || recovered.items.length === 0) {
    return {
      invoked: true,
      ok: false,
      value: null,
      error: "truncated observations[] has no complete objects",
      audit,
    };
  }

  const schema = completeStringField(text, "schema");
  const segmentId = completeStringField(text, "segment_id");
  const value: Record<string, unknown> = {
    observations: recovered.items,
  };
  if (schema) value.schema = schema;
  if (segmentId) value.segment_id = segmentId;

  return {
    invoked: true,
    ok: true,
    value,
    error: null,
    audit,
  };
}
