import { CanonDomainError, type CanonEvidence, type CanonStore } from "./types.ts";

const CONTENT_HASH = /^[a-f0-9]{64}$/;

export function attachEvidence(
  store: CanonStore,
  input: Omit<CanonEvidence, "id" | "created_at">,
  now?: string,
): CanonEvidence {
  if (!input.fact_id && !input.conflict_id) {
    throw new CanonDomainError("EVIDENCE_NEEDS_TARGET");
  }
  if (!CONTENT_HASH.test(input.content_hash)) {
    throw new CanonDomainError("INVALID_CONTENT_HASH");
  }
  const row: CanonEvidence = {
    ...input,
    id: crypto.randomUUID(),
    created_at: now ?? new Date().toISOString(),
  };
  store.evidence.push(row);
  return row;
}

export function evidenceForConflict(store: CanonStore, conflictId: string): CanonEvidence[] {
  return store.evidence.filter((row) => row.conflict_id === conflictId);
}

export function evidenceForFact(store: CanonStore, factId: string): CanonEvidence[] {
  return store.evidence.filter((row) => row.fact_id === factId);
}
