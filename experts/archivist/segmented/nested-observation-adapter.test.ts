import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allObservationFacts, validateSegmentObservation } from "./observation-contract.ts";
import {
  chooseObservationPreferringRecoveredPrimary,
  recoverAndNormalizeSegmentObservation,
  recoverCompleteNestedEntities,
  recoverCompleteTopLevelArrays,
} from "./nested-observation-adapter.ts";
import { flattenNestedEntityFacts, normalizeSegmentObservation } from "./observation-normalization.ts";
import { canReuseValidatedCheckpoint, checkpointPinsFor, markCheckpointValidated } from "./checkpoint.ts";
import { buildSyntheticThirtyUnitManuscript, mockObservationForSegment } from "./fixtures.ts";
import { planSegments } from "./segment-planner.ts";
import { rehydrateEvidenceRecord } from "./evidence-rehydration.ts";

const SEGMENT_ID = "seg-02-chapter-03-chapter-04";

function nestedPrimary(args?: { truncate?: boolean; extraEntity?: boolean }) {
  const payload = {
    schema: "archivist_segment_observation@v1",
    segment_id: SEGMENT_ID,
    entities: [
      {
        entity_id: "ent-cole",
        entity_type: "person",
        alias: "Cole",
        name_surface: "Cole",
        facts: [
          {
            fact_id: "f-cole-appearance",
            fact_type: "appearance",
            confidence: "high",
            inferred: false,
            excerpt: "HOLD FAST, inked up the inside of his left wrist",
            locator: { chapter: "THREE", context: "footage" },
            temporal_scope: { kind: "at" },
            notes: "editorial",
          },
          {
            fact_id: "f-cole-knowledge",
            fact_type: "knowledge",
            confidence: "high",
            inferred: false,
            excerpt: "Quds Force was running training pipelines",
            locator: { chapter: "TWO", context: "tactics" },
            temporal_scope: { kind: "at" },
          },
        ],
      },
      {
        entity_id: "ent-wife",
        entity_type: "person",
        name_surface: "Karimi's wife",
        facts: [
          {
            fact_id: "f-wife-dead",
            fact_type: "alive_status",
            excerpt: "two rounds in the back of her head",
            locator: { chapter: "TWO", context: "bedroom" },
            confidence: "high",
            inferred: false,
          },
        ],
      },
    ],
  };
  const json = JSON.stringify(payload, null, 2);
  return args?.truncate ? `\`\`\`json\n${json.slice(0, 180)}\n` : `\`\`\`json\n${json}\n\`\`\``;
}

describe("nested Archivist fact adapter", () => {
  it("flattens entities[].facts, strips entity_id, and maps knowledge", () => {
    const recovered = recoverAndNormalizeSegmentObservation(nestedPrimary(), SEGMENT_ID);
    assert.equal(recovered.ok, true);
    assert.ok(recovered.observation);
    assert.equal(recovered.nested_facts_discovered, 3);
    assert.ok(recovered.observation.entities.every((entity) => !("entity_id" in entity)));
    assert.equal(recovered.observation.entities.some((entity) => entity.alias === "Karimi's wife"), true);
    const facts = allObservationFacts(recovered.observation);
    assert.equal(facts.some((fact) => fact.fact_type === "knowledge_state"), true);
    assert.equal(facts.some((fact) => fact.fact_type === "appearance"), true);
    assert.equal(facts.every((fact) => Boolean(fact.locator?.locator)), true);
    assert.equal(validateSegmentObservation(recovered.observation, SEGMENT_ID).ok, true);
  });

  it("drops nested facts missing locator, excerpt, unsupported type, or accepted status", () => {
    const raw = {
      schema: "archivist_segment_observation@v1",
      segment_id: SEGMENT_ID,
      entities: [
        {
          alias: "Cole",
          entity_type: "person",
          facts: [
            { fact_id: "a", fact_type: "appearance", excerpt: "has a tattoo" },
            { fact_id: "b", fact_type: "appearance", locator: { chapter: "THREE" } },
            { fact_id: "c", fact_type: "magic", excerpt: "spell", locator: { chapter: "THREE" } },
            { fact_id: "d", fact_type: "appearance", excerpt: "mark", locator: { chapter: "THREE" }, status: "accepted" },
            { fact_id: "e", fact_type: "injury", excerpt: "left wrist", locator: { chapter: "THREE" } },
          ],
        },
      ],
    };
    const flattened = flattenNestedEntityFacts(raw, SEGMENT_ID);
    assert.equal(flattened.nested_facts_discovered, 5);
    const normalized = normalizeSegmentObservation(flattened.observation, SEGMENT_ID);
    const parsed = validateSegmentObservation(normalized.observation, SEGMENT_ID);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(allObservationFacts(parsed.observation).length, 1);
    assert.ok(flattened.quarantined.some((item) => item.reason === "missing_locator"));
    assert.ok(flattened.quarantined.some((item) => item.reason === "unsupported_fact_type"));
    assert.ok(flattened.quarantined.some((item) => item.reason === "unusable_optional"));
  });

  it("recovers complete objects from a truncated prefix and fail-closes when none are complete", () => {
    const first = {
      entity_type: "person",
      alias: "Cole",
      facts: [
        {
          fact_id: "f1",
          fact_type: "appearance",
          excerpt: "HOLD FAST, inked up the inside of his left wrist",
          locator: { chapter: "THREE" },
        },
      ],
    };
    const truncated = `\`\`\`json\n{"schema":"archivist_segment_observation@v1","segment_id":"${SEGMENT_ID}","entities":[${JSON.stringify(first)},{"fact_`;
    const recovered = recoverCompleteNestedEntities(truncated);
    assert.equal(recovered.recoverable, true);
    assert.equal(recovered.truncated, true);
    assert.equal(recovered.incomplete_tail, true);
    assert.equal(recovered.complete_entity_count, 1);
    const adapted = recoverAndNormalizeSegmentObservation(truncated, SEGMENT_ID);
    assert.equal(adapted.ok, true);
    assert.equal(adapted.flattened_facts, 1);
    const dead = recoverAndNormalizeSegmentObservation("```json\n{\"entities\":[{\"fact_", SEGMENT_ID);
    assert.equal(dead.recoverable, false);
    assert.equal(dead.ok, false);
  });

  it("keeps recovered primary facts when an empty repair is schema-valid", () => {
    const emptyRepair = JSON.stringify({
      schema: "archivist_segment_observation@v1",
      segment_id: SEGMENT_ID,
      entities: [{ alias: "Cole", entity_type: "person", local_mentions: ["Cole"] }],
      aliases: [],
    });
    const chosen = chooseObservationPreferringRecoveredPrimary({
      primaryRaw: nestedPrimary(),
      repairRaw: emptyRepair,
      segmentId: SEGMENT_ID,
    });
    assert.equal(chosen.repair_necessary, false);
    assert.equal(chosen.source, "primary");
    assert.ok((chosen.primary.flattened_facts ?? 0) >= 2);
    assert.ok(chosen.observation && allObservationFacts(chosen.observation).length >= 2);
  });

  it("rehydrates flattened excerpts without fabricating locators", () => {
    const recovered = recoverAndNormalizeSegmentObservation(nestedPrimary(), SEGMENT_ID);
    assert.ok(recovered.observation);
    const manuscript = "HOLD FAST, inked up the inside of his left wrist and later Quds Force was running training pipelines.";
    let located = 0;
    let fabricated = 0;
    for (const fact of allObservationFacts(recovered.observation)) {
      const record = rehydrateEvidenceRecord({
        record: {
          excerpt: fact.excerpt,
          locator: fact.locator.locator,
          evidence_role: "current_observation",
          verification_status: "unverified",
          source_kind: "manuscript",
        },
        manuscriptText: manuscript,
        manuscript_id: "ms",
        manuscript_version_id: "mv",
        content_hash: "h",
      });
      if (record.verification_status === "located") located += 1;
      if (fact.excerpt && !manuscript.includes(fact.excerpt) && record.verification_status === "located") {
        fabricated += 1;
      }
    }
    assert.ok(located >= 1);
    assert.equal(fabricated, 0);
  });

  it("keeps existing checkpoint pins compatible", () => {
    const { snapshot } = buildSyntheticThirtyUnitManuscript();
    const plan = planSegments(snapshot.extracted_text, snapshot);
    const segment = plan.segments[0]!;
    const observation = mockObservationForSegment({
      segmentId: segment.segment_id,
      primaryHeadings: segment.assignments.filter((item) => item.role === "primary").map((item) => item.heading),
    });
    const validated = markCheckpointValidated(
      { ...checkpointPinsFor({ plan, segment }), status: "pending", repair_used: false },
      observation,
    );
    assert.equal(canReuseValidatedCheckpoint(validated, checkpointPinsFor({ plan, segment })), true);
    assert.equal(validated.segment_contract_version, "archivist_segment_observation@v1");
  });
});

function compactPrefix(args?: { truncateInjury?: boolean; extraIncompleteFact?: boolean; unknown?: boolean }) {
  const fact = (id: string, alias: string, fact_type: string, excerpt: string) => ({
    id,
    alias,
    entity_type: "person",
    fact_type,
    excerpt,
    locator: { locator: "CHAPTER THREE", chapter: "CHAPTER THREE" },
    confidence: "high",
    inferred: false,
  });
  const entities = [
    { alias: "Cole", entity_type: "person" },
    { alias: "Ari", entity_type: "person" },
  ];
  const candidate_facts = [
    fact("f1", "Cole", "appearance", "HOLD FAST, inked up the inside of his left wrist"),
    fact("f2", "Ari", "knowledge_state", "An account in my name"),
  ];
  const events = [
    {
      id: "e1",
      name: "Safe-house attack",
      excerpt: "two entry wounds in his chest",
      locator: { locator: "CHAPTER TWO", chapter: "CHAPTER TWO" },
      confidence: "high",
    },
  ];
  const relationships = [
    {
      id: "r1",
      entity1: "Cole",
      entity2: "Ari",
      type: "brotherhood",
      excerpt: "Sixteen years of friendship",
      locator: { locator: "CHAPTER THREE", chapter: "CHAPTER THREE" },
    },
  ];
  const injuries = [
    {
      id: "inj1",
      entity: "Gilad",
      type: "blade wound",
      excerpt: "Single slash, left to right",
      locator: { locator: "CHAPTER TWO", chapter: "CHAPTER TWO" },
    },
  ];
  if (args?.extraIncompleteFact) {
    const closed = JSON.stringify({
      schema: "archivist_segment_observation@v1",
      segment_id: SEGMENT_ID,
      entities,
      aliases: [],
      candidate_facts,
    }).slice(0, -2);
    return `\`\`\`json\n${closed},\n    {"id":"f-cut","alias":"Dana","fact_type":"chronology","excerpt":"`;
  }
  const head = {
    schema: "archivist_segment_observation@v1",
    segment_id: SEGMENT_ID,
    entities,
    aliases: [],
    candidate_facts,
    entity_ambiguities: [],
    events,
    state_transitions: [],
    relationships,
  };
  const prefix = JSON.stringify(head, null, 2).slice(0, -1);
  if (args?.unknown) {
    return `\`\`\`json\n${prefix},\n  "mystery_bucket": [{"id":"x1","excerpt":"nope"}],\n  "not_a_contract": [{"id":"z"}],\n  "injuries": [${JSON.stringify(injuries[0])},{"id":"inj-cut","excerpt":"`;
  }
  if (args?.truncateInjury) {
    return `\`\`\`json\n${prefix},\n  "injuries": [${JSON.stringify(injuries[0])},\n    {"id":"inj-cut","entity":"Wife","excerpt":"two rounds","locator":{"`;
  }
  return `\`\`\`json\n${JSON.stringify({ ...head, injuries }, null, 2)}\n\`\`\``;
}

describe("top-level array truncation recovery", () => {
  it("keeps complete entities and candidate_facts from a truncated prefix", () => {
    const recovered = recoverCompleteTopLevelArrays(compactPrefix({ truncateInjury: true }));
    assert.equal(recovered.recoverable, true);
    assert.equal(recovered.truncated, true);
    assert.equal(recovered.recovered_array_counts.entities, 2);
    assert.equal(recovered.recovered_array_counts.candidate_facts, 2);
    assert.ok((recovered.recovered_array_counts.candidate_facts ?? 0) > 0);
    const adapted = recoverAndNormalizeSegmentObservation(compactPrefix({ truncateInjury: true }), SEGMENT_ID);
    assert.equal(adapted.ok, true);
    assert.equal(adapted.observation?.candidate_facts.length, 2);
    assert.equal(adapted.incomplete_tail_array, "injuries");
    assert.equal(adapted.incomplete_tail_object_dropped, true);
  });

  it("drops an incomplete final candidate fact and keeps earlier complete facts", () => {
    const raw = compactPrefix({ extraIncompleteFact: true });
    const recovered = recoverCompleteTopLevelArrays(raw);
    assert.ok((recovered.recovered_array_counts.candidate_facts ?? 0) >= 2);
    const last = (recovered.value?.candidate_facts as Array<{ id?: string }> | undefined) ?? [];
    assert.equal(last.some((fact) => fact.id === "f-cut"), false);
    const adapted = recoverAndNormalizeSegmentObservation(raw, SEGMENT_ID);
    assert.equal(adapted.ok, true);
    assert.ok((adapted.observation?.candidate_facts.length ?? 0) >= 2);
    assert.equal(adapted.observation?.candidate_facts.some((fact) => fact.id === "f-cut"), false);
  });

  it("recovers complete event, relationship, and injury objects and drops the incomplete tail", () => {
    const adapted = recoverAndNormalizeSegmentObservation(compactPrefix({ truncateInjury: true }), SEGMENT_ID);
    assert.equal(adapted.ok, true);
    assert.equal(adapted.observation?.events.length, 1);
    assert.equal(adapted.observation?.relationships.length, 1);
    assert.equal(adapted.observation?.injuries.length, 1);
    assert.equal(adapted.incomplete_tail_array, "injuries");
    assert.equal(adapted.incomplete_tail_object_dropped, true);
    assert.equal(adapted.observation?.injuries.some((fact) => fact.id === "inj-cut"), false);
  });

  it("does not treat entity-only recovery as success when prefix facts were recoverable", () => {
    const raw = compactPrefix({ truncateInjury: true });
    const recovered = recoverCompleteTopLevelArrays(raw);
    assert.ok((recovered.recovered_array_counts.candidate_facts ?? 0) > 0);
    const adapted = recoverAndNormalizeSegmentObservation(raw, SEGMENT_ID);
    assert.ok((adapted.observation?.candidate_facts.length ?? 0) > 0);
    assert.notEqual(adapted.errors.includes("entity_only_recovery_masked_prefix_facts"), true);
    assert.ok((adapted.flattened_facts ?? 0) >= 2);
  });

  it("recovers recognized arrays only and diagnoses unknown arrays", () => {
    const recovered = recoverCompleteTopLevelArrays(compactPrefix({ unknown: true }));
    assert.equal(recovered.unknown_arrays.includes("mystery_bucket"), true);
    assert.equal("mystery_bucket" in (recovered.value ?? {}), false);
    assert.ok((recovered.recovered_array_counts.candidate_facts ?? 0) >= 2);
  });

  it("does not reconstruct an incomplete closing object or fabricate locators", () => {
    const truncated = `\`\`\`json\n{"schema":"archivist_segment_observation@v1","segment_id":"${SEGMENT_ID}","entities":[{"alias":"Cole","entity_type":"person"}],"candidate_facts":[{"id":"f1","alias":"Cole","entity_type":"person","fact_type":"appearance","excerpt":"HOLD FAST, inked up the inside of his left wrist","locator":{"locator":"CHAPTER THREE","chapter":"CHAPTER THREE"}},{"id":"f-cut","excerpt":"`;
    const recovered = recoverCompleteTopLevelArrays(truncated);
    const facts = (recovered.value?.candidate_facts as Array<{ id?: string; locator?: unknown }> | undefined) ?? [];
    assert.equal(facts.length, 1);
    assert.equal(facts[0]?.id, "f1");
    assert.equal(JSON.stringify(facts).includes("f-cut"), false);
    const adapted = recoverAndNormalizeSegmentObservation(truncated, SEGMENT_ID);
    assert.equal(adapted.ok, true);
    assert.equal(adapted.observation?.candidate_facts[0]?.locator?.locator, "CHAPTER THREE");
    assert.equal(adapted.observation?.candidate_facts.some((fact) => !fact.locator), false);
  });

  it("rejects accepted canon on recovered top-level facts", () => {
    const raw = JSON.stringify({
      schema: "archivist_segment_observation@v1",
      segment_id: SEGMENT_ID,
      entities: [{ alias: "Cole", entity_type: "person" }],
      candidate_facts: [
        {
          id: "f1",
          alias: "Cole",
          entity_type: "person",
          fact_type: "appearance",
          excerpt: "HOLD FAST, inked up the inside of his left wrist",
          locator: { locator: "CHAPTER THREE", chapter: "CHAPTER THREE" },
          status: "accepted",
        },
      ],
    });
    const adapted = recoverAndNormalizeSegmentObservation(raw, SEGMENT_ID);
    assert.equal(adapted.ok, true);
    assert.equal(adapted.observation?.candidate_facts.length, 0);
    assert.ok(adapted.quarantined.some((item) => item.reason === "unusable_optional"));
  });

  it("rehydrates recovered top-level excerpts without fabricating evidence", () => {
    const adapted = recoverAndNormalizeSegmentObservation(compactPrefix({ truncateInjury: true }), SEGMENT_ID);
    assert.ok(adapted.observation);
    const manuscript = "HOLD FAST, inked up the inside of his left wrist. An account in my name. two entry wounds in his chest. Sixteen years of friendship. Single slash, left to right.";
    let located = 0;
    let fabricated = 0;
    for (const fact of allObservationFacts(adapted.observation)) {
      const record = rehydrateEvidenceRecord({
        record: {
          excerpt: fact.excerpt,
          locator: fact.locator.locator,
          evidence_role: "current_observation",
          verification_status: "unverified",
          source_kind: "manuscript",
        },
        manuscriptText: manuscript,
        manuscript_id: "ms",
        manuscript_version_id: "mv",
        content_hash: "h",
      });
      if (record.verification_status === "located") located += 1;
      if (fact.excerpt && !manuscript.includes(fact.excerpt) && record.verification_status === "located") {
        fabricated += 1;
      }
    }
    assert.ok(located >= 2);
    assert.equal(fabricated, 0);
  });
});
