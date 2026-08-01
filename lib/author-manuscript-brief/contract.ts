/** Versioned contract: storydna_author_manuscript_brief@v1 */

export const MANUSCRIPT_BRIEF_CONTRACT_VERSION = "storydna_author_manuscript_brief@v1" as const;

export const MANUSCRIPT_BRIEF_STATUSES = [
  "draft",
  "submitted",
  "superseded",
  "cancelled",
] as const;

export type ManuscriptBriefStatus = (typeof MANUSCRIPT_BRIEF_STATUSES)[number];

/** Brief is author framing — never manuscript evidence. */
export const MANUSCRIPT_BRIEF_IS_EVIDENCE = false as const;

export const MARKET_POSITION_UNSURE = "unsure" as const;

export const INTAKE_PROMPT_COUNT = 6 as const;
