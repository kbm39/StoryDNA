import { createHash } from "node:crypto";

/**
 * Canonical JSON for definition hashing.
 *
 * Rules:
 * - Object keys are sorted lexicographically at every level.
 * - Arrays preserve order (order is semantic unless documented otherwise).
 * - undefined values are omitted; null is preserved.
 */
export function canonicalizeForHash(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalizeForHash);
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const v = obj[key];
    if (v === undefined) continue;
    out[key] = canonicalizeForHash(v);
  }
  return out;
}

export function canonicalJsonString(value: unknown): string {
  return JSON.stringify(canonicalizeForHash(value));
}

export function hashExpertDefinition(definition: unknown): string {
  return createHash("sha256").update(canonicalJsonString(definition)).digest("hex");
}

export function verifyExpertDefinitionHash(
  definition: unknown,
  expectedHash: string,
): boolean {
  return hashExpertDefinition(definition) === expectedHash;
}

export const DEFINITION_HASH_PATTERN = /^[a-f0-9]{64}$/;

export function isValidDefinitionHash(hash: string): boolean {
  return DEFINITION_HASH_PATTERN.test(hash);
}
