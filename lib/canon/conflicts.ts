import {
  CanonDomainError,
  type CanonConflict,
  type CanonConflictDisposition,
  type CanonConflictEvent,
  type CanonStore,
} from "./types.ts";

function recordConflictEvent(
  store: CanonStore,
  row: Omit<CanonConflictEvent, "id">,
): CanonConflictEvent {
  const event: CanonConflictEvent = {
    ...row,
    id: crypto.randomUUID(),
  };
  store.conflict_events.push(event);
  return event;
}

export function classifyConflict(args: {
  explainedInText: boolean;
  bothSidesCited: boolean;
  evidenceInsufficient: boolean;
  withinBookOnly: boolean;
}): CanonConflict["classification"] {
  if (args.evidenceInsufficient) return "author_verification_needed";
  if (args.explainedInText) return "possible_continuity_conflict";
  if (args.bothSidesCited) return "confirmed_contradiction";
  if (args.withinBookOnly && !args.bothSidesCited) return "author_verification_needed";
  return "possible_continuity_conflict";
}

export function recordConflict(
  store: CanonStore,
  input: Omit<CanonConflict, "id" | "author_action" | "created_at" | "updated_at"> & {
    author_action?: CanonConflict["author_action"];
  },
  now: string,
): CanonConflict {
  if (input.current_observation_fact_id === input.conflicting_canon_fact_id) {
    throw new CanonDomainError("CONFLICT_SAME_FACT");
  }
  const current = store.facts.find((fact) => fact.id === input.current_observation_fact_id);
  if (!current) throw new CanonDomainError("FACT_NOT_FOUND");
  if (
    input.conflicting_canon_fact_id &&
    !store.facts.some((fact) => fact.id === input.conflicting_canon_fact_id)
  ) {
    throw new CanonDomainError("FACT_NOT_FOUND");
  }

  const conflict: CanonConflict = {
    ...input,
    id: crypto.randomUUID(),
    author_action: input.author_action ?? "pending",
    created_at: now,
    updated_at: now,
  };
  store.conflicts.push(conflict);
  recordConflictEvent(store, {
    conflict_id: conflict.id,
    author_action: conflict.author_action,
    comment: conflict.author_comment,
    created_by: "system",
    created_at: now,
  });
  return conflict;
}

export function applyConflictDisposition(
  store: CanonStore,
  args: {
    conflictId: string;
    action: CanonConflictDisposition;
    comment?: string | null;
    now?: string;
  },
): CanonConflict {
  const conflict = store.conflicts.find((row) => row.id === args.conflictId);
  if (!conflict) throw new CanonDomainError("CONFLICT_NOT_FOUND");
  const stamp = args.now ?? new Date().toISOString();
  conflict.author_action = args.action;
  if (args.comment !== undefined) conflict.author_comment = args.comment;
  conflict.updated_at = stamp;
  recordConflictEvent(store, {
    conflict_id: conflict.id,
    author_action: args.action,
    comment: args.comment ?? conflict.author_comment,
    created_by: "author",
    created_at: stamp,
  });
  return conflict;
}

export function unresolvedConflicts(store: CanonStore, manuscriptId?: string): CanonConflict[] {
  return store.conflicts.filter((conflict) => {
    if (conflict.author_action !== "pending") return false;
    if (manuscriptId && conflict.manuscript_id !== manuscriptId) return false;
    return true;
  });
}
