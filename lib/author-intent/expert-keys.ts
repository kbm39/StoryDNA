/**
 * Known expert keys for Author Intent validation.
 * Includes built, experimental, and planned experts for honest rejection.
 */

export const KNOWN_EXPERT_KEYS = [
  "literary_agent",
  "developmental_editor",
  "line_editor",
  "military_expert",
  "psychologist",
  "librarian",
  "show_vs_tell_editor",
  "character_expert",
  "dialogue_expert",
  "continuity_expert",
  "timeline_expert",
  "archivist",
  "police_expert",
  "combat_medicine_expert",
  "medical_expert",
  "financial_crimes_expert",
  "editor_in_chief",
] as const;

export type KnownExpertKey = (typeof KNOWN_EXPERT_KEYS)[number];

const KNOWN_SET = new Set<string>(KNOWN_EXPERT_KEYS);

export function isKnownExpertKey(key: string): key is KnownExpertKey {
  return KNOWN_SET.has(key);
}

export function rejectUnknownExpertKeys(keys: readonly string[]): string[] {
  return keys.filter((k) => !isKnownExpertKey(k));
}
