import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { diagnoseV2ObservationPair } from "../comparison.ts";
import { classifyRehearsalFinding } from "../opus-v2-full-manuscript-eval/runner.ts";
import type { V2Observation } from "../types.ts";
import {
  collectPhase1ReviewCandidates,
  createMemoryReviewDecisionStore,
  evidenceIdentity,
  isPhase1ReviewEligiblePair,
  presentReviewRecommendedModel,
  recordPassageReviewDecision,
  replaySavedDa1cb4fbReviewRecommended,
  reviewFingerprint,
  summarizeClusterReviewStatus,
} from "./index.ts";
import { diagnoseNamespacedPair } from "./eligibility.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../../../");

function injury(
  id: string,
  args: {
    entity: string;
    region: string;
    laterality: "left" | "right" | "bilateral" | "unspecified";
    condition: string;
    locator: string;
    excerpt: string;
    verified?: boolean;
    segment?: string;
  },
): V2Observation {
  return {
    id,
    kind: "injury",
    payload: {
      entity: args.entity,
      body_region: args.region,
      laterality: args.laterality,
      condition: args.condition,
    },
    proposition: {
      subject: args.entity,
      predicate: "injured",
      object: args.condition,
      polarity: "true",
      source_kind: "narration",
    },
    evidence: {
      locator: args.locator,
      excerpt: args.excerpt,
      source_segment: args.segment ?? "seg-test",
      evidence_status: args.verified === false ? "unverified" : "verified",
    },
    confidence: "high",
    inferred: false,
  };
}

function objectRow(
  id: string,
  object: string,
  action: string,
): V2Observation {
  return {
    id,
    kind: "object_equipment",
    payload: { object, action_or_state: action },
    proposition: {
      subject: "team",
      predicate: "has",
      object,
      polarity: "true",
      source_kind: "narration",
    },
    evidence: {
      locator: "CHAPTER TWO",
      excerpt: `${object} ${action} on the table nearby`,
      source_segment: "seg-test",
      evidence_status: "verified",
    },
    confidence: "high",
    inferred: false,
  };
}

function relationshipRow(id: string): V2Observation {
  return {
    id,
    kind: "relationship",
    payload: { subject: "Mara", relationship_type: "", state: "exists" } as never,
    proposition: {
      subject: "Mara",
      predicate: "related",
      object: "unknown",
      polarity: "true",
      source_kind: "narration",
    },
    evidence: {
      locator: "CHAPTER TWO",
      excerpt: "Mara stood beside someone on the quay",
      source_segment: "seg-test",
      evidence_status: "verified",
    },
    confidence: "high",
    inferred: false,
  };
}

const PIN = {
  manuscriptId: "9478ddf1-4564-4019-96a4-0d1852ee56f9",
  manuscriptVersionId: "19ec5084-3426-4a91-a946-05895bb3e556",
};

const courtyard = injury("obs-03", {
  entity: "Cole",
  region: "upper arm",
  laterality: "unspecified",
  condition: "gunshot wound; later in sling",
  locator: "Prologue, courtyard",
  excerpt: "Cole clutched his upper arm and later wore a sling",
});
const wash = injury("o7", {
  entity: "Cole",
  region: "upper arm",
  laterality: "left",
  condition: "graze",
  locator: "wash ambush",
  excerpt: "A graze burned along Cole's left upper arm",
  segment: "seg-07-chapter-14-chapter-14",
});
const armLater = injury("obs-05", {
  entity: "Cole",
  region: "upper arm",
  laterality: "left",
  condition: "gunshot wound",
  locator: "Chapter 24, container stack",
  excerpt: "The old gunshot wound in Cole's left upper arm ached",
});
const chestRight = injury("obs-13", {
  entity: "Cole",
  region: "chest",
  laterality: "right",
  condition: "gunshot through gap between vest plates",
  locator: "Ch24 container stack",
  excerpt: "The round found the gap between Cole's vest plates",
});
const chestOverlap = injury("obs-07", {
  entity: "Cole",
  region: "chest",
  laterality: "right",
  condition: "gunshot through gap between vest plates",
  locator: "Chapter 24, container gap",
  excerpt: "The same vest-gap round punched through Cole's chest",
});
const chestLater = injury("obs-04", {
  entity: "Cole",
  region: "chest",
  laterality: "unspecified",
  condition: "gunshot wound (hole in chest)",
  locator: "Ch26, Two Hours Later",
  excerpt: "Two hours later the hole in Cole's chest still bled",
});
const ariEarly = injury("ari-a", {
  entity: "Ari",
  region: "knee",
  laterality: "unspecified",
  condition: "kicked and twisted",
  locator: "Ch9, Area B basement",
  excerpt: "They kicked Ari's knee and twisted it hard",
});
const ariLater = injury("ari-b", {
  entity: "Ari",
  region: "knee",
  laterality: "unspecified",
  condition: "swollen, soft tissue damage, nothing torn; braced",
  locator: "Chapter Eleven, safe house",
  excerpt: "Ari's knee was swollen and they fitted a brace",
});

describe("Phase 1 review recommended", () => {
  it("promotes mixed unspecified laterality with verified same-entity region and different state", () => {
    const { left, right, diagnosis } = diagnoseNamespacedPair(courtyard, wash);
    assert.equal(diagnosis.eligibility, "insufficient_semantic_specificity");
    assert.equal(diagnosis.reason, "unspecified_laterality");
    assert.equal(isPhase1ReviewEligiblePair(left, right, diagnosis), true);
    const cards = collectPhase1ReviewCandidates({
      observations: [courtyard, wash],
      ...PIN,
    });
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.topic_key, "upper arm");
    assert.equal(cards[0]?.entity_key, "cole");
    assert.equal(cards[0]?.engine_eligibility, "insufficient_semantic_specificity");
  });

  it("clusters multiple qualifying Cole arm pairs into one card", () => {
    const cards = collectPhase1ReviewCandidates({
      observations: [courtyard, wash, armLater],
      ...PIN,
    });
    assert.equal(cards.length, 1);
    assert.ok((cards[0]?.pair_count ?? 0) >= 2);
    assert.equal(cards[0]?.topic_key, "upper arm");
  });

  it("collapses Cole chest pair combinations into one card", () => {
    const cards = collectPhase1ReviewCandidates({
      observations: [chestRight, chestOverlap, chestLater],
      ...PIN,
    });
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.topic_key, "chest");
    assert.ok((cards[0]?.pair_count ?? 0) >= 2);
  });

  it("does not create a card for generic objects", () => {
    const left = objectRow("boat-a", "boat", "tied");
    const right = objectRow("boat-b", "boat", "lost");
    const diagnosis = diagnoseV2ObservationPair(left, right);
    assert.equal(diagnosis.reason, "generic_object");
    assert.equal(isPhase1ReviewEligiblePair(left, right, diagnosis), false);
    assert.equal(
      collectPhase1ReviewCandidates({ observations: [left, right], ...PIN }).length,
      0,
    );
  });

  it("does not create a card for incomplete relationships", () => {
    const a = relationshipRow("rel-a");
    const b = relationshipRow("rel-b");
    const diagnosis = diagnoseV2ObservationPair(a, b);
    assert.equal(isPhase1ReviewEligiblePair(a, b, diagnosis), false);
    assert.equal(collectPhase1ReviewCandidates({ observations: [a, b], ...PIN }).length, 0);
  });

  it("does not create a Phase 1 card for both-unspecified laterality", () => {
    const { left, right, diagnosis } = diagnoseNamespacedPair(ariEarly, ariLater);
    assert.equal(diagnosis.reason, "unspecified_laterality");
    assert.equal(isPhase1ReviewEligiblePair(left, right, diagnosis), false);
    assert.equal(
      collectPhase1ReviewCandidates({ observations: [ariEarly, ariLater], ...PIN }).length,
      0,
    );
  });

  it("does not create a card when evidence is unverified", () => {
    const unverified = injury("u", {
      entity: "Cole",
      region: "upper arm",
      laterality: "unspecified",
      condition: "gunshot wound; later in sling",
      locator: "Prologue, courtyard",
      excerpt: "Cole clutched his upper arm and later wore a sling",
      verified: false,
    });
    const cards = collectPhase1ReviewCandidates({
      observations: [unverified, wash],
      ...PIN,
    });
    assert.equal(cards.length, 0);
  });

  it("does not create a card for a different entity", () => {
    const mara = injury("m", {
      entity: "Mara",
      region: "upper arm",
      laterality: "unspecified",
      condition: "gunshot wound; later in sling",
      locator: "Prologue, courtyard",
      excerpt: "Mara clutched her upper arm after the shot",
    });
    assert.equal(
      collectPhase1ReviewCandidates({ observations: [mara, wash], ...PIN }).length,
      0,
    );
  });

  it("does not create a card for a different body region", () => {
    const chest = injury("c", {
      entity: "Cole",
      region: "chest",
      laterality: "unspecified",
      condition: "gunshot wound; later in sling",
      locator: "Prologue, courtyard",
      excerpt: "Cole clutched a wound high on his chest",
    });
    assert.equal(
      collectPhase1ReviewCandidates({ observations: [chest, wash], ...PIN }).length,
      0,
    );
  });

  it("keeps one Cole upper-arm card with three independent passages", () => {
    const cards = collectPhase1ReviewCandidates({
      observations: [courtyard, wash, armLater],
      ...PIN,
    });
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.evidence.length, 3);
    assert.deepEqual(
      cards[0]?.evidence.map((row) => row.locator),
      ["Prologue, courtyard", "wash ambush", "Chapter 24, container stack"],
    );
  });

  it("lets three passages in one cluster take different author decisions", () => {
    const store = createMemoryReviewDecisionStore();
    const clinic = injury("obs-clinic", {
      entity: "Cole",
      region: "upper arm",
      laterality: "right",
      condition: "bandage only",
      locator: "Chapter 12, clinic",
      excerpt: "Cole's right upper arm showed only a bandage",
    });
    const first = collectPhase1ReviewCandidates({
      observations: [courtyard, wash, armLater, clinic],
      ...PIN,
      decisions: store,
    });
    assert.equal(first.length, 1);
    assert.equal(first[0]?.evidence.length, 4);
    const byLocator = Object.fromEntries(first[0]!.evidence.map((row) => [row.locator, row]));
    recordPassageReviewDecision({
      store,
      passageKey: byLocator["Prologue, courtyard"]!.passage_key,
      clusterFingerprint: first[0]!.fingerprint,
      evidenceIdentity: byLocator["Prologue, courtyard"]!.evidence_identity,
      action: "needs_fix",
      manuscriptId: PIN.manuscriptId,
      manuscriptVersionId: PIN.manuscriptVersionId,
    });
    recordPassageReviewDecision({
      store,
      passageKey: byLocator["wash ambush"]!.passage_key,
      clusterFingerprint: first[0]!.fingerprint,
      evidenceIdentity: byLocator["wash ambush"]!.evidence_identity,
      action: "needs_fix",
      manuscriptId: PIN.manuscriptId,
      manuscriptVersionId: PIN.manuscriptVersionId,
    });
    recordPassageReviewDecision({
      store,
      passageKey: byLocator["Chapter 24, container stack"]!.passage_key,
      clusterFingerprint: first[0]!.fingerprint,
      evidenceIdentity: byLocator["Chapter 24, container stack"]!.evidence_identity,
      action: "not_an_issue",
      manuscriptId: PIN.manuscriptId,
      manuscriptVersionId: PIN.manuscriptVersionId,
    });
    const later = collectPhase1ReviewCandidates({
      observations: [courtyard, wash, armLater, clinic],
      ...PIN,
      decisions: store,
    });
    const model = presentReviewRecommendedModel({
      manuscriptId: PIN.manuscriptId,
      manuscriptVersionId: PIN.manuscriptVersionId,
      candidates: later,
    });
    assert.equal(model.cards.length, 1);
    const states = Object.fromEntries(later[0]!.evidence.map((row) => [row.locator, row.review_state]));
    assert.equal(states["Prologue, courtyard"], "needs_fix");
    assert.equal(states["wash ambush"], "needs_fix");
    assert.equal(states["Chapter 24, container stack"], "not_an_issue");
    assert.equal(states["Chapter 12, clinic"], "pending");
    assert.equal(later[0]?.status_summary, "2 need attention · 1 not an issue · 1 awaiting review");
    assert.equal(later[0]?.status_counts.needs_fix, 2);
    assert.equal(later[0]?.status_counts.not_an_issue, 1);
    assert.equal(later[0]?.status_counts.pending, 1);
    assert.equal(later[0]?.engine_eligibility, "insufficient_semantic_specificity");
    const { diagnosis } = diagnoseNamespacedPair(courtyard, wash);
    assert.equal(diagnosis.eligibility, "insufficient_semantic_specificity");
    assert.equal(diagnosis.reason, "unspecified_laterality");
  });

  it("summarizes a three-passage cluster as two needing attention and one not an issue", () => {
    const store = createMemoryReviewDecisionStore();
    const first = collectPhase1ReviewCandidates({
      observations: [courtyard, wash, armLater],
      ...PIN,
      decisions: store,
    });
    const byLocator = Object.fromEntries(first[0]!.evidence.map((row) => [row.locator, row]));
    recordPassageReviewDecision({
      store,
      passageKey: byLocator["Prologue, courtyard"]!.passage_key,
      clusterFingerprint: first[0]!.fingerprint,
      evidenceIdentity: byLocator["Prologue, courtyard"]!.evidence_identity,
      action: "needs_fix",
      manuscriptId: PIN.manuscriptId,
      manuscriptVersionId: PIN.manuscriptVersionId,
    });
    recordPassageReviewDecision({
      store,
      passageKey: byLocator["wash ambush"]!.passage_key,
      clusterFingerprint: first[0]!.fingerprint,
      evidenceIdentity: byLocator["wash ambush"]!.evidence_identity,
      action: "needs_fix",
      manuscriptId: PIN.manuscriptId,
      manuscriptVersionId: PIN.manuscriptVersionId,
    });
    recordPassageReviewDecision({
      store,
      passageKey: byLocator["Chapter 24, container stack"]!.passage_key,
      clusterFingerprint: first[0]!.fingerprint,
      evidenceIdentity: byLocator["Chapter 24, container stack"]!.evidence_identity,
      action: "not_an_issue",
      manuscriptId: PIN.manuscriptId,
      manuscriptVersionId: PIN.manuscriptVersionId,
    });
    const later = collectPhase1ReviewCandidates({
      observations: [courtyard, wash, armLater],
      ...PIN,
      decisions: store,
    });
    assert.equal(later[0]?.status_summary, "2 need attention · 1 not an issue");
    assert.equal(later[0]?.status_counts.needs_fix, 2);
    assert.equal(later[0]?.status_counts.not_an_issue, 1);
    assert.equal(later[0]?.status_counts.pending, 0);
  });

  it("does not dismiss the cluster when one passage is not an issue", () => {
    const store = createMemoryReviewDecisionStore();
    const first = collectPhase1ReviewCandidates({
      observations: [courtyard, wash, armLater],
      ...PIN,
      decisions: store,
    });
    const stack = first[0]!.evidence.find((row) => row.locator === "Chapter 24, container stack")!;
    recordPassageReviewDecision({
      store,
      passageKey: stack.passage_key,
      clusterFingerprint: first[0]!.fingerprint,
      evidenceIdentity: stack.evidence_identity,
      action: "not_an_issue",
      manuscriptId: PIN.manuscriptId,
      manuscriptVersionId: PIN.manuscriptVersionId,
    });
    const later = collectPhase1ReviewCandidates({
      observations: [courtyard, wash, armLater],
      ...PIN,
      decisions: store,
    });
    assert.equal(later.length, 1);
    assert.equal(later[0]?.evidence.filter((row) => row.review_state === "pending").length, 2);
    assert.equal(later[0]?.evidence.filter((row) => row.review_state === "not_an_issue").length, 1);
  });

  it("does not mark other passages when one passage needs a fix", () => {
    const store = createMemoryReviewDecisionStore();
    const first = collectPhase1ReviewCandidates({
      observations: [courtyard, wash, armLater],
      ...PIN,
      decisions: store,
    });
    const prologue = first[0]!.evidence.find((row) => row.locator === "Prologue, courtyard")!;
    recordPassageReviewDecision({
      store,
      passageKey: prologue.passage_key,
      clusterFingerprint: first[0]!.fingerprint,
      evidenceIdentity: prologue.evidence_identity,
      action: "needs_fix",
      manuscriptId: PIN.manuscriptId,
      manuscriptVersionId: PIN.manuscriptVersionId,
    });
    const later = collectPhase1ReviewCandidates({
      observations: [courtyard, wash, armLater],
      ...PIN,
      decisions: store,
    });
    const states = Object.fromEntries(later[0]!.evidence.map((row) => [row.locator, row.review_state]));
    assert.equal(states["Prologue, courtyard"], "needs_fix");
    assert.equal(states["wash ambush"], "pending");
    assert.equal(states["Chapter 24, container stack"], "pending");
  });

  it("retains a passage decision on a later run of unchanged evidence", () => {
    const store = createMemoryReviewDecisionStore();
    const first = collectPhase1ReviewCandidates({
      observations: [courtyard, wash],
      ...PIN,
      decisions: store,
    });
    const prologue = first[0]!.evidence.find((row) => row.locator === "Prologue, courtyard")!;
    recordPassageReviewDecision({
      store,
      passageKey: prologue.passage_key,
      clusterFingerprint: first[0]!.fingerprint,
      evidenceIdentity: prologue.evidence_identity,
      action: "needs_fix",
      manuscriptId: PIN.manuscriptId,
      manuscriptVersionId: PIN.manuscriptVersionId,
    });
    const later = collectPhase1ReviewCandidates({
      observations: [courtyard, wash],
      ...PIN,
      decisions: store,
    });
    assert.equal(later[0]?.evidence.find((row) => row.locator === "Prologue, courtyard")?.review_state, "needs_fix");
    assert.equal(later[0]?.evidence.find((row) => row.locator === "wash ambush")?.review_state, "pending");
    assert.equal(later[0]?.fingerprint, first[0]?.fingerprint);
  });

  it("requires a new review after the excerpt hash changes", () => {
    const store = createMemoryReviewDecisionStore();
    const original = collectPhase1ReviewCandidates({
      observations: [courtyard, wash],
      ...PIN,
      decisions: store,
    });
    const washRow = original[0]!.evidence.find((row) => row.locator === "wash ambush")!;
    recordPassageReviewDecision({
      store,
      passageKey: washRow.passage_key,
      clusterFingerprint: original[0]!.fingerprint,
      evidenceIdentity: washRow.evidence_identity,
      action: "not_an_issue",
      manuscriptId: PIN.manuscriptId,
      manuscriptVersionId: PIN.manuscriptVersionId,
    });
    const edited = injury("o7-edited", {
      entity: "Cole",
      region: "upper arm",
      laterality: "left",
      condition: "graze",
      locator: "wash ambush",
      excerpt: "A completely different verified wash-ambush sentence about the graze",
      segment: "seg-07-chapter-14-chapter-14",
    });
    assert.notEqual(evidenceIdentity(wash), evidenceIdentity(edited));
    const reopened = collectPhase1ReviewCandidates({
      observations: [courtyard, edited],
      ...PIN,
      decisions: store,
    });
    const model = presentReviewRecommendedModel({
      manuscriptId: PIN.manuscriptId,
      manuscriptVersionId: PIN.manuscriptVersionId,
      candidates: reopened,
    });
    assert.equal(model.cards.length, 1);
    assert.equal(reopened[0]?.evidence.find((row) => row.locator === "wash ambush")?.review_state, "pending");
  });

  it("derives cluster summaries from passage decisions", () => {
    assert.equal(summarizeClusterReviewStatus(["needs_fix", "needs_fix", "not_an_issue"]), "2 need attention · 1 not an issue");
    assert.equal(summarizeClusterReviewStatus(["not_an_issue", "not_an_issue", "not_an_issue"]), "3 reviewed · no fixes needed");
    assert.equal(summarizeClusterReviewStatus(["needs_fix", "pending", "pending"]), "1 needs attention · 2 awaiting review");
  });

  it("does not write accepted canon or Series Bible from either action", () => {
    const store = createMemoryReviewDecisionStore();
    const cards = collectPhase1ReviewCandidates({
      observations: [courtyard, wash],
      ...PIN,
    });
    const passage = cards[0]!.evidence[0]!;
    for (const action of ["not_an_issue", "needs_fix"] as const) {
      const decision = recordPassageReviewDecision({
        store,
        passageKey: `${passage.passage_key}-${action}`,
        clusterFingerprint: cards[0]!.fingerprint,
        evidenceIdentity: passage.evidence_identity,
        action,
        manuscriptId: PIN.manuscriptId,
        manuscriptVersionId: PIN.manuscriptVersionId,
      });
      assert.equal(decision.accepted_canon, false);
      assert.equal(decision.series_bible, false);
    }
  });

  it("leaves confirmed / possible / AVN comparable behavior unchanged", () => {
    const left = injury("left-arm", {
      entity: "Cole",
      region: "upper arm",
      laterality: "left",
      condition: "graze",
      locator: "wash ambush",
      excerpt: "A graze burned along Cole's left upper arm",
    });
    const right = injury("left-arm-2", {
      entity: "Cole",
      region: "upper arm",
      laterality: "left",
      condition: "gunshot wound",
      locator: "Chapter 24, container stack",
      excerpt: "The old gunshot wound in Cole's left upper arm ached",
    });
    const diagnosis = diagnoseV2ObservationPair(left, right);
    assert.equal(diagnosis.eligibility, "comparable");
    assert.equal(diagnosis.reason, "competing_injury_state");
    const finding = classifyRehearsalFinding(diagnosis, left, right);
    assert.equal(finding?.classification, "author_verification_needed");
    assert.equal(isPhase1ReviewEligiblePair(left, right, diagnosis), false);
  });

  it("does not change comparison.ts laterality fail-closed source", () => {
    const source = readFileSync(join(ROOT, "experts/archivist/segmented/observation-v2/comparison.ts"), "utf8");
    assert.match(source, /Unspecified laterality cannot become left or right/);
    assert.match(source, /if \(leftSide === "unspecified" \|\| rightSide === "unspecified"\)/);
  });

  it("keeps a stable fingerprint across observation-id changes", () => {
    const first = collectPhase1ReviewCandidates({
      observations: [courtyard, wash],
      ...PIN,
    });
    const renamed = injury("different-id", {
      entity: "Cole",
      region: "upper arm",
      laterality: "left",
      condition: "graze",
      locator: "wash ambush",
      excerpt: "A graze burned along Cole's left upper arm",
      segment: "seg-07-chapter-14-chapter-14",
    });
    const second = collectPhase1ReviewCandidates({
      observations: [courtyard, renamed],
      ...PIN,
    });
    assert.equal(first[0]?.fingerprint, second[0]?.fingerprint);
    assert.equal(
      reviewFingerprint({
        manuscriptId: PIN.manuscriptId,
        manuscriptVersionId: PIN.manuscriptVersionId,
        domain: "injury_state",
        reason: "unspecified_laterality",
        entityKey: "cole",
        topicKey: "upper arm",
        evidenceIdentities: first[0]!.evidence.map((row) => row.evidence_identity),
      }),
      first[0]?.fingerprint,
    );
  });

  it("replays saved da1cb4fb observations at $0 into two review cards", () => {
    const replay = replaySavedDa1cb4fbReviewRecommended({ root: ROOT });
    if (!replay.ok) {
      assert.equal(replay.reason, "missing");
      return;
    }
    assert.equal(replay.review_recommended_cards, 2);
    const topics = replay.candidates.map((row) => `${row.entity_key}|${row.topic_key}`).sort();
    assert.deepEqual(topics, ["cole|chest", "cole|upper arm"]);
    assert.equal(
      replay.candidates.some((row) => row.topic_key === "knee"),
      false,
    );
    assert.equal(replay.as_comparable, 4);
    assert.equal(replay.am_object_chains, 2);
    assert.equal(replay.official_report.present, true);
    assert.equal(replay.official_report.as_comparable, 4);
    assert.equal(replay.official_report.am_object_chains, 0);
    const arm = replay.candidates.find((row) => row.topic_key === "upper arm");
    const chest = replay.candidates.find((row) => row.topic_key === "chest");
    assert.equal(arm?.evidence.length, 3);
    assert.deepEqual(
      arm?.evidence.map((row) => row.locator),
      ["Prologue, courtyard", "wash ambush", "Chapter 24, container stack"],
    );
    assert.equal(chest?.evidence.length, 3);
    assert.equal(arm?.evidence.every((row) => row.review_state === "pending"), true);
  });
});
