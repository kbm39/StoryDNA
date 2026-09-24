/**
 * Fixture-owned prior-source identities for Archivist certification.
 *
 * StoryDNA attaches these deterministically. The model must not invent
 * production database source IDs.
 */

export const ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS = {
  book1Source: "fixture-source-book-1",
  book1Manuscript: "fixture-ms-book-1",
  book1Version: "fixture-mv-book-1",
  book1Hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  relationshipFact: "canon-fact-rel-mara-calder",
  ageFact: "canon-fact-age-mara",
} as const;

export interface ArchivistPriorSourceIdentity {
  source_id: string;
  source_manuscript_id: string;
  source_version_id: string;
  source_content_hash: string;
  source_label: string;
  book_order: number;
  chapter?: string;
  locator: string;
  canon_fact_id: string;
  fact_type: string;
  excerpt: string;
  source_kind: "prior_volume_canon";
  status: "accepted";
  authority: "prior_volume_canon";
}

export const ARCHIVIST_CERTIFICATION_PRIOR_SOURCES: readonly ArchivistPriorSourceIdentity[] = [
  {
    source_id: ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS.book1Source,
    source_manuscript_id: ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS.book1Manuscript,
    source_version_id: ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS.book1Version,
    source_content_hash: ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS.book1Hash,
    source_label: "Hold Fast synthetic Book 1 equivalent",
    book_order: 1,
    chapter: "12",
    locator: "Book 1 Chapter 12",
    canon_fact_id: ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS.relationshipFact,
    fact_type: "relationship",
    excerpt: "Mara and Calder ran the Harbor cell together.",
    source_kind: "prior_volume_canon",
    status: "accepted",
    authority: "prior_volume_canon",
  },
  {
    source_id: ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS.book1Source,
    source_manuscript_id: ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS.book1Manuscript,
    source_version_id: ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS.book1Version,
    source_content_hash: ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS.book1Hash,
    source_label: "Hold Fast synthetic Book 1 equivalent",
    book_order: 1,
    chapter: "18",
    locator: "Book 1 Chapter 18",
    canon_fact_id: ARCHIVIST_FIXTURE_PRIOR_SOURCE_IDS.ageFact,
    fact_type: "age",
    excerpt: "Mara turned thirty-one before the Harbor siege.",
    source_kind: "prior_volume_canon",
    status: "accepted",
    authority: "prior_volume_canon",
  },
];

export function priorSourceByCanonFactId(
  canonFactId: string,
  registry: readonly ArchivistPriorSourceIdentity[] = ARCHIVIST_CERTIFICATION_PRIOR_SOURCES,
): ArchivistPriorSourceIdentity | undefined {
  return registry.find((item) => item.canon_fact_id === canonFactId);
}
