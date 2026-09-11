import type { GenerationMeta } from "@/lib/ai/shared.ts";
import type { ParsedIssue } from "@/lib/ai/review-engine.ts";
import {
  resolveRevisionCandidates,
  type RevisionCandidateParseDiagnostics,
} from "@/lib/ai/revision-candidate-recovery.ts";
import type { ProviderTokenUsage } from "@/lib/editorial-generation/literary-agent-cost.ts";

export const REVISION_CANDIDATE_PARSE_ERROR =
  "Could not parse revision-candidate JSON from the model response.";

export const REVISION_CANDIDATE_EMPTY_ERROR =
  "No revision candidates were produced from the review.";

export interface RevisionCandidatePrimaryResult {
  content: string;
  model: string;
  generationMeta: GenerationMeta;
  durationMs: number;
}

export interface RevisionCandidateRepairResult {
  content: string;
  model: string;
  generationMeta: GenerationMeta;
  durationMs: number;
}

export interface RevisionCandidateLedgerRecord {
  role: "revision_candidates" | "revision_candidates_repair";
  model: string;
  usage: ProviderTokenUsage;
  durationMs: number;
  status?: "ok" | "parse_failed" | "validation_failed";
}

export interface RevisionCandidateStageResult {
  ok: boolean;
  error?: string;
  issues: ParsedIssue[];
  warnings: string[];
  diagnostics: RevisionCandidateParseDiagnostics;
  publishAllowed: boolean;
}

function usageFromMeta(meta?: GenerationMeta | null): ProviderTokenUsage {
  return {
    inputTokens: meta?.inputTokens ?? null,
    outputTokens: meta?.outputTokens ?? null,
    cachedTokens: meta?.cachedTokens ?? null,
    cacheCreationTokens: meta?.cacheCreationTokens ?? null,
  };
}

/**
 * Record provider usage first, then parse. At most one format-repair call.
 * Empty/unusable issues after a structurally valid parse do not invoke repair
 * and do not publish.
 */
export async function completeRevisionCandidatesStage(args: {
  primary: RevisionCandidatePrimaryResult;
  record: (entry: RevisionCandidateLedgerRecord) => { status?: RevisionCandidateLedgerRecord["status"] } | void;
  repairOnce?: (input: {
    malformedRaw: string;
    parseError: string;
  }) => Promise<RevisionCandidateRepairResult>;
}): Promise<RevisionCandidateStageResult> {
  const primaryRecord: RevisionCandidateLedgerRecord = {
    role: "revision_candidates",
    model: args.primary.model,
    usage: usageFromMeta(args.primary.generationMeta),
    durationMs: args.primary.durationMs,
  };
  const recordedPrimary = args.record(primaryRecord) ?? primaryRecord;

  let resolved = resolveRevisionCandidates(args.primary.content, {
    usage_captured_before_parse: true,
    repair_invoked: false,
    repair_parse_ok: null,
  });

  if (resolved.structuralOk && resolved.issues.length > 0) {
    recordedPrimary.status = "ok";
    return {
      ok: true,
      issues: resolved.issues,
      warnings: resolved.warnings,
      diagnostics: resolved.diagnostics,
      publishAllowed: true,
    };
  }

  if (resolved.structuralOk) {
    recordedPrimary.status = "validation_failed";
    const error =
      resolved.warnings.length > 0
        ? `No usable revision candidates were produced. ${resolved.warnings.join(" ")}`
        : REVISION_CANDIDATE_EMPTY_ERROR;
    return {
      ok: false,
      error,
      issues: resolved.issues,
      warnings: resolved.warnings,
      diagnostics: resolved.diagnostics,
      publishAllowed: false,
    };
  }

  recordedPrimary.status = "parse_failed";
  const parseError = resolved.diagnostics.parse_error ?? REVISION_CANDIDATE_PARSE_ERROR;

  if (!args.repairOnce) {
    return {
      ok: false,
      error: parseError,
      issues: [],
      warnings: [],
      diagnostics: resolved.diagnostics,
      publishAllowed: false,
    };
  }

  const repaired = await args.repairOnce({
    malformedRaw: args.primary.content,
    parseError,
  });
  const repairEntry: RevisionCandidateLedgerRecord = {
    role: "revision_candidates_repair",
    model: repaired.model,
    usage: usageFromMeta(repaired.generationMeta),
    durationMs: repaired.durationMs,
  };
  const recordedRepair = args.record(repairEntry) ?? repairEntry;

  resolved = resolveRevisionCandidates(repaired.content, {
    usage_captured_before_parse: true,
    repair_invoked: true,
    repair_parse_ok: false,
  });
  resolved.diagnostics.repair_invoked = true;
  resolved.diagnostics.repair_parse_ok = resolved.structuralOk;
  resolved.diagnostics.usage_captured_before_parse = true;

  if (resolved.structuralOk && resolved.issues.length > 0) {
    recordedRepair.status = "ok";
    return {
      ok: true,
      issues: resolved.issues,
      warnings: resolved.warnings,
      diagnostics: resolved.diagnostics,
      publishAllowed: true,
    };
  }

  if (resolved.structuralOk) {
    recordedRepair.status = "validation_failed";
    const error =
      resolved.warnings.length > 0
        ? `No usable revision candidates were produced. ${resolved.warnings.join(" ")}`
        : REVISION_CANDIDATE_EMPTY_ERROR;
    return {
      ok: false,
      error,
      issues: resolved.issues,
      warnings: resolved.warnings,
      diagnostics: resolved.diagnostics,
      publishAllowed: false,
    };
  }

  recordedRepair.status = "parse_failed";
  return {
    ok: false,
    error: resolved.diagnostics.parse_error ?? REVISION_CANDIDATE_PARSE_ERROR,
    issues: [],
    warnings: [],
    diagnostics: resolved.diagnostics,
    publishAllowed: false,
  };
}
