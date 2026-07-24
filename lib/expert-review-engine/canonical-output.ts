/**
 * Deterministic canonical output comparison for expert parity harness (P2-23).
 */

import { createHash } from "node:crypto";

export type CanonicalizationErrorCode =
  | "function"
  | "symbol"
  | "class_instance"
  | "cycle"
  | "error_object"
  | "buffer"
  | "unknown_type";

export interface CanonicalizationFailure {
  ok: false;
  code: CanonicalizationErrorCode;
  path: string;
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
  /(manuscript|extractedText|memoContent|reviewMemo|content|text|original|revised)/i;

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

/** Canonicalize a value for deterministic hashing and comparison. */
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
  if (valueType === "boolean" || valueType === "number" || valueType === "string") {
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

/** Stable JSON string with sorted object keys at every level. */
export function canonicalJsonString(value: unknown): string {
  const canonical = canonicalizeOutputValue(value);
  if (!canonical.ok) {
    throw new Error(`Cannot canonicalize output at ${canonical.path}: ${canonical.code}`);
  }
  return JSON.stringify(canonical.value);
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

  const directCanonical = canonicalizeOutputValue(directOutput);
  if (!directCanonical.ok) {
    return { ok: false, side: "direct", error: directCanonical };
  }

  const engineHash = createHash("sha256")
    .update(JSON.stringify(engineCanonical.value))
    .digest("hex");
  const directHash = createHash("sha256")
    .update(JSON.stringify(directCanonical.value))
    .digest("hex");

  const mismatches = collectMismatches(engineCanonical.value, directCanonical.value).map(
    (mismatch) => ({
      path: mismatch.path,
      engineValue: SENSITIVE_PATH_PATTERN.test(mismatch.path)
        ? sanitizeDiagnosticValue(mismatch.engineValue)
        : mismatch.engineValue,
      directValue: SENSITIVE_PATH_PATTERN.test(mismatch.path)
        ? sanitizeDiagnosticValue(mismatch.directValue)
        : mismatch.directValue,
    }),
  );

  return {
    ok: true,
    engineHash,
    directHash,
    match: engineHash === directHash,
    mismatches,
  };
}
