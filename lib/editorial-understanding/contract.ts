/** Versioned contract: storydna_editorial_understanding@v1 */

export const EDITORIAL_UNDERSTANDING_CONTRACT_VERSION =
  "storydna_editorial_understanding@v1" as const;

export const EDITORIAL_UNDERSTANDING_STATUSES = [
  "draft",
  "awaiting_author_confirmation",
  "confirmed",
  "correction_requested",
  "superseded",
  "cancelled",
] as const;

export type EditorialUnderstandingStatus =
  (typeof EDITORIAL_UNDERSTANDING_STATUSES)[number];

export const EDITORIAL_UNDERSTANDING_INTERVIEW_TYPES = [
  "eic_author_intake",
  "literary_agent_intake",
  "character_interview",
  "series_intake",
  "producer_intake",
  "screenplay_intake",
] as const;

export type EditorialUnderstandingInterviewType =
  (typeof EDITORIAL_UNDERSTANDING_INTERVIEW_TYPES)[number];

export const EDITORIAL_UNDERSTANDING_CONDUCTED_BY = [
  "editor_in_chief",
  "literary_agent",
  "character_expert",
  "producer",
  "screenplay_editor",
] as const;

/** Editorial understanding is author framing — never evidence, intent, or canon. */
export const EDITORIAL_UNDERSTANDING_IS_EVIDENCE = false as const;
export const EDITORIAL_UNDERSTANDING_IS_AUTHOR_INTENT = false as const;
export const EDITORIAL_UNDERSTANDING_IS_CANON = false as const;

export const CONFIRMATION_GATE_MIN_OVERALL_CONFIDENCE = 0.6 as const;

export const UNDERSTANDING_FIELD_WEIGHTS = {
  primary_vision: 0.25,
  creative_motivation: 0.15,
  target_reader: 0.15,
  desired_reader_experience: 0.1,
  market_position: 0.15,
  success_definition: 0.2,
} as const;

export type UnderstandingFieldKey = keyof typeof UNDERSTANDING_FIELD_WEIGHTS;
