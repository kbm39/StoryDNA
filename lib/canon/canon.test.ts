import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CanonDomainError,
  DEVELOPMENTAL_CANON_QUERY_FACT_TYPES,
  MILITARY_CANON_QUERY_FACT_TYPES,
  acceptBibleRevision,
  addEntityAlias,
  applyConflictDisposition,
  assertNoSilentOverwrite,
  attachEvidence,
  authorityOutranks,
  classifyConflict,
  compareTemporalScopes,
  createCandidateFact,
  createCanonStore,
  createDraftBibleRevision,
  detectAcceptedTemporalConflicts,
  effectiveAuthority,
  evidenceForConflict,
  findEntityByAlias,
  historicalFactsForEntity,
  normalizeAlias,
  promoteFactToAccepted,
  queryCanon,
  recordConflict,
  registerEntity,
  rejectCandidateFact,
  resolveEntityByAlias,
  supersedeFact,
  temporalFactCompatibility,
  type CanonFact,
  type CanonStore,
} from "./index.ts";

const NOW = "2026-09-10T18:00:00.000Z";
const SERIES = "11111111-1111-4111-8111-111111111111";
const BOOK1 = "22222222-2222-4222-8222-222222222221";
const BOOK2 = "22222222-2222-4222-8222-222222222222";
const STANDALONE = "33333333-3333-4333-8333-333333333333";
const VER1 = "44444444-4444-4444-8444-444444444441";
const VER2 = "44444444-4444-4444-8444-444444444442";
const HASH1 = "a".repeat(64);
const HASH2 = "b".repeat(64);

function assertCode(fn: () => unknown, code: string): void {
  assert.throws(fn, (err: unknown) => err instanceof CanonDomainError && err.code === code);
}

function candidateInput(
  overrides: Partial<
    Omit<CanonFact, "id" | "status" | "superseded_by_fact_id" | "created_at" | "updated_at">
  > & { entity_id: string },
): Omit<CanonFact, "id" | "status" | "superseded_by_fact_id" | "created_at" | "updated_at"> {
  return {
    series_id: SERIES,
    fact_type: "age",
    fact_value: { years: 42 },
    temporal_scope: { kind: "as_of_book", book_order: 1 },
    source_manuscript_id: BOOK1,
    source_version_id: VER1,
    source_content_hash: HASH1,
    locator: "ch-3",
    confidence: "high",
    authority: "current_observation",
    created_by: "extraction",
    ...overrides,
  };
}

function seedPerson(store: CanonStore, name = "James Nichols") {
  return registerEntity(
    store,
    {
      series_id: SERIES,
      standalone_manuscript_id: null,
      entity_type: "person",
      canonical_name: name,
      aliases: ["James", "Nichols"],
    },
    NOW,
  );
}

describe("canon entity aliases", () => {
  it("rejects a duplicate normalized alias on the same entity", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    assert.equal(normalizeAlias("  James  "), "james");
    assertCode(() => addEntityAlias(store, entity.id, "  JAMES  ", NOW), "ALIAS_ALREADY_PRESENT");
  });

  it("lets different entities share the alias John", () => {
    const store = createCanonStore();
    const carter = registerEntity(
      store,
      {
        series_id: SERIES,
        standalone_manuscript_id: null,
        entity_type: "person",
        canonical_name: "John Carter",
        aliases: ["John"],
      },
      NOW,
    );
    const miller = registerEntity(
      store,
      {
        series_id: SERIES,
        standalone_manuscript_id: null,
        entity_type: "person",
        canonical_name: "John Miller",
        aliases: ["John"],
      },
      NOW,
    );
    assert.notEqual(carter.id, miller.id);
    const shared = resolveEntityByAlias(store, { series_id: SERIES }, "  JOHN  ");
    assert.equal(shared.status, "ambiguous");
    if (shared.status === "ambiguous") {
      assert.deepEqual(new Set(shared.candidates.map((row) => row.id)), new Set([carter.id, miller.id]));
    }
  });

  it("resolves a unique full name and a unique alias", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const full = resolveEntityByAlias(store, { series_id: SERIES }, "James Nichols");
    const alias = resolveEntityByAlias(store, { series_id: SERIES }, "NICHOLS");
    assert.equal(full.status, "resolved");
    assert.equal(alias.status, "resolved");
    if (full.status === "resolved") assert.equal(full.entity_id, entity.id);
    if (alias.status === "resolved") assert.equal(alias.entity.id, entity.id);
    assert.equal(findEntityByAlias(store, { series_id: SERIES }, "james nichols")?.id, entity.id);
    assert.equal(
      resolveEntityByAlias(store, { standalone_manuscript_id: STANDALONE }, "James Nichols").status,
      "not_found",
    );
  });

  it("never silently merges an ambiguous alias", () => {
    const store = createCanonStore();
    registerEntity(
      store,
      {
        series_id: SERIES,
        standalone_manuscript_id: null,
        entity_type: "person",
        canonical_name: "John Carter",
        aliases: ["John", "Captain"],
      },
      NOW,
    );
    registerEntity(
      store,
      {
        series_id: SERIES,
        standalone_manuscript_id: null,
        entity_type: "person",
        canonical_name: "John Miller",
        aliases: ["John"],
      },
      NOW,
    );
    assert.equal(resolveEntityByAlias(store, { series_id: SERIES }, "John").status, "ambiguous");
    assert.equal(resolveEntityByAlias(store, { series_id: SERIES }, "nobody").status, "not_found");
    assertCode(
      () => findEntityByAlias(store, { series_id: SERIES }, "John"),
      "AMBIGUOUS_ENTITY_ALIAS",
    );
  });
});

describe("candidate facts and author promotion", () => {
  it("extraction creates candidates, never accepted canon", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    assertCode(
      () =>
        createCandidateFact(store, {
          ...candidateInput({ entity_id: entity.id }),
          status: "accepted",
        } as Parameters<typeof createCandidateFact>[1]),
      "EXTRACTION_CANNOT_ACCEPT_CANON",
    );
    const fact = createCandidateFact(store, candidateInput({ entity_id: entity.id }), NOW);
    assert.equal(fact.status, "candidate");
    assert.equal(fact.created_by, "extraction");
  });

  it("author promotion is required and is auditable", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const fact = createCandidateFact(store, candidateInput({ entity_id: entity.id }), NOW);
    assertCode(
      () =>
        promoteFactToAccepted(store, {
          factId: fact.id,
          actor: "extraction" as unknown as "author",
        }),
      "ACCEPTED_CANON_REQUIRES_AUTHOR",
    );
    const accepted = promoteFactToAccepted(store, { factId: fact.id, actor: "author", now: NOW });
    assert.equal(accepted.status, "accepted");
    assert.equal(store.transitions.length, 1);
    assert.equal(store.transitions[0]?.kind, "promotion");
    assert.equal(store.transitions[0]?.created_by, "author");
  });

  it("inferred and uncertain observations cannot independently establish canon", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const inferred = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        authority: "inferred",
        created_by: "inferred",
        confidence: "low",
        fact_type: "knowledge_state",
        fact_value: { knows: "the ambush" },
      }),
      NOW,
    );
    const uncertain = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        authority: "uncertain_observation",
        confidence: "insufficient",
        fact_type: "appearance",
        fact_value: { eyes: "maybe grey" },
        locator: "ch-8",
      }),
      NOW,
    );
    assertCode(
      () => promoteFactToAccepted(store, { factId: inferred.id, actor: "author" }),
      "INFERRED_CANNOT_BECOME_CANON",
    );
    assertCode(
      () => promoteFactToAccepted(store, { factId: uncertain.id, actor: "author" }),
      "INFERRED_CANNOT_BECOME_CANON",
    );
  });
});

describe("authority precedence and no silent overwrite", () => {
  it("ranks author exception above bible, prior volume, observation, inferred, uncertain", () => {
    assert.equal(authorityOutranks("author_approved_exception", "series_bible_accepted"), true);
    assert.equal(authorityOutranks("series_bible_accepted", "prior_volume_canon"), true);
    assert.equal(authorityOutranks("prior_volume_canon", "current_observation"), true);
    assert.equal(authorityOutranks("current_observation", "inferred"), true);
    assert.equal(authorityOutranks("inferred", "uncertain_observation"), true);
    assert.equal(authorityOutranks("current_observation", "prior_volume_canon"), false);
  });

  it("accepted canon outranks a current observation and cannot be silently overwritten", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const prior = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        authority: "prior_volume_canon",
        fact_type: "rank_title",
        fact_value: { rank: "Captain" },
        temporal_scope: { kind: "at", book_order: 1, chapter: "10" },
      }),
      NOW,
    );
    promoteFactToAccepted(store, { factId: prior.id, actor: "author", now: NOW });
    const incoming = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "rank_title",
        fact_value: { rank: "Lieutenant" },
        source_manuscript_id: BOOK2,
        source_version_id: VER2,
        source_content_hash: HASH2,
        temporal_scope: { kind: "at", book_order: 1, chapter: "10" },
      }),
      NOW,
    );
    assertCode(
      () =>
        assertNoSilentOverwrite({
          existing: prior,
          incoming: { ...incoming, status: "accepted" },
          store,
        }),
      "SILENT_CANON_OVERWRITE",
    );
    assertCode(
      () => promoteFactToAccepted(store, { factId: incoming.id, actor: "author" }),
      "CONFLICTING_PRIORS_UNRESOLVED",
    );
    assert.equal(prior.status, "accepted");
    assert.equal(prior.fact_value.rank, "Captain");
    assert.equal(incoming.status, "candidate");
  });

  it("conflicting prior facts do not resolve themselves", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const first = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "alive_status",
        fact_value: { alive: true },
        temporal_scope: { kind: "at", book_order: 1, chapter: "2" },
      }),
      NOW,
    );
    promoteFactToAccepted(store, { factId: first.id, actor: "author", now: NOW });
    const second = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "alive_status",
        fact_value: { alive: false },
        authority: "prior_volume_canon",
        source_manuscript_id: BOOK2,
        source_version_id: VER2,
        source_content_hash: HASH2,
        temporal_scope: { kind: "at", book_order: 1, chapter: "2" },
      }),
      NOW,
    );
    assertCode(
      () => promoteFactToAccepted(store, { factId: second.id, actor: "author" }),
      "CONFLICTING_PRIORS_UNRESOLVED",
    );
    assert.equal(first.status, "accepted");
    assert.equal(second.status, "candidate");
    assert.equal(store.conflicts[0]?.classification, "confirmed_contradiction");
  });
});

describe("supersession and intentional retcon", () => {
  it("supersedes without deleting historical canon", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const original = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "rank_title",
        fact_value: { rank: "Captain" },
      }),
      NOW,
    );
    promoteFactToAccepted(store, { factId: original.id, actor: "author", now: NOW });
    const { previous, replacement } = supersedeFact(store, {
      previousFactId: original.id,
      kind: "supersession",
      actor: "author",
      reason: "later volume promotion",
      now: NOW,
      replacement: candidateInput({
        entity_id: entity.id,
        fact_type: "rank_title",
        fact_value: { rank: "Major" },
        source_manuscript_id: BOOK2,
        source_version_id: VER2,
        source_content_hash: HASH2,
        authority: "prior_volume_canon",
        created_by: "author",
      }),
    });
    assert.equal(previous.status, "superseded");
    assert.equal(previous.superseded_by_fact_id, replacement.id);
    assert.equal(replacement.status, "accepted");
    assert.equal(historicalFactsForEntity(store, entity.id).length, 2);
    const current = queryCanon(store, { series_id: SERIES, entity_id: entity.id, fact_types: ["rank_title"] });
    assert.deepEqual(
      current.facts.map((fact) => fact.id),
      [replacement.id],
    );
    const historical = queryCanon(store, {
      series_id: SERIES,
      entity_id: entity.id,
      include_historical: true,
    });
    assert.equal(historical.facts.some((fact) => fact.id === previous.id), true);
  });

  it("preserves an intentional retcon as author-approved exception", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const original = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "age",
        fact_value: { years: 42 },
      }),
      NOW,
    );
    promoteFactToAccepted(store, { factId: original.id, actor: "author", now: NOW });
    const { previous, replacement } = supersedeFact(store, {
      previousFactId: original.id,
      kind: "retcon",
      actor: "author",
      reason: "author-approved age correction",
      now: NOW,
      replacement: candidateInput({
        entity_id: entity.id,
        fact_value: { years: 38 },
        created_by: "author",
        authority: "current_observation",
      }),
    });
    assert.equal(replacement.authority, "author_approved_exception");
    assert.equal(previous.status, "superseded");
    assert.equal(store.transitions.at(-1)?.kind, "retcon");
    assert.equal(
      queryCanon(store, { include_historical: true, entity_id: entity.id }).facts.length,
      2,
    );
  });
});

describe("conflicts, evidence, and dispositions", () => {
  it("classifies continuity conflicts separately from facts", () => {
    assert.equal(
      classifyConflict({
        explainedInText: false,
        bothSidesCited: true,
        evidenceInsufficient: false,
        withinBookOnly: false,
      }),
      "confirmed_contradiction",
    );
    assert.equal(
      classifyConflict({
        explainedInText: true,
        bothSidesCited: true,
        evidenceInsufficient: false,
        withinBookOnly: false,
      }),
      "possible_continuity_conflict",
    );
    assert.equal(
      classifyConflict({
        explainedInText: false,
        bothSidesCited: false,
        evidenceInsufficient: true,
        withinBookOnly: true,
      }),
      "author_verification_needed",
    );
  });

  it("records both-sided evidence and author dispositions without turning conflicts into canon", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const prior = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "injury",
        fact_value: { injury: "left-arm amputation" },
        authority: "prior_volume_canon",
      }),
      NOW,
    );
    promoteFactToAccepted(store, { factId: prior.id, actor: "author", now: NOW });
    const observation = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "injury",
        fact_value: { injury: "both arms intact" },
        source_manuscript_id: BOOK2,
        source_version_id: VER2,
        source_content_hash: HASH2,
        locator: "ch-12",
      }),
      NOW,
    );
    const conflict = recordConflict(
      store,
      {
        series_id: SERIES,
        manuscript_id: BOOK2,
        classification: "confirmed_contradiction",
        severity: "major",
        confidence: "high",
        current_observation_fact_id: observation.id,
        conflicting_canon_fact_id: prior.id,
        explanation: "Book 2 shows both arms; Book 1 established amputation.",
        suggested_resolution: "Confirm whether this is a retcon or a different character.",
        author_comment: null,
      },
      NOW,
    );
    attachEvidence(
      store,
      {
        fact_id: observation.id,
        conflict_id: conflict.id,
        evidence_role: "current_observation",
        manuscript_id: BOOK2,
        manuscript_version_id: VER2,
        content_hash: HASH2,
        locator: "ch-12",
        excerpt: "He raised both hands.",
        normalized_excerpt: "he raised both hands",
        verification_status: "unverified",
      },
      NOW,
    );
    attachEvidence(
      store,
      {
        fact_id: prior.id,
        conflict_id: conflict.id,
        evidence_role: "conflicting_canon",
        manuscript_id: BOOK1,
        manuscript_version_id: VER1,
        content_hash: HASH1,
        locator: "ch-3",
        excerpt: "The sleeve hung empty.",
        normalized_excerpt: "the sleeve hung empty",
        verification_status: "located",
      },
      NOW,
    );
    assert.equal(evidenceForConflict(store, conflict.id).length, 2);
    assert.equal(store.facts.some((fact) => fact.id === conflict.id), false);
    const marked = applyConflictDisposition(store, {
      conflictId: conflict.id,
      action: "mark_intentional",
      comment: "Keep both; later explained as a prosthetic.",
      now: NOW,
    });
    assert.equal(marked.author_action, "mark_intentional");
    assert.equal(store.conflict_events.length, 2);
    assert.equal(
      queryCanon(store, { series_id: SERIES, manuscript_id: BOOK2 }).unresolved_conflicts.length,
      0,
    );
  });
});

describe("series bible revisions", () => {
  it("does not auto-create revision 1 from first-book extraction", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    createCandidateFact(store, candidateInput({ entity_id: entity.id }), NOW);
    assert.equal(store.bible_revisions.length, 0);
    assertCode(
      () =>
        createDraftBibleRevision(store, {
          seriesId: SERIES,
          factIds: [],
          actor: "extraction",
        }),
      "BIBLE_REQUIRES_AUTHOR",
    );
  });

  it("requires accepted facts and author promotion, then supersedes prior revisions", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const fact = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "location",
        fact_value: { place: "Camp Pendleton" },
      }),
      NOW,
    );
    assertCode(
      () =>
        createDraftBibleRevision(store, {
          seriesId: SERIES,
          factIds: [fact.id],
          actor: "author",
        }),
      "BIBLE_FACTS_MUST_BE_ACCEPTED",
    );
    promoteFactToAccepted(store, { factId: fact.id, actor: "author", now: NOW });
    const draft = createDraftBibleRevision(store, {
      seriesId: SERIES,
      factIds: [fact.id],
      actor: "author",
      now: NOW,
    });
    assert.equal(draft.revision_number, 1);
    assert.equal(draft.status, "draft");
    const accepted = acceptBibleRevision(store, { revisionId: draft.id, actor: "author", now: NOW });
    assert.equal(accepted.status, "accepted");
    assert.equal(effectiveAuthority(fact, store), "series_bible_accepted");

    const { replacement } = supersedeFact(store, {
      previousFactId: fact.id,
      kind: "supersession",
      actor: "author",
      reason: "author updated bible location",
      now: NOW,
      replacement: {
        ...candidateInput({
          entity_id: entity.id,
          fact_type: "location",
          fact_value: { place: "Okinawa" },
          source_manuscript_id: BOOK2,
          source_version_id: VER2,
          source_content_hash: HASH2,
          created_by: "author",
          authority: "series_bible_accepted",
        }),
      },
    });
    const draft2 = createDraftBibleRevision(store, {
      seriesId: SERIES,
      factIds: [replacement.id],
      actor: "author",
      now: NOW,
    });
    assert.equal(draft2.revision_number, 2);
    assert.equal(draft2.supersedes_revision_id, accepted.id);
    acceptBibleRevision(store, { revisionId: draft2.id, actor: "author", now: NOW });
    assert.equal(accepted.status, "superseded");
    assert.equal(draft2.status, "accepted");
  });
});

describe("CanonQuery filtering and provenance", () => {
  it("filters by series, entity, fact type, status, temporal scope, and min authority", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const age = createCandidateFact(store, candidateInput({ entity_id: entity.id }), NOW);
    const rank = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "rank_title",
        fact_value: { rank: "Captain" },
        temporal_scope: { kind: "as_of_book", book_order: 2 },
        source_manuscript_id: BOOK2,
        source_version_id: VER2,
        source_content_hash: HASH2,
        authority: "prior_volume_canon",
      }),
      NOW,
    );
    const relationship = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "relationship",
        fact_value: { related_to: "Elena Voss", kind: "spouse" },
      }),
      NOW,
    );
    promoteFactToAccepted(store, { factId: age.id, actor: "author", now: NOW });
    promoteFactToAccepted(store, { factId: rank.id, actor: "author", now: NOW });
    promoteFactToAccepted(store, { factId: relationship.id, actor: "author", now: NOW });

    const military = queryCanon(store, {
      series_id: SERIES,
      entity_id: entity.id,
      fact_types: MILITARY_CANON_QUERY_FACT_TYPES,
    });
    assert.equal(military.facts.some((fact) => fact.fact_type === "relationship"), false);
    assert.equal(military.facts.some((fact) => fact.fact_type === "rank_title"), true);

    const developmental = queryCanon(store, {
      series_id: SERIES,
      fact_types: DEVELOPMENTAL_CANON_QUERY_FACT_TYPES,
    });
    assert.equal(developmental.facts.some((fact) => fact.fact_type === "relationship"), true);

    const book2Temporal = queryCanon(store, {
      series_id: SERIES,
      temporal_book_order: 2,
      fact_types: ["rank_title", "age"],
    });
    assert.deepEqual(
      book2Temporal.facts.map((fact) => fact.fact_type).sort(),
      ["rank_title"],
    );

    const minAuthority = queryCanon(store, {
      series_id: SERIES,
      min_authority: "prior_volume_canon",
    });
    assert.equal(minAuthority.facts.length, 1);
    assert.equal(minAuthority.facts[0]?.id, rank.id);
  });

  it("keeps within-book and cross-book source provenance distinct", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const withinA = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "presence",
        fact_value: { place: "mess hall" },
        locator: "ch-1",
      }),
      NOW,
    );
    const withinB = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "presence",
        fact_value: { place: "motor pool" },
        locator: "ch-4",
      }),
      NOW,
    );
    const cross = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "presence",
        fact_value: { place: "Okinawa" },
        source_manuscript_id: BOOK2,
        source_version_id: VER2,
        source_content_hash: HASH2,
        locator: "ch-2",
        temporal_scope: { kind: "as_of_book", book_order: 2 },
      }),
      NOW,
    );
    for (const fact of [withinA, withinB, cross]) {
      promoteFactToAccepted(store, { factId: fact.id, actor: "author", now: NOW });
    }

    const book1 = queryCanon(store, {
      series_id: SERIES,
      manuscript_id: BOOK1,
      fact_types: ["presence"],
      statuses: ["accepted"],
    });
    assert.equal(book1.facts.length, 2);
    assert.equal(
      book1.facts.every((fact) => fact.source_manuscript_id === BOOK1 && fact.source_content_hash === HASH1),
      true,
    );
    assert.deepEqual(new Set(book1.facts.map((fact) => fact.locator)), new Set(["ch-1", "ch-4"]));

    const book2 = queryCanon(store, {
      series_id: SERIES,
      manuscript_id: BOOK2,
      fact_types: ["presence"],
    });
    assert.equal(book2.facts.length, 1);
    assert.equal(book2.facts[0]?.source_content_hash, HASH2);

    const asOfBook2 = queryCanon(store, {
      series_id: SERIES,
      as_of_manuscript_id: BOOK2,
      fact_types: ["presence"],
      min_authority: "prior_volume_canon",
    });
    assert.equal(asOfBook2.facts.length, 2);
    assert.equal(
      asOfBook2.facts.every((fact) => fact.source_manuscript_id === BOOK1),
      true,
    );
  });

  it("exposes unresolved conflicts for developmental queries", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const a = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "relationship",
        fact_value: { related_to: "Elena", kind: "ex-spouse" },
      }),
      NOW,
    );
    const b = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "relationship",
        fact_value: { related_to: "Elena", kind: "spouse" },
        locator: "ch-9",
      }),
      NOW,
    );
    recordConflict(
      store,
      {
        series_id: SERIES,
        manuscript_id: BOOK1,
        classification: "author_verification_needed",
        severity: "moderate",
        confidence: "medium",
        current_observation_fact_id: b.id,
        conflicting_canon_fact_id: a.id,
        explanation: "Marital status flips without a scene.",
        suggested_resolution: "Ask the author which status is current.",
        author_comment: null,
      },
      NOW,
    );
    const result = queryCanon(store, {
      series_id: SERIES,
      fact_types: DEVELOPMENTAL_CANON_QUERY_FACT_TYPES,
      statuses: ["candidate"],
    });
    assert.equal(result.unresolved_conflicts.length, 1);
    assert.equal(result.unresolved_conflicts[0]?.classification, "author_verification_needed");
  });
});

describe("temporal fact compatibility", () => {
  it("does not duplicate the same rank at the same time", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const first = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "rank_title",
        fact_value: { rank: "Lieutenant" },
        temporal_scope: { kind: "from_to", book_order: 3, from: "1", to: "12" },
      }),
      NOW,
    );
    promoteFactToAccepted(store, { factId: first.id, actor: "author", now: NOW });
    const duplicate = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "rank_title",
        fact_value: { rank: "Lieutenant" },
        temporal_scope: { kind: "from_to", book_order: 3, from: "1", to: "12" },
        locator: "ch-4",
      }),
      NOW,
    );
    assertCode(
      () => promoteFactToAccepted(store, { factId: duplicate.id, actor: "author" }),
      "REDUNDANT_ACCEPTED_FACT",
    );
    assert.equal(store.facts.filter((fact) => fact.status === "accepted" && fact.fact_type === "rank_title").length, 1);
  });

  it("allows different ranks at disjoint times and conflicts at the same time", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const lieutenant = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "rank_title",
        fact_value: { rank: "Lieutenant" },
        temporal_scope: { kind: "from_to", book_order: 3, from: "1", to: "12" },
      }),
      NOW,
    );
    promoteFactToAccepted(store, { factId: lieutenant.id, actor: "author", now: NOW });
    const captain = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "rank_title",
        fact_value: { rank: "Captain" },
        temporal_scope: { kind: "from_to", book_order: 3, from: "13" },
        locator: "ch-13",
      }),
      NOW,
    );
    promoteFactToAccepted(store, { factId: captain.id, actor: "author", now: NOW });
    assert.equal(store.facts.filter((fact) => fact.status === "accepted" && fact.fact_type === "rank_title").length, 2);

    const clash = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "rank_title",
        fact_value: { rank: "Major" },
        temporal_scope: { kind: "at", book_order: 3, chapter: "8" },
        locator: "ch-8",
      }),
      NOW,
    );
    assertCode(
      () => promoteFactToAccepted(store, { factId: clash.id, actor: "author" }),
      "CONFLICTING_PRIORS_UNRESOLVED",
    );
    assert.equal(store.conflicts[0]?.classification, "confirmed_contradiction");
    assert.equal(clash.status, "candidate");
    assert.equal(lieutenant.status, "accepted");
  });

  it("allows alive then deceased across chronology and conflicts at the same point", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const alive = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "alive_status",
        fact_value: { alive: true },
        temporal_scope: { kind: "from_to", book_order: 3, from: "1", to: "26" },
      }),
      NOW,
    );
    promoteFactToAccepted(store, { factId: alive.id, actor: "author", now: NOW });
    const dead = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "alive_status",
        fact_value: { alive: false },
        temporal_scope: { kind: "from_to", book_order: 3, from: "27" },
        locator: "ch-27",
      }),
      NOW,
    );
    promoteFactToAccepted(store, { factId: dead.id, actor: "author", now: NOW });
    assert.equal(compareTemporalScopes(alive.temporal_scope, dead.temporal_scope), "disjoint");

    const sameMoment = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "alive_status",
        fact_value: { alive: false },
        temporal_scope: { kind: "at", book_order: 3, chapter: "2" },
      }),
      NOW,
    );
    assertCode(
      () => promoteFactToAccepted(store, { factId: sameMoment.id, actor: "author" }),
      "CONFLICTING_PRIORS_UNRESOLVED",
    );
  });

  it("allows appearance and age changes after a birthday or time jump", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const clean = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "appearance",
        fact_value: { beard: false },
        temporal_scope: { kind: "at", book_order: 3, chapter: "4" },
      }),
      NOW,
    );
    const bearded = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "appearance",
        fact_value: { beard: true },
        temporal_scope: { kind: "at", book_order: 3, chapter: "20" },
        locator: "ch-20",
      }),
      NOW,
    );
    const age24 = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "age",
        fact_value: { years: 24 },
        temporal_scope: { kind: "from_to", book_order: 3, from: "1", to: "8" },
      }),
      NOW,
    );
    const age25 = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "age",
        fact_value: { years: 25 },
        temporal_scope: { kind: "from_to", book_order: 3, from: "9" },
        locator: "ch-9",
      }),
      NOW,
    );
    for (const fact of [clean, bearded, age24, age25]) {
      promoteFactToAccepted(store, { factId: fact.id, actor: "author", now: NOW });
    }
    assert.equal(store.conflicts.length, 0);
    assert.equal(store.facts.filter((fact) => fact.status === "accepted").length, 4);
  });

  it("does not let unknown temporal scope overwrite accepted canon", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const known = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "rank_title",
        fact_value: { rank: "Captain" },
        temporal_scope: { kind: "from_to", book_order: 3, from: "13" },
      }),
      NOW,
    );
    promoteFactToAccepted(store, { factId: known.id, actor: "author", now: NOW });
    const unknown = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "rank_title",
        fact_value: { rank: "Private" },
        temporal_scope: { kind: "unknown" },
        locator: "ch-??",
      }),
      NOW,
    );
    assert.equal(
      temporalFactCompatibility(known, unknown).kind,
      "conflict",
    );
    assertCode(
      () => promoteFactToAccepted(store, { factId: unknown.id, actor: "author" }),
      "CONFLICTING_PRIORS_UNRESOLVED",
    );
    assert.equal(unknown.status, "candidate");
    assert.equal(known.status, "accepted");
    assert.equal(store.conflicts[0]?.classification, "author_verification_needed");
  });

  it("treats book-only as_of_book overlap as verification-needed, not a silent collapse", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const first = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "rank_title",
        fact_value: { rank: "Lieutenant" },
        temporal_scope: { kind: "as_of_book", book_order: 3 },
      }),
      NOW,
    );
    promoteFactToAccepted(store, { factId: first.id, actor: "author", now: NOW });
    const second = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "rank_title",
        fact_value: { rank: "Captain" },
        temporal_scope: { kind: "as_of_book", book_order: 3 },
        locator: "ch-13",
      }),
      NOW,
    );
    assert.equal(compareTemporalScopes(first.temporal_scope, second.temporal_scope), "unknown");
    assertCode(
      () => promoteFactToAccepted(store, { factId: second.id, actor: "author" }),
      "CONFLICTING_PRIORS_UNRESOLVED",
    );
    assert.equal(store.conflicts[0]?.classification, "author_verification_needed");
  });

  it("keeps historical accepted facts queryable after a later disjoint state", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const before = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "rank_title",
        fact_value: { rank: "Lieutenant" },
        temporal_scope: { kind: "from_to", book_order: 3, from: "1", to: "12" },
      }),
      NOW,
    );
    promoteFactToAccepted(store, { factId: before.id, actor: "author", now: NOW });
    const after = createCandidateFact(
      store,
      candidateInput({
        entity_id: entity.id,
        fact_type: "rank_title",
        fact_value: { rank: "Captain" },
        temporal_scope: { kind: "from_to", book_order: 3, from: "13" },
      }),
      NOW,
    );
    promoteFactToAccepted(store, { factId: after.id, actor: "author", now: NOW });
    const current = queryCanon(store, {
      series_id: SERIES,
      entity_id: entity.id,
      fact_types: ["rank_title"],
    });
    assert.equal(current.facts.length, 2);
    const superseded = supersedeFact(store, {
      previousFactId: after.id,
      kind: "supersession",
      actor: "author",
      reason: "author corrected the later rank",
      now: NOW,
      replacement: candidateInput({
        entity_id: entity.id,
        fact_type: "rank_title",
        fact_value: { rank: "Major" },
        temporal_scope: { kind: "from_to", book_order: 3, from: "13" },
        created_by: "author",
        authority: "author_approved_exception",
      }),
    });
    assert.equal(
      queryCanon(store, {
        series_id: SERIES,
        entity_id: entity.id,
        include_historical: true,
        fact_types: ["rank_title"],
      }).facts.length,
      3,
    );
    assert.equal(superseded.previous.status, "superseded");
    assert.equal(detectAcceptedTemporalConflicts(store.facts).length, 0);
  });
});

describe("reject remains historical", () => {
  it("rejected candidates stay queryable when historical is requested", () => {
    const store = createCanonStore();
    const entity = seedPerson(store);
    const fact = createCandidateFact(store, candidateInput({ entity_id: entity.id }), NOW);
    rejectCandidateFact(store, { factId: fact.id, actor: "author", reason: "misread", now: NOW });
    assert.equal(queryCanon(store, { series_id: SERIES }).facts.length, 0);
    assert.equal(
      queryCanon(store, { series_id: SERIES, include_historical: true }).facts[0]?.status,
      "rejected",
    );
  });
});
