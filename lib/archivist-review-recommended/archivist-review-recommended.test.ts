import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ARCHIVIST_CANDIDATE_REVIEW_WORKFLOW_ID,
} from "@/lib/archivist-candidate-review/types.ts";
import { ARCHIVIST_REVIEW_DECISION_STORE_RELATIVE } from "./store.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("Phase 1 review-recommended wiring", () => {
  it("adds a sibling author-review section without replacing candidate review", () => {
    const page = readFileSync(join(ROOT, "app/manuscripts/[id]/page.tsx"), "utf8");
    assert.match(page, /ArchivistCandidateReviewPanel/);
    assert.match(page, /ArchivistReviewRecommendedSection/);
    assert.match(page, /loadArchivistReviewRecommendedForManuscript/);
  });

  it("keeps historical candidate-review workflow id unchanged", () => {
    assert.equal(
      ARCHIVIST_CANDIDATE_REVIEW_WORKFLOW_ID,
      "293c23d7-2793-4f79-bb97-5eb3ab8ae7fc",
    );
  });

  it("persists author decisions outside official eval artifacts", () => {
    assert.equal(
      ARCHIVIST_REVIEW_DECISION_STORE_RELATIVE,
      ".calibration-results/archivist-review-decisions/decisions.json",
    );
    assert.doesNotMatch(
      ARCHIVIST_REVIEW_DECISION_STORE_RELATIVE,
      /da1cb4fb|report\.json|candidate-review\.json/,
    );
  });

  it("gives each evidence passage its own review controls", () => {
    const section = readFileSync(
      join(ROOT, "app/manuscripts/[id]/ArchivistReviewRecommendedSection.tsx"),
      "utf8",
    );
    assert.match(section, /card\.passages\.map/);
    assert.match(section, /passage\.passage_key/);
    assert.match(section, /What do you want to do with this passage\?/);
    assert.match(section, /Mark all passages/);
    assert.match(section, /Review status: \{card\.status_summary\}/);
    const action = readFileSync(join(ROOT, "app/actions/archivist-review-recommended.ts"), "utf8");
    assert.match(action, /passages: ReadonlyArray/);
    const migration = readFileSync(
      join(ROOT, "supabase/migrations/0029_archivist_review_decisions.sql"),
      "utf8",
    );
    assert.match(migration, /passage_key\s+text primary key/);
    assert.match(migration, /cluster_fingerprint\s+text not null/);
    assert.match(migration, /evidence_identity\s+text not null/);
    assert.doesNotMatch(migration, /fingerprint\s+text primary key/);
  });
});
