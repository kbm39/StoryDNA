import {
  CANON_AUTHORITY_RANK,
  CanonDomainError,
  type CanonAuthority,
  type CanonFact,
  type CanonStore,
} from "./types.ts";

export function authorityRank(authority: CanonAuthority): number {
  return CANON_AUTHORITY_RANK[authority];
}

export function authorityOutranks(left: CanonAuthority, right: CanonAuthority): boolean {
  return authorityRank(left) > authorityRank(right);
}

export function canEstablishCanonIndependently(authority: CanonAuthority): boolean {
  return authority !== "inferred" && authority !== "uncertain_observation";
}

/**
 * Query-time authority. Accepted fact rows are immutable, so Series Bible
 * membership and prior-volume context are derived rather than written back.
 */
export function effectiveAuthority(
  fact: CanonFact,
  store: CanonStore,
  context?: { manuscript_id?: string },
): CanonAuthority {
  let authority = fact.authority;

  const inAcceptedBible = store.bible_revisions.some(
    (revision) => revision.status === "accepted" && revision.fact_ids.includes(fact.id),
  );
  if (
    inAcceptedBible &&
    authorityRank(authority) < authorityRank("series_bible_accepted")
  ) {
    authority = "series_bible_accepted";
  }

  if (
    context?.manuscript_id &&
    fact.source_manuscript_id !== context.manuscript_id &&
    (fact.status === "accepted" || fact.status === "superseded") &&
    authorityRank(authority) < authorityRank("prior_volume_canon")
  ) {
    authority = "prior_volume_canon";
  }

  return authority;
}

/** Lower-authority facts must never silently replace a higher-authority accepted fact. */
export function assertNoSilentOverwrite(args: {
  existing: CanonFact;
  incoming: Pick<CanonFact, "authority" | "status">;
  store?: CanonStore;
}): void {
  if (args.existing.status !== "accepted") return;
  const existingAuthority = args.store
    ? effectiveAuthority(args.existing, args.store)
    : args.existing.authority;
  if (authorityRank(args.incoming.authority) < authorityRank(existingAuthority)) {
    throw new CanonDomainError("SILENT_CANON_OVERWRITE");
  }
  if (
    authorityRank(args.incoming.authority) === authorityRank(existingAuthority) &&
    args.incoming.status === "accepted"
  ) {
    throw new CanonDomainError("CONFLICTING_PRIORS_UNRESOLVED");
  }
}
