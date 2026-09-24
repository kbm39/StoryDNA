/**
 * Sanitized v2 semantic shapes. Not a pass. Used to prove StoryDNA now
 * resolves identities and keeps persistent earlier/later contradictions.
 */

export const ARCHIVIST_V2_BLUE_GREEN_FENCED = `\`\`\`json
${JSON.stringify(
  {
    summary: { narrative: "Mara's eye color is blue in chapter 3 and green in chapter 22." },
    findings: [
      {
        id: "f-eye-color",
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
          relation: "disjoint",
          explanation: "The observations occur in different chapters.",
          current_scope: { kind: "at", chapter: "3" },
          conflicting_scope: { kind: "at", chapter: "22" },
        },
        explanation: "Blue eyes in chapter 3 and green eyes in chapter 22 with no intervening change.",
        suggested_resolution: "Confirm the intended eye color.",
      },
    ],
    canon_delta: [
      {
        id: "delta_001_mara_blue_eyes",
        entity: { alias: "Mara", resolution: "resolved", entity_type: "person" },
        entity_type: "person",
        fact_type: "appearance",
        proposed_fact_value: { eye_color: "blue" },
        temporal_scope: { kind: "at", chapter: "3" },
        source_location: { locator: "Chapter 3" },
        evidence: [
          {
            excerpt: "Mara had blue eyes that caught the lantern light.",
            locator: "Chapter 3",
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
        id: "delta_002_mara_green_eyes",
        entity: { alias: "Mara", resolution: "resolved", entity_type: "person" },
        entity_type: "person",
        fact_type: "appearance",
        proposed_fact_value: { eye_color: "green" },
        temporal_scope: { kind: "at", chapter: "22" },
        source_location: { locator: "Chapter 22" },
        evidence: [
          {
            excerpt: "Mara's green eyes narrowed at the map.",
            locator: "Chapter 22",
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
  },
  null,
  2,
)}
\`\`\``;

export const ARCHIVIST_V2_EXPLAINED_DYE_PAYLOAD = {
  summary: { narrative: "Eye color change is explained by dye for a cover identity." },
  findings: [
    {
      id: "f-dye",
      issue_type: "appearance",
      classification: "possible_continuity_conflict",
      severity: "minor",
      confidence: "medium",
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
          excerpt: "After the dye, Mara's green eyes suited the cover identity.",
          locator: "Chapter 22",
          evidence_role: "conflicting_canon",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      temporal_analysis: {
        relation: "disjoint",
        explanation: "Later chapter after a dye change.",
        current_scope: { kind: "at", chapter: "3" },
        conflicting_scope: { kind: "at", chapter: "22" },
      },
      explanation: "The later green eyes follow an intentional dye.",
      suggested_resolution: "Treat as an explained appearance change.",
    },
  ],
  canon_delta: [
    {
      id: "mara_eye_color_blue",
      entity: { alias: "Mara", resolution: "resolved", entity_type: "person" },
      entity_type: "person",
      fact_type: "appearance",
      proposed_fact_value: { eye_color: "blue" },
      temporal_scope: { kind: "at", chapter: "3" },
      source_location: { locator: "Chapter 3" },
      evidence: [
        {
          excerpt: "Mara had blue eyes that caught the lantern light.",
          locator: "Chapter 3",
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

export const ARCHIVIST_V2_CLEAN_CONTROL_PAYLOAD = {
  summary: { narrative: "Single consistent blue-eyed description." },
  findings: [
    {
      id: "f-verify",
      issue_type: "appearance",
      classification: "author_verification_needed",
      severity: "minor",
      confidence: "medium",
      current_location: { locator: "Chapter 1", chapter: "1" },
      conflicting_location: null,
      current_evidence: [
        {
          excerpt: "Mara kept the blue-eyed description consistent through the Harbor chapters.",
          locator: "Chapter 1",
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      conflicting_evidence: [],
      temporal_analysis: {
        relation: "unknown",
        explanation: "Only one observation.",
        current_scope: { kind: "at", chapter: "1" },
      },
      explanation: "One consistent observation.",
      suggested_resolution: "No contradiction to resolve.",
    },
  ],
  canon_delta: [
    {
      id: "cd-001",
      entity: { alias: "Mara", resolution: "unresolved", entity_type: "person" },
      entity_type: "person",
      fact_type: "appearance",
      proposed_fact_value: { eye_color: "blue" },
      temporal_scope: { kind: "at", chapter: "1" },
      source_location: { locator: "Chapter 1" },
      evidence: [
        {
          excerpt: "Mara kept the blue-eyed description consistent through the Harbor chapters.",
          locator: "Chapter 1",
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
  entity_ambiguities: [
    {
      id: "ea-001",
      alias: "Mara",
      candidate_entities: [{ entity_id: "", canonical_name: "Mara", entity_type: "person", evidence: [] }],
      context: "Model guessed a single candidate.",
      confidence: "low",
      recommended_author_verification: "Confirm Mara.",
    },
  ],
} as const;

export const ARCHIVIST_V2_SPOOFED_ENTITY_ID_PAYLOAD = {
  summary: { narrative: "Spoofed identity." },
  findings: [],
  canon_delta: [
    {
      id: "delta-spoof",
      entity: {
        alias: "Mara",
        resolution: "resolved",
        entity_type: "person",
        entity_id: "spoofed-not-a-storydna-id",
      },
      entity_type: "person",
      fact_type: "appearance",
      proposed_fact_value: { eye_color: "blue" },
      temporal_scope: { kind: "at", chapter: "3" },
      source_location: { locator: "Chapter 3" },
      evidence: [
        {
          excerpt: "Mara had blue eyes that caught the lantern light.",
          locator: "Chapter 3",
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

export const ARCHIVIST_V2_AMBIGUOUS_JOHN_PAYLOAD = {
  summary: { narrative: "John is ambiguous." },
  findings: [],
  canon_delta: [
    {
      id: "delta-john",
      entity: { alias: "John", resolution: "resolved", entity_type: "person", entity_id: "guess-id" },
      entity_type: "person",
      fact_type: "presence",
      proposed_fact_value: { present: true },
      temporal_scope: { kind: "at", chapter: "8" },
      source_location: { locator: "Chapter 8" },
      evidence: [
        {
          excerpt: "John closed the ledger.",
          locator: "Chapter 8",
          evidence_role: "supporting",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      confidence: "low",
      proposed_authority: "uncertain_observation",
      status: "candidate",
    },
  ],
  entity_ambiguities: [],
} as const;

export const ARCHIVIST_V2_UNKNOWN_ENTITY_PAYLOAD = {
  summary: { narrative: "Unknown person." },
  findings: [],
  canon_delta: [
    {
      id: "delta-nobody",
      entity: { alias: "Nobody", resolution: "resolved", entity_type: "person", entity_id: "invented-id" },
      entity_type: "person",
      fact_type: "presence",
      proposed_fact_value: { present: true },
      temporal_scope: { kind: "at", chapter: "1" },
      source_location: { locator: "Chapter 1" },
      evidence: [
        {
          excerpt: "Nobody stood at the rail.",
          locator: "Chapter 1",
          evidence_role: "supporting",
          verification_status: "located",
          source_kind: "manuscript",
        },
      ],
      confidence: "low",
      proposed_authority: "uncertain_observation",
      status: "candidate",
    },
  ],
  entity_ambiguities: [],
} as const;

export const ARCHIVIST_V3_BLUE_GREEN_MANUSCRIPT = [
  "Chapter 3. Mara had blue eyes that caught the lantern light.",
  "Chapter 22. Mara's green eyes narrowed at the map.",
].join("\n");

export const ARCHIVIST_V3_DYE_MANUSCRIPT = [
  "Chapter 3. Mara had blue eyes that caught the lantern light.",
  "Chapter 22. After the dye, Mara's green eyes suited the cover identity.",
].join("\n");

export const ARCHIVIST_V3_CLEAN_MANUSCRIPT =
  "Chapter 1. Mara kept the blue-eyed description consistent through the Harbor chapters.";
