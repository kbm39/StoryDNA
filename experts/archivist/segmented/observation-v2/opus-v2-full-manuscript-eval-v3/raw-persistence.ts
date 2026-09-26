/**
 * Experimental raw provider-output archive for a future Opus eval @v3 rerun.
 * Writes only under gitignored .calibration-results. Never logs raw text.
 * Does not write Production. Does not accept canon.
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  OPUS_V2_EVAL_V3_CACHE,
  OPUS_V2_EVAL_V3_EFFORT,
  OPUS_V2_EVAL_V3_FALLBACK,
  OPUS_V2_EVAL_V3_ID,
  OPUS_V2_EVAL_V3_MAX_TOKENS,
  OPUS_V2_EVAL_V3_PROMPT_VERSION,
  OPUS_V2_EVAL_V3_PROVIDER,
  OPUS_V2_EVAL_V3_RAW_ARCHIVE_KIND,
  OPUS_V2_EVAL_V3_RAW_ARCHIVE_RELATIVE_DIR,
  OPUS_V2_EVAL_V3_RAW_GITIGNORED,
  OPUS_V2_EVAL_V3_RAW_PRODUCTION,
  OPUS_V2_EVAL_V3_RAW_PUBLIC,
  OPUS_V2_EVAL_V3_SCHEMA_VERSION,
  OPUS_V2_EVAL_V3_SOURCE_PIN,
  OPUS_V2_EVAL_V3_VERSION,
} from "./lock.ts";

export interface OpusV2EvalV3RawCallRecord {
  workflow_id: string;
  call_id: string;
  role: "observation" | "emergency_repair" | "reconciliation";
  segment_id: string | null;
  recorded_at: string;
  provider: typeof OPUS_V2_EVAL_V3_PROVIDER;
  model: string;
  effort: typeof OPUS_V2_EVAL_V3_EFFORT;
  max_tokens: typeof OPUS_V2_EVAL_V3_MAX_TOKENS;
  cache: typeof OPUS_V2_EVAL_V3_CACHE;
  fallback: typeof OPUS_V2_EVAL_V3_FALLBACK;
  finish_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    thinking_tokens: number | null;
    cached_tokens: number;
  };
  prompt_version: typeof OPUS_V2_EVAL_V3_PROMPT_VERSION;
  schema_version: typeof OPUS_V2_EVAL_V3_SCHEMA_VERSION;
  runner_id: typeof OPUS_V2_EVAL_V3_ID;
  runner_version: typeof OPUS_V2_EVAL_V3_VERSION;
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  plan_fingerprint: string;
  raw_text: string;
  accepted_canon: false;
}

export function experimentalRawArchiveDir(root = process.cwd()): string {
  return join(root, OPUS_V2_EVAL_V3_RAW_ARCHIVE_RELATIVE_DIR);
}

export function rawCallArchivePath(args: {
  workflow_id: string;
  call_id: string;
  root?: string;
}): string {
  return join(experimentalRawArchiveDir(args.root), args.workflow_id, `${args.call_id}.json`);
}

export function hashRawText(rawText: string): string {
  return createHash("sha256").update(rawText, "utf8").digest("hex");
}

export function assertRawArchivePrivacy(): void {
  if (!OPUS_V2_EVAL_V3_RAW_GITIGNORED) {
    throw new Error("opus_v2_eval_v3_raw_must_be_gitignored");
  }
  if (OPUS_V2_EVAL_V3_RAW_PUBLIC || OPUS_V2_EVAL_V3_RAW_PRODUCTION) {
    throw new Error("opus_v2_eval_v3_raw_must_stay_private");
  }
  if (OPUS_V2_EVAL_V3_RAW_ARCHIVE_KIND !== "experimental_local_calibration_artifact") {
    throw new Error("opus_v2_eval_v3_raw_archive_kind");
  }
}

export function redactRawFromMessage(message: string, rawText: string): string {
  if (!rawText) return message;
  return message.includes(rawText) ? message.split(rawText).join("[raw_provider_text_redacted]") : message;
}

export function persistExperimentalRawProviderOutput(
  record: OpusV2EvalV3RawCallRecord,
  root = process.cwd(),
): { path: string; raw_sha256: string } {
  assertRawArchivePrivacy();
  if (record.accepted_canon !== false) {
    throw new Error("opus_v2_eval_v3_raw_cannot_be_accepted_canon");
  }
  if (record.manuscript_id !== OPUS_V2_EVAL_V3_SOURCE_PIN.manuscript_id) {
    throw new Error("opus_v2_eval_v3_raw_source_pin_mismatch");
  }
  if (record.prompt_version !== OPUS_V2_EVAL_V3_PROMPT_VERSION) {
    throw new Error("opus_v2_eval_v3_raw_prompt_mismatch");
  }
  const path = rawCallArchivePath({
    workflow_id: record.workflow_id,
    call_id: record.call_id,
    root,
  });
  mkdirSync(dirname(path), { recursive: true });
  const raw_sha256 = hashRawText(record.raw_text);
  writeFileSync(
    path,
    JSON.stringify(
      {
        archive_kind: OPUS_V2_EVAL_V3_RAW_ARCHIVE_KIND,
        public: false,
        production: false,
        raw_sha256,
        ...record,
        accepted_canon: false,
      },
      null,
      2,
    ),
  );
  return { path, raw_sha256 };
}
