/**
 * Authoritative expert relationship contract (P2-05).
 *
 * Relationship data lives exclusively in editor_in_chief_rules.
 * Top-level snake_case relationship fields are not part of the runtime schema.
 */

import type { EditorInChiefRules, ExpertRuntimeDefinition } from "./types.ts";

export const EXPERT_RELATIONSHIP_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export function getCompatibleExperts(def: ExpertRuntimeDefinition): readonly string[] {
  return def.editor_in_chief_rules.compatibleExperts;
}

export function getEscalationExperts(def: ExpertRuntimeDefinition): readonly string[] {
  return def.editor_in_chief_rules.escalationExperts;
}

export function getPrerequisiteExperts(def: ExpertRuntimeDefinition): readonly string[] {
  return def.editor_in_chief_rules.prerequisiteExperts;
}

function validateRelationshipKeyList(
  label: string,
  keys: string[],
  selfKey: string,
  errors: string[],
): void {
  const seen = new Set<string>();
  let prev = "";

  for (const key of keys) {
    if (!key.trim()) {
      errors.push(`${label}: expert key must be non-empty`);
      continue;
    }
    if (!EXPERT_RELATIONSHIP_KEY_PATTERN.test(key)) {
      errors.push(`${label}: malformed expert key "${key}"`);
      continue;
    }
    if (key === selfKey) {
      errors.push(`${label}: expert cannot reference itself (${selfKey})`);
    }
    if (seen.has(key)) {
      errors.push(`${label}: duplicate expert key "${key}"`);
    }
    seen.add(key);
    if (prev && key.localeCompare(prev) < 0) {
      errors.push(`${label}: keys must be in deterministic lexicographic order`);
    }
    prev = key;
  }
}

export function validateEditorInChiefRelationshipRules(
  expertKey: string,
  rules: EditorInChiefRules,
): string[] {
  const errors: string[] = [];
  validateRelationshipKeyList(
    "editor_in_chief_rules.compatibleExperts",
    rules.compatibleExperts,
    expertKey,
    errors,
  );
  validateRelationshipKeyList(
    "editor_in_chief_rules.escalationExperts",
    rules.escalationExperts,
    expertKey,
    errors,
  );
  validateRelationshipKeyList(
    "editor_in_chief_rules.prerequisiteExperts",
    rules.prerequisiteExperts,
    expertKey,
    errors,
  );
  return errors;
}
