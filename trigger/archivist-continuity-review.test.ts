import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ARCHIVIST_CONTINUITY_REVIEW_TASK_ID,
  executeArchivistContinuityReviewTask,
} from "./archivist-continuity-review.ts";
import {
  FIXTURE_CONTENT_HASH,
  FIXTURE_MANUSCRIPT_ID,
  FIXTURE_MANUSCRIPT_VERSION_ID,
} from "@/experts/archivist/fixtures.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXPERT_VERSION_ID = "883407ad-4afe-4f3c-a69b-eaa3234fc9c6";

describe("Archivist continuity-review Trigger task", () => {
  const src = readFileSync(join(ROOT, "trigger/archivist-continuity-review.ts"), "utf8");
  const config = readFileSync(join(ROOT, "trigger.config.ts"), "utf8");

  it("uses the hardened Trigger keep-alive foundation and is picked up from ./trigger", () => {
    assert.equal(ARCHIVIST_CONTINUITY_REVIEW_TASK_ID, "archivist-continuity-review");
    assert.match(src, /import \{ task, heartbeats, timeout \} from "@trigger\.dev\/sdk\/v3"/);
    assert.match(src, /onExecutionHeartbeat: \(\) => heartbeats\.yield\(\)/);
    assert.match(src, /abortSignal: timeout\.signal/);
    assert.match(src, /maxDuration: 3600/);
    assert.match(config, /dirs: \["\.\/trigger"\]/);
  });

  it("fail-closes without enabling live execution if the task is invoked", async () => {
    const result = await executeArchivistContinuityReviewTask({
      manuscript_id: FIXTURE_MANUSCRIPT_ID,
      manuscript_version_id: FIXTURE_MANUSCRIPT_VERSION_ID,
      content_hash: FIXTURE_CONTENT_HASH,
      expert_version_id: EXPERT_VERSION_ID,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error_code, "archivist_live_disabled");
    assert.equal(result.published, false);
    assert.equal(result.cost.call_count, 0);
  });
});
