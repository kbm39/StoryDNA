import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  createMemoryReviewDecisionStore,
  type ArchivistReviewDecision,
  type ArchivistReviewDecisionStore,
} from "@/experts/archivist/segmented/observation-v2/review-recommended/index.ts";

export const ARCHIVIST_REVIEW_DECISION_STORE_KIND =
  "archivist_review_decisions@v2" as const;

export const ARCHIVIST_REVIEW_DECISION_STORE_RELATIVE =
  ".calibration-results/archivist-review-decisions/decisions.json" as const;

interface PersistedDecisionFile {
  kind: typeof ARCHIVIST_REVIEW_DECISION_STORE_KIND;
  official_eval_artifact: false;
  decisions: ArchivistReviewDecision[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function reviewDecisionStorePath(root = process.cwd()): string {
  return join(root, ARCHIVIST_REVIEW_DECISION_STORE_RELATIVE);
}

export function createFileReviewDecisionStore(root = process.cwd()): ArchivistReviewDecisionStore {
  const path = reviewDecisionStorePath(root);
  const loaded: ArchivistReviewDecision[] = [];
  if (existsSync(path)) {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (
      isRecord(raw) &&
      raw.kind === ARCHIVIST_REVIEW_DECISION_STORE_KIND &&
      raw.official_eval_artifact === false &&
      Array.isArray(raw.decisions)
    ) {
      loaded.push(
        ...(raw.decisions as ArchivistReviewDecision[]).filter((row) => isRecord(row) && typeof row.passage_key === "string"),
      );
    }
  }
  const memory = createMemoryReviewDecisionStore(loaded);
  return {
    get: (fingerprint) => memory.get(fingerprint),
    list: () => memory.list(),
    put(decision) {
      const saved = memory.put(decision);
      const payload: PersistedDecisionFile = {
        kind: ARCHIVIST_REVIEW_DECISION_STORE_KIND,
        official_eval_artifact: false,
        decisions: memory.list(),
      };
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
      return saved;
    },
  };
}
