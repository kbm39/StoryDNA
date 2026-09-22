/**
 * Sanitized regression fixtures for Archivist structured-output recovery.
 * These are not the lost Haiku dumps from archivist-smoke-20260922-v1.
 */

export const ARCHIVIST_MODEL_PAYLOAD_CLEAN = {
  summary: { narrative: "No continuity conflict." },
  findings: [],
  canon_delta: [],
  entity_ambiguities: [],
} as const;

export const ARCHIVIST_MODEL_PAYLOAD_BLUE_GREEN = {
  summary: { narrative: "Mara's eye color contradicts between chapter 3 and chapter 22." },
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
        relation: "identical",
        explanation: "Both passages describe present-tense appearance.",
        current_scope: { kind: "at", chapter: "3" },
        conflicting_scope: { kind: "at", chapter: "22" },
      },
      explanation: "Blue eyes in chapter 3 and green eyes in chapter 22 with no intervening change.",
      suggested_resolution: "Author should confirm the intended eye color or the dye/cover explanation.",
    },
  ],
  canon_delta: [
    {
      id: "delta-eyes",
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

export const ARCHIVIST_FENCED_CLEAN_JSON = `\`\`\`json
${JSON.stringify(ARCHIVIST_MODEL_PAYLOAD_CLEAN, null, 2)}
\`\`\``;

export const ARCHIVIST_PROSE_WRAPPED_CLEAN_JSON = [
  "Here is the continuity review.",
  JSON.stringify(ARCHIVIST_MODEL_PAYLOAD_CLEAN),
  "Let me know if you want more detail.",
].join("\n");

export const ARCHIVIST_TRUNCATED_JSON = '{"summary":{"narrative":"cut off","findings":[';

export const ARCHIVIST_NOT_JSON = "Mara's eyes change from blue to green in later chapters.";

export const ARCHIVIST_ACCEPTED_CANON_PAYLOAD = {
  ...ARCHIVIST_MODEL_PAYLOAD_CLEAN,
  canon_delta: [
    {
      ...ARCHIVIST_MODEL_PAYLOAD_BLUE_GREEN.canon_delta[0],
      status: "accepted",
    },
  ],
};

export const ARCHIVIST_ONE_SIDED_CONFIRMED_PAYLOAD = {
  summary: { narrative: "One-sided confirmation." },
  findings: [
    {
      ...ARCHIVIST_MODEL_PAYLOAD_BLUE_GREEN.findings[0],
      conflicting_evidence: [],
    },
  ],
  canon_delta: [],
  entity_ambiguities: [],
};
