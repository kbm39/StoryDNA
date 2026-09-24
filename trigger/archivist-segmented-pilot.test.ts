import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getLiveProviderInvocationCount, resetLiveProviderInvocationCountForTests } from "@/lib/execute-expert/dry-run-guard.ts";
import { RECKONING_PAID_PILOT_AUTHORIZATION } from "@/experts/archivist/segmented/paid-pilot-authorization.ts";
import { PaidPilotUnauthorizedError } from "@/experts/archivist/segmented/errors.ts";
import {
  ARCHIVIST_SEGMENTED_PILOT_TASK_ID,
  executeArchivistSegmentedPilotTask,
} from "./archivist-segmented-pilot.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Archivist segmented paid-pilot Trigger task", () => {
  const src = readFileSync(join(ROOT, "trigger/archivist-segmented-pilot.ts"), "utf8");
  const old = readFileSync(join(ROOT, "trigger/archivist-continuity-review.ts"), "utf8");
  const config = readFileSync(join(ROOT, "trigger.config.ts"), "utf8");

  it("uses keep-alive wiring and is distinct from the empty-text continuity task", () => {
    assert.equal(ARCHIVIST_SEGMENTED_PILOT_TASK_ID, "archivist-segmented-pilot");
    assert.match(src, /heartbeats\.yield\(\)/);
    assert.match(src, /abortSignal: timeout\.signal/);
    assert.match(src, /maxDuration: PAID_PILOT_TRIGGER_MAX_DURATION_SECONDS/);
    assert.match(src, /manuscript_text_empty/);
    assert.doesNotMatch(src, /manuscript_text: ""/);
    assert.match(old, /manuscript_text: ""/);
    assert.match(config, /dirs: \["\.\/trigger"\]/);
    assert.match(config, /proj_ijlzqjkrsswgjlacylsa/);
  });

  it("fail-closes on prepared authorization without constructing a provider", async () => {
    resetLiveProviderInvocationCountForTests();
    await assert.rejects(
      () =>
        executeArchivistSegmentedPilotTask({
          manuscript_id: RECKONING_PAID_PILOT_AUTHORIZATION.manuscript_id,
          manuscript_version_id: RECKONING_PAID_PILOT_AUTHORIZATION.manuscript_version_id,
          content_hash: RECKONING_PAID_PILOT_AUTHORIZATION.content_hash,
          authorization_id: RECKONING_PAID_PILOT_AUTHORIZATION.authorization_id,
        }, { manuscriptText: "PROLOGUE\n\nPinned rehearsal text for empty-path refusal." }),
      PaidPilotUnauthorizedError,
    );
    assert.equal(getLiveProviderInvocationCount(), 0);
  });

  it("refuses empty manuscript_text before the provider gate", async () => {
    resetLiveProviderInvocationCountForTests();
    await assert.rejects(
      () =>
        executeArchivistSegmentedPilotTask({
          manuscript_id: RECKONING_PAID_PILOT_AUTHORIZATION.manuscript_id,
          manuscript_version_id: RECKONING_PAID_PILOT_AUTHORIZATION.manuscript_version_id,
          content_hash: RECKONING_PAID_PILOT_AUTHORIZATION.content_hash,
          authorization_id: RECKONING_PAID_PILOT_AUTHORIZATION.authorization_id,
        }),
      /manuscript_text_empty/,
    );
    assert.equal(getLiveProviderInvocationCount(), 0);
  });
});
