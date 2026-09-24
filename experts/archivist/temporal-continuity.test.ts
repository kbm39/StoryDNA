import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyFactPersistence } from "./fact-persistence.ts";
import {
  evaluateContinuityCompatibility,
  inferObservationTemporalRelation,
  mapArchivistTemporalRelation,
} from "./temporal-continuity.ts";
import type { ArchivistFinding } from "./contracts.ts";

function finding(overrides: Partial<ArchivistFinding>): ArchivistFinding {
  return {
    id: "f1",
    issue_type: "appearance",
    classification: "confirmed_contradiction",
    severity: "major",
    confidence: "high",
    current_location: { locator: "Chapter 3", chapter: "3" },
    conflicting_location: { locator: "Chapter 22", chapter: "22" },
    current_evidence: [
      {
        excerpt: "Mara had blue eyes that caught the lantern light.",
        locator: "Chapter 3",
        evidence_role: "current_observation",
        verification_status: "located",
        source_kind: "manuscript",
      },
    ],
    conflicting_evidence: [
      {
        excerpt: "Mara's green eyes narrowed at the map.",
        locator: "Chapter 22",
        evidence_role: "conflicting_canon",
        verification_status: "located",
        source_kind: "manuscript",
      },
    ],
    temporal_analysis: {
      relation: "earlier_later",
      explanation: "Different chapters.",
      current_scope: { kind: "at", chapter: "3" },
      conflicting_scope: { kind: "at", chapter: "22" },
    },
    explanation: "Blue then green with no change.",
    suggested_resolution: "Confirm eye color.",
    author_action: "pending",
    author_challenge_supported: true,
    ...overrides,
  };
}

describe("Archivist temporal relation and persistence", () => {
  it("maps legacy disjoint to earlier_later instead of blocking confirmation", () => {
    assert.equal(mapArchivistTemporalRelation("disjoint"), "earlier_later");
    assert.equal(mapArchivistTemporalRelation("identical"), "same_time");
    assert.equal(mapArchivistTemporalRelation("overlap"), "overlapping");
  });

  it("treats different chapters as earlier_later", () => {
    assert.equal(inferObservationTemporalRelation(finding({
      temporal_analysis: {
        relation: "unknown",
        explanation: "model omitted time",
        current_scope: { kind: "at", chapter: "3" },
        conflicting_scope: { kind: "at", chapter: "22" },
      },
    })), "earlier_later");
  });

  it("keeps blue/green without transition as incompatible", () => {
    const compatibility = evaluateContinuityCompatibility(finding({}));
    assert.equal(compatibility, "incompatible");
    assert.equal(classifyFactPersistence({ factType: "appearance", textHints: "blue eyes green eyes" }), "persistent");
  });

  it("treats an explained dye change as compatible", () => {
    const compatibility = evaluateContinuityCompatibility(finding({
      classification: "possible_continuity_conflict",
      conflicting_evidence: [
        {
          excerpt: "After the dye, Mara's green eyes suited the cover identity.",
          locator: "Chapter 22",
          evidence_role: "conflicting_canon",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      explanation: "Later green eyes follow an intentional dye.",
    }));
    assert.equal(compatibility, "compatible_change");
  });

  it("treats same-time left/right injury laterality as incompatible", () => {
    const compatibility = evaluateContinuityCompatibility(finding({
      issue_type: "injury",
      current_location: { locator: "Chapter 11", chapter: "11" },
      conflicting_location: { locator: "Chapter 11", chapter: "11" },
      current_evidence: [
        {
          excerpt: "The wound on Mara's left shoulder had closed.",
          locator: "Chapter 11",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      conflicting_evidence: [
        {
          excerpt: "The medic wrapped Mara's right shoulder.",
          locator: "Chapter 11",
          evidence_role: "conflicting_canon",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      temporal_analysis: {
        relation: "same_time",
        explanation: "No evidence indicates the wound healed and relocated.",
        current_scope: { kind: "at", chapter: "11" },
        conflicting_scope: { kind: "at", chapter: "11" },
      },
    }));
    assert.equal(compatibility, "incompatible");
  });

  it("treats alive then died as a compatible changeable fact", () => {
    const compatibility = evaluateContinuityCompatibility(finding({
      issue_type: "alive_status",
      current_evidence: [
        {
          excerpt: "Mara kept watch at the door.",
          locator: "Chapter 3",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      conflicting_evidence: [
        {
          excerpt: "Mara died in the stairwell after the shot.",
          locator: "Chapter 5",
          evidence_role: "conflicting_canon",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      explanation: "She is alive earlier and dies later.",
    }));
    assert.equal(compatibility, "compatible_change");
    assert.equal(classifyFactPersistence({ factType: "alive_status" }), "stateful_changeable");
  });
});
