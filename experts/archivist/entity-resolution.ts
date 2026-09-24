/**
 * Deterministic StoryDNA entity resolution for Archivist output.
 *
 * The model may name an entity. It must not invent database IDs or fake
 * candidate identities. StoryDNA resolves against a fixture catalog and/or
 * the canon entity layer, then attaches real IDs or real ambiguity.
 */

import {
  normalizeAlias,
  resolveEntityByAlias,
  type CanonEntityScope,
} from "@/lib/canon/aliases.ts";
import type { CanonEntity, CanonEntityType, CanonStore } from "@/lib/canon/types.ts";
import type {
  ArchivistCanonDelta,
  ArchivistEntityAmbiguity,
  ArchivistEntityRef,
  ArchivistEntityResolution,
  ArchivistReview,
} from "./contracts.ts";
import {
  catalogMatchesForAlias,
  type ArchivistResolvableEntity,
} from "./entity-catalog.ts";

export interface ArchivistEntityResolutionContext {
  catalog?: readonly ArchivistResolvableEntity[];
  canonStore?: CanonStore;
  canonScope?: CanonEntityScope;
}

export interface ArchivistResolvedIdentity {
  status: ArchivistEntityResolution;
  alias: string;
  entity_type: CanonEntityType;
  entity_id?: string;
  canonical_name?: string;
  candidates: Array<{ entity_id: string; canonical_name: string; entity_type: CanonEntityType }>;
}

function entityFromCatalog(row: ArchivistResolvableEntity): {
  entity_id: string;
  canonical_name: string;
  entity_type: CanonEntityType;
} {
  return {
    entity_id: row.entity_id,
    canonical_name: row.canonical_name,
    entity_type: row.entity_type,
  };
}

function entityFromCanon(entity: CanonEntity): {
  entity_id: string;
  canonical_name: string;
  entity_type: CanonEntityType;
} {
  return {
    entity_id: entity.id,
    canonical_name: entity.canonical_name,
    entity_type: entity.entity_type,
  };
}

export function resolveArchivistEntityIdentity(
  alias: string,
  entityType: CanonEntityType,
  context: ArchivistEntityResolutionContext | undefined,
): ArchivistResolvedIdentity {
  const trimmed = alias.trim();
  if (!trimmed) {
    return { status: "unresolved", alias: trimmed, entity_type: entityType, candidates: [] };
  }

  const seen = new Set<string>();
  const matches: Array<{ entity_id: string; canonical_name: string; entity_type: CanonEntityType }> =
    [];

  for (const row of catalogMatchesForAlias(context?.catalog ?? [], trimmed)) {
    if (seen.has(row.entity_id)) continue;
    seen.add(row.entity_id);
    matches.push(entityFromCatalog(row));
  }

  if (context?.canonStore && context.canonScope) {
    const storeResult = resolveEntityByAlias(context.canonStore, context.canonScope, trimmed);
    if (storeResult.status === "resolved") {
      if (!seen.has(storeResult.entity_id)) {
        seen.add(storeResult.entity_id);
        matches.push(entityFromCanon(storeResult.entity));
      }
    } else if (storeResult.status === "ambiguous") {
      for (const entity of storeResult.candidates) {
        if (seen.has(entity.id)) continue;
        seen.add(entity.id);
        matches.push(entityFromCanon(entity));
      }
    }
  }

  if (matches.length === 1) {
    const match = matches[0]!;
    return {
      status: "resolved",
      alias: trimmed,
      entity_type: match.entity_type || entityType,
      entity_id: match.entity_id,
      canonical_name: match.canonical_name,
      candidates: [],
    };
  }

  if (matches.length >= 2) {
    return {
      status: "ambiguous",
      alias: trimmed,
      entity_type: entityType,
      candidates: matches,
    };
  }

  return {
    status: "not_found",
    alias: trimmed,
    entity_type: entityType,
    candidates: [],
  };
}

export function applyResolvedIdentityToEntityRef(
  entity: ArchivistEntityRef,
  context: ArchivistEntityResolutionContext | undefined,
): ArchivistEntityRef {
  const resolved = resolveArchivistEntityIdentity(entity.alias, entity.entity_type, context);
  if (resolved.status === "resolved") {
    return {
      resolution: "resolved",
      alias: resolved.alias,
      entity_type: resolved.entity_type,
      entity_id: resolved.entity_id,
      canonical_name: resolved.canonical_name,
      candidates: undefined,
    };
  }
  if (resolved.status === "ambiguous") {
    return {
      resolution: "ambiguous",
      alias: resolved.alias,
      entity_type: resolved.entity_type,
      entity_id: undefined,
      canonical_name: undefined,
      candidates: resolved.candidates.map((candidate) => ({
        entity_id: candidate.entity_id,
        canonical_name: candidate.canonical_name,
      })),
    };
  }
  return {
    resolution: resolved.status,
    alias: resolved.alias || entity.alias,
    entity_type: resolved.entity_type,
    entity_id: undefined,
    canonical_name: undefined,
    candidates: undefined,
  };
}

function ambiguityFromResolution(
  existing: ArchivistEntityAmbiguity | undefined,
  alias: string,
  resolved: ArchivistResolvedIdentity,
  index: number,
): ArchivistEntityAmbiguity | null {
  if (resolved.status !== "ambiguous" || resolved.candidates.length < 2) return null;
  return {
    id: existing?.id?.trim() || `entity-ambiguity-${index + 1}`,
    alias,
    candidate_entities: resolved.candidates.map((candidate) => ({
      entity_id: candidate.entity_id,
      canonical_name: candidate.canonical_name,
      entity_type: candidate.entity_type,
      evidence: existing?.candidate_entities.find((item) => item.entity_id === candidate.entity_id)
        ?.evidence ?? [],
    })),
    context: existing?.context?.trim() || `Alias "${alias}" matches multiple StoryDNA entities.`,
    confidence: existing?.confidence ?? "medium",
    recommended_author_verification:
      existing?.recommended_author_verification?.trim() ||
      `Ask the author which ${alias} is intended.`,
  };
}

export function applyArchivistEntityResolution(
  review: ArchivistReview,
  context: ArchivistEntityResolutionContext | undefined,
): ArchivistReview {
  const canon_delta: ArchivistCanonDelta[] = review.canon_delta.map((delta) => ({
    ...delta,
    entity: applyResolvedIdentityToEntityRef(delta.entity, context),
    status: delta.status,
  }));

  const aliases = new Map<string, { alias: string; type: CanonEntityType }>();
  for (const delta of review.canon_delta) {
    if (typeof delta.entity.alias !== "string" || !delta.entity.alias.trim()) continue;
    const key = normalizeAlias(delta.entity.alias);
    if (key) aliases.set(key, { alias: delta.entity.alias, type: delta.entity.entity_type });
  }
  for (const item of review.entity_ambiguities) {
    if (typeof item.alias !== "string" || !item.alias.trim()) continue;
    const key = normalizeAlias(item.alias);
    if (key) {
      aliases.set(key, {
        alias: item.alias,
        type: item.candidate_entities?.[0]?.entity_type ?? "person",
      });
    }
  }

  const entity_ambiguities: ArchivistEntityAmbiguity[] = [];
  let index = 0;
  for (const { alias, type } of aliases.values()) {
    const resolved = resolveArchivistEntityIdentity(alias, type, context);
    const existing = review.entity_ambiguities.find(
      (item) => normalizeAlias(item.alias) === normalizeAlias(alias),
    );
    const next = ambiguityFromResolution(existing, alias, resolved, index);
    if (next) {
      entity_ambiguities.push(next);
      index += 1;
    }
  }

  return {
    ...review,
    canon_delta,
    entity_ambiguities,
  };
}
