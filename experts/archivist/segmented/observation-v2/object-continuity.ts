/**
 * Repeated-object continuity chains from retained V2 object_equipment rows.
 * Does not call a provider. Does not write canon.
 */

import type { V2Observation } from "./types.ts";

const GENERIC_OBJECTS = new Set([
  "laptop",
  "phone",
  "glock",
  "rifle",
  "boat",
  "car",
  "truck",
  "pistol",
  "weapon",
  "radio",
]);

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function isGenericObject(value: string): boolean {
  const bare = norm(value).replace(/^(the|a|an)\s+/, "");
  return GENERIC_OBJECTS.has(bare);
}

function compactForCanonical(value: string): string {
  return norm(value).replace(/[\u2018\u2019]/g, "'");
}

function leadingPossessor(compact: string): string | null {
  const match = compact.match(/^([a-z]+'s)\b/);
  return match?.[1] ?? null;
}

/** High-confidence only: possessor + "team coin". Does not key a bare coin. */
function possessorTeamCoinKey(compact: string): string | null {
  if (!/\bteam coin\b/.test(compact)) return null;
  const possessor = leadingPossessor(compact);
  return possessor ? `${possessor} team coin` : null;
}

/** High-confidence only: possessor + insurance + laptop. Does not key a bare laptop. */
function possessorInsuranceLaptopKey(compact: string): string | null {
  if (!/\binsurance\b/.test(compact) || !/\blaptop\b/.test(compact)) return null;
  const possessor = leadingPossessor(compact);
  return possessor ? `${possessor} insurance laptop` : null;
}

export function objectContinuityKey(observation: V2Observation): string | null {
  if (observation.kind !== "object_equipment") return null;
  const payload = observation.payload as unknown as Record<string, unknown>;
  const identity = text(payload.object_identity);
  const object = text(payload.object);
  const source = identity ?? object;
  if (!source) return null;
  const compact = compactForCanonical(source);
  const teamCoin = possessorTeamCoinKey(compact);
  if (teamCoin) return teamCoin;
  const insuranceLaptop = possessorInsuranceLaptopKey(compact);
  if (insuranceLaptop) return insuranceLaptop;
  if (identity) return norm(identity.split(",")[0] ?? identity);
  if (isGenericObject(object ?? "")) return null;
  return norm(object ?? source);
}

export function countRepeatedObjectContinuityChains(
  observations: readonly V2Observation[],
): number {
  const byKey = new Map<string, { locators: Set<string>; actions: Set<string> }>();
  for (const observation of observations) {
    const key = objectContinuityKey(observation);
    if (!key) continue;
    const payload = observation.payload as unknown as Record<string, unknown>;
    const row = byKey.get(key) ?? { locators: new Set<string>(), actions: new Set<string>() };
    const locator = observation.evidence.locator?.trim() || observation.evidence.source_segment;
    if (locator) row.locators.add(norm(locator));
    const action = text(payload.action_or_state);
    if (action) row.actions.add(norm(action));
    byKey.set(key, row);
  }
  return [...byKey.values()].filter((row) => row.locators.size >= 2 || row.actions.size >= 2).length;
}
