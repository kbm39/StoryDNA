import {
  canEstablishCanonIndependently,
} from "./authority.ts";
import { recordConflict } from "./conflicts.ts";
import {
  acceptedPeersForFact,
  isTimeVaryingExclusiveFactType,
  temporalFactCompatibility,
} from "./temporal.ts";
import {
  CanonDomainError,
  type CanonCreatedBy,
  type CanonFact,
  type CanonFactTransition,
  type CanonStore,
} from "./types.ts";

function nowIso(now?: string): string {
  return now ?? new Date().toISOString();
}

function requireFact(store: CanonStore, id: string): CanonFact {
  const fact = store.facts.find((row) => row.id === id);
  if (!fact) throw new CanonDomainError("FACT_NOT_FOUND");
  return fact;
}

export function createCandidateFact(
  store: CanonStore,
  input: Omit<CanonFact, "id" | "status" | "superseded_by_fact_id" | "created_at" | "updated_at"> & {
    status?: CanonFact["status"];
  },
  now?: string,
): CanonFact {
  if (input.status != null && input.status !== "candidate") {
    throw new CanonDomainError(
      input.created_by === "extraction" && input.status === "accepted"
        ? "EXTRACTION_CANNOT_ACCEPT_CANON"
        : "CANDIDATE_ONLY_INSERT",
    );
  }
  const stamp = nowIso(now);
  const fact: CanonFact = {
    ...input,
    id: crypto.randomUUID(),
    status: "candidate",
    superseded_by_fact_id: null,
    created_at: stamp,
    updated_at: stamp,
  };
  store.facts.push(fact);
  return fact;
}

function recordTransition(
  store: CanonStore,
  row: Omit<CanonFactTransition, "id" | "created_at">,
  now: string,
): CanonFactTransition {
  const transition: CanonFactTransition = {
    ...row,
    id: crypto.randomUUID(),
    created_at: now,
  };
  store.transitions.push(transition);
  return transition;
}

function alreadyHasConflictPair(store: CanonStore, leftId: string, rightId: string): boolean {
  return store.conflicts.some(
    (conflict) =>
      (conflict.current_observation_fact_id === leftId && conflict.conflicting_canon_fact_id === rightId) ||
      (conflict.current_observation_fact_id === rightId && conflict.conflicting_canon_fact_id === leftId),
  );
}

function assertExclusiveTemporalCompatibility(
  store: CanonStore,
  fact: CanonFact,
  now: string,
): void {
  if (!isTimeVaryingExclusiveFactType(fact.fact_type)) return;
  for (const existing of acceptedPeersForFact(store.facts, fact)) {
    const compatibility = temporalFactCompatibility(existing, fact);
    if (compatibility.kind === "compatible") continue;
    if (compatibility.kind === "redundant") {
      throw new CanonDomainError("REDUNDANT_ACCEPTED_FACT");
    }
    if (!alreadyHasConflictPair(store, fact.id, existing.id)) {
      recordConflict(
        store,
        {
          series_id: fact.series_id,
          manuscript_id: fact.source_manuscript_id,
          classification: compatibility.classification,
          severity: compatibility.classification === "confirmed_contradiction" ? "major" : "moderate",
          confidence: compatibility.classification === "confirmed_contradiction" ? "high" : "medium",
          current_observation_fact_id: fact.id,
          conflicting_canon_fact_id: existing.id,
          explanation:
            compatibility.relation === "unknown"
              ? "Accepted facts of this type have an unknown temporal relationship and incompatible values."
              : "Accepted facts of this type overlap in narrative time with incompatible values.",
          suggested_resolution:
            compatibility.relation === "unknown"
              ? "Establish chapter or from/to scope, or choose which state is canonical."
              : "Keep both with disjoint scopes, or supersede/retcon one fact.",
          author_comment: null,
        },
        now,
      );
    }
    throw new CanonDomainError("CONFLICTING_PRIORS_UNRESOLVED");
  }
}

/** Author (or bible import) promotion. Extraction cannot call this. */
export function promoteFactToAccepted(
  store: CanonStore,
  args: {
    factId: string;
    actor: Exclude<CanonCreatedBy, "extraction" | "inferred">;
    now?: string;
  },
): CanonFact {
  if (args.actor !== "author" && args.actor !== "bible_import") {
    throw new CanonDomainError("ACCEPTED_CANON_REQUIRES_AUTHOR");
  }
  const fact = requireFact(store, args.factId);
  if (fact.status !== "candidate") throw new CanonDomainError("NOT_CANDIDATE");
  if (!canEstablishCanonIndependently(fact.authority)) {
    throw new CanonDomainError("INFERRED_CANNOT_BECOME_CANON");
  }

  const stamp = nowIso(args.now);
  assertExclusiveTemporalCompatibility(store, fact, stamp);

  fact.status = "accepted";
  fact.updated_at = stamp;
  recordTransition(
    store,
    {
      from_fact_id: fact.id,
      to_fact_id: fact.id,
      kind: "promotion",
      reason: "author_promotion",
      created_by: args.actor,
    },
    stamp,
  );
  return fact;
}

export function supersedeFact(
  store: CanonStore,
  args: {
    previousFactId: string;
    replacement: Omit<
      CanonFact,
      "id" | "status" | "superseded_by_fact_id" | "created_at" | "updated_at"
    >;
    kind: "supersession" | "retcon";
    actor: "author" | "bible_import";
    reason: string;
    now?: string;
  },
): { previous: CanonFact; replacement: CanonFact } {
  const previous = requireFact(store, args.previousFactId);
  if (previous.status !== "accepted") throw new CanonDomainError("SUPERSEDE_REQUIRES_ACCEPTED");

  const stamp = nowIso(args.now);
  const replacement: CanonFact = {
    ...args.replacement,
    id: crypto.randomUUID(),
    status: "accepted",
    superseded_by_fact_id: null,
    created_by: args.actor,
    created_at: stamp,
    updated_at: stamp,
  };
  if (args.kind === "retcon") {
    replacement.authority = "author_approved_exception";
  }

  store.facts.push(replacement);
  previous.status = "superseded";
  previous.superseded_by_fact_id = replacement.id;
  previous.updated_at = stamp;

  recordTransition(
    store,
    {
      from_fact_id: previous.id,
      to_fact_id: replacement.id,
      kind: args.kind,
      reason: args.reason,
      created_by: args.actor,
    },
    stamp,
  );
  return { previous, replacement };
}

export function rejectCandidateFact(
  store: CanonStore,
  args: { factId: string; actor: "author" | "bible_import"; reason?: string; now?: string },
): CanonFact {
  const fact = requireFact(store, args.factId);
  if (fact.status !== "candidate") throw new CanonDomainError("NOT_CANDIDATE");
  const stamp = nowIso(args.now);
  fact.status = "rejected";
  fact.updated_at = stamp;
  recordTransition(
    store,
    {
      from_fact_id: fact.id,
      to_fact_id: null,
      kind: "rejection",
      reason: args.reason ?? null,
      created_by: args.actor,
    },
    stamp,
  );
  return fact;
}

export function historicalFactsForEntity(store: CanonStore, entityId: string): CanonFact[] {
  return store.facts.filter((fact) => fact.entity_id === entityId);
}
