/**
 * Deterministic Archivist certification fixtures — synthetic, no live generation.
 */

import {
  ARCHIVIST_EXPERT_KEY,
  ARCHIVIST_REVIEW_SCHEMA,
  ARCHIVIST_VERSION,
  type ArchivistCanonDelta,
  type ArchivistEvidenceRecord,
  type ArchivistFinding,
  type ArchivistReview,
} from "./contracts.ts";
import { ARCHIVIST_NORMALIZATION_VERSION, ARCHIVIST_PROMPT_VERSION, ARCHIVIST_VALIDATOR_VERSION } from "./runtime-definition.ts";

export const FIXTURE_MANUSCRIPT_ID = "ms-archivist-fixture";
export const FIXTURE_MANUSCRIPT_VERSION_ID = "mv-archivist-fixture";
export const FIXTURE_CONTENT_HASH =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const FIXTURE_SERIES_ID = "series-archivist-fixture";

export const FIXTURE_MANUSCRIPT_WITHIN_BOOK = [
  "Chapter 2. Mara whispered the courier password at the gate.",
  "Chapter 3. Mara had blue eyes that caught the lantern light.",
  "Chapter 4. Mara learned the courier password at dusk.",
  "Chapter 5. Mara died in the stairwell after the shot.",
  "Chapter 7. The silver compass sat in Mara's coat pocket.",
  "Chapter 7. Calder spun the silver compass on the chart table.",
  "Chapter 9. Two days later they were still in Harbor City.",
  "Chapter 9. That same afternoon they docked in Greyport.",
  "Chapter 11. The wound on Mara's left shoulder had closed.",
  "Chapter 11. The medic wrapped Mara's right shoulder.",
  "Chapter 22. Mara's green eyes narrowed at the map.",
  "Chapter 22. After the dye, Mara's green eyes suited the cover identity.",
].join("\n");

export interface ArchivistCertificationFixture {
  id: string;
  title: string;
  safety: boolean;
  manuscript_text?: string;
  review: ArchivistReview;
  expect: {
    validation_ok: boolean;
    confirmed_count: number;
    entity_ambiguity_count?: number;
    canon_delta_accepted?: number;
  };
}

function located(
  excerpt: string,
  locator: string,
  role: ArchivistEvidenceRecord["evidence_role"],
  source: ArchivistEvidenceRecord["source_kind"] = "manuscript",
  canonFactId?: string,
): ArchivistEvidenceRecord {
  return {
    excerpt,
    locator,
    evidence_role: role,
    verification_status: "located",
    source_kind: source,
    manuscript_id: FIXTURE_MANUSCRIPT_ID,
    manuscript_version_id: FIXTURE_MANUSCRIPT_VERSION_ID,
    content_hash: FIXTURE_CONTENT_HASH,
    canon_fact_id: canonFactId,
  };
}

function metricsFor(review: Omit<ArchivistReview, "metrics" | "summary"> & {
  summary?: ArchivistReview["summary"];
}): Pick<ArchivistReview, "metrics" | "summary"> {
  const confirmed = review.findings.filter((item) => item.classification === "confirmed_contradiction");
  const possible = review.findings.filter((item) => item.classification === "possible_continuity_conflict");
  const verification = review.findings.filter((item) => item.classification === "author_verification_needed");
  const evidence_record_count =
    review.findings.reduce(
      (sum, finding) =>
        sum + finding.current_evidence.length + finding.conflicting_evidence.length,
      0,
    ) +
    review.canon_delta.reduce((sum, delta) => sum + delta.evidence.length, 0) +
    review.entity_ambiguities.reduce(
      (sum, item) =>
        sum + item.candidate_entities.reduce((inner, candidate) => inner + candidate.evidence.length, 0),
      0,
    );
  return {
    summary: {
      confirmed_contradiction_count: confirmed.length,
      possible_conflict_count: possible.length,
      author_verification_count: verification.length,
      narrative: review.summary?.narrative ?? "Synthetic Archivist fixture.",
    },
    metrics: {
      finding_count: review.findings.length,
      confirmed_contradiction_count: confirmed.length,
      possible_conflict_count: possible.length,
      author_verification_count: verification.length,
      canon_delta_count: review.canon_delta.length,
      entity_ambiguity_count: review.entity_ambiguities.length,
      evidence_record_count,
    },
  };
}

function baseReview(
  overrides: Partial<ArchivistReview> & Pick<ArchivistReview, "findings" | "canon_delta" | "entity_ambiguities">,
): ArchivistReview {
  const core = {
    schema: ARCHIVIST_REVIEW_SCHEMA,
    expert_key: ARCHIVIST_EXPERT_KEY,
    expert_version: ARCHIVIST_VERSION,
    manuscript_id: FIXTURE_MANUSCRIPT_ID,
    manuscript_version_id: FIXTURE_MANUSCRIPT_VERSION_ID,
    content_hash: FIXTURE_CONTENT_HASH,
    series_id: overrides.series_id,
    findings: overrides.findings,
    canon_delta: overrides.canon_delta,
    entity_ambiguities: overrides.entity_ambiguities,
    generation: {
      provider: "none" as const,
      model: "none" as const,
      prompt_version: ARCHIVIST_PROMPT_VERSION,
      validator_version: ARCHIVIST_VALIDATOR_VERSION,
      normalization_version: ARCHIVIST_NORMALIZATION_VERSION,
      definition_hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    },
    author_challenge_supported: true as const,
    summary: overrides.summary,
  };
  const derived = metricsFor(core);
  return {
    ...core,
    ...derived,
    ...overrides,
    summary: overrides.summary ?? derived.summary,
    metrics: overrides.metrics ?? derived.metrics,
    generation: overrides.generation ?? core.generation,
  };
}

function finding(overrides: Partial<ArchivistFinding> & Pick<ArchivistFinding, "id" | "issue_type">): ArchivistFinding {
  return {
    classification: "confirmed_contradiction",
    severity: "major",
    confidence: "high",
    current_location: { locator: "Chapter 3", chapter: "3" },
    current_evidence: [],
    conflicting_evidence: [],
    temporal_analysis: {
      relation: "identical",
      explanation: "Same narrative present.",
      current_scope: { kind: "at", book_order: 1, chapter: "3" },
      conflicting_scope: { kind: "at", book_order: 1, chapter: "22" },
    },
    explanation: "Synthetic continuity finding.",
    suggested_resolution: "Align the later passage with the earlier established fact, or mark an intentional change.",
    author_action: "pending",
    author_challenge_supported: true,
    ...overrides,
  };
}

function candidateDelta(overrides: Partial<ArchivistCanonDelta>): ArchivistCanonDelta {
  return {
    id: "delta-1",
    entity: {
      resolution: "resolved",
      alias: "Mara",
      entity_type: "person",
      entity_id: "entity-mara",
      canonical_name: "Mara Quinn",
    },
    entity_type: "person",
    fact_type: "appearance",
    proposed_fact_value: { eye_color: "blue" },
    temporal_scope: { kind: "at", book_order: 1, chapter: "3" },
    source_location: { locator: "Chapter 3", chapter: "3" },
    evidence: [
      located("Mara had blue eyes that caught the lantern light.", "Chapter 3", "current_observation"),
    ],
    confidence: "high",
    proposed_authority: "current_observation",
    status: "candidate",
    inferred: false,
    created_by: "extraction",
    ...overrides,
  };
}

export const FIXTURE_01_WITHIN_BOOK_EXACT: ArchivistCertificationFixture = {
  id: "within_book_exact_contradiction",
  title: "Within-book exact contradiction",
  safety: true,
  manuscript_text: FIXTURE_MANUSCRIPT_WITHIN_BOOK,
  expect: { validation_ok: true, confirmed_count: 1 },
  review: baseReview({
    findings: [
      finding({
        id: "f-eye-color",
        issue_type: "appearance",
        explanation: "Mara's eye color is blue in chapter 3 and green in chapter 22 at the same temporal state.",
        current_evidence: [
          located("Mara had blue eyes that caught the lantern light.", "Chapter 3", "current_observation"),
        ],
        conflicting_source: "manuscript",
        conflicting_location: { locator: "Chapter 22", chapter: "22" },
        conflicting_evidence: [
          located("Mara's green eyes narrowed at the map.", "Chapter 22", "conflicting_canon"),
        ],
        temporal_analysis: {
          relation: "identical",
          explanation: "Both passages describe Mara in the present with no intervening change.",
          current_scope: { kind: "at", book_order: 1, chapter: "3", narrative_time: "present" },
          conflicting_scope: { kind: "at", book_order: 1, chapter: "22", narrative_time: "present" },
        },
      }),
    ],
    canon_delta: [
      candidateDelta({ proposed_fact_value: { eye_color: "blue" } }),
      candidateDelta({
        id: "delta-2",
        proposed_fact_value: { eye_color: "green" },
        temporal_scope: { kind: "at", book_order: 1, chapter: "22" },
        source_location: { locator: "Chapter 22", chapter: "22" },
        evidence: [located("Mara's green eyes narrowed at the map.", "Chapter 22", "current_observation")],
      }),
    ],
    entity_ambiguities: [],
    summary: {
      confirmed_contradiction_count: 1,
      possible_conflict_count: 0,
      author_verification_count: 0,
      narrative: "One confirmed appearance contradiction.",
    },
  }),
};

export const FIXTURE_02_EXPLAINED_APPEARANCE: ArchivistCertificationFixture = {
  id: "explained_apparent_conflict",
  title: "Explained apparent conflict",
  safety: true,
  manuscript_text: FIXTURE_MANUSCRIPT_WITHIN_BOOK,
  expect: { validation_ok: true, confirmed_count: 0 },
  review: baseReview({
    findings: [
      finding({
        id: "f-dye-job",
        issue_type: "appearance",
        classification: "possible_continuity_conflict",
        severity: "minor",
        confidence: "medium",
        explanation: "Eye color changes after an intentional dye for a cover identity.",
        current_evidence: [
          located("Mara had blue eyes that caught the lantern light.", "Chapter 3", "current_observation"),
        ],
        conflicting_source: "manuscript",
        conflicting_location: { locator: "Chapter 22", chapter: "22" },
        conflicting_evidence: [
          located(
            "After the dye, Mara's green eyes suited the cover identity.",
            "Chapter 22",
            "conflicting_canon",
          ),
        ],
        temporal_analysis: {
          relation: "disjoint",
          explanation: "Later appearance is a deliberate disguise, not the same temporal state.",
          current_scope: { kind: "at", book_order: 1, chapter: "3" },
          conflicting_scope: { kind: "at", book_order: 1, chapter: "22" },
        },
      }),
    ],
    canon_delta: [],
    entity_ambiguities: [],
  }),
};

export const FIXTURE_03_SERIES_AGE: ArchivistCertificationFixture = {
  id: "series_age_contradiction",
  title: "Series age contradiction",
  safety: true,
  expect: { validation_ok: true, confirmed_count: 1 },
  review: baseReview({
    series_id: FIXTURE_SERIES_ID,
    findings: [
      finding({
        id: "f-age-drift",
        issue_type: "age",
        explanation: "Current book states Mara is twenty-four; accepted prior-volume canon has her thirty-one in the same year.",
        current_location: { locator: "Book 2 Chapter 1", chapter: "1", book_order: 2 },
        current_evidence: [
          located("Mara was twenty-four that winter.", "Book 2 Chapter 1", "current_observation"),
        ],
        conflicting_source: "prior_volume_canon",
        conflicting_location: { locator: "series_bible:age-mara", book_order: 1 },
        conflicting_canon_fact_id: "canon-fact-age-mara",
        conflicting_canon_status: "accepted",
        conflicting_authority: "prior_volume_canon",
        conflicting_evidence: [
          located(
            "Mara turned thirty-one before the Harbor siege.",
            "Book 1 Chapter 18",
            "conflicting_canon",
            "prior_volume_canon",
            "canon-fact-age-mara",
          ),
        ],
        temporal_analysis: {
          relation: "overlap",
          explanation: "Both ages are claimed for the same calendar year across volumes.",
          current_scope: { kind: "at", book_order: 2, chapter: "1", narrative_time: "winter Y4" },
          conflicting_scope: { kind: "at", book_order: 1, chapter: "18", narrative_time: "winter Y4" },
        },
      }),
    ],
    canon_delta: [
      candidateDelta({
        fact_type: "age",
        proposed_fact_value: { age: 24 },
        temporal_scope: { kind: "at", book_order: 2, chapter: "1" },
        source_location: { locator: "Book 2 Chapter 1", chapter: "1", book_order: 2 },
        evidence: [located("Mara was twenty-four that winter.", "Book 2 Chapter 1", "current_observation")],
      }),
    ],
    entity_ambiguities: [],
  }),
};

export const FIXTURE_04_TIMELINE: ArchivistCertificationFixture = {
  id: "timeline_contradiction",
  title: "Timeline contradiction",
  safety: false,
  manuscript_text: FIXTURE_MANUSCRIPT_WITHIN_BOOK,
  expect: { validation_ok: true, confirmed_count: 1 },
  review: baseReview({
    findings: [
      finding({
        id: "f-travel-time",
        issue_type: "chronology",
        explanation: "They remain in Harbor City two days later, but a later passage places them across the channel the same afternoon.",
        current_location: { locator: "Chapter 9", chapter: "9" },
        current_evidence: [
          located("Two days later they were still in Harbor City.", "Chapter 9", "current_observation"),
        ],
        conflicting_source: "manuscript",
        conflicting_location: { locator: "Chapter 9", chapter: "9" },
        conflicting_evidence: [
          located("That same afternoon they docked in Greyport.", "Chapter 9", "conflicting_canon"),
        ],
        temporal_analysis: {
          relation: "overlap",
          explanation: "Same afternoon cannot be both Harbor City two days later and Greyport.",
          current_scope: { kind: "at", book_order: 1, chapter: "9", narrative_time: "two days later" },
          conflicting_scope: { kind: "at", book_order: 1, chapter: "9", narrative_time: "same afternoon" },
        },
      }),
    ],
    canon_delta: [],
    entity_ambiguities: [],
  }),
};

export const FIXTURE_05_INJURY: ArchivistCertificationFixture = {
  id: "injury_continuity",
  title: "Injury continuity",
  safety: false,
  manuscript_text: FIXTURE_MANUSCRIPT_WITHIN_BOOK,
  expect: { validation_ok: true, confirmed_count: 1 },
  review: baseReview({
    findings: [
      finding({
        id: "f-injury-side",
        issue_type: "injury",
        explanation: "The wound is on the left shoulder, then treated as a right-shoulder injury with no intervening event.",
        current_location: { locator: "Chapter 11", chapter: "11" },
        current_evidence: [
          located("The wound on Mara's left shoulder had closed.", "Chapter 11", "current_observation"),
        ],
        conflicting_source: "manuscript",
        conflicting_location: { locator: "Chapter 11", chapter: "11" },
        conflicting_evidence: [
          located("The medic wrapped Mara's right shoulder.", "Chapter 11", "conflicting_canon"),
        ],
        temporal_analysis: {
          relation: "identical",
          explanation: "Same scene, incompatible injury sides.",
          current_scope: { kind: "at", book_order: 1, chapter: "11" },
          conflicting_scope: { kind: "at", book_order: 1, chapter: "11" },
        },
      }),
    ],
    canon_delta: [],
    entity_ambiguities: [],
  }),
};

export const FIXTURE_06_KNOWLEDGE: ArchivistCertificationFixture = {
  id: "knowledge_state",
  title: "Knowledge-state",
  safety: false,
  manuscript_text: FIXTURE_MANUSCRIPT_WITHIN_BOOK,
  expect: { validation_ok: true, confirmed_count: 1 },
  review: baseReview({
    findings: [
      finding({
        id: "f-password",
        issue_type: "knowledge_state",
        explanation: "Mara uses the courier password before the scene in which she learns it.",
        current_location: { locator: "Chapter 2", chapter: "2" },
        current_evidence: [
          located("Mara whispered the courier password at the gate.", "Chapter 2", "current_observation"),
        ],
        conflicting_source: "manuscript",
        conflicting_location: { locator: "Chapter 4", chapter: "4" },
        conflicting_evidence: [
          located("Mara learned the courier password at dusk.", "Chapter 4", "conflicting_canon"),
        ],
        temporal_analysis: {
          relation: "overlap",
          explanation: "Knowledge is used before the acquisition scene.",
          current_scope: { kind: "at", book_order: 1, chapter: "2" },
          conflicting_scope: { kind: "at", book_order: 1, chapter: "4" },
        },
      }),
    ],
    canon_delta: [],
    entity_ambiguities: [],
  }),
};

export const FIXTURE_07_RELATIONSHIP: ArchivistCertificationFixture = {
  id: "relationship_history",
  title: "Relationship history",
  safety: false,
  expect: { validation_ok: true, confirmed_count: 1 },
  review: baseReview({
    series_id: FIXTURE_SERIES_ID,
    findings: [
      finding({
        id: "f-relationship",
        issue_type: "relationship",
        explanation: "Current book says Mara never met Calder; accepted prior history records them as former partners.",
        current_evidence: [
          located("Mara had never met Calder before tonight.", "Chapter 6", "current_observation"),
        ],
        conflicting_source: "prior_volume_canon",
        conflicting_location: { locator: "Book 1 Chapter 12", chapter: "12", book_order: 1 },
        conflicting_canon_fact_id: "canon-fact-rel-mara-calder",
        conflicting_canon_status: "accepted",
        conflicting_authority: "prior_volume_canon",
        conflicting_evidence: [
          located(
            "Mara and Calder ran the Harbor cell together.",
            "Book 1 Chapter 12",
            "conflicting_canon",
            "prior_volume_canon",
            "canon-fact-rel-mara-calder",
          ),
        ],
        temporal_analysis: {
          relation: "overlap",
          explanation: "Prior accepted partnership conflicts with a never-met claim.",
          current_scope: { kind: "at", book_order: 2, chapter: "6" },
          conflicting_scope: { kind: "from_to", book_order: 1, from: "8", to: "12" },
        },
      }),
    ],
    canon_delta: [],
    entity_ambiguities: [],
  }),
};

export const FIXTURE_08_OBJECT: ArchivistCertificationFixture = {
  id: "object_possession",
  title: "Object possession",
  safety: false,
  manuscript_text: FIXTURE_MANUSCRIPT_WITHIN_BOOK,
  expect: { validation_ok: true, confirmed_count: 1 },
  review: baseReview({
    findings: [
      finding({
        id: "f-compass",
        issue_type: "possession",
        explanation: "The unique silver compass is in Mara's pocket and simultaneously on Calder's chart table.",
        current_location: { locator: "Chapter 7", chapter: "7" },
        current_evidence: [
          located("The silver compass sat in Mara's coat pocket.", "Chapter 7", "current_observation"),
        ],
        conflicting_source: "manuscript",
        conflicting_location: { locator: "Chapter 7", chapter: "7" },
        conflicting_evidence: [
          located("Calder spun the silver compass on the chart table.", "Chapter 7", "conflicting_canon"),
        ],
        temporal_analysis: {
          relation: "identical",
          explanation: "Same unique object, same moment, two locations.",
          current_scope: { kind: "at", book_order: 1, chapter: "7" },
          conflicting_scope: { kind: "at", book_order: 1, chapter: "7" },
        },
      }),
    ],
    canon_delta: [],
    entity_ambiguities: [],
  }),
};

export const FIXTURE_09_ALIVE_DEAD: ArchivistCertificationFixture = {
  id: "alive_dead_temporal_control",
  title: "Alive/dead temporal control",
  safety: true,
  manuscript_text: FIXTURE_MANUSCRIPT_WITHIN_BOOK,
  expect: { validation_ok: true, confirmed_count: 0 },
  review: baseReview({
    findings: [],
    canon_delta: [
      candidateDelta({
        id: "delta-alive",
        fact_type: "alive_status",
        proposed_fact_value: { alive: true },
        temporal_scope: { kind: "at", book_order: 1, chapter: "3" },
        evidence: [
          located("Mara had blue eyes that caught the lantern light.", "Chapter 3", "current_observation"),
        ],
      }),
      candidateDelta({
        id: "delta-dead",
        fact_type: "alive_status",
        proposed_fact_value: { alive: false },
        temporal_scope: { kind: "at", book_order: 1, chapter: "5" },
        source_location: { locator: "Chapter 5", chapter: "5" },
        evidence: [
          located("Mara died in the stairwell after the shot.", "Chapter 5", "current_observation"),
        ],
      }),
    ],
    entity_ambiguities: [],
    summary: {
      confirmed_contradiction_count: 0,
      possible_conflict_count: 0,
      author_verification_count: 0,
      narrative: "Alive earlier and dead later are temporally disjoint and both valid.",
    },
  }),
};

export const FIXTURE_10_RETCON: ArchivistCertificationFixture = {
  id: "intentional_retcon",
  title: "Intentional retcon",
  safety: true,
  expect: { validation_ok: true, confirmed_count: 0 },
  review: baseReview({
    series_id: FIXTURE_SERIES_ID,
    findings: [],
    canon_delta: [
      candidateDelta({
        id: "delta-retcon-age",
        fact_type: "age",
        proposed_fact_value: { age: 28 },
        proposed_authority: "current_observation",
        temporal_scope: { kind: "at", book_order: 2, chapter: "1" },
        evidence: [located("Mara was twenty-eight, the revised record said.", "Chapter 1", "current_observation")],
      }),
    ],
    entity_ambiguities: [],
    summary: {
      confirmed_contradiction_count: 0,
      possible_conflict_count: 0,
      author_verification_count: 0,
      narrative:
        "Author-approved exception supersedes prior age canon. No contradiction against superseded facts.",
    },
  }),
};

export const FIXTURE_11_AMBIGUOUS_ALIAS: ArchivistCertificationFixture = {
  id: "ambiguous_alias",
  title: "Ambiguous alias",
  safety: true,
  expect: { validation_ok: true, confirmed_count: 0, entity_ambiguity_count: 1 },
  review: baseReview({
    findings: [
      finding({
        id: "f-john-alias",
        issue_type: "entity_ambiguity",
        classification: "author_verification_needed",
        severity: "moderate",
        confidence: "insufficient",
        explanation: "Alias John matches two entities. No silent resolution.",
        current_evidence: [located("John closed the ledger.", "Chapter 8", "supporting")],
        conflicting_evidence: [],
        temporal_analysis: {
          relation: "unknown",
          explanation: "Entity identity is unresolved, so temporal comparison is withheld.",
          current_scope: { kind: "at", book_order: 1, chapter: "8" },
        },
        suggested_resolution: "Ask the author which John is intended.",
      }),
    ],
    canon_delta: [
      candidateDelta({
        id: "delta-unresolved-john",
        entity: {
          resolution: "ambiguous",
          alias: "John",
          entity_type: "person",
          candidates: [
            { entity_id: "entity-john-reeves", canonical_name: "John Reeves" },
            { entity_id: "entity-john-hale", canonical_name: "John Hale" },
          ],
        },
        fact_type: "presence",
        proposed_fact_value: { present: true },
        confidence: "insufficient",
        proposed_authority: "uncertain_observation",
        inferred: true,
        evidence: [located("John closed the ledger.", "Chapter 8", "supporting")],
      }),
    ],
    entity_ambiguities: [
      {
        id: "amb-john",
        alias: "John",
        candidate_entities: [
          {
            entity_id: "entity-john-reeves",
            canonical_name: "John Reeves",
            entity_type: "person",
            evidence: [located("John Reeves signed the Harbor roster.", "Chapter 1", "supporting")],
          },
          {
            entity_id: "entity-john-hale",
            canonical_name: "John Hale",
            entity_type: "person",
            evidence: [located("John Hale waited by the warehouse.", "Chapter 2", "supporting")],
          },
        ],
        context: "Two entities share the alias John.",
        confidence: "insufficient",
        recommended_author_verification: "Identify whether Chapter 8 John is Reeves or Hale.",
      },
    ],
  }),
};

export const FIXTURE_12_UNCERTAIN: ArchivistCertificationFixture = {
  id: "uncertain_evidence",
  title: "Uncertain evidence",
  safety: true,
  expect: { validation_ok: true, confirmed_count: 0 },
  review: baseReview({
    findings: [
      finding({
        id: "f-uncertain-rank",
        issue_type: "rank_title",
        classification: "author_verification_needed",
        severity: "minor",
        confidence: "insufficient",
        explanation: "A passing mention of captain is too thin to establish rank canon.",
        current_evidence: [located("Someone called captain from the dock.", "Chapter 10", "supporting")],
        conflicting_evidence: [],
        temporal_analysis: {
          relation: "unknown",
          explanation: "Insufficient support to compare rank states.",
          current_scope: { kind: "unknown", chapter: "10" },
        },
        suggested_resolution: "Ask the author whether captain is a rank, a nickname, or another character.",
      }),
    ],
    canon_delta: [],
    entity_ambiguities: [],
  }),
};

export const FIXTURE_13_CLEAN_CONTROL: ArchivistCertificationFixture = {
  id: "no_false_positive_control",
  title: "No-false-positive control",
  safety: true,
  manuscript_text: "Chapter 1. Mara kept the blue-eyed description consistent through the Harbor chapters.",
  expect: { validation_ok: true, confirmed_count: 0 },
  review: baseReview({
    findings: [],
    canon_delta: [
      candidateDelta({
        proposed_fact_value: { eye_color: "blue" },
        evidence: [
          located(
            "Mara kept the blue-eyed description consistent through the Harbor chapters.",
            "Chapter 1",
            "current_observation",
          ),
        ],
      }),
    ],
    entity_ambiguities: [],
    summary: {
      confirmed_contradiction_count: 0,
      possible_conflict_count: 0,
      author_verification_count: 0,
      narrative: "Clean continuity control. Zero confirmed contradictions.",
    },
  }),
};

export const FIXTURE_14_CANON_PROMOTION: ArchivistCertificationFixture = {
  id: "canon_promotion_safety",
  title: "Canon promotion safety",
  safety: true,
  expect: { validation_ok: false, confirmed_count: 0, canon_delta_accepted: 1 },
  review: baseReview({
    findings: [],
    canon_delta: [
      {
        ...candidateDelta({ id: "delta-illegal-accepted" }),
        status: "accepted" as unknown as "candidate",
      },
    ],
    entity_ambiguities: [],
  }),
};

export const FIXTURE_15_MISSING_CONFLICT_EVIDENCE: ArchivistCertificationFixture = {
  id: "missing_conflict_evidence",
  title: "Missing conflict evidence",
  safety: true,
  expect: { validation_ok: false, confirmed_count: 1 },
  review: baseReview({
    findings: [
      finding({
        id: "f-one-sided",
        issue_type: "appearance",
        explanation: "Confirmed without the conflicting passage.",
        current_evidence: [
          located("Mara had blue eyes that caught the lantern light.", "Chapter 3", "current_observation"),
        ],
        conflicting_evidence: [],
      }),
    ],
    canon_delta: [],
    entity_ambiguities: [],
  }),
};

export const ARCHIVIST_CERTIFICATION_FIXTURES: readonly ArchivistCertificationFixture[] = [
  FIXTURE_01_WITHIN_BOOK_EXACT,
  FIXTURE_02_EXPLAINED_APPEARANCE,
  FIXTURE_03_SERIES_AGE,
  FIXTURE_04_TIMELINE,
  FIXTURE_05_INJURY,
  FIXTURE_06_KNOWLEDGE,
  FIXTURE_07_RELATIONSHIP,
  FIXTURE_08_OBJECT,
  FIXTURE_09_ALIVE_DEAD,
  FIXTURE_10_RETCON,
  FIXTURE_11_AMBIGUOUS_ALIAS,
  FIXTURE_12_UNCERTAIN,
  FIXTURE_13_CLEAN_CONTROL,
  FIXTURE_14_CANON_PROMOTION,
  FIXTURE_15_MISSING_CONFLICT_EVIDENCE,
];

export const ARCHIVIST_SAFETY_FIXTURE_IDS = ARCHIVIST_CERTIFICATION_FIXTURES.filter(
  (fixture) => fixture.safety,
).map((fixture) => fixture.id);
