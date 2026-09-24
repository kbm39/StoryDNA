/**
 * Sanitized model shapes from archivist-cert-20260924-v2.
 * Not raw provider dumps. Official v2 score remains 12/15 FAIL.
 */

export const ARCHIVIST_V2_INJURY_MANUSCRIPT = [
  "Chapter 11. The wound on Mara's left shoulder had closed.",
  "Chapter 11. The medic wrapped Mara's right shoulder.",
].join("\n");

export const ARCHIVIST_V2_OBJECT_MANUSCRIPT = [
  "Chapter 7. The silver compass sat in Mara's coat pocket.",
  "Chapter 7. Calder spun the silver compass on the chart table.",
].join("\n");

export const ARCHIVIST_V2_RELATIONSHIP_MANUSCRIPT =
  "Chapter 6. Mara had never met Calder before tonight.";

export const ARCHIVIST_V2_INJURY_PAYLOAD = {
  summary: { narrative: "Chapter 11 laterality conflict." },
  findings: [
    {
      id: "finding_001_mara_shoulder_laterality",
      issue_type: "injury",
      classification: "confirmed_contradiction",
      severity: "major",
      confidence: "high",
      current_location: { locator: "Chapter 11, sentence 1", chapter: "11" },
      conflicting_location: { locator: "Chapter 11, sentence 2", chapter: "11" },
      current_evidence: [
        {
          excerpt: "The wound on Mara's left shoulder had closed.",
          locator: "Chapter 11, sentence 1",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      conflicting_evidence: [
        {
          excerpt: "The medic wrapped Mara's right shoulder.",
          locator: "Chapter 11, sentence 2",
          evidence_role: "conflicting_canon",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      temporal_analysis: {
        relation: "same_time",
        explanation:
          "Both observations occur in Chapter 11, consecutive sentences, with no intervening narrative that establishes passage of time or introduces a second injury.",
        current_scope: { kind: "at" },
        conflicting_scope: { kind: "at" },
      },
      explanation:
        "Without evidence of a second injury, these statements describe the same anatomical region with contradictory laterality. Laterality changes require explicit justification (e.g., 'a second wound on the right side').",
      suggested_resolution: "If two wounds, add narrative language that explicitly introduces the second injury.",
    },
  ],
  canon_delta: [
    {
      id: "delta-mara-injury",
      entity: { alias: "Mara", entity_type: "person" },
      fact_type: "injury",
      proposed_fact_value: { laterality: "left" },
      temporal_scope: { kind: "at" },
      source_location: { locator: "Chapter 11" },
      evidence: [
        {
          excerpt: "The wound on Mara's left shoulder had closed.",
          locator: "Chapter 11",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      confidence: "high",
      proposed_authority: "current_observation",
      status: "candidate",
    },
  ],
  entity_ambiguities: [],
} as const;

export const ARCHIVIST_V2_OBJECT_PAYLOAD = {
  summary: { narrative: "Unique compass in two places." },
  findings: [
    {
      id: "obj_poss_001",
      issue_type: "possession",
      classification: "possible_continuity_conflict",
      severity: "major",
      confidence: "high",
      current_location: { locator: "Chapter 7, sentence 1", chapter: "7" },
      conflicting_location: { locator: "Chapter 7, sentence 2", chapter: "7" },
      current_evidence: [
        {
          excerpt: "The silver compass sat in Mara's coat pocket.",
          locator: "Chapter 7, sentence 1",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      conflicting_evidence: [
        {
          excerpt: "Calder spun the silver compass on the chart table.",
          locator: "Chapter 7, sentence 2",
          evidence_role: "conflicting_canon",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      temporal_analysis: {
        relation: "same_time",
        explanation:
          "Both observations occur in Chapter 7 with no intervening scene break, dialogue, or action establishing passage of time or object transfer.",
        current_scope: { kind: "at" },
        conflicting_scope: { kind: "at" },
      },
      explanation:
        "No transition narrative (theft, borrowing, handoff, retrieval) is provided to explain how Calder gained possession or when Mara lost it.",
      suggested_resolution: "Verify whether these observations are the same scene moment.",
    },
  ],
  canon_delta: [
    {
      id: "cd_compass_mara",
      entity: { alias: "silver compass", entity_type: "object" },
      fact_type: "possession",
      proposed_fact_value: { possessor: "Mara" },
      temporal_scope: { kind: "at" },
      source_location: { locator: "Chapter 7, sentence 1" },
      evidence: [
        {
          excerpt: "The silver compass sat in Mara's coat pocket.",
          locator: "Chapter 7, sentence 1",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      confidence: "high",
      proposed_authority: "current_observation",
      status: "candidate",
    },
  ],
  entity_ambiguities: [],
} as const;

export const ARCHIVIST_V2_RELATIONSHIP_PAYLOAD = {
  summary: {
    narrative:
      "Manuscript Chapter 6 states Mara had never met Calder before tonight. Accepted prior canon establishes them as former partners.",
  },
  findings: [
    {
      id: "conflict-mara-calder-meeting-history",
      issue_type: "prior_event_reference",
      classification: "confirmed_contradiction",
      severity: "critical",
      confidence: "high",
      current_location: { locator: "Chapter 6", chapter: "6" },
      conflicting_location: { locator: "Book 1, Chapter 12", chapter: "12" },
      current_evidence: [
        {
          excerpt: "Mara had never met Calder before tonight.",
          locator: "ms-archivist-cert-relationship_history, Chapter 6",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      conflicting_evidence: [
        {
          excerpt: "former partners who ran the Harbor cell",
          locator: "Book 1, Chapter 12 (canon-fact-rel-mara-calder)",
          evidence_role: "conflicting_canon",
          verification_status: "located",
          source_kind: "prior_volume_canon",
        },
      ],
      temporal_analysis: {
        relation: "earlier_later",
        explanation: "Book 1 partnership history precedes Book 2 Chapter 6.",
        current_scope: { kind: "at", value: "Book 2, Chapter 6" },
        conflicting_scope: { kind: "from_to", value: "Book 1, Chapters 8–12" },
      },
      explanation:
        "Current manuscript asserts first meeting in Chapter 6. Accepted prior canon documents a Harbor-cell partnership.",
      suggested_resolution: "Clarify the first-meeting claim or the prior partnership.",
    },
  ],
  canon_delta: [
    {
      id: "delta-mara-calder-first-meeting",
      entity: { alias: "Mara", entity_type: "person", canonical_name: "Mara" },
      fact_type: "prior_event_reference",
      proposed_fact_value: { event: "first meeting with Calder" },
      temporal_scope: { kind: "at", value: "Book 2, Chapter 6" },
      source_location: { locator: "ms-archivist-cert-relationship_history, Chapter 6" },
      evidence: [
        {
          excerpt: "Mara had never met Calder before tonight.",
          locator: "Chapter 6",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      confidence: "high",
      proposed_authority: "current_observation",
      status: "candidate",
    },
  ],
  entity_ambiguities: [],
} as const;
