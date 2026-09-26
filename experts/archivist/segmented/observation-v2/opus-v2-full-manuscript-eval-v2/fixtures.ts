/**
 * Generic synthetic $0 fixture for prompt @v3 balanced-dimension requirements.
 * No Rule 8 language. No Reckoning names. Provider: none.
 */

export const V3_BALANCED_FIXTURE_SEGMENT_ID = "seg-v3-balanced-synthetic" as const;

export const V3_BALANCED_FIXTURE_SEGMENT = [
  "At 06:10 Mara boarded the harbor launch at Quay 3.",
  "Forty minutes later, at 06:50, she stepped onto the outer-island slip.",
  "Her left wrist was wrapped; the medic had said the bone was bruised, not broken.",
  "Joss, who is Mara's brother, waited at the chart table with the brass compass.",
  "The dock clerk called Joss \"the Warden\" and asked for the radio.",
  "\"The radio is dead,\" Mara said.",
  "Joss already used the blue cache token at the quay. Nia then told him, \"Blue means the cache is live.\"",
  "The rover fired its only flare over the slip.",
  "Pax later set the same brass compass on the chart.",
].join(" ");

export const V3_BALANCED_FIXTURE_REQUIRED_KINDS = [
  "timestamp",
  "injury",
  "travel_leg",
  "relationship",
  "identity",
  "object_equipment",
  "operational_capability",
  "knowledge",
  "location_presence",
  "statement",
] as const;

export const V3_BALANCED_FIXTURE_DIMENSIONS = {
  clocks: ["06:10", "06:50"],
  injury: "left wrist bruised",
  travel_leg: "Quay 3 to outer-island slip by harbor launch",
  relationship: "Joss is Mara's brother",
  alias: "Joss called the Warden",
  recurring_object: "brass compass",
  capability_unavailable: "radio is dead",
  capability_used: "rover fired its only flare",
  knowledge_acquisition: "Nia explains blue cache token to Joss",
  location_change: "quay then chart table / outer-island slip",
} as const;
