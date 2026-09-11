import type { CanonStore } from "./types.ts";

export function createCanonStore(): CanonStore {
  return {
    entities: [],
    aliases: [],
    facts: [],
    evidence: [],
    conflicts: [],
    conflict_events: [],
    transitions: [],
    bible_revisions: [],
  };
}
