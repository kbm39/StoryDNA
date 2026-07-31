/** Versioned contract: storydna_author_intent@v1 */

export const AUTHOR_INTENT_CONTRACT_VERSION = "storydna_author_intent@v1" as const;

export const AUTHOR_INTENT_TYPES = [
  "general_manuscript_review",
  "query_preparation",
  "traditional_publishing",
  "self_publishing",
  "kindle_unlimited",
  "screenplay_adaptation",
  "television_adaptation",
  "comic_adaptation",
  "developmental_editing",
  "copy_editing",
  "military_realism",
  "medical_realism",
  "financial_realism",
  "continuity_review",
  "word_count_reduction",
  "series_consistency",
  "certification_benchmark",
  "custom",
] as const;

export type AuthorIntentType = (typeof AUTHOR_INTENT_TYPES)[number];

export const AUTHOR_INTENT_STATUSES = [
  "draft",
  "active",
  "superseded",
  "cancelled",
] as const;

export type AuthorIntentStatus = (typeof AUTHOR_INTENT_STATUSES)[number];

export const AUTHOR_INTENT_TYPE_LABELS: Record<AuthorIntentType, string> = {
  general_manuscript_review: "General manuscript review",
  query_preparation: "Query preparation",
  traditional_publishing: "Traditional publishing",
  self_publishing: "Self publishing",
  kindle_unlimited: "Kindle Unlimited",
  screenplay_adaptation: "Screenplay adaptation",
  television_adaptation: "Television adaptation",
  comic_adaptation: "Comic adaptation",
  developmental_editing: "Developmental editing",
  copy_editing: "Copy editing",
  military_realism: "Military realism",
  medical_realism: "Medical realism",
  financial_realism: "Financial realism",
  continuity_review: "Continuity review",
  word_count_reduction: "Word-count reduction",
  series_consistency: "Series consistency",
  certification_benchmark: "Certification benchmark",
  custom: "Custom objective",
};

export const PRIORITY_DOMAINS = [
  "commercial",
  "structure",
  "prose",
  "character",
  "dialogue",
  "military",
  "medical",
  "financial",
  "continuity",
  "series",
  "pacing",
  "market",
] as const;

export type PriorityDomain = (typeof PRIORITY_DOMAINS)[number];
