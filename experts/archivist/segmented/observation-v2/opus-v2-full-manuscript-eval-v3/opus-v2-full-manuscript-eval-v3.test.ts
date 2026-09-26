import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ARCHIVIST_CONSTITUTION } from "../../../constitution.ts";
import { isArchivistLiveExecutionAllowed } from "../../../live-flags.ts";
import { archivistRuntimeDefinition } from "../../../runtime-definition.ts";
import { V2_PHASE2_HELD_OUT_IDS } from "../phase-2/index.ts";
import {
  OPUS_V2_EVAL_PROMPT_VERSION,
  OPUS_V2_EVAL_VERSION,
} from "../opus-v2-full-manuscript-eval/lock.ts";
import { OPUS_V2_EVAL_PAID_AUTHORIZATION_ID } from "../opus-v2-full-manuscript-eval/paid-authorization.ts";
import {
  OPUS_V2_EVAL_V2_PROMPT_VERSION,
  OPUS_V2_EVAL_V2_VERSION,
} from "../opus-v2-full-manuscript-eval-v2/lock.ts";
import { OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID } from "../opus-v2-full-manuscript-eval-v2/paid-authorization.ts";
import {
  OPUS_V2_EVAL_V3_AUTHORIZED_TO_RUN,
  OPUS_V2_EVAL_V3_COMPLETED_OPUS_V1_WORKFLOW_ID,
  OPUS_V2_EVAL_V3_COMPLETED_OPUS_V2_WORKFLOW_ID,
  OPUS_V2_EVAL_V3_CONSUMED_AUTHORIZATION_IDS,
  OPUS_V2_EVAL_V3_EXECUTION_FINGERPRINT,
  OPUS_V2_EVAL_V3_HELD_OUT_IDS,
  OPUS_V2_EVAL_V3_HISTORICAL_REVISED_13_WORKFLOW_ID,
  OPUS_V2_EVAL_V3_ID,
  OPUS_V2_EVAL_V3_MAX_TOKENS,
  OPUS_V2_EVAL_V3_OBSERVATION_HARD_CAP,
  OPUS_V2_EVAL_V3_PLAN_FINGERPRINT_UNCHANGED,
  OPUS_V2_EVAL_V3_PROMPT_VERSION,
  OPUS_V2_EVAL_V3_SOURCE_PIN,
  OPUS_V2_EVAL_V3_SPEND_AUTHORIZED,
  OPUS_V2_EVAL_V3_SUCCESS_BAR,
  OPUS_V2_EVAL_V3_VERSION,
  OPUS_V2_EVAL_V3_WIRED_TO_PAID_PATH,
  assertHistoricalEvalsUnchangedByV3,
  persistExperimentalRawProviderOutput,
  redactRawFromMessage,
} from "./index.ts";

const ROOT = dirname(fileURLToPath(import.meta.url));
const MODULE_FILES = [
  "explicit-grant.ts",
  "fixtures.ts",
  "index.ts",
  "lock.ts",
  "opus-v2-full-manuscript-eval-v3.test.ts",
  "paid-authorization.ts",
  "paid-authorization.test.ts",
  "paid-authorization-lifecycle.test.ts",
  "raw-persistence.ts",
];

describe("isolated Opus eval @v3 future configuration", () => {
  it("stays unauthorized and does not overwrite eval @v1 or @v2", () => {
    assert.equal(assertHistoricalEvalsUnchangedByV3(), true);
    assert.equal(OPUS_V2_EVAL_VERSION, "archivist_opus_v2_full_manuscript_eval@v1");
    assert.equal(OPUS_V2_EVAL_PROMPT_VERSION, "archivist_v2_extraction_prompt@v2");
    assert.equal(OPUS_V2_EVAL_V2_VERSION, "archivist_opus_v2_full_manuscript_eval@v2");
    assert.equal(OPUS_V2_EVAL_V2_PROMPT_VERSION, "archivist_v2_extraction_prompt@v3");
    assert.equal(OPUS_V2_EVAL_V3_ID, "archivist-opus-v2-full-manuscript-eval-v3");
    assert.equal(OPUS_V2_EVAL_V3_VERSION, "archivist_opus_v2_full_manuscript_eval@v3");
    assert.equal(OPUS_V2_EVAL_V3_PROMPT_VERSION, "archivist_v2_extraction_prompt@v4");
    assert.equal(OPUS_V2_EVAL_V3_MAX_TOKENS, 6000);
    assert.equal(OPUS_V2_EVAL_V3_OBSERVATION_HARD_CAP, 16);
    assert.equal(OPUS_V2_EVAL_V3_AUTHORIZED_TO_RUN, false);
    assert.equal(OPUS_V2_EVAL_V3_SPEND_AUTHORIZED, false);
    assert.equal(OPUS_V2_EVAL_V3_WIRED_TO_PAID_PATH, false);
    assert.equal(isArchivistLiveExecutionAllowed(), false);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
  });

  it("keeps the 14-segment plan and isolates a new execution fingerprint", () => {
    assert.equal(
      OPUS_V2_EVAL_V3_PLAN_FINGERPRINT_UNCHANGED,
      "c10f91f8efdc7e1ae821f5c7c7f824da8b085913506cab7d2c4b3514d5656686",
    );
    assert.equal(OPUS_V2_EVAL_V3_SOURCE_PIN.analytical_word_count, 109887);
    assert.equal(OPUS_V2_EVAL_V3_EXECUTION_FINGERPRINT.length, 64);
    assert.notEqual(
      OPUS_V2_EVAL_V3_EXECUTION_FINGERPRINT,
      OPUS_V2_EVAL_V3_PLAN_FINGERPRINT_UNCHANGED,
    );
    assert.equal(OPUS_V2_EVAL_V3_SUCCESS_BAR.observation_hard_cap, 16);
    assert.equal(OPUS_V2_EVAL_V3_SUCCESS_BAR.normal_parse_rate_min, "8/14");
    assert.equal(OPUS_V2_EVAL_V3_SUCCESS_BAR.max_tokens_rate_max, "6/14");
  });

  it("does not reuse consumed authorizations or completed workflows", () => {
    assert.deepEqual([...OPUS_V2_EVAL_V3_CONSUMED_AUTHORIZATION_IDS], [
      OPUS_V2_EVAL_PAID_AUTHORIZATION_ID,
      OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID,
    ]);
    assert.equal(
      OPUS_V2_EVAL_V3_COMPLETED_OPUS_V1_WORKFLOW_ID,
      "8911acab-2ea0-44a7-b5ad-b677c57e185b",
    );
    assert.equal(
      OPUS_V2_EVAL_V3_COMPLETED_OPUS_V2_WORKFLOW_ID,
      "b30594ca-c56f-4379-b40b-6a2349f259ed",
    );
    assert.equal(
      OPUS_V2_EVAL_V3_HISTORICAL_REVISED_13_WORKFLOW_ID,
      "293c23d7-2793-4f79-bb97-5eb3ab8ae7fc",
    );
  });

  it("archives raw provider text privately and redacts it from errors", () => {
    const root = mkdtempSync(join(tmpdir(), "opus-v2-eval-v3-raw-"));
    const raw_text = '{"schema":"archivist_segment_observation@v2","observations":[]}';
    try {
      const persisted = persistExperimentalRawProviderOutput(
        {
          workflow_id: "11111111-2222-4333-8444-555555555555",
          call_id: "seg-01-observation",
          role: "observation",
          segment_id: "seg-01-prologue-chapter-02",
          recorded_at: "2026-09-26T00:00:00.000Z",
          provider: "anthropic",
          model: "claude-opus-5-5",
          effort: "medium",
          max_tokens: 6000,
          cache: "off",
          fallback: "none",
          finish_reason: "end_turn",
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            thinking_tokens: 0,
            cached_tokens: 0,
          },
          prompt_version: "archivist_v2_extraction_prompt@v4",
          schema_version: "archivist_segment_observation@v2",
          runner_id: "archivist-opus-v2-full-manuscript-eval-v3",
          runner_version: "archivist_opus_v2_full_manuscript_eval@v3",
          manuscript_id: OPUS_V2_EVAL_V3_SOURCE_PIN.manuscript_id,
          manuscript_version_id: OPUS_V2_EVAL_V3_SOURCE_PIN.manuscript_version_id,
          content_hash: OPUS_V2_EVAL_V3_SOURCE_PIN.content_hash,
          plan_fingerprint: OPUS_V2_EVAL_V3_SOURCE_PIN.plan_fingerprint,
          raw_text,
          accepted_canon: false,
        },
        root,
      );
      const saved = JSON.parse(readFileSync(persisted.path, "utf8")) as { raw_text: string };
      assert.equal(saved.raw_text, raw_text);
      assert.equal(
        redactRawFromMessage(`parse failed: ${raw_text}`, raw_text).includes(raw_text),
        false,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps held-out Rule 8 IDs out of the eval v3 module", () => {
    assert.deepEqual([...OPUS_V2_EVAL_V3_HELD_OUT_IDS], [...V2_PHASE2_HELD_OUT_IDS]);
    for (const file of MODULE_FILES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const id of V2_PHASE2_HELD_OUT_IDS) {
        assert.equal(text.includes(id), false, `${file} listed ${id}`);
      }
      if (file !== "opus-v2-full-manuscript-eval-v3.test.ts") {
        assert.equal(/hold fast/i.test(text), false, file);
      }
    }
  });
});
