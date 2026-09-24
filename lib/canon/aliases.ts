import {
  CanonDomainError,
  type CanonEntity,
  type CanonEntityAlias,
  type CanonEntityScope,
  type CanonStore,
  type EntityResolutionResult,
} from "./types.ts";

export type { CanonEntityScope } from "./types.ts";

export function normalizeAlias(alias: string | null | undefined): string {
  return (alias ?? "").trim().toLowerCase();
}

function entityInScope(entity: CanonEntity, scope: CanonEntityScope): boolean {
  if (scope.series_id) return entity.series_id === scope.series_id;
  return entity.standalone_manuscript_id === scope.standalone_manuscript_id;
}

export function resolveEntityByAlias(
  store: CanonStore,
  scope: CanonEntityScope,
  alias: string,
): EntityResolutionResult {
  const normalized = normalizeAlias(alias);
  if (!normalized) return { status: "not_found" };

  const candidates: CanonEntity[] = [];
  const seen = new Set<string>();
  for (const row of store.aliases) {
    if (row.alias_normalized !== normalized) continue;
    const entity = store.entities.find((item) => item.id === row.entity_id);
    if (!entity || !entityInScope(entity, scope) || seen.has(entity.id)) continue;
    seen.add(entity.id);
    candidates.push(entity);
  }

  if (candidates.length === 0) return { status: "not_found" };
  if (candidates.length === 1) {
    const entity = candidates[0]!;
    return { status: "resolved", entity_id: entity.id, entity };
  }
  return { status: "ambiguous", candidates };
}

/** Unique match only. Ambiguous aliases never silently pick a winner. */
export function findEntityByAlias(
  store: CanonStore,
  scope: CanonEntityScope,
  alias: string,
): CanonEntity | null {
  const result = resolveEntityByAlias(store, scope, alias);
  if (result.status === "resolved") return result.entity;
  if (result.status === "not_found") return null;
  throw new CanonDomainError("AMBIGUOUS_ENTITY_ALIAS");
}

export function addEntityAlias(
  store: CanonStore,
  entityId: string,
  alias: string,
  now: string,
): CanonEntityAlias {
  const entity = store.entities.find((row) => row.id === entityId);
  if (!entity) throw new CanonDomainError("CANON_ENTITY_NOT_FOUND");
  const normalized = normalizeAlias(alias);
  if (!normalized) throw new CanonDomainError("EMPTY_ALIAS");

  if (store.aliases.some((row) => row.entity_id === entityId && row.alias_normalized === normalized)) {
    throw new CanonDomainError("ALIAS_ALREADY_PRESENT");
  }

  const row: CanonEntityAlias = {
    id: crypto.randomUUID(),
    entity_id: entityId,
    alias: alias.trim(),
    alias_normalized: normalized,
    created_at: now,
  };
  store.aliases.push(row);
  return row;
}

export function registerEntity(
  store: CanonStore,
  input: {
    series_id: string | null;
    standalone_manuscript_id: string | null;
    entity_type: CanonEntity["entity_type"];
    canonical_name: string;
    aliases?: string[];
  },
  now: string,
): CanonEntity {
  if ((input.series_id == null) === (input.standalone_manuscript_id == null)) {
    throw new CanonDomainError("ENTITY_SCOPE_XOR");
  }

  const entity: CanonEntity = {
    id: crypto.randomUUID(),
    series_id: input.series_id,
    standalone_manuscript_id: input.standalone_manuscript_id,
    entity_type: input.entity_type,
    canonical_name: input.canonical_name.trim(),
    created_at: now,
    updated_at: now,
  };
  store.entities.push(entity);
  addEntityAlias(store, entity.id, entity.canonical_name, now);
  for (const alias of input.aliases ?? []) {
    if (normalizeAlias(alias) === normalizeAlias(entity.canonical_name)) continue;
    addEntityAlias(store, entity.id, alias, now);
  }
  return entity;
}
