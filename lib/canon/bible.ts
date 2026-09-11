import { CanonDomainError, type CanonStore, type SeriesBibleRevision } from "./types.ts";

/** Extraction never creates revision 1. Author (or bible import) must open a draft. */
export function createDraftBibleRevision(
  store: CanonStore,
  args: {
    seriesId: string;
    factIds: string[];
    actor: "author" | "bible_import" | "system" | "extraction";
    notes?: string | null;
    now?: string;
  },
): SeriesBibleRevision {
  if (args.actor !== "author" && args.actor !== "bible_import") {
    throw new CanonDomainError("BIBLE_REQUIRES_AUTHOR");
  }
  for (const factId of args.factIds) {
    const fact = store.facts.find((row) => row.id === factId);
    if (!fact) throw new CanonDomainError("FACT_NOT_FOUND");
    if (fact.status !== "accepted") throw new CanonDomainError("BIBLE_FACTS_MUST_BE_ACCEPTED");
    if (fact.series_id !== args.seriesId) throw new CanonDomainError("BIBLE_FACT_SERIES_MISMATCH");
  }

  const existing = store.bible_revisions.filter((row) => row.series_id === args.seriesId);
  const revision_number = existing.reduce((max, row) => Math.max(max, row.revision_number), 0) + 1;
  const stamp = args.now ?? new Date().toISOString();
  const revision: SeriesBibleRevision = {
    id: crypto.randomUUID(),
    series_id: args.seriesId,
    revision_number,
    status: "draft",
    supersedes_revision_id: existing.find((row) => row.status === "accepted")?.id ?? null,
    notes: args.notes ?? null,
    created_by: args.actor,
    accepted_at: null,
    accepted_by: null,
    created_at: stamp,
    updated_at: stamp,
    fact_ids: [...args.factIds],
  };
  store.bible_revisions.push(revision);
  return revision;
}

export function acceptBibleRevision(
  store: CanonStore,
  args: { revisionId: string; actor: "author" | "bible_import"; now?: string },
): SeriesBibleRevision {
  const revision = store.bible_revisions.find((row) => row.id === args.revisionId);
  if (!revision) throw new CanonDomainError("BIBLE_REVISION_NOT_FOUND");
  if (revision.status !== "draft") throw new CanonDomainError("BIBLE_NOT_DRAFT");

  const stamp = args.now ?? new Date().toISOString();
  const prior = store.bible_revisions.find(
    (row) => row.series_id === revision.series_id && row.status === "accepted" && row.id !== revision.id,
  );
  if (prior) {
    prior.status = "superseded";
    prior.updated_at = stamp;
  }

  revision.status = "accepted";
  revision.accepted_at = stamp;
  revision.accepted_by = args.actor;
  revision.updated_at = stamp;
  return revision;
}

export function acceptedBibleFacts(store: CanonStore, seriesId: string) {
  const accepted = store.bible_revisions.find(
    (row) => row.series_id === seriesId && row.status === "accepted",
  );
  if (!accepted) return [];
  return store.facts.filter((fact) => accepted.fact_ids.includes(fact.id));
}
