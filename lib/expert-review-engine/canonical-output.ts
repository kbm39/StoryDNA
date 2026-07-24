/**
 * Deterministic canonical output comparison for expert parity harness (P2-23).
 *
 * Contract notes:
 * - Object keys are sorted lexicographically at every depth; array order is preserved.
 * - `null` is preserved; object properties with `undefined` values are omitted.
 * - `-0` normalizes to `0` (JSON-compatible signed-zero handling).
 * - Sparse arrays are rejected by index presence, not filled with null.
 * - NaN and ±Infinity fail closed (never JSON.stringify-null collisions).
 */

import { createHash } from "node:crypto";

/** Aligned with P2-22 executor output safety limit. */
export const MAX_CANONICAL_OUTPUT_BYTES = 512_000;

export type CanonicalizationErrorCode =
  | "function"
  | "symbol"
  | "class_instance"
  | "cycle"
  | "error_object"
  | "buffer"
  | "non_finite_number"
  | "sparse_array"
  | "output_size_exceeded"
  | "unknown_type";

export interface CanonicalizationFailure {
  ok: false;
  code: CanonicalizationErrorCode;
  path: string;
  context?: Readonly<Record<string, string>>;
}

export interface CanonicalizationSuccess {
  ok: true;
  value: unknown;
}

export type CanonicalizationResult = CanonicalizationSuccess | CanonicalizationFailure;

export interface CanonicalOutputMismatch {
  path: string;
  engineValue: unknown;
  directValue: unknown;
}

export interface CompareCanonicalOutputsResult {
  ok: true;
  engineHash: string;
  directHash: string;
  match: boolean;
  mismatches: readonly CanonicalOutputMismatch[];
}

export interface CompareCanonicalOutputsFailure {
  ok: false;
  side: "engine" | "direct";
  error: CanonicalizationFailure;
}

export type CompareCanonicalOutputsResponse =
  | CompareCanonicalOutputsResult
  | CompareCanonicalOutputsFailure;

const SENSITIVE_PATH_PATTERN =
  /(manuscript|extractedText|memoContent|reviewMemo|content|text|original|revised|prompt)/i;

const textEncoder = new TextEncoder();

function sanitizeDiagnosticValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.length > 80) return `[string length=${value.length}]`;
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return `[array length=${value.length}]`;
  if (typeof value === "object") return "[object]";
  return `[${typeof value}]`;
}

function canonicalNumber(value: number, path: string): CanonicalizationResult {
  if (!Number.isFinite(value)) {
    return { ok: false, code: "non_finite_number", path };
  }
  return { ok: true, value: Object.is(value, -0) ? 0 : value };
}

function measureUtf8Bytes(value: unknown): number {
  return textEncoder.encode(JSON.stringify(value)).length;
}

function enforceCanonicalSize(value: unknown, path: string): CanonicalizationResult {
  const bytes = measureUtf8Bytes(value);
  if (bytes > MAX_CANONICAL_OUTPUT_BYTES) {
    return {
      ok: false,
      code: "output_size_exceeded",
      path,
      context: {
        actual_bytes: String(bytes),
        max_bytes: String(MAX_CANONICAL_OUTPUT_BYTES),
      },
    };
  }
  return { ok: true, value };
}

/** Canonicalize a value for deterministic hashing and comparison. Does not mutate input. */
export function canonicalizeOutputValue(
  value: unknown,
  path = "$",
  seen: WeakSet<object> = new WeakSet(),
): CanonicalizationResult {
  if (value === null || value === undefined) {
    return { ok: true, value: value ?? null };
  }

  const valueType = typeof value;
  if (valueType === "function") {
    return { ok: false, code: "function", path };
  }
  if (valueType === "symbol") {
    return { ok: false, code: "symbol", path };
  }
  if (valueType === "number") {
    return canonicalNumber(value as number, path);
  }
  if (valueType === "boolean" || valueType === "string") {
    return { ok: true, value };
  }
  if (valueType === "bigint") {
    return { ok: true, value: value.toString() };
  }

  if (value instanceof Error) {
    return { ok: false, code: "error_object", path };
  }

  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return { ok: false, code: "buffer", path };
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) return { ok: false, code: "cycle", path };
    seen.add(value);
    const canonical: unknown[] = [];
    for (let index = 0; index < value.length; index++) {
      if (!(index in value)) {
        return { ok: false, code: "sparse_array", path: `${path}[${index}]` };
      }
      const item = canonicalizeOutputValue(value[index], `${path}[${index}]`, seen);
      if (!item.ok) return item;
      canonical.push(item.value);
    }
    return { ok: true, value: canonical };
  }

  if (valueType === "object") {
    if (seen.has(value)) return { ok: false, code: "cycle", path };
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return { ok: false, code: "class_instance", path };
    }
    seen.add(value);
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const canonical: Record<string, unknown> = {};
    for (const key of keys) {
      const nested = obj[key];
      if (nested === undefined) continue;
      const item = canonicalizeOutputValue(nested, `${path}.${key}`, seen);
      if (!item.ok) return item;
      canonical[key] = item.value;
    }
    return { ok: true, value: canonical };
  }

  return { ok: false, code: "unknown_type", path };
}

function finalizeCanonicalValue(
  canonical: CanonicalizationSuccess,
  path: string,
): CanonicalizationResult {
  return enforceCanonicalSize(canonical.value, path);
}

/** Stable JSON string with sorted object keys at every level. */
export function canonicalJsonString(value: unknown): string {
  const canonical = canonicalizeOutputValue(value);
  if (!canonical.ok) {
    throw new Error(`Cannot canonicalize output at ${canonical.path}: ${canonical.code}`);
  }
  const sized = finalizeCanonicalValue(canonical, "$");
  if (!sized.ok) {
    throw new Error(`Cannot canonicalize output at ${sized.path}: ${sized.code}`);
  }
  return JSON.stringify(sized.value);
}

/** SHA-256 hash of canonical JSON representation. */
export function hashCanonicalOutput(value: unknown): string {
  return createHash("sha256").update(canonicalJsonString(value)).digest("hex");
}

function collectMismatches(
  engineValue: unknown,
  directValue: unknown,
  path = "$",
  mismatches: CanonicalOutputMismatch[] = [],
): CanonicalOutputMismatch[] {
  if (Object.is(engineValue, directValue)) return mismatches;

  const engineType = engineValue === null ? "null" : typeof engineValue;
  const directType = directValue === null ? "null" : typeof directValue;
  if (engineType !== directType || engineValue === null || directValue === null) {
    mismatches.push({ path, engineValue, directValue });
    return mismatches;
  }

  if (Array.isArray(engineValue) && Array.isArray(directValue)) {
    const maxLen = Math.max(engineValue.length, directValue.length);
    for (let index = 0; index < maxLen; index++) {
      if (index >= engineValue.length || index >= directValue.length) {
        mismatches.push({
          path: `${path}[${index}]`,
          engineValue: engineValue[index],
          directValue: directValue[index],
        });
        continue;
      }
      collectMismatches(engineValue[index], directValue[index], `${path}[${index}]`, mismatches);
    }
    return mismatches;
  }

  if (engineType === "object" && directType === "object") {
    const engineObj = engineValue as Record<string, unknown>;
    const directObj = directValue as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(engineObj), ...Object.keys(directObj)])].sort();
    for (const key of keys) {
      if (!(key in engineObj)) {
        mismatches.push({ path: `${path}.${key}`, engineValue: undefined, directValue: directObj[key] });
        continue;
      }
      if (!(key in directObj)) {
        mismatches.push({ path: `${path}.${key}`, engineValue: engineObj[key], directValue: undefined });
        continue;
      }
      collectMismatches(engineObj[key], directObj[key], `${path}.${key}`, mismatches);
    }
    return mismatches;
  }

  mismatches.push({ path, engineValue, directValue });
  return mismatches;
}

/** Compare two outputs after canonicalization; returns hashes and concise mismatch paths. */
export function compareCanonicalOutputs(
  engineOutput: unknown,
  directOutput: unknown,
): CompareCanonicalOutputsResponse {
  const engineCanonical = canonicalizeOutputValue(engineOutput);
  if (!engineCanonical.ok) {
    return { ok: false, side: "engine", error: engineCanonical };
  }
  const engineSized = finalizeCanonicalValue(engineCanonical, "$");
  if (!engineSized.ok) {
    return { ok: false, side: "engine", error: engineSized };
  }

  const directCanonical = canonicalizeOutputValue(directOutput);
  if (!directCanonical.ok) {
    return { ok: false, side: "direct", error: directCanonical };
  }
  const directSized = finalizeCanonicalValue(directCanonical, "$");
  if (!directSized.ok) {
    return { ok: false, side: "direct", error: directSized };
  }

  const engineHash = createHash("sha256")
    .update(JSON.stringify(engineSized.value))
    .digest("hex");
  const directHash = createHash("sha256")
    .update(JSON.stringify(directSized.value))
    .digest("hex");

  const mismatches = collectMismatches(engineSized.value, directSized.value).map((mismatch) => ({
    path: mismatch.path,
    engineValue: SENSITIVE_PATH_PATTERN.test(mismatch.path)
      ? sanitizeDiagnosticValue(mismatch.engineValue)
      : mismatch.engineValue,
    directValue: SENSITIVE_PATH_PATTERN.test(mismatch.path)
      ? sanitizeDiagnosticValue(mismatch.directValue)
      : mismatch.directValue,
  }));

  return {
    ok: true,
    engineHash,
    directHash,
    match: engineHash === directHash,
    mismatches,
  };
}
