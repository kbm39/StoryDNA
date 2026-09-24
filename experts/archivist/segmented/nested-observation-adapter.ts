/**
 * Truncation recovery + repair-order for compact and nested Haiku shapes.
 * Flattening lives in observation-normalization.ts. Contract version unchanged.
 */

import { extractArchivistJson } from "../model-output.ts";
import {
  allObservationFacts,
  FACT_GROUPS,
  RECOVERABLE_TOP_LEVEL_ARRAYS,
  validateSegmentObservation,
} from "./observation-contract.ts";
import {
  flattenNestedEntityFacts,
  locatorFromRepresentation,
  normalizeSegmentObservation,
  type ObservationQuarantine,
} from "./observation-normalization.ts";
import type { ArchivistSegmentObservation } from "./types.ts";

export const NESTED_FACT_INPUT_SHAPE = {
  source: "archivist-compact-cal-20260924-seg02",
  entity_fields_observed: ["entity_id", "entity_type", "alias", "name_surface", "facts"],
  fact_fields_observed: [
    "fact_id",
    "fact_type",
    "confidence",
    "inferred",
    "excerpt",
    "locator",
    "temporal_scope",
    "notes",
  ],
  locator_fields_observed: ["chapter", "context"],
  not_typically_present: ["value", "locator.locator", "status"],
} as const;

const RECOVERABLE_ARRAY_SET = new Set<string>(RECOVERABLE_TOP_LEVEL_ARRAYS);

export interface RecoveredArrayCounts {
  [key: string]: number;
}

export interface TopLevelArrayRecovery {
  recoverable: boolean;
  truncated: boolean;
  incomplete_tail: boolean;
  incomplete_tail_array: string | null;
  incomplete_tail_object_dropped: boolean;
  complete_objects_retained: number;
  recovered_array_counts: RecoveredArrayCounts;
  unknown_arrays: string[];
  value: Record<string, unknown> | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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

function listedArrayKeys(text: string): string[] {
  const keys: string[] = [];
  const pattern = /"([A-Za-z_][A-Za-z0-9_]*)"\s*:\s*\[/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    keys.push(match[1]!);
  }
  return keys;
}

function countsFromValue(value: Record<string, unknown>): RecoveredArrayCounts {
  const counts: RecoveredArrayCounts = {};
  for (const key of RECOVERABLE_TOP_LEVEL_ARRAYS) {
    if (Array.isArray(value[key])) counts[key] = (value[key] as unknown[]).length;
  }
  return counts;
}

export function recoverCompleteTopLevelArrays(raw: string): TopLevelArrayRecovery {
  const extracted = extractArchivistJson(raw);
  if (extracted.ok && asRecord(extracted.value)) {
    const value = extracted.value as Record<string, unknown>;
    const recovered_array_counts = countsFromValue(value);
    return {
      recoverable: true,
      truncated: false,
      incomplete_tail: false,
      incomplete_tail_array: null,
      incomplete_tail_object_dropped: false,
      complete_objects_retained: Object.values(recovered_array_counts).reduce((sum, count) => sum + count, 0),
      recovered_array_counts,
      unknown_arrays: [],
      value,
    };
  }

  const text = unwrapFence(raw);
  const recovered_array_counts: RecoveredArrayCounts = {};
  const value: Record<string, unknown> = {};
  const schema = completeStringField(text, "schema") ?? "archivist_segment_observation@v1";
  const segmentId = completeStringField(text, "segment_id");
  value.schema = schema;
  if (segmentId) value.segment_id = segmentId;

  let incompleteTail = false;
  let incompleteTailArray: string | null = null;
  let incompleteObjectDropped = false;
  let completeObjects = 0;

  for (const key of RECOVERABLE_TOP_LEVEL_ARRAYS) {
    const recovered = recoverCompleteArrayElements(text, key);
    if (!recovered.found) continue;
    value[key] = recovered.items;
    recovered_array_counts[key] = recovered.items.length;
    completeObjects += recovered.items.length;
    if (recovered.incomplete_tail && !incompleteTail) {
      incompleteTail = true;
      incompleteTailArray = key;
      incompleteObjectDropped = !recovered.closed;
    }
  }

  const unknown_arrays = listedArrayKeys(text).filter((key) => !RECOVERABLE_ARRAY_SET.has(key));

  if (completeObjects === 0) {
    return {
      recoverable: false,
      truncated: true,
      incomplete_tail: true,
      incomplete_tail_array: incompleteTailArray,
      incomplete_tail_object_dropped: incompleteObjectDropped,
      complete_objects_retained: 0,
      recovered_array_counts,
      unknown_arrays,
      value: null,
    };
  }

  return {
    recoverable: true,
    truncated: true,
    incomplete_tail: incompleteTail,
    incomplete_tail_array: incompleteTailArray,
    incomplete_tail_object_dropped: incompleteObjectDropped,
    complete_objects_retained: completeObjects,
    recovered_array_counts,
    unknown_arrays,
    value,
  };
}

export function recoverCompleteNestedEntities(raw: string): {
  recoverable: boolean;
  truncated: boolean;
  incomplete_tail: boolean;
  value: Record<string, unknown> | null;
  complete_entity_count: number;
} {
  const recovered = recoverCompleteTopLevelArrays(raw);
  return {
    recoverable: recovered.recoverable,
    truncated: recovered.truncated,
    incomplete_tail: recovered.incomplete_tail,
    value: recovered.value,
    complete_entity_count: recovered.recovered_array_counts.entities ?? 0,
  };
}

export function usableFactCount(observation: ArchivistSegmentObservation | null): number {
  if (!observation) return 0;
  return allObservationFacts(observation).filter((fact) => {
    const locator = locatorFromRepresentation(fact.locator);
    return Boolean(locator && fact.excerpt?.trim() && fact.alias?.trim());
  }).length;
}

function prefixFactObjectCount(counts: RecoveredArrayCounts): number {
  return FACT_GROUPS.reduce((sum, group) => sum + (counts[group] ?? 0), 0);
}

export function recoverAndNormalizeSegmentObservation(
  raw: string,
  segmentId: string,
): {
  ok: boolean;
  observation: ArchivistSegmentObservation | null;
  errors: string[];
  quarantined: ObservationQuarantine[];
  nested_facts_discovered: number;
  flattened_facts: number;
  truncated: boolean;
  incomplete_tail: boolean;
  recoverable: boolean;
  recovered_array_counts: RecoveredArrayCounts;
  incomplete_tail_array: string | null;
  incomplete_tail_object_dropped: boolean;
  complete_objects_retained: number;
  unknown_arrays: string[];
} {
  const recovered = recoverCompleteTopLevelArrays(raw);
  if (!recovered.recoverable || !recovered.value) {
    return {
      ok: false,
      observation: null,
      errors: ["truncated_unrecoverable"],
      quarantined: [],
      nested_facts_discovered: 0,
      flattened_facts: 0,
      truncated: recovered.truncated,
      incomplete_tail: recovered.incomplete_tail,
      recoverable: false,
      recovered_array_counts: recovered.recovered_array_counts,
      incomplete_tail_array: recovered.incomplete_tail_array,
      incomplete_tail_object_dropped: recovered.incomplete_tail_object_dropped,
      complete_objects_retained: recovered.complete_objects_retained,
      unknown_arrays: recovered.unknown_arrays,
    };
  }
  const flattened = flattenNestedEntityFacts(recovered.value, segmentId);
  const normalized = normalizeSegmentObservation(flattened.observation, segmentId);
  const parsed = validateSegmentObservation(normalized.observation, segmentId);
  const observation = parsed.ok ? parsed.observation : null;
  const flattenedFacts = usableFactCount(observation);
  const prefixFacts = prefixFactObjectCount(recovered.recovered_array_counts);
  const masked =
    parsed.ok &&
    prefixFacts > 0 &&
    flattenedFacts === 0 &&
    flattened.quarantined.length === 0 &&
    normalized.quarantined.length === 0 &&
    flattened.nested_facts_discovered === 0;
  return {
    ok: parsed.ok && !masked,
    observation: masked ? null : observation,
    errors: masked
      ? ["entity_only_recovery_masked_prefix_facts"]
      : parsed.ok
        ? []
        : parsed.errors,
    quarantined: [...flattened.quarantined, ...normalized.quarantined],
    nested_facts_discovered: flattened.nested_facts_discovered,
    flattened_facts: flattenedFacts,
    truncated: recovered.truncated,
    incomplete_tail: recovered.incomplete_tail,
    recoverable: true,
    recovered_array_counts: recovered.recovered_array_counts,
    incomplete_tail_array: recovered.incomplete_tail_array,
    incomplete_tail_object_dropped: recovered.incomplete_tail_object_dropped,
    complete_objects_retained: recovered.complete_objects_retained,
    unknown_arrays: recovered.unknown_arrays,
  };
}

export function chooseObservationPreferringRecoveredPrimary(args: {
  primaryRaw: string;
  repairRaw?: string;
  segmentId: string;
}): {
  observation: ArchivistSegmentObservation | null;
  source: "primary" | "repair" | "none";
  repair_necessary: boolean;
  primary: ReturnType<typeof recoverAndNormalizeSegmentObservation>;
  repair: ReturnType<typeof recoverAndNormalizeSegmentObservation> | null;
} {
  const primary = recoverAndNormalizeSegmentObservation(args.primaryRaw, args.segmentId);
  if (primary.ok && primary.observation && (usableFactCount(primary.observation) > 0 || prefixFactObjectCount(primary.recovered_array_counts) === 0)) {
    return { observation: primary.observation, source: "primary", repair_necessary: false, primary, repair: null };
  }
  if (!args.repairRaw) {
    return {
      observation: primary.observation,
      source: primary.ok ? "primary" : "none",
      repair_necessary: true,
      primary,
      repair: null,
    };
  }
  const repair = recoverAndNormalizeSegmentObservation(args.repairRaw, args.segmentId);
  const primaryCount = usableFactCount(primary.observation);
  const repairCount = usableFactCount(repair.observation);
  if (primaryCount > repairCount && primary.observation) {
    return { observation: primary.observation, source: "primary", repair_necessary: false, primary, repair };
  }
  if (repair.ok && repair.observation) {
    return { observation: repair.observation, source: "repair", repair_necessary: true, primary, repair };
  }
  return { observation: null, source: "none", repair_necessary: true, primary, repair };
}
