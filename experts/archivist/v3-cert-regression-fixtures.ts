/**
 * Sanitized model shapes from archivist-cert-20260924-v3.
 * Not raw provider dumps. Official v3 score remains 13/15 FAIL.
 */

export const ARCHIVIST_V3_TIMELINE_MANUSCRIPT = [
  "Chapter 9. Two days later they were still in Harbor City.",
  "Chapter 9. That same afternoon they docked in Greyport.",
].join("\n");

export const ARCHIVIST_V3_RELATIONSHIP_MANUSCRIPT =
  "Chapter 6. Mara had never met Calder before tonight.";

export const ARCHIVIST_V3_TIMELINE_PAYLOAD = {
  summary: {
    narrative:
      "Chapter 9 contains a temporal contradiction: they remain in Harbor City two days later, then dock in Greyport that same afternoon.",
  },
  findings: [
    {
      id: "ch9_location_timeline_001",
      issue_type: "chronology",
      classification: "confirmed_contradiction",
      severity: "critical",
      confidence: "high",
      current_location: { locator: "Chapter 9, sentence 1", chapter: "9" },
      conflicting_location: { locator: "Chapter 9, sentence 2", chapter: "9" },
      current_evidence: [
        {
          excerpt: "Two days later they were still in Harbor City.",
          locator: "Chapter 9, sentence 1",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      conflicting_evidence: [
        {
          excerpt: "That same afternoon they docked in Greyport.",
          locator: "Chapter 9, sentence 2",
          evidence_role: "conflicting_canon",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      temporal_analysis: {
        relation: "same_time",
        explanation:
          "Both statements occur within Chapter 9 with no intervening temporal marker that makes both locations compatible.",
        current_scope: { kind: "at", value: "two days after unstated anchor" },
        conflicting_scope: { kind: "at", value: "afternoon of unstated anchor" },
      },
      explanation:
        "The manuscript reports the same party in two incompatible locations and time states within consecutive sentences of the same chapter.",
      suggested_resolution: "Clarify the time anchors or whether both sentences describe the same group.",
    },
  ],
  canon_delta: [
    {
      id: "ch9_location_harbor_city_001",
      entity: { alias: "they", entity_type: "person" },
      fact_type: "location",
      proposed_fact_value: "Harbor City",
      temporal_scope: { kind: "at", value: "two days later" },
      source_location: { locator: "Chapter 9, sentence 1" },
      evidence: [
        {
          excerpt: "Two days later they were still in Harbor City.",
          locator: "Chapter 9, sentence 1",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      confidence: "high",
      proposed_authority: "current_observation",
      status: "candidate",
    },
    {
      id: "ch9_location_greyport_001",
      entity: { alias: "they", entity_type: "person" },
      fact_type: "location",
      proposed_fact_value: "Greyport",
      temporal_scope: { kind: "at", value: "same afternoon" },
      source_location: { locator: "Chapter 9, sentence 2" },
      evidence: [
        {
          excerpt: "That same afternoon they docked in Greyport.",
          locator: "Chapter 9, sentence 2",
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

export const ARCHIVIST_V3_RELATIONSHIP_PAYLOAD = {
  summary: {
    narrative:
      "Manuscript Chapter 6 states Mara had never met Calder before tonight. Accepted prior canon establishes them as former partners.",
  },
  findings: [
    {
      id: "finding-mara-calder-meeting-history",
      issue_type: "prior_event_reference",
      classification: "confirmed_contradiction",
      severity: "critical",
      confidence: "high",
      current_location: { locator: "Chapter 6", chapter: "6" },
      conflicting_location: { locator: "Book 1 Chapter 12", chapter: "12" },
      current_evidence: [
        {
          excerpt: "Mara had never met Calder before tonight.",
          locator: "Chapter 6",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      conflicting_evidence: [
        {
          excerpt: "Mara and Calder: former partners who ran the Harbor cell (Book 1 Chapters 8–12).",
          locator: "Book 1 Chapter 12",
          evidence_role: "conflicting_canon",
          verification_status: "located",
          source_kind: "prior_volume_canon",
        },
      ],
      temporal_analysis: {
        relation: "earlier_later",
        explanation: "Book 1 partnership history precedes Book 2 Chapter 6.",
        current_scope: { kind: "at", book: 2, chapter: 6 },
        conflicting_scope: { kind: "from_to", book: 1, from_chapter: 8, to_chapter: 12 },
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
      entity_type: "person",
      fact_type: "prior_event_reference",
      proposed_fact_value: {
        claim: "Mara had never met Calder before Book 2 Chapter 6",
        counterpart: "Calder",
      },
      temporal_scope: { kind: "at", book: 2, chapter: 6 },
      source_location: { locator: "Chapter 6" },
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
    {
      id: "delta-mara-calder-partnership",
      entity: { alias: "Mara", entity_type: "person", canonical_name: "Mara" },
      entity_type: "person",
      fact_type: "relationship",
      proposed_fact_value: {
        counterpart: "Calder",
        history: "former partners who ran the Harbor cell",
        temporal_scope_book_1: "Chapters 8–12",
      },
      temporal_scope: { kind: "from_to", book: 1, from_chapter: 8, to_chapter: 12 },
      source_location: { locator: "Book 1 Chapter 12" },
      evidence: [
        {
          excerpt: "Mara and Calder: former partners who ran the Harbor cell.",
          locator: "Book 1 Chapter 12",
          evidence_role: "conflicting_canon",
          verification_status: "located",
          source_kind: "prior_volume_canon",
        },
      ],
      confidence: "high",
      proposed_authority: "prior_volume_canon",
      status: "candidate",
    },
  ],
  entity_ambiguities: [],
} as const;
