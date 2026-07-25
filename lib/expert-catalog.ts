/**
 * Presentational Expert Team catalog for the main-site author UI (Sprint 1 PR 1).
 *
 * Not a runtime Expert Registry. Does not imply production execution readiness
 * beyond explicit availability/certification fields on each entry.
 */

export type ExpertCatalogAvailability =
  | "available"
  | "coming_soon"
  | "internal_only"
  | "unavailable";

export type ExpertCatalogCertification = "certified" | "not_certified" | "planned";

export type ExpertCatalogKey =
  | "literary_agent"
  | "developmental_editor"
  | "line_editor"
  | "psychologist"
  | "librarian"
  | "military_expert";

export interface ExpertCatalogEntry {
  key: ExpertCatalogKey;
  displayName: string;
  shortDescription: string;
  responsibilities: readonly string[];
  availability: ExpertCatalogAvailability;
  certificationStatus: ExpertCatalogCertification;
  selectionEnabled: boolean;
  statusLabel: string;
  certificationLabel: string;
  recommendedFor: readonly string[];
  sortOrder: number;
}

export const EXPERT_CATALOG_ENTRIES: readonly ExpertCatalogEntry[] = Object.freeze([
  {
    key: "literary_agent",
    displayName: "Literary Agent",
    shortDescription:
      "Evaluates commercial potential, positioning, publishability, submission readiness, strengths, weaknesses, and revision priorities.",
    responsibilities: [
      "Commercial positioning and acquisition readiness",
      "Submission strategy and revision priorities",
      "Strengths, weaknesses, and market-facing feedback",
    ],
    availability: "available",
    certificationStatus: "certified",
    selectionEnabled: true,
    statusLabel: "Available",
    certificationLabel: "Certified",
    recommendedFor: ["agent_submission", "commercial_fiction"],
    sortOrder: 1,
  },
  {
    key: "developmental_editor",
    displayName: "Developmental Editor",
    shortDescription:
      "Evaluates plot, structure, pacing, stakes, character arcs, scene order, narrative logic, and story architecture.",
    responsibilities: [
      "Plot and structure",
      "Pacing, stakes, and scene order",
      "Character arcs and narrative logic",
    ],
    availability: "coming_soon",
    certificationStatus: "planned",
    selectionEnabled: false,
    statusLabel: "Coming Soon",
    certificationLabel: "Planned",
    recommendedFor: ["developmental", "story_architecture"],
    sortOrder: 2,
  },
  {
    key: "line_editor",
    displayName: "Line Editor",
    shortDescription:
      "Evaluates prose clarity, sentence rhythm, repetition, dialogue, voice consistency, paragraph flow, word economy, and show-versus-tell.",
    responsibilities: [
      "Prose clarity and sentence rhythm",
      "Dialogue and voice consistency",
      "Word economy and show-versus-tell",
    ],
    availability: "coming_soon",
    certificationStatus: "planned",
    selectionEnabled: false,
    statusLabel: "Coming Soon",
    certificationLabel: "Planned",
    recommendedFor: ["line_edit", "prose_polish"],
    sortOrder: 3,
  },
  {
    key: "psychologist",
    displayName: "Psychologist",
    shortDescription:
      "Evaluates character motivation, trauma responses, emotional continuity, relationships, behavior, and psychological realism.",
    responsibilities: [
      "Character motivation and behavior",
      "Trauma responses and emotional continuity",
      "Relationship dynamics and psychological realism",
    ],
    availability: "coming_soon",
    certificationStatus: "planned",
    selectionEnabled: false,
    statusLabel: "Coming Soon",
    certificationLabel: "Planned",
    recommendedFor: ["character_consistency", "psychological_realism"],
    sortOrder: 4,
  },
  {
    key: "librarian",
    displayName: "Librarian",
    shortDescription:
      "Evaluates factual accuracy, research questions, timelines, geography, legal and technical claims, historical context, and source-supported realism.",
    responsibilities: [
      "Factual accuracy and research questions",
      "Timelines, geography, and historical context",
      "Legal, technical, and source-supported realism",
    ],
    availability: "coming_soon",
    certificationStatus: "planned",
    selectionEnabled: false,
    statusLabel: "Coming Soon",
    certificationLabel: "Planned",
    recommendedFor: ["reality_check", "research_accuracy"],
    sortOrder: 5,
  },
  {
    key: "military_expert",
    displayName: "Military Expert",
    shortDescription:
      "Evaluates military command, rank, tactics, mission planning, equipment, communications, logistics, special operations, terminology, and operational realism.",
    responsibilities: [
      "Command, rank, and tactics",
      "Mission planning and operational realism",
      "Equipment, communications, and terminology",
    ],
    availability: "coming_soon",
    certificationStatus: "planned",
    selectionEnabled: false,
    statusLabel: "Coming Soon",
    certificationLabel: "Planned",
    recommendedFor: ["military_realism", "operational_accuracy"],
    sortOrder: 6,
  },
]);

export const EXPERT_CATALOG_KEY_ORDER: readonly ExpertCatalogKey[] = EXPERT_CATALOG_ENTRIES.map(
  (entry) => entry.key,
);

export function getExpertCatalogEntry(key: ExpertCatalogKey): ExpertCatalogEntry | undefined {
  return EXPERT_CATALOG_ENTRIES.find((entry) => entry.key === key);
}

export function listExpertCatalogEntries(): readonly ExpertCatalogEntry[] {
  return EXPERT_CATALOG_ENTRIES;
}

export function getLiteraryAgentCatalogEntry(): ExpertCatalogEntry {
  const entry = getExpertCatalogEntry("literary_agent");
  if (!entry) throw new Error("Literary Agent catalog entry is required");
  return entry;
}
