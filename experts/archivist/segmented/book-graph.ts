import { createHash } from "node:crypto";
import type { CanonEntityType, CanonFactType } from "@/lib/canon/types.ts";
import { ARCHIVIST_CERTIFICATION_ENTITY_CATALOG } from "../entity-catalog.ts";
import {
  resolveArchivistEntityIdentity,
  type ArchivistEntityResolutionContext,
} from "../entity-resolution.ts";
import { ARCHIVIST_BOOK_GRAPH_SCHEMA } from "./constants.ts";
import { allObservationFacts, observationAmbiguities, observationEvidence } from "./observation-contract.ts";
import type {
  ArchivistBookGraph,
  ArchivistSegmentObservation,
  BookGraphEntity,
  BookGraphFact,
  SegmentCheckpoint,
} from "./types.ts";

function stableValue(value: Record<string, unknown>): string {
  return JSON.stringify(value, Object.keys(value).sort());
}

function entityKey(alias: string, entityType: CanonEntityType, entityId?: string): string {
  return entityId ?? `${entityType}:${alias.trim().toLowerCase()}`;
}

function factIdentity(fact: BookGraphFact): string {
  return [
    fact.entity_key,
    fact.fact_type,
    stableValue(fact.value),
    fact.locators.map((item) => item.locator).join("|"),
  ].join("::");
}

export function mergeSegmentObservations(args: {
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  checkpoints: readonly SegmentCheckpoint[];
  entityContext?: ArchivistEntityResolutionContext;
}): ArchivistBookGraph {
  const context: ArchivistEntityResolutionContext = {
    catalog: args.entityContext?.catalog ?? ARCHIVIST_CERTIFICATION_ENTITY_CATALOG,
    canonStore: args.entityContext?.canonStore,
    canonScope: args.entityContext?.canonScope,
  };
  const entities = new Map<string, BookGraphEntity>();
  const facts = new Map<string, BookGraphFact>();
  const ambiguities = new Map<string, (typeof args.checkpoints)[number] extends never ? never : import("../contracts.ts").ArchivistEntityAmbiguity>();
  const evidence: import("../contracts.ts").ArchivistEvidenceRecord[] = [];

  const validated = args.checkpoints.filter(
    (item) => item.status === "validated" && item.observation,
  );

  for (const checkpoint of validated) {
    const observation = checkpoint.observation as ArchivistSegmentObservation;
    for (const entity of observation.entities) {
      const resolved = resolveArchivistEntityIdentity(entity.alias, entity.entity_type, context);
      const key = entityKey(resolved.alias, resolved.entity_type, resolved.entity_id);
      const existing = entities.get(key);
      if (!existing) {
        entities.set(key, {
          alias: resolved.alias,
          entity_type: resolved.entity_type,
          entity_id: resolved.entity_id,
          canonical_name: resolved.canonical_name,
          resolution: resolved.status,
          candidates: resolved.candidates,
          aliases: [resolved.alias, ...entity.local_mentions],
          source_segment_ids: [observation.segment_id],
        });
      } else {
        if (!existing.source_segment_ids.includes(observation.segment_id)) {
          existing.source_segment_ids.push(observation.segment_id);
        }
        for (const alias of [resolved.alias, ...entity.local_mentions]) {
          if (!existing.aliases.includes(alias)) existing.aliases.push(alias);
        }
        if (existing.resolution === "resolved" && resolved.status === "ambiguous") {
          existing.resolution = "ambiguous";
          existing.candidates = resolved.candidates;
          existing.entity_id = undefined;
        }
      }
    }

    for (const fact of allObservationFacts(observation)) {
      const resolved = resolveArchivistEntityIdentity(fact.alias, fact.entity_type, context);
      const graphFact: BookGraphFact = {
        id: fact.id,
        entity_key: entityKey(resolved.alias, resolved.entity_type, resolved.entity_id),
        alias: resolved.alias,
        entity_type: resolved.entity_type,
        entity_id: resolved.entity_id,
        fact_type: fact.fact_type,
        value: fact.value,
        temporal_scope: fact.temporal_scope,
        evidence: [
          {
            excerpt: fact.excerpt,
            locator: fact.locator.locator,
            evidence_role: "current_observation",
            verification_status: "located",
            source_kind: "manuscript",
            manuscript_id: args.manuscript_id,
            manuscript_version_id: args.manuscript_version_id,
            content_hash: args.content_hash,
          },
        ],
        locators: [fact.locator],
        source_segment_ids: [observation.segment_id],
        confidence: fact.confidence,
      };
      const key = createHash("sha256").update(factIdentity(graphFact), "utf8").digest("hex");
      const existing = facts.get(key);
      if (!existing) {
        facts.set(key, graphFact);
      } else if (!existing.source_segment_ids.includes(observation.segment_id)) {
        existing.source_segment_ids.push(observation.segment_id);
        for (const locator of graphFact.locators) {
          if (!existing.locators.some((item) => item.locator === locator.locator)) {
            existing.locators.push(locator);
          }
        }
      }
    }

    for (const ambiguity of observationAmbiguities(observation)) {
      ambiguities.set(ambiguity.id || ambiguity.alias, ambiguity);
    }
    evidence.push(...observationEvidence(observation));
  }

  const allFacts = [...facts.values()];
  const byType = (type: CanonFactType | CanonFactType[]) => {
    const types = Array.isArray(type) ? type : [type];
    return allFacts.filter((fact) => types.includes(fact.fact_type));
  };

  return {
    schema: ARCHIVIST_BOOK_GRAPH_SCHEMA,
    manuscript_id: args.manuscript_id,
    manuscript_version_id: args.manuscript_version_id,
    content_hash: args.content_hash,
    entities: [...entities.values()],
    unresolved_ambiguities: [...ambiguities.values()],
    candidate_facts: allFacts,
    temporal_fact_history: allFacts,
    events: byType("chronology"),
    relationships: byType("relationship"),
    injury_histories: byType("injury"),
    knowledge_histories: byType("knowledge_state"),
    location_travel_histories: byType(["location", "travel", "presence"]),
    possessions: byType("possession"),
    unique_objects: allFacts.filter((fact) => fact.value.unique === true || fact.entity_type === "object"),
    organizations: allFacts.filter((fact) => fact.entity_type === "organization"),
    evidence_references: evidence,
  };
}
