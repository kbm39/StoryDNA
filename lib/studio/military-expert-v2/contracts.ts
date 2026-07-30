/**
 * Military Expert V2 scene inventory and selection contracts.
 * Version: military_expert_scene_inventory@v1, military_expert_v2_handoff@v1
 */

export const MILITARY_EXPERT_SCENE_INVENTORY_CONTRACT_VERSION =
  "military_expert_scene_inventory@v1" as const;

export const MILITARY_EXPERT_V2_HANDOFF_VERSION = "military_expert_v2_handoff@v1" as const;

export const MILITARY_EXPERT_SCENE_TYPES = [
  "firefight",
  "battle",
  "breach",
  "room_entry",
  "convoy",
  "vehicle_contact",
  "aviation_insertion",
  "aviation_extraction",
  "casualty_under_fire",
  "casualty_evacuation",
  "communications",
  "command_decision",
  "mission_planning",
  "intelligence",
  "weapons_handling",
  "military_culture",
  "chain_of_command",
  "other",
] as const;

export type MilitaryExpertSceneType = (typeof MILITARY_EXPERT_SCENE_TYPES)[number];

export const MILITARY_EXPERT_ACTION_CATEGORIES = [
  "firefight_or_battle",
  "movement_and_cover",
  "room_entry_or_breach",
  "ambush_or_contact",
  "convoy_or_vehicle_movement",
  "command_decision",
  "radio_or_communications",
  "weapons_handling",
  "casualty_treatment_or_evacuation",
  "intelligence_or_planning",
  "aviation",
  "military_culture_or_chain_of_command",
] as const;

export type MilitaryExpertActionCategory =
  (typeof MILITARY_EXPERT_ACTION_CATEGORIES)[number];

export const MILITARY_EXPERT_SCENE_PRIORITY_TIERS = [
  "major",
  "moderate",
  "minor",
] as const;

export type MilitaryExpertScenePriorityTier =
  (typeof MILITARY_EXPERT_SCENE_PRIORITY_TIERS)[number];

export const MILITARY_EXPERT_SCENE_DISCOVERY_SOURCES = [
  "deterministic_heuristic",
  "provider_refinement",
  "deterministic_and_provider_merged",
  "manual_override",
] as const;

export type MilitaryExpertSceneDiscoverySource =
  (typeof MILITARY_EXPERT_SCENE_DISCOVERY_SOURCES)[number];

export const MILITARY_EXPERT_SELECTION_WARNING_CODES = [
  "major_scene_deselected",
  "no_firefights_selected",
  "no_breach_or_entry_selected",
  "no_major_scenes_selected",
  "casualty_under_fire_not_selected",
  "aviation_not_selected",
  "convoy_contact_not_selected",
] as const;

export type MilitaryExpertSelectionWarningCode =
  (typeof MILITARY_EXPERT_SELECTION_WARNING_CODES)[number];

export const MILITARY_EXPERT_SELECTION_SOURCES = [
  "system_default",
  "author_selected",
  "author_deselected",
  "certification_required",
] as const;

export type MilitaryExpertSelectionSource =
  (typeof MILITARY_EXPERT_SELECTION_SOURCES)[number];

export const MILITARY_EXPERT_INVENTORY_STATUSES = [
  "draft",
  "ready_for_selection",
  "superseded",
] as const;

export type MilitaryExpertInventoryStatus =
  (typeof MILITARY_EXPERT_INVENTORY_STATUSES)[number];

export interface MilitaryExpertSceneLocator {
  readonly exact_page_number: number | null;
  readonly page_is_approximate: boolean;
  readonly chapter_label: string | null;
  readonly scene_heading: string | null;
  readonly approximate_book_percentage: number;
  readonly internal_start_offset: number;
  readonly internal_end_offset: number;
}

export interface MilitaryExpertSceneInventoryEntry {
  readonly inventory_id: string;
  readonly scene_id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly scene_index: number;
  readonly locator: MilitaryExpertSceneLocator;
  readonly two_sentence_description: string;
  readonly scene_types: readonly MilitaryExpertSceneType[];
  readonly action_categories: readonly MilitaryExpertActionCategory[];
  readonly participants: readonly string[];
  readonly priority_tier: MilitaryExpertScenePriorityTier;
  readonly discovery_confidence: number;
  readonly discovery_source: MilitaryExpertSceneDiscoverySource;
  readonly default_selected: boolean;
  readonly selection_warning_codes: readonly MilitaryExpertSelectionWarningCode[];
  readonly source_hash: string;
}

export interface MilitaryExpertSceneInventoryDocument {
  readonly contract_version: typeof MILITARY_EXPERT_SCENE_INVENTORY_CONTRACT_VERSION;
  readonly inventory_id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly workflow_id: string | null;
  readonly generated_at: string;
  readonly mode: "author" | "certification";
  readonly scene_count: number;
  readonly major_scene_count: number;
  readonly scenes: readonly MilitaryExpertSceneInventoryEntry[];
  readonly inventory_status: MilitaryExpertInventoryStatus;
}

export interface MilitaryExpertSceneSelectionEntry {
  readonly inventory_id: string;
  readonly scene_id: string;
  readonly is_selected: boolean;
  readonly selection_source: MilitaryExpertSelectionSource;
  readonly selected_at: string | null;
  readonly warning_acknowledged: boolean;
  readonly estimated_input_tokens: number;
  readonly estimated_output_tokens: number;
  readonly estimated_cost_usd: number;
  readonly estimated_runtime_seconds: number;
}

export interface MilitaryExpertSelectionSnapshot {
  readonly selection_snapshot_id: string;
  readonly inventory_id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly mode: "author" | "certification";
  readonly confirmed_at: string | null;
  readonly confirmed_by: "author" | "system_certification";
  readonly immutable: boolean;
  readonly selections: readonly MilitaryExpertSceneSelectionEntry[];
  readonly active_warnings: readonly MilitaryExpertSelectionWarningCode[];
  readonly totals: {
    readonly selected_scene_count: number;
    readonly estimated_input_tokens: number;
    readonly estimated_output_tokens: number;
    readonly estimated_cost_usd: number;
    readonly estimated_runtime_seconds_min: number;
    readonly estimated_runtime_seconds_max: number;
  };
}

export interface MilitaryExpertV2ReviewHandoffPayload {
  readonly handoff_version: typeof MILITARY_EXPERT_V2_HANDOFF_VERSION;
  readonly inventory_id: string;
  readonly selection_snapshot_id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly selected_scene_ids: readonly string[];
  readonly selection_snapshot: MilitaryExpertSelectionSnapshot;
  readonly expected_scene_count: number;
  readonly selected_scene_coverage_target: 1.0;
  readonly mode: "author" | "certification";
  readonly estimated_budget_usd: number;
  readonly workflow_definition_version: "military_expert_review@v2-scene";
  readonly inventory_document: MilitaryExpertSceneInventoryDocument;
}

const SCENE_TYPE_SET = new Set<string>(MILITARY_EXPERT_SCENE_TYPES);
const ACTION_CATEGORY_SET = new Set<string>(MILITARY_EXPERT_ACTION_CATEGORIES);
const PRIORITY_TIER_SET = new Set<string>(MILITARY_EXPERT_SCENE_PRIORITY_TIERS);
const DISCOVERY_SOURCE_SET = new Set<string>(MILITARY_EXPERT_SCENE_DISCOVERY_SOURCES);
const WARNING_CODE_SET = new Set<string>(MILITARY_EXPERT_SELECTION_WARNING_CODES);
const SELECTION_SOURCE_SET = new Set<string>(MILITARY_EXPERT_SELECTION_SOURCES);
const INVENTORY_STATUS_SET = new Set<string>(MILITARY_EXPERT_INVENTORY_STATUSES);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isEnum(value: unknown, allowed: Set<string>): boolean {
  return typeof value === "string" && allowed.has(value);
}

function isEnumArray(value: unknown, allowed: Set<string>): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((item) => isEnum(item, allowed));
}

export function parseMilitaryExpertSceneLocator(raw: unknown): MilitaryExpertSceneLocator | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const exactPage =
    obj.exact_page_number === null
      ? null
      : typeof obj.exact_page_number === "number" && Number.isFinite(obj.exact_page_number)
        ? obj.exact_page_number
        : null;
  if (
    typeof obj.page_is_approximate !== "boolean" ||
    typeof obj.approximate_book_percentage !== "number" ||
    !Number.isFinite(obj.approximate_book_percentage) ||
    typeof obj.internal_start_offset !== "number" ||
    typeof obj.internal_end_offset !== "number" ||
    !Number.isFinite(obj.internal_start_offset) ||
    !Number.isFinite(obj.internal_end_offset)
  ) {
    return null;
  }
  if (obj.chapter_label !== null && typeof obj.chapter_label !== "string") return null;
  if (obj.scene_heading !== null && typeof obj.scene_heading !== "string") return null;
  if (exactPage !== null && exactPage < 1) return null;
  if (obj.approximate_book_percentage < 0 || obj.approximate_book_percentage > 100) return null;

  return Object.freeze({
    exact_page_number: exactPage,
    page_is_approximate: obj.page_is_approximate,
    chapter_label: (obj.chapter_label as string | null) ?? null,
    scene_heading: (obj.scene_heading as string | null) ?? null,
    approximate_book_percentage: obj.approximate_book_percentage,
    internal_start_offset: obj.internal_start_offset,
    internal_end_offset: obj.internal_end_offset,
  });
}

export function parseMilitaryExpertSceneInventoryEntry(
  raw: unknown,
): MilitaryExpertSceneInventoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const locator = parseMilitaryExpertSceneLocator(obj.locator);
  if (!locator) return null;
  if (
    !isNonEmptyString(obj.inventory_id) ||
    !isNonEmptyString(obj.scene_id) ||
    !isNonEmptyString(obj.manuscript_id) ||
    !isNonEmptyString(obj.manuscript_version_id) ||
    typeof obj.scene_index !== "number" ||
    !Number.isInteger(obj.scene_index) ||
    obj.scene_index < 1 ||
    !isNonEmptyString(obj.two_sentence_description) ||
    !isEnumArray(obj.scene_types, SCENE_TYPE_SET) ||
    !isEnumArray(obj.action_categories, ACTION_CATEGORY_SET) ||
    !isStringArray(obj.participants) ||
    !isEnum(obj.priority_tier, PRIORITY_TIER_SET) ||
    typeof obj.discovery_confidence !== "number" ||
    !Number.isFinite(obj.discovery_confidence) ||
    obj.discovery_confidence < 0 ||
    obj.discovery_confidence > 1 ||
    !isEnum(obj.discovery_source, DISCOVERY_SOURCE_SET) ||
    typeof obj.default_selected !== "boolean" ||
    !Array.isArray(obj.selection_warning_codes) ||
    !obj.selection_warning_codes.every((code) => isEnum(code, WARNING_CODE_SET)) ||
    !isNonEmptyString(obj.source_hash)
  ) {
    return null;
  }

  return Object.freeze({
    inventory_id: obj.inventory_id,
    scene_id: obj.scene_id,
    manuscript_id: obj.manuscript_id,
    manuscript_version_id: obj.manuscript_version_id,
    scene_index: obj.scene_index,
    locator,
    two_sentence_description: obj.two_sentence_description,
    scene_types: Object.freeze([...(obj.scene_types as MilitaryExpertSceneType[])]),
    action_categories: Object.freeze([
      ...(obj.action_categories as MilitaryExpertActionCategory[]),
    ]),
    participants: Object.freeze([...(obj.participants as string[])]),
    priority_tier: obj.priority_tier as MilitaryExpertScenePriorityTier,
    discovery_confidence: obj.discovery_confidence,
    discovery_source: obj.discovery_source as MilitaryExpertSceneDiscoverySource,
    default_selected: obj.default_selected,
    selection_warning_codes: Object.freeze([
      ...(obj.selection_warning_codes as MilitaryExpertSelectionWarningCode[]),
    ]),
    source_hash: obj.source_hash,
  });
}

export function parseMilitaryExpertSceneInventoryDocument(
  raw: unknown,
): MilitaryExpertSceneInventoryDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (
    obj.contract_version !== MILITARY_EXPERT_SCENE_INVENTORY_CONTRACT_VERSION ||
    !isNonEmptyString(obj.inventory_id) ||
    !isNonEmptyString(obj.manuscript_id) ||
    !isNonEmptyString(obj.manuscript_version_id) ||
    !isNonEmptyString(obj.generated_at) ||
    (obj.mode !== "author" && obj.mode !== "certification") ||
    typeof obj.scene_count !== "number" ||
    typeof obj.major_scene_count !== "number" ||
    !isEnum(obj.inventory_status, INVENTORY_STATUS_SET) ||
    !Array.isArray(obj.scenes)
  ) {
    return null;
  }
  const scenes = obj.scenes
    .map(parseMilitaryExpertSceneInventoryEntry)
    .filter((entry): entry is MilitaryExpertSceneInventoryEntry => entry !== null);
  if (scenes.length !== obj.scenes.length) return null;
  if (scenes.length !== obj.scene_count) return null;

  return Object.freeze({
    contract_version: MILITARY_EXPERT_SCENE_INVENTORY_CONTRACT_VERSION,
    inventory_id: obj.inventory_id,
    manuscript_id: obj.manuscript_id,
    manuscript_version_id: obj.manuscript_version_id,
    workflow_id: typeof obj.workflow_id === "string" ? obj.workflow_id : null,
    generated_at: obj.generated_at,
    mode: obj.mode,
    scene_count: obj.scene_count,
    major_scene_count: obj.major_scene_count,
    scenes: Object.freeze(scenes),
    inventory_status: obj.inventory_status as MilitaryExpertInventoryStatus,
  });
}

export function parseMilitaryExpertSceneSelectionEntry(
  raw: unknown,
): MilitaryExpertSceneSelectionEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(obj.inventory_id) ||
    !isNonEmptyString(obj.scene_id) ||
    typeof obj.is_selected !== "boolean" ||
    !isEnum(obj.selection_source, SELECTION_SOURCE_SET) ||
    (obj.selected_at !== null && typeof obj.selected_at !== "string") ||
    typeof obj.warning_acknowledged !== "boolean" ||
    typeof obj.estimated_input_tokens !== "number" ||
    typeof obj.estimated_output_tokens !== "number" ||
    typeof obj.estimated_cost_usd !== "number" ||
    typeof obj.estimated_runtime_seconds !== "number"
  ) {
    return null;
  }
  return Object.freeze({
    inventory_id: obj.inventory_id,
    scene_id: obj.scene_id,
    is_selected: obj.is_selected,
    selection_source: obj.selection_source as MilitaryExpertSelectionSource,
    selected_at: (obj.selected_at as string | null) ?? null,
    warning_acknowledged: obj.warning_acknowledged,
    estimated_input_tokens: obj.estimated_input_tokens,
    estimated_output_tokens: obj.estimated_output_tokens,
    estimated_cost_usd: obj.estimated_cost_usd,
    estimated_runtime_seconds: obj.estimated_runtime_seconds,
  });
}

export function parseMilitaryExpertSelectionSnapshot(
  raw: unknown,
): MilitaryExpertSelectionSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(obj.selection_snapshot_id) ||
    !isNonEmptyString(obj.inventory_id) ||
    !isNonEmptyString(obj.manuscript_id) ||
    !isNonEmptyString(obj.manuscript_version_id) ||
    (obj.mode !== "author" && obj.mode !== "certification") ||
    (obj.confirmed_at !== null && typeof obj.confirmed_at !== "string") ||
    (obj.confirmed_by !== "author" && obj.confirmed_by !== "system_certification") ||
    typeof obj.immutable !== "boolean" ||
    !Array.isArray(obj.selections) ||
    !Array.isArray(obj.active_warnings) ||
    !obj.active_warnings.every((code) => isEnum(code, WARNING_CODE_SET)) ||
    !obj.totals ||
    typeof obj.totals !== "object"
  ) {
    return null;
  }
  const selections = obj.selections
    .map(parseMilitaryExpertSceneSelectionEntry)
    .filter((entry): entry is MilitaryExpertSceneSelectionEntry => entry !== null);
  if (selections.length !== obj.selections.length) return null;
  const totals = obj.totals as Record<string, unknown>;
  if (
    typeof totals.selected_scene_count !== "number" ||
    typeof totals.estimated_input_tokens !== "number" ||
    typeof totals.estimated_output_tokens !== "number" ||
    typeof totals.estimated_cost_usd !== "number" ||
    typeof totals.estimated_runtime_seconds_min !== "number" ||
    typeof totals.estimated_runtime_seconds_max !== "number"
  ) {
    return null;
  }

  return Object.freeze({
    selection_snapshot_id: obj.selection_snapshot_id,
    inventory_id: obj.inventory_id,
    manuscript_id: obj.manuscript_id,
    manuscript_version_id: obj.manuscript_version_id,
    mode: obj.mode,
    confirmed_at: (obj.confirmed_at as string | null) ?? null,
    confirmed_by: obj.confirmed_by,
    immutable: obj.immutable,
    selections: Object.freeze(selections),
    active_warnings: Object.freeze([
      ...(obj.active_warnings as MilitaryExpertSelectionWarningCode[]),
    ]),
    totals: Object.freeze({
      selected_scene_count: totals.selected_scene_count,
      estimated_input_tokens: totals.estimated_input_tokens,
      estimated_output_tokens: totals.estimated_output_tokens,
      estimated_cost_usd: totals.estimated_cost_usd,
      estimated_runtime_seconds_min: totals.estimated_runtime_seconds_min,
      estimated_runtime_seconds_max: totals.estimated_runtime_seconds_max,
    }),
  });
}

export function parseMilitaryExpertV2ReviewHandoffPayload(
  raw: unknown,
): MilitaryExpertV2ReviewHandoffPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const inventory = parseMilitaryExpertSceneInventoryDocument(obj.inventory_document);
  const snapshot = parseMilitaryExpertSelectionSnapshot(obj.selection_snapshot);
  if (
    obj.handoff_version !== MILITARY_EXPERT_V2_HANDOFF_VERSION ||
    !inventory ||
    !snapshot ||
    !isNonEmptyString(obj.inventory_id) ||
    !isNonEmptyString(obj.selection_snapshot_id) ||
    !isNonEmptyString(obj.manuscript_id) ||
    !isNonEmptyString(obj.manuscript_version_id) ||
    !Array.isArray(obj.selected_scene_ids) ||
    !obj.selected_scene_ids.every((id) => typeof id === "string") ||
    typeof obj.expected_scene_count !== "number" ||
    obj.selected_scene_coverage_target !== 1.0 ||
    (obj.mode !== "author" && obj.mode !== "certification") ||
    typeof obj.estimated_budget_usd !== "number" ||
    obj.workflow_definition_version !== "military_expert_review@v2-scene"
  ) {
    return null;
  }

  return Object.freeze({
    handoff_version: MILITARY_EXPERT_V2_HANDOFF_VERSION,
    inventory_id: obj.inventory_id,
    selection_snapshot_id: obj.selection_snapshot_id,
    manuscript_id: obj.manuscript_id,
    manuscript_version_id: obj.manuscript_version_id,
    selected_scene_ids: Object.freeze([...(obj.selected_scene_ids as string[])]),
    selection_snapshot: snapshot,
    expected_scene_count: obj.expected_scene_count,
    selected_scene_coverage_target: 1.0,
    mode: obj.mode,
    estimated_budget_usd: obj.estimated_budget_usd,
    workflow_definition_version: "military_expert_review@v2-scene",
    inventory_document: inventory,
  });
}
