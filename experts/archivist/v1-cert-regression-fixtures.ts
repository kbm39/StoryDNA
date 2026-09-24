/**
 * Sanitized model shapes from archivist-cert-20260924-v1.
 * Not raw provider dumps. Official v1 score remains 12/15 FAIL.
 */

export const ARCHIVIST_V1_INJURY_MANUSCRIPT = [
  "Chapter 11. The wound on Mara's left shoulder had closed.",
  "Chapter 11. The medic wrapped Mara's right shoulder.",
].join("\n");

export const ARCHIVIST_V1_KNOWLEDGE_MANUSCRIPT = [
  "Chapter 2. Mara whispered the courier password at the gate.",
  "Chapter 4. Mara learned the courier password at dusk.",
].join("\n");

export const ARCHIVIST_V1_OBJECT_MANUSCRIPT = [
  "Chapter 7. The silver compass sat in Mara's coat pocket.",
  "Chapter 7. Calder spun the silver compass on the chart table.",
].join("\n");

export const ARCHIVIST_V1_HAIR_DYE_MANUSCRIPT = [
  "Chapter 3. Mara's hair was brown against the lantern light.",
  "Chapter 22. After the dye, Mara's blonde hair suited the cover identity.",
].join("\n");

export const ARCHIVIST_V1_ALIVE_DEAD_MANUSCRIPT = [
  "Chapter 3. Mara kept watch at the door.",
  "Chapter 5. Mara died in the stairwell after the shot.",
].join("\n");

export const ARCHIVIST_V1_RETCON_MANUSCRIPT =
  "Chapter 1. Mara was twenty-eight, the revised record said.";

export const ARCHIVIST_V1_INJURY_PAYLOAD = {
  summary: {
    narrative: "Chapter 11 contradicts Mara's injury laterality.",
  },
  findings: [
    {
      id: "ch11_mara_shoulder_location_contradiction",
      issue_type: "injury",
      classification: "confirmed_contradiction",
      severity: "critical",
      confidence: "high",
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
        explanation:
          "No evidence indicates the wound healed and relocated, or that two separate injuries exist.",
        current_scope: { kind: "at", chapter: "11" },
        conflicting_scope: { kind: "at", chapter: "11" },
      },
      explanation:
        "Injury location differs: left shoulder vs right shoulder. Injury state also differs: healed/closed vs wrapping.",
      suggested_resolution: "Confirm the intended shoulder.",
    },
  ],
  canon_delta: [
    {
      id: "ch11_mara_left_shoulder_wound_closed",
      entity: { alias: "Mara", entity_type: "person" },
      entity_type: "person",
      fact_type: "injury",
      proposed_fact_value: { location: "left shoulder" },
      temporal_scope: { kind: "at", chapter: "11" },
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

export const ARCHIVIST_V1_KNOWLEDGE_PAYLOAD = {
  summary: { narrative: "Password used before it is learned." },
  findings: [
    {
      id: "finding_001",
      issue_type: "knowledge_state",
      classification: "possible_continuity_conflict",
      severity: "major",
      confidence: "high",
      current_location: { locator: "Chapter 2", chapter: "2" },
      conflicting_location: { locator: "Chapter 4", chapter: "4" },
      current_evidence: [
        {
          excerpt: "Mara whispered the courier password at the gate.",
          locator: "Chapter 2",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      conflicting_evidence: [
        {
          excerpt: "Mara learned the courier password at dusk.",
          locator: "Chapter 4",
          evidence_role: "conflicting_canon",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      temporal_analysis: {
        relation: "earlier_later",
        explanation: "Usage in chapter 2 precedes acquisition in chapter 4.",
        current_scope: { kind: "at", chapter: "2" },
        conflicting_scope: { kind: "at", chapter: "4" },
      },
      explanation: "Mara uses the courier password before the scene where she learns it.",
      suggested_resolution: "Confirm when she acquired the password.",
    },
  ],
  canon_delta: [
    {
      id: "canon_001",
      entity: { alias: "Mara", entity_type: "person" },
      entity_type: "person",
      fact_type: "knowledge_state",
      proposed_fact_value: { knows: "courier password" },
      temporal_scope: { kind: "at", chapter: "2" },
      source_location: { locator: "Chapter 2" },
      evidence: [
        {
          excerpt: "Mara whispered the courier password at the gate.",
          locator: "Chapter 2",
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

export const ARCHIVIST_V1_OBJECT_PAYLOAD = {
  summary: { narrative: "The silver compass is in two places at once." },
  findings: [
    {
      id: "find-001-compass-possession",
      issue_type: "possession",
      classification: "possible_continuity_conflict",
      severity: "major",
      confidence: "high",
      current_location: { locator: "Chapter 7", chapter: "7" },
      conflicting_location: { locator: "Chapter 7", chapter: "7" },
      current_evidence: [
        {
          excerpt: "The silver compass sat in Mara's coat pocket.",
          locator: "Chapter 7",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      conflicting_evidence: [
        {
          excerpt: "Calder spun the silver compass on the chart table.",
          locator: "Chapter 7",
          evidence_role: "conflicting_canon",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      temporal_analysis: {
        relation: "same_time",
        explanation: "Same unique object, same chapter, two possessions.",
        current_scope: { kind: "at", chapter: "7" },
        conflicting_scope: { kind: "at", chapter: "7" },
      },
      explanation: "The unique silver compass cannot be in Mara's pocket and on Calder's table.",
      suggested_resolution: "Confirm who holds the compass.",
    },
  ],
  canon_delta: [
    {
      id: "delta-001-compass-in-mara-pocket",
      entity: { alias: "silver compass", entity_type: "object" },
      entity_type: "object",
      fact_type: "possession",
      proposed_fact_value: { holder: "Mara" },
      temporal_scope: { kind: "at", chapter: "7" },
      source_location: { locator: "Chapter 7" },
      evidence: [
        {
          excerpt: "The silver compass sat in Mara's coat pocket.",
          locator: "Chapter 7",
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
