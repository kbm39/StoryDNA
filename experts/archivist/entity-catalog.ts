/**
 * Fixture-owned entity identities for Archivist certification and tests.
 *
 * StoryDNA resolves model-emitted names/aliases against this catalog or a
 * real canon store. The model must not invent these IDs.
 */

import type { CanonEntityType } from "@/lib/canon/types.ts";

export const ARCHIVIST_FIXTURE_ENTITY_IDS = {
  mara: "fixture-entity-mara",
  elenaWard: "fixture-entity-elena-ward",
  johnReeves: "fixture-entity-john-reeves",
  johnHale: "fixture-entity-john-hale",
} as const;

export interface ArchivistResolvableEntity {
  entity_id: string;
  canonical_name: string;
  aliases: readonly string[];
  entity_type: CanonEntityType;
}

export const ARCHIVIST_CERTIFICATION_ENTITY_CATALOG: readonly ArchivistResolvableEntity[] = [
  {
    entity_id: ARCHIVIST_FIXTURE_ENTITY_IDS.mara,
    canonical_name: "Mara",
    aliases: ["Mara", "Mara Quinn"],
    entity_type: "person",
  },
  {
    entity_id: ARCHIVIST_FIXTURE_ENTITY_IDS.elenaWard,
    canonical_name: "Elena Ward",
    aliases: ["Elena Ward", "Elena"],
    entity_type: "person",
  },
  {
    entity_id: ARCHIVIST_FIXTURE_ENTITY_IDS.johnReeves,
    canonical_name: "John Reeves",
    aliases: ["John Reeves", "John"],
    entity_type: "person",
  },
  {
    entity_id: ARCHIVIST_FIXTURE_ENTITY_IDS.johnHale,
    canonical_name: "John Hale",
    aliases: ["John Hale", "John"],
    entity_type: "person",
  },
];

export function normalizeArchivistEntityAlias(alias: string): string {
  return alias.trim().toLowerCase();
}

export function catalogMatchesForAlias(
  catalog: readonly ArchivistResolvableEntity[],
  alias: string,
): ArchivistResolvableEntity[] {
  const normalized = normalizeArchivistEntityAlias(alias);
  if (!normalized) return [];
  return catalog.filter((entity) => {
    if (normalizeArchivistEntityAlias(entity.canonical_name) === normalized) return true;
    return entity.aliases.some((item) => normalizeArchivistEntityAlias(item) === normalized);
  });
}
