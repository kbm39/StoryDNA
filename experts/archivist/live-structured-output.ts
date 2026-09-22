/**
 * Live Archivist structured-output handling.
 *
 * provider response → usage captured FIRST → parse → deterministic
 * normalize → validate. At most ONE representation-only repair call.
 * Repair must not invent evidence or change editorial meaning.
 * A paid/mock call is never dropped because parse failed.
 */

import type { ProviderCallHooks } from "@/lib/ai/provider-call-hooks.ts";
import type { ExpertCostLedger } from "@/lib/execute-expert/cost.ts";
import type { ArchivistReview } from "./contracts.ts";
import { parseArchivistReview } from "./parsing.ts";
import { normalizeArchivistReview } from "./normalization.ts";
import type { ArchivistLiveProvider } from "./live-provider.ts";
import type { LiveArchivistCallRole } from "./live-types.ts";
import {
  ARCHIVIST_MODEL_OUTPUT_CONTRACT,
  extractArchivistJson,
  type ArchivistJsonExtract,
} from "./model-output.ts";

export const ARCHIVIST_LIVE_MAX_REPAIR_CALLS = 1 as const;

export interface ArchivistStructuredOutputSuccess {
  ok: true;
  review: ArchivistReview;
  repair_invoked: boolean;
  repair_call_count: number;
  repair_parse_ok: boolean | null;
  usage_captured_before_parse: true;
}

export interface ArchivistStructuredOutputFailure {
  ok: false;
  code: "parse_failed" | "structured_output_invalid";
  message: string;
  repair_invoked: boolean;
  repair_call_count: number;
  repair_parse_ok: boolean | null;
  usage_captured_before_parse: true;
  review: null;
}

export type ArchivistStructuredOutputResult =
  | ArchivistStructuredOutputSuccess
  | ArchivistStructuredOutputFailure;

function recordCall(
  ledger: ExpertCostLedger,
  args: {
    role: LiveArchivistCallRole;
    provider: "anthropic";
    model: string;
    usage: {
      inputTokens: number | null;
      outputTokens: number | null;
      cachedTokens: number | null;
      cacheCreationTokens: number | null;
    };
    durationMs: number;
    costUsd: number | null;
    status?: "ok" | "parse_failed" | "validation_failed";
  },
): void {
  ledger.record({
    role: args.role,
    provider: args.provider,
    model: args.model,
    usage: args.usage,
    durationMs: args.durationMs,
    costUsd: args.costUsd,
    status: args.status,
  });
}

export function buildArchivistRepresentationRepairPrompt(args: {
  malformedRaw: string;
  parseError: string;
  failureClass?: string;
}): string {
  return [
    "Repair the Archivist JSON so it is valid structured output.",
    "Representation-only: fix JSON syntax, markdown fences, surrounding prose, missing brackets, and enum casing.",
    "Return ONLY the JSON object. No markdown fences. No commentary.",
    "Do not invent evidence, quotations, locators, canon facts, or findings.",
    "Do not change editorial meaning, classifications, or proposed fact values.",
    "If required evidence is absent, keep the finding unclassified as confirmed or omit invented sides. Do not fabricate.",
    "Do not emit accepted canon. canon_delta status must remain candidate.",
    "Do not emit system identity, metrics, generation, or author_action. StoryDNA attaches those.",
    `Parse error: ${args.parseError}`,
    args.failureClass ? `Failure class: ${args.failureClass}` : "",
    "Target model-facing contract:",
    ARCHIVIST_MODEL_OUTPUT_CONTRACT,
    "Malformed output follows:",
    args.malformedRaw,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function parseExtractedArchivistReview(raw: string): {
  extract: ArchivistJsonExtract;
  parsed: ReturnType<typeof parseArchivistReview> | null;
} {
  const extract = extractArchivistJson(raw);
  if (!extract.ok) return { extract, parsed: null };
  return { extract, parsed: parseArchivistReview(extract.value) };
}

export async function completeArchivistStructuredOutput(args: {
  provider: ArchivistLiveProvider;
  system: string;
  user: string;
  hooks?: ProviderCallHooks;
  ledger: ExpertCostLedger;
  allowRepair?: boolean;
}): Promise<ArchivistStructuredOutputResult> {
  const primary = await args.provider.complete(
    { role: "archivist_review", system: args.system, user: args.user },
    args.hooks,
  );
  recordCall(args.ledger, {
    role: "archivist_review",
    provider: primary.provider,
    model: primary.model,
    usage: primary.usage,
    durationMs: primary.durationMs,
    costUsd: primary.costUsd,
    status: "parse_failed",
  });

  const primaryParsed = parseExtractedArchivistReview(primary.content);
  if (primaryParsed.parsed?.ok) {
    const recorded = args.ledger.calls[args.ledger.calls.length - 1];
    if (recorded) recorded.status = "ok";
    return {
      ok: true,
      review: normalizeArchivistReview(primaryParsed.parsed.review),
      repair_invoked: false,
      repair_call_count: 0,
      repair_parse_ok: null,
      usage_captured_before_parse: true,
    };
  }

  const primaryMessage = primaryParsed.extract.ok
    ? (primaryParsed.parsed && !primaryParsed.parsed.ok
        ? primaryParsed.parsed.message
        : "Archivist output is not valid JSON")
    : primaryParsed.extract.message;

  if (args.allowRepair === false) {
    return {
      ok: false,
      code: "parse_failed",
      message: primaryMessage,
      repair_invoked: false,
      repair_call_count: 0,
      repair_parse_ok: null,
      usage_captured_before_parse: true,
      review: null,
    };
  }

  const repairUser = buildArchivistRepresentationRepairPrompt({
    malformedRaw: primary.content,
    parseError: primaryMessage,
    failureClass: primaryParsed.extract.ok ? undefined : primaryParsed.extract.failure_class,
  });
  const repaired = await args.provider.complete(
    {
      role: "archivist_review_repair",
      system: args.system,
      user: repairUser,
    },
    args.hooks,
  );
  recordCall(args.ledger, {
    role: "archivist_review_repair",
    provider: repaired.provider,
    model: repaired.model,
    usage: repaired.usage,
    durationMs: repaired.durationMs,
    costUsd: repaired.costUsd,
    status: "parse_failed",
  });

  const repairedParsed = parseExtractedArchivistReview(repaired.content);
  if (!repairedParsed.parsed?.ok) {
    const repairMessage = repairedParsed.extract.ok
      ? (repairedParsed.parsed && !repairedParsed.parsed.ok
          ? repairedParsed.parsed.message
          : "Archivist repair output is not valid JSON")
      : repairedParsed.extract.message;
    return {
      ok: false,
      code: "structured_output_invalid",
      message: repairMessage,
      repair_invoked: true,
      repair_call_count: ARCHIVIST_LIVE_MAX_REPAIR_CALLS,
      repair_parse_ok: false,
      usage_captured_before_parse: true,
      review: null,
    };
  }

  const recordedRepair = args.ledger.calls[args.ledger.calls.length - 1];
  if (recordedRepair) recordedRepair.status = "ok";
  return {
    ok: true,
    review: normalizeArchivistReview(repairedParsed.parsed.review),
    repair_invoked: true,
    repair_call_count: ARCHIVIST_LIVE_MAX_REPAIR_CALLS,
    repair_parse_ok: true,
    usage_captured_before_parse: true,
  };
}
