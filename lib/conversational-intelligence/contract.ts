/** Versioned contract: storydna_conversational_response@v1 */

export const CONVERSATIONAL_RESPONSE_CONTRACT_VERSION =
  "storydna_conversational_response@v1" as const;

export const CONVERSATIONAL_RESPONSE_TYPES = [
  "acknowledgment",
  "reflection",
  "type_b_synthesis",
  "clarification",
] as const;

export type ConversationalResponseType = (typeof CONVERSATIONAL_RESPONSE_TYPES)[number];

export const FOLLOW_UP_DECISION_OUTCOMES = [
  "acknowledge_and_continue",
  "reflect_and_continue",
  "clarify_once",
  "insufficient_answer",
  "author_skipped_optional",
  "blocked_unsafe_or_invalid",
] as const;

export type FollowUpDecisionOutcome = (typeof FOLLOW_UP_DECISION_OUTCOMES)[number];

/** Phase 1B-ab uses deterministic templates — no provider by default. */
export const CONVERSATIONAL_INTELLIGENCE_PROVIDER_MODEL = "deterministic@v1" as const;
