import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { CanonFactType } from "@/lib/canon/types.ts";
import { V2_PHASE2_HELD_OUT_IDS } from "./observation-v2/phase-2/index.ts";
import { candidateCanonFromBookGraph } from "./candidate-canon.ts";
import { buildComparisonKey } from "./comparison-key.ts";
import { diagnoseCandidateFactPair as diagnose } from "./comparison-eligibility.ts";
import { pairDeterministicContradictions } from "./contradiction-pairing.ts";
import { RECONCILIATION_MAX_BATCH_SIZE } from "./constants.ts";
import { batchReconciliationItems, buildReconciliationItems } from "./reconciliation.ts";
import type { ArchivistBookGraph, BookGraphFact } from "./types.ts";

function fact(args: {
  id: string;
  entity_key: string;
  alias: string;
  fact_type: CanonFactType;
  value: Record<string, unknown>;
  chapter: string;
  excerpt?: string;
}): BookGraphFact {
  return {
    id: args.id,
    entity_key: args.entity_key,
    alias: args.alias,
    entity_type: args.entity_key.startsWith("object:") ? "object" : "person",
    fact_type: args.fact_type,
    value: args.value,
    temporal_scope: { kind: "at", chapter: args.chapter },
    evidence: args.excerpt
      ? [{
          excerpt: args.excerpt,
          locator: args.chapter,
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        }]
      : [],
    locators: [{ locator: args.chapter, chapter: args.chapter }],
    source_segment_ids: ["seg-test"],
    confidence: "high",
  };
}

function graph(facts: BookGraphFact[]): ArchivistBookGraph {
  return {
    schema: "archivist_book_graph@v1",
    manuscript_id: "ms",
    manuscript_version_id: "mv",
    content_hash: "d1e3fb40bb864399c1459414e5286e7d3806740dd0788343c298620676602a8f",
    entities: [],
    unresolved_ambiguities: [],
    candidate_facts: facts,
    temporal_fact_history: facts,
    events: [],
    relationships: [],
    injury_histories: [],
    knowledge_histories: [],
    location_travel_histories: [],
    possessions: [],
    unique_objects: [],
    organizations: [],
    evidence_references: [],
  };
}

describe("Archivist comparison keys", () => {
  it("builds distinct appearance keys for tattoo vs eye injury", () => {
    const tattoo = fact({
      id: "t",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "appearance",
      value: { mark: "HOLD FAST tattoo on inside of left wrist" },
      chapter: "CHAPTER THREE",
    });
    const eye = fact({
      id: "e",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "appearance",
      value: { mark: "split above left eye, blood" },
      chapter: "CHAPTER TWENTY-FOUR",
    });
    const tattooKey = buildComparisonKey(tattoo);
    const eyeKey = buildComparisonKey(eye);
    assert.equal(tattooKey.attribute, "tattoo");
    assert.equal(eyeKey.attribute, "injury_mark");
    assert.notEqual(tattooKey.attribute, eyeKey.attribute);
    assert.equal(tattooKey.specificity, "specific");
  });

  it("fails closed when an appearance subtype cannot be determined", () => {
    const vague = fact({
      id: "v",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "appearance",
      value: { mark: "observed" },
      chapter: "CHAPTER ONE",
    });
    assert.equal(buildComparisonKey(vague).specificity, "insufficient");
  });
});

describe("REVISED-13 real-noise pairing fixtures", () => {
  it("treats HOLD FAST tattoo vs tattoo on wrist as equivalent", () => {
    const left = fact({
      id: "a",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "appearance",
      value: { mark: "HOLD FAST tattoo on inside of left wrist" },
      chapter: "CHAPTER THREE",
    });
    const right = fact({
      id: "b",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "appearance",
      value: { mark: "tattoo on inside of wrist" },
      chapter: "CHAPTER SEVEN",
    });
    const result = diagnose(left, right);
    assert.equal(result.eligibility, "equivalent");
    assert.equal(pairDeterministicContradictions(graph([left, right])).length, 0);
  });

  it("does not compare tattoo vs split left eye", () => {
    const tattoo = fact({
      id: "a",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "appearance",
      value: { mark: "HOLD FAST tattoo on inside of left wrist" },
      chapter: "CHAPTER THREE",
    });
    const eye = fact({
      id: "b",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "appearance",
      value: { mark: "split above left eye, blood" },
      chapter: "CHAPTER TWENTY-FOUR",
    });
    assert.equal(diagnose(tattoo, eye).eligibility, "not_comparable");
    assert.equal(diagnose(tattoo, eye).reason, "different_attribute");
  });

  it("treats two descriptions of the same eye injury as equivalent", () => {
    const first = fact({
      id: "a",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "appearance",
      value: { mark: "split above left eye, blood" },
      chapter: "CHAPTER TWENTY-FOUR",
    });
    const second = fact({
      id: "b",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "appearance",
      value: { mark: "blood over left eye from split, tracked into sight picture" },
      chapter: "CHAPTER TWENTY-FOUR",
    });
    assert.equal(diagnose(first, second).eligibility, "equivalent");
  });

  it("does not compare Ari/Cole service vs Ari/Dalia work", () => {
    const cole = fact({
      id: "a",
      entity_key: "person:ari",
      alias: "Ari",
      fact_type: "relationship",
      value: { context: "military training", relationship: "served with Cole" },
      chapter: "PROLOGUE",
    });
    const dalia = fact({
      id: "b",
      entity_key: "person:ari",
      alias: "Ari",
      fact_type: "relationship",
      value: { type: "professional connection", other: "Dalia Parsi", duration: "eleven years" },
      chapter: "CHAPTER FOUR",
    });
    const result = diagnose(cole, dalia);
    assert.equal(result.eligibility, "not_comparable");
    assert.ok(result.reason === "different_counterparty" || result.reason === "different_relationship_type");
  });

  it("does not compare Ari/Dalia work vs Ari/Noa sibling", () => {
    const dalia = fact({
      id: "a",
      entity_key: "person:ari",
      alias: "Ari",
      fact_type: "relationship",
      value: { type: "professional connection", other: "Dalia Parsi", duration: "eleven years" },
      chapter: "CHAPTER FOUR",
    });
    const noa = fact({
      id: "b",
      entity_key: "person:ari",
      alias: "Ari",
      fact_type: "relationship",
      value: { other: "Noa", relation: "sibling" },
      chapter: "CHAPTER TEN",
    });
    assert.equal(diagnose(dalia, noa).eligibility, "not_comparable");
  });

  it("treats Cole married to Dana vs spouse Dana as equivalent", () => {
    const married = fact({
      id: "a",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "relationship",
      value: { other: "Dana", relation: "married" },
      chapter: "CHAPTER TEN",
    });
    const spouse = fact({
      id: "b",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "relationship",
      value: { related_entity: "Dana", relationship_type: "spouse" },
      chapter: "CHAPTER TWENTY-SIX",
    });
    assert.equal(diagnose(married, spouse).eligibility, "equivalent");
  });

  it("does not conflict Ari alive with warrant vs alive in hospital", () => {
    const warrant = fact({
      id: "a",
      entity_key: "person:ari",
      alias: "Ari",
      fact_type: "alive_status",
      value: { status: "alive", context: "suspected of treason, warrant imminent" },
      chapter: "CHAPTER TWO",
    });
    const hospital = fact({
      id: "b",
      entity_key: "person:ari",
      alias: "Ari",
      fact_type: "alive_status",
      value: { status: "alive" },
      chapter: "CHAPTER TWENTY-FIVE",
    });
    const result = diagnose(warrant, hospital);
    assert.ok(result.eligibility === "equivalent" || result.eligibility === "not_comparable");
    assert.notEqual(result.eligibility, "comparable");
  });

  it("does not conflict Dalia alive under pressure vs alive surrendering", () => {
    const pressure = fact({
      id: "a",
      entity_key: "person:dalia",
      alias: "Dalia",
      fact_type: "alive_status",
      value: { status: "alive", condition: "under coercive control by Iranian intelligence" },
      chapter: "CHAPTER EIGHT",
    });
    const surrender = fact({
      id: "b",
      entity_key: "person:dalia",
      alias: "Dalia",
      fact_type: "alive_status",
      value: { status: "alive_surrendering" },
      chapter: "CHAPTER ELEVEN",
    });
    assert.notEqual(diagnose(pressure, surrender).eligibility, "comparable");
  });

  it("does not pair Rashid dead vs family dead", () => {
    const rashid = fact({
      id: "a",
      entity_key: "person:rashid kanaan",
      alias: "Rashid Kanaan",
      fact_type: "alive_status",
      value: { status: "dead" },
      chapter: "CHAPTER SIXTEEN",
    });
    const family = fact({
      id: "b",
      entity_key: "person:rashid kanaan",
      alias: "Rashid Kanaan",
      fact_type: "alive_status",
      value: { status: "wife and children also dead" },
      chapter: "CHAPTER SIXTEEN",
    });
    const result = diagnose(rashid, family);
    assert.equal(result.eligibility, "not_comparable");
    assert.equal(result.reason, "different_subject");
  });

  it("treats Cyrus presumed dead vs no body/no confirmation as compatible uncertainty", () => {
    const presumed = fact({
      id: "a",
      entity_key: "person:cyrus",
      alias: "Cyrus",
      fact_type: "alive_status",
      value: { status: "presumed dead" },
      chapter: "CHAPTER TWENTY-FOUR",
    });
    const unconfirmed = fact({
      id: "b",
      entity_key: "person:cyrus",
      alias: "Cyrus",
      fact_type: "alive_status",
      value: { status: "presumed_dead_unconfirmed" },
      chapter: "CHAPTER TWENTY-SIX",
    });
    const noBody = fact({
      id: "c",
      entity_key: "person:cyrus",
      alias: "Cyrus",
      fact_type: "alive_status",
      value: { status: "unknown; presumed dead but unconfirmed" },
      chapter: "CHAPTER TWENTY-SIX",
    });
    assert.notEqual(diagnose(presumed, unconfirmed).eligibility, "comparable");
    assert.notEqual(diagnose(unconfirmed, noBody).eligibility, "comparable");
  });

  it("does not compare team lead vs Navy SEAL", () => {
    const lead = fact({
      id: "a",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "rank_title",
      value: { rank: "military officer", context: "team lead" },
      chapter: "PROLOGUE",
    });
    const seal = fact({
      id: "b",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "rank_title",
      value: { rank: "Navy SEAL" },
      chapter: "CHAPTER SEVEN",
    });
    const result = diagnose(lead, seal);
    assert.equal(result.eligibility, "not_comparable");
    assert.equal(result.reason, "different_role_dimension");
  });

  it("does not compare SEAL duration vs Israel assignment", () => {
    const duration = fact({
      id: "a",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "other",
      value: { event: "served as SEAL for twenty years", temporal: "past" },
      chapter: "CHAPTER TWO",
    });
    const assignment = fact({
      id: "b",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "other",
      value: { event: "assigned to Israel", temporal_scope: { kind: "during", reference: "four months prior" } },
      chapter: "CHAPTER SEVEN",
    });
    assert.notEqual(diagnose(duration, assignment).eligibility, "comparable");
  });

  it("does not compare safe-house departure vs network collapse", () => {
    const left = fact({
      id: "a",
      entity_key: "person:cyrus",
      alias: "Cyrus",
      fact_type: "other",
      value: { event: "departed safe house in Hebron before Cole and Ari arrived" },
      chapter: "CHAPTER NINETEEN",
    });
    const right = fact({
      id: "b",
      entity_key: "person:cyrus",
      alias: "Cyrus",
      fact_type: "other",
      value: { event: "network dismantled; operational calendar closed" },
      chapter: "CHAPTER TWENTY-SEVEN",
    });
    assert.notEqual(diagnose(left, right).eligibility, "comparable");
  });

  it("does not compare Rashid arrangement with Ari vs Rashid has wife/children", () => {
    const ari = fact({
      id: "a",
      entity_key: "person:rashid kanaan",
      alias: "Rashid",
      fact_type: "relationship",
      value: { type: "operational arrangement", other: "Ari", duration: "eleven years" },
      chapter: "CHAPTER FOUR",
    });
    const family = fact({
      id: "b",
      entity_key: "person:rashid kanaan",
      alias: "Rashid",
      fact_type: "relationship",
      value: { relationship: "had wife and children" },
      chapter: "CHAPTER SIXTEEN",
    });
    assert.notEqual(diagnose(ari, family).eligibility, "comparable");
  });
});

describe("true-positive pairing fixtures", () => {
  it("pairs eye color blue vs green", () => {
    const blue = fact({
      id: "a",
      entity_key: "person:mara",
      alias: "Mara",
      fact_type: "appearance",
      value: { eye_color: "blue" },
      chapter: "PROLOGUE",
    });
    const green = fact({
      id: "b",
      entity_key: "person:mara",
      alias: "Mara",
      fact_type: "appearance",
      value: { eye_color: "green" },
      chapter: "CHAPTER TWENTY-NINE",
    });
    const result = diagnose(blue, green);
    assert.equal(result.eligibility, "comparable");
    assert.equal(pairDeterministicContradictions(graph([blue, green])).length, 1);
  });

  it("fails closed on bundled multi-region injury laterality", () => {
    const bundled = fact({
      id: "a",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "injury",
      value: { laterality: "left arm below shoulder, right side chest", description: "gunshot wounds to arm and chest" },
      chapter: "CHAPTER TWENTY-FOUR",
    });
    const compound = fact({
      id: "b",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "injury",
      value: { description: "left arm shot below shoulder, blood over left eye from split, cracked ribs, chest round right side" },
      chapter: "CHAPTER TWENTY-FOUR",
    });
    assert.equal(diagnose(bundled, compound).eligibility, "insufficient_semantic_specificity");
  });

  it("pairs same injury left vs right", () => {
    const left = fact({
      id: "a",
      entity_key: "person:mara",
      alias: "Mara",
      fact_type: "injury",
      value: { laterality: "left", site: "shoulder" },
      chapter: "CHAPTER ELEVEN",
    });
    const right = fact({
      id: "b",
      entity_key: "person:mara",
      alias: "Mara",
      fact_type: "injury",
      value: { laterality: "right", site: "shoulder" },
      chapter: "CHAPTER ELEVEN",
    });
    assert.equal(diagnose(left, right).eligibility, "comparable");
    assert.equal(diagnose(left, right).reason, "injury_laterality_conflict");
  });

  it("pairs knowledge used before acquisition", () => {
    const usage = fact({
      id: "a",
      entity_key: "person:mara",
      alias: "Mara",
      fact_type: "knowledge_state",
      value: { kind: "usage", secret: "courier password" },
      chapter: "CHAPTER TWO",
    });
    const learn = fact({
      id: "b",
      entity_key: "person:mara",
      alias: "Mara",
      fact_type: "knowledge_state",
      value: { kind: "acquisition", secret: "courier password" },
      chapter: "CHAPTER FOUR",
    });
    assert.equal(diagnose(usage, learn).eligibility, "comparable");
    assert.equal(diagnose(usage, learn).reason, "knowledge_before_acquisition");
  });

  it("pairs unique object impossible simultaneous possession", () => {
    const mara = fact({
      id: "a",
      entity_key: "object:silver compass",
      alias: "silver compass",
      fact_type: "possession",
      value: { unique: true, possessor: "Mara" },
      chapter: "CHAPTER SEVEN",
    });
    const calder = fact({
      id: "b",
      entity_key: "object:silver compass",
      alias: "silver compass",
      fact_type: "possession",
      value: { unique: true, possessor: "Calder" },
      chapter: "CHAPTER TWENTY-TWO",
    });
    assert.equal(diagnose(mara, calder).eligibility, "comparable");
  });

  it("pairs a true age contradiction", () => {
    const young = fact({
      id: "a",
      entity_key: "person:mara",
      alias: "Mara",
      fact_type: "age",
      value: { age: 28 },
      chapter: "CHAPTER ONE",
    });
    const older = fact({
      id: "b",
      entity_key: "person:mara",
      alias: "Mara",
      fact_type: "age",
      value: { age: 41 },
      chapter: "CHAPTER TWO",
    });
    assert.equal(diagnose(young, older).eligibility, "comparable");
  });

  it("pairs incompatible states of the same relationship edge", () => {
    const married = fact({
      id: "a",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "relationship",
      value: { other: "Dana", relation: "married" },
      chapter: "CHAPTER TEN",
    });
    const divorced = fact({
      id: "b",
      entity_key: "person:cole",
      alias: "Cole",
      fact_type: "relationship",
      value: { other: "Dana", relationship_type: "divorced" },
      chapter: "CHAPTER TWENTY",
    });
    assert.equal(diagnose(married, divorced).eligibility, "comparable");
  });

  it("pairs same-time locations and ignores ordinary travel", () => {
    const hebron = fact({
      id: "a",
      entity_key: "person:cyrus",
      alias: "Cyrus",
      fact_type: "location",
      value: { place: "Hebron safe house" },
      chapter: "CHAPTER NINETEEN",
    });
    const jerusalem = fact({
      id: "b",
      entity_key: "person:cyrus",
      alias: "Cyrus",
      fact_type: "location",
      value: { place: "Jerusalem" },
      chapter: "CHAPTER NINETEEN",
    });
    const later = fact({
      id: "c",
      entity_key: "person:cyrus",
      alias: "Cyrus",
      fact_type: "location",
      value: { place: "coast" },
      chapter: "CHAPTER TWENTY-SEVEN",
    });
    assert.equal(diagnose(hebron, jerusalem).eligibility, "comparable");
    assert.equal(diagnose(hebron, later).eligibility, "not_comparable");
  });

  it("does not pair generic objects", () => {
    const left = fact({
      id: "a",
      entity_key: "object:rifle",
      alias: "rifle",
      fact_type: "possession",
      value: { unique: false, possessor: "Cole" },
      chapter: "CHAPTER ONE",
    });
    const right = fact({
      id: "b",
      entity_key: "object:rifle",
      alias: "rifle",
      fact_type: "possession",
      value: { unique: false, possessor: "Ari" },
      chapter: "CHAPTER ONE",
    });
    assert.equal(diagnose(left, right).eligibility, "insufficient_semantic_specificity");
  });

  it("can represent a candidate without confirming when identity is ambiguous", () => {
    const left = fact({
      id: "a",
      entity_key: "person:the captain",
      alias: "the captain",
      fact_type: "knowledge_state",
      value: { kind: "usage", secret: "cipher key" },
      chapter: "CHAPTER TWO",
    });
    const right = fact({
      id: "b",
      entity_key: "person:the captain",
      alias: "the captain",
      fact_type: "knowledge_state",
      value: { kind: "acquisition", secret: "cipher key" },
      chapter: "CHAPTER FOUR",
    });
    const result = diagnose(left, right, { ambiguous_aliases: ["the captain"] });
    assert.equal(result.eligibility, "comparable");
    assert.equal(result.identity_status, "ambiguous");
    assert.equal(result.confirmation_blocked, true);
  });
});

describe("candidate canon remains separate from pairing", () => {
  it("keeps compatible restatements in candidate canon while pairing emits no finding", () => {
    const first = fact({
      id: "a",
      entity_key: "person:mara",
      alias: "Mara",
      fact_type: "appearance",
      value: { mark: "anchor tattoo on inside of left wrist" },
      chapter: "CHAPTER THREE",
      excerpt: "anchor tattoo on inside of left wrist",
    });
    const second = fact({
      id: "b",
      entity_key: "person:mara",
      alias: "Mara",
      fact_type: "appearance",
      value: { mark: "tattoo on inside of wrist" },
      chapter: "CHAPTER SEVEN",
      excerpt: "tattoo on inside of wrist",
    });
    assert.equal(diagnose(first, second).eligibility, "equivalent");
    assert.equal(pairDeterministicContradictions(graph([first, second])).length, 0);
    const canon = candidateCanonFromBookGraph(graph([first, second]));
    assert.equal(canon.length, 2);
    assert.ok(canon.every((row) => row.status === "candidate"));
  });
});

describe("bounded reconciliation contract", () => {
  it("receives only pair identity, facts, evidence, entity, temporal metadata, and comparison interface", () => {
    const blue = fact({
      id: "a",
      entity_key: "person:mara",
      alias: "Mara",
      fact_type: "appearance",
      value: { eye_color: "blue" },
      chapter: "PROLOGUE",
      excerpt: "blue eyes",
    });
    const green = fact({
      id: "b",
      entity_key: "person:mara",
      alias: "Mara",
      fact_type: "appearance",
      value: { eye_color: "green" },
      chapter: "CHAPTER TWENTY-NINE",
      excerpt: "green eyes",
    });
    const pairs = pairDeterministicContradictions(graph([blue, green]));
    const items = buildReconciliationItems(pairs);
    assert.equal(items.length, 1);
    const item = items[0]!;
    assert.equal(item.schema, "archivist_global_reconciliation@v1");
    assert.equal(item.pair_id, pairs[0]!.id);
    assert.equal(item.entity_identity.alias, "Mara");
    assert.equal(item.fact_history.length, 2);
    assert.equal(item.temporal_relationship, "earlier_later");
    assert.ok(item.excerpts.includes("blue eyes"));
    assert.equal(item.comparison.comparison_interface, "appearance");
    assert.equal(JSON.stringify(item).includes("full novel"), false);
    assert.equal(/R8-\d{3}/.test(JSON.stringify(item)), false);
    const batches = batchReconciliationItems(Array.from({ length: 9 }, (_, index) => ({
      ...item,
      pair_id: `pair-${index}`,
    })));
    assert.equal(RECONCILIATION_MAX_BATCH_SIZE, 8);
    assert.equal(batches[0]!.items.length, 8);
    assert.equal(batches[1]!.items.length, 1);
  });
});

describe("pairing production files stay novel-agnostic", () => {
  it("does not embed held-out Rule 8 IDs or novel-specific pairing leaks", () => {
    const files = [
      "./comparison-key.ts",
      "./comparison-eligibility.ts",
      "./contradiction-pairing.ts",
    ];
    for (const file of files) {
      const text = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
      for (const id of V2_PHASE2_HELD_OUT_IDS) {
        assert.equal(text.includes(id), false, `${file} ${id}`);
      }
      assert.equal(/hold fast/i.test(text), false, file);
      assert.equal(/\bwhisper\b/.test(text), false, file);
      assert.equal(/\brecit/.test(text), false, file);
    }
  });
});
