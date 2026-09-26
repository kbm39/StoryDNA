import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { ARCHIVIST_CONSTITUTION } from "../../../constitution.ts";
import { isArchivistLiveExecutionAllowed } from "../../../live-flags.ts";
import { archivistRuntimeDefinition } from "../../../runtime-definition.ts";
import { V2_ADAPTER_VERSION } from "../adapter.ts";
import { V2_OBSERVATION_COMPARISON_VERSION } from "../comparison.ts";
import { V2_EVIDENCE_GATE_VERSION } from "../evidence-contiguity.ts";
import { V2_PHASE2_HELD_OUT_IDS } from "../phase-2/index.ts";
import {
  V2_EXTRACTION_PROMPT_VERSION,
  V2_PROMPT_MAX_TOKENS,
} from "../prompt.ts";
import { V2_TRUNCATED_PREFIX_RECOVERY_VERSION } from "../truncated-prefix-recovery.ts";
import {
  OPUS_V2_EVAL_FUTURE_HARD_CEILING_USD,
  OPUS_V2_EVAL_MAX_TOKENS,
  OPUS_V2_EVAL_PROMPT_VERSION,
  OPUS_V2_EVAL_VERSION,
} from "../opus-v2-full-manuscript-eval/lock.ts";
import {
  OPUS_V2_EVAL_V2_AUTHORIZED_TO_RUN,
  OPUS_V2_EVAL_V2_CEILING_AUTHORIZED,
  OPUS_V2_EVAL_V2_COMPLETED_OPUS_WORKFLOW_ID,
  OPUS_V2_EVAL_V2_CONSUMED_AUTHORIZATION_ID,
  OPUS_V2_EVAL_V2_EFFORT,
  OPUS_V2_EVAL_V2_EXECUTION_FINGERPRINT,
  OPUS_V2_EVAL_V2_FUTURE_EXPECTED_USD_MAX,
  OPUS_V2_EVAL_V2_FUTURE_HIGH_USD_MAX,
  OPUS_V2_EVAL_V2_FUTURE_LOW_USD,
  OPUS_V2_EVAL_V2_HELD_OUT_IDS,
  OPUS_V2_EVAL_V2_HISTORICAL_REVISED_13_WORKFLOW_ID,
  OPUS_V2_EVAL_V2_ID,
  OPUS_V2_EVAL_V2_MAX_TOKENS,
  OPUS_V2_EVAL_V2_MODEL,
  OPUS_V2_EVAL_V2_ORGANIZATION_MAPPING,
  OPUS_V2_EVAL_V2_OUTPUT_ORDER,
  OPUS_V2_EVAL_V2_PLAN_FINGERPRINT_UNCHANGED,
  OPUS_V2_EVAL_V2_PROMPT_VERSION,
  OPUS_V2_EVAL_V2_PROVIDER,
  OPUS_V2_EVAL_V2_RAW_ARCHIVE_RELATIVE_DIR,
  OPUS_V2_EVAL_V2_RECOMMENDED_HARD_CEILING_USD,
  OPUS_V2_EVAL_V2_SCHEMA_VERSION,
  OPUS_V2_EVAL_V2_SOURCE_PIN,
  OPUS_V2_EVAL_V2_SPEND_AUTHORIZED,
  OPUS_V2_EVAL_V2_SUCCESS_BAR,
  OPUS_V2_EVAL_V2_VERSION,
  OPUS_V2_EVAL_V2_WIRED_TO_PAID_PATH,
  OPUS_V2_EVAL_V2_WIRED_TO_PUBLIC_LIVE,
  assertHistoricalEvalV1Unchanged,
  persistExperimentalRawProviderOutput,
  redactRawFromMessage,
} from "./index.ts";

const ROOT = dirname(fileURLToPath(import.meta.url));
const MODULE_FILES = [
  "fixtures.ts",
  "index.ts",
  "lock.ts",
  "opus-v2-full-manuscript-eval-v2.test.ts",
  "paid-authorization.ts",
  "paid-authorization.test.ts",
  "raw-persistence.ts",
];

describe("isolated Opus eval @v2 future configuration", () => {
  it("stays unauthorized and does not overwrite historical eval @v1", () => {
    assert.equal(assertHistoricalEvalV1Unchanged(), true);
    assert.equal(OPUS_V2_EVAL_VERSION, "archivist_opus_v2_full_manuscript_eval@v1");
    assert.equal(OPUS_V2_EVAL_PROMPT_VERSION, "archivist_v2_extraction_prompt@v2");
    assert.equal(OPUS_V2_EVAL_MAX_TOKENS, 4000);
    assert.equal(V2_EXTRACTION_PROMPT_VERSION, "archivist_v2_extraction_prompt@v2");
    assert.equal(V2_PROMPT_MAX_TOKENS, 4000);
    assert.equal(OPUS_V2_EVAL_FUTURE_HARD_CEILING_USD, 6);
    assert.equal(OPUS_V2_EVAL_V2_ID, "archivist-opus-v2-full-manuscript-eval-v2");
    assert.equal(OPUS_V2_EVAL_V2_VERSION, "archivist_opus_v2_full_manuscript_eval@v2");
    assert.equal(OPUS_V2_EVAL_V2_PROMPT_VERSION, "archivist_v2_extraction_prompt@v3");
    assert.equal(OPUS_V2_EVAL_V2_SCHEMA_VERSION, "archivist_segment_observation@v2");
    assert.equal(OPUS_V2_EVAL_V2_MAX_TOKENS, 6000);
    assert.equal(OPUS_V2_EVAL_V2_EFFORT, "medium");
    assert.equal(OPUS_V2_EVAL_V2_MODEL, "claude-opus-5-5");
    assert.equal(OPUS_V2_EVAL_V2_PROVIDER, "anthropic");
    assert.equal(OPUS_V2_EVAL_V2_AUTHORIZED_TO_RUN, false);
    assert.equal(OPUS_V2_EVAL_V2_SPEND_AUTHORIZED, false);
    assert.equal(OPUS_V2_EVAL_V2_CEILING_AUTHORIZED, false);
    assert.equal(OPUS_V2_EVAL_V2_RECOMMENDED_HARD_CEILING_USD, 5);
    assert.equal(OPUS_V2_EVAL_V2_WIRED_TO_PAID_PATH, false);
    assert.equal(OPUS_V2_EVAL_V2_WIRED_TO_PUBLIC_LIVE, false);
    assert.equal(isArchivistLiveExecutionAllowed(), false);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
  });

  it("keeps the 14-segment plan fingerprint and isolates a new execution fingerprint", () => {
    assert.equal(
      OPUS_V2_EVAL_V2_PLAN_FINGERPRINT_UNCHANGED,
      "c10f91f8efdc7e1ae821f5c7c7f824da8b085913506cab7d2c4b3514d5656686",
    );
    assert.equal(OPUS_V2_EVAL_V2_SOURCE_PIN.analytical_word_count, 109887);
    assert.equal(OPUS_V2_EVAL_V2_EXECUTION_FINGERPRINT.length, 64);
    assert.notEqual(
      OPUS_V2_EVAL_V2_EXECUTION_FINGERPRINT,
      OPUS_V2_EVAL_V2_PLAN_FINGERPRINT_UNCHANGED,
    );
    assert.equal(OPUS_V2_EVAL_V2_OUTPUT_ORDER, "manuscript_appearance_order");
    assert.equal(OPUS_V2_EVAL_V2_ORGANIZATION_MAPPING.schema_kind_added, false);
    assert.equal(OPUS_V2_EVAL_V2_FUTURE_LOW_USD, 2.2);
    assert.equal(OPUS_V2_EVAL_V2_FUTURE_EXPECTED_USD_MAX, 3.1);
    assert.equal(OPUS_V2_EVAL_V2_FUTURE_HIGH_USD_MAX, 3.7);
    assert.equal(OPUS_V2_EVAL_V2_SUCCESS_BAR.candidate_count_is_success_metric, false);
    assert.equal(OPUS_V2_EVAL_V2_SUCCESS_BAR.injury_min, 4);
    assert.equal(OPUS_V2_EVAL_V2_SUCCESS_BAR.travel_leg_min, 3);
    assert.deepEqual([...OPUS_V2_EVAL_V2_SUCCESS_BAR.consumed_rule8_retain], [
      "R8-001",
      "R8-012",
      "R8-025",
    ]);
  });

  it("does not reuse the consumed authorization or mutate completed workflows", () => {
    assert.equal(
      OPUS_V2_EVAL_V2_COMPLETED_OPUS_WORKFLOW_ID,
      "8911acab-2ea0-44a7-b5ad-b677c57e185b",
    );
    assert.equal(
      OPUS_V2_EVAL_V2_CONSUMED_AUTHORIZATION_ID,
      "reckoning-revised-13-opus-v2-full-eval-20260925",
    );
    assert.equal(
      OPUS_V2_EVAL_V2_HISTORICAL_REVISED_13_WORKFLOW_ID,
      "293c23d7-2793-4f79-bb97-5eb3ab8ae7fc",
    );
  });

  it("preserves prefix recovery, evidence gate, and pairing versions", () => {
    assert.equal(V2_TRUNCATED_PREFIX_RECOVERY_VERSION, "archivist_v2_truncated_prefix_recovery@v1");
    assert.equal(V2_EVIDENCE_GATE_VERSION, "archivist_v2_contiguous_evidence@v1");
    assert.equal(V2_OBSERVATION_COMPARISON_VERSION, "archivist_v2_observation_comparison@v1");
    assert.equal(V2_ADAPTER_VERSION, "archivist_v2_compact_adapter@v1");
  });

  it("archives raw provider text privately and redacts it from errors", () => {
    const root = mkdtempSync(join(tmpdir(), "opus-v2-eval-v2-raw-"));
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
          prompt_version: "archivist_v2_extraction_prompt@v3",
          schema_version: "archivist_segment_observation@v2",
          runner_id: "archivist-opus-v2-full-manuscript-eval-v2",
          runner_version: "archivist_opus_v2_full_manuscript_eval@v2",
          manuscript_id: OPUS_V2_EVAL_V2_SOURCE_PIN.manuscript_id,
          manuscript_version_id: OPUS_V2_EVAL_V2_SOURCE_PIN.manuscript_version_id,
          content_hash: OPUS_V2_EVAL_V2_SOURCE_PIN.content_hash,
          plan_fingerprint: OPUS_V2_EVAL_V2_SOURCE_PIN.plan_fingerprint,
          raw_text,
          accepted_canon: false,
        },
        root,
      );
      const saved = JSON.parse(readFileSync(persisted.path, "utf8")) as {
        raw_text: string;
        public: boolean;
        production: boolean;
        accepted_canon: boolean;
      };
      assert.equal(saved.raw_text, raw_text);
      assert.equal(saved.public, false);
      assert.equal(saved.production, false);
      assert.equal(saved.accepted_canon, false);
      assert.match(OPUS_V2_EVAL_V2_RAW_ARCHIVE_RELATIVE_DIR, /^\.calibration-results\//);
      assert.equal(
        redactRawFromMessage(`parse failed: ${raw_text}`, raw_text).includes(raw_text),
        false,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps held-out Rule 8 IDs out of the eval v2 module", () => {
    assert.deepEqual([...OPUS_V2_EVAL_V2_HELD_OUT_IDS], [...V2_PHASE2_HELD_OUT_IDS]);
    const gitignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    assert.match(gitignore, /\.calibration-results\//);
    for (const file of MODULE_FILES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const id of V2_PHASE2_HELD_OUT_IDS) {
        assert.equal(text.includes(id), false, `${file} listed ${id}`);
      }
      if (file !== "opus-v2-full-manuscript-eval-v2.test.ts") {
        assert.equal(/hold fast/i.test(text), false, file);
      }
    }
  });
});
