/**
 * Live Archivist execution on the generic Execute Expert foundation.
 * Public executeExpert({ mode: "live" }) remains fail-closed.
 * This runner is for the disabled live path, Trigger (fail-closed), and mock tests.
 */

import { randomUUID } from "node:crypto";
import {
  ProviderExecutionAbortedError,
  runWithProviderExecutionKeepAlive,
} from "@/lib/ai/provider-execution.ts";
import { WorkflowCancelledError } from "@/lib/editorial-workflow/types.ts";
import { createExpertCostLedger } from "@/lib/execute-expert/cost.ts";
import { DuplicateActiveWorkflowError, assertNoDuplicateActiveWorkflow } from "@/lib/execute-expert/duplicate.ts";
import { assertVersionPin, isValidContentHash } from "@/lib/execute-expert/pin.ts";
import type { ExecuteExpertResult } from "@/lib/execute-expert/types.ts";
import { ARCHIVIST_WORKFLOW_TYPE } from "@/lib/execute-expert/types.ts";
import {
  ARCHIVIST_DEFINITION_VERSION,
  ARCHIVIST_EXPERT_KEY,
  ARCHIVIST_VERSION,
} from "./contracts.ts";
import {
  ArchivistLiveDisabledError,
  LiveCanonWriteForbiddenError,
  assertArchivistLiveExecutionAllowed,
} from "./live-flags.ts";
import { createDisabledArchivistLiveProvider } from "./live-provider.ts";
import { runArchivistLivePipeline } from "./live-pipeline.ts";
import { LIVE_ARCHIVIST_PIPELINE_PHASES } from "./live-types.ts";
import type {
  LiveArchivistExecutionOptions,
  LiveArchivistExecutionResult,
  LiveArchivistRequest,
} from "./live-types.ts";

function emptyLiveResult(
  request: LiveArchivistRequest,
  args: {
    workflowId: string;
    status: ExecuteExpertResult["status"];
    code: NonNullable<ExecuteExpertResult["error_code"]>;
    diagnostics: string[];
    runtimeMs: number;
    cost: ExecuteExpertResult["cost"];
    costCalls?: LiveArchivistExecutionResult["cost_calls"];
    repair_invoked?: boolean;
    repair_call_count?: number;
    series_canon_check_applied?: boolean;
    prior_accepted_canon_count?: number;
    review?: LiveArchivistExecutionResult["review"];
    findings?: unknown[];
    candidate_canon_delta?: unknown[];
    entity_ambiguities?: unknown[];
  },
): LiveArchivistExecutionResult {
  return {
    ok: false,
    execution_mode: "live",
    expert_key: ARCHIVIST_EXPERT_KEY,
    expert_version: ARCHIVIST_VERSION,
    expert_version_id: request.expert_version_id,
    workflow_id: args.workflowId,
    workflow_type: ARCHIVIST_WORKFLOW_TYPE,
    workflow_definition_version: ARCHIVIST_DEFINITION_VERSION,
    phases: LIVE_ARCHIVIST_PIPELINE_PHASES,
    live_phases: LIVE_ARCHIVIST_PIPELINE_PHASES,
    manuscript_id: request.manuscript_id,
    manuscript_version_id: request.manuscript_version_id,
    content_hash: request.content_hash,
    series_id: request.series_id ?? null,
    series_order: request.series_order ?? null,
    prior_authoritative_manuscript_versions:
      request.prior_authoritative_manuscript_versions ?? [],
    status: args.status,
    published: false,
    findings: args.findings ?? [],
    candidate_canon_delta: args.candidate_canon_delta ?? [],
    entity_ambiguities: args.entity_ambiguities ?? [],
    validation: { ok: false, errors: args.diagnostics },
    provenance: {
      provider: args.cost.provider,
      model: args.cost.model,
    },
    cost: args.cost,
    cost_calls: args.costCalls ?? [],
    runtime_ms: args.runtimeMs,
    canon_writes: { accepted_facts: 0, accepted_bible_revisions: 0, persisted: false },
    read_model: null,
    error_code: args.code,
    diagnostics: args.diagnostics,
    repair_invoked: args.repair_invoked ?? false,
    repair_call_count: args.repair_call_count ?? 0,
    series_canon_check_applied: args.series_canon_check_applied ?? false,
    prior_accepted_canon_count: args.prior_accepted_canon_count ?? 0,
    review: args.review ?? null,
  };
}

function validateLiveRequest(request: LiveArchivistRequest): string | null {
  if (request.expert_key !== ARCHIVIST_EXPERT_KEY) return "expert_key must be archivist";
  if (request.mode !== "live") return "mode must be live";
  if (!request.expert_version_id?.trim()) return "expert_version_id is required";
  if (!request.manuscript_id?.trim()) return "manuscript_id is required";
  if (!request.manuscript_version_id?.trim()) return "manuscript_version_id is required";
  if (!isValidContentHash(request.content_hash ?? "")) {
    return "content_hash must be a 64-character lowercase hex sha256";
  }
  if (typeof request.manuscript_text !== "string") return "manuscript_text is required";
  return null;
}

export async function runArchivistLiveExecution(args: {
  request: LiveArchivistRequest;
  options?: Partial<LiveArchivistExecutionOptions>;
}): Promise<LiveArchivistExecutionResult> {
  const started = Date.now();
  const request = args.request;
  const workflowId = args.options?.workflowId?.trim() || randomUUID();
  const ledger = createExpertCostLedger({ expertKey: ARCHIVIST_EXPERT_KEY, mode: "live" });
  const merged: LiveArchivistExecutionOptions = {
    ...args.options,
    expertKey: ARCHIVIST_EXPERT_KEY,
    expertVersionId: request.expert_version_id,
    manuscriptId: request.manuscript_id,
    manuscriptVersionId: request.manuscript_version_id,
    contentHash: request.content_hash,
    executionMode: "live",
    seriesContext: args.options?.seriesContext ?? {
      series_id: request.series_id,
      series_order: request.series_order,
      prior_authoritative_manuscript_versions: request.prior_authoritative_manuscript_versions,
    },
    workflowId,
    allowUnwiredForTests: args.options?.allowUnwiredForTests,
    allowPaidCertificationRun: args.options?.allowPaidCertificationRun,
  };

  const invalid = validateLiveRequest(request);
  if (invalid) {
    return emptyLiveResult(request, {
      workflowId,
      status: "failed",
      code: "invalid_request",
      diagnostics: [invalid],
      runtimeMs: Date.now() - started,
      cost: ledger.finalize(Date.now() - started),
    });
  }

  try {
    assertArchivistLiveExecutionAllowed({
      allowUnwiredForTests: merged.allowUnwiredForTests,
      allowPaidCertificationRun: merged.allowPaidCertificationRun,
    });
  } catch (error) {
    const message =
      error instanceof ArchivistLiveDisabledError
        ? error.message
        : "Live Archivist execution is not enabled";
    return emptyLiveResult(request, {
      workflowId,
      status: "failed",
      code: "archivist_live_disabled",
      diagnostics: [message],
      runtimeMs: Date.now() - started,
      cost: ledger.finalize(Date.now() - started),
    });
  }

  if (merged.allowUnwiredForTests && !merged.provider) {
    return emptyLiveResult(request, {
      workflowId,
      status: "failed",
      code: "archivist_live_disabled",
      diagnostics: ["test live execution requires an injected mock provider"],
      runtimeMs: Date.now() - started,
      cost: ledger.finalize(Date.now() - started),
    });
  }

  if (merged.allowPaidCertificationRun && !merged.provider) {
    return emptyLiveResult(request, {
      workflowId,
      status: "failed",
      code: "archivist_live_disabled",
      diagnostics: ["paid certification requires an injected Anthropic provider"],
      runtimeMs: Date.now() - started,
      cost: ledger.finalize(Date.now() - started),
    });
  }

  const provider = merged.provider ?? createDisabledArchivistLiveProvider();

  try {
    assertVersionPin(request, merged.pinned);
  } catch {
    return emptyLiveResult(request, {
      workflowId,
      status: "failed",
      code: "version_pin_mismatch",
      diagnostics: ["manuscript version or content hash does not match the pinned identity"],
      runtimeMs: Date.now() - started,
      cost: ledger.finalize(Date.now() - started),
    });
  }

  try {
    await assertNoDuplicateActiveWorkflow(request, merged);
  } catch (error) {
    if (error instanceof DuplicateActiveWorkflowError) {
      return emptyLiveResult(request, {
        workflowId,
        status: "failed",
        code: "duplicate_active_workflow",
        diagnostics: [`active workflow already exists: ${error.existing.workflow_id}`],
        runtimeMs: Date.now() - started,
        cost: ledger.finalize(Date.now() - started),
      });
    }
    throw error;
  }

  try {
    const output = await runWithProviderExecutionKeepAlive(
      async () =>
        runArchivistLivePipeline({
          request,
          options: merged,
          provider,
          ledger,
        }),
      {
        onExecutionHeartbeat:
          merged.onExecutionHeartbeat ?? merged.providerCallHooks?.onExecutionHeartbeat,
        shouldCancel: merged.shouldCancel ?? merged.providerCallHooks?.shouldCancel,
        abortSignal: merged.abortSignal ?? merged.providerCallHooks?.abortSignal,
        heartbeatIntervalMs: merged.heartbeatIntervalMs,
      },
    );

    const runtimeMs = Date.now() - started;
    const cost = ledger.finalize(runtimeMs);
    if (!output.ok) {
      const code =
        output.code === "parse_failed"
          ? "parse_failed"
          : output.code === "structured_output_invalid"
            ? "structured_output_invalid"
            : "validation_failed";
      return emptyLiveResult(request, {
        workflowId,
        status: "failed",
        code,
        diagnostics: output.validation_errors,
        runtimeMs,
        cost,
        costCalls: ledger.calls,
        repair_invoked: output.repair_invoked,
        repair_call_count: output.repair_call_count,
        series_canon_check_applied: output.series_canon_check_applied,
        prior_accepted_canon_count: output.prior_accepted_canon_count,
        review: output.review,
        findings: output.review?.findings ?? [],
        candidate_canon_delta: output.review?.canon_delta ?? [],
        entity_ambiguities: output.review?.entity_ambiguities ?? [],
      });
    }

    return {
      ok: true,
      execution_mode: "live",
      expert_key: ARCHIVIST_EXPERT_KEY,
      expert_version: ARCHIVIST_VERSION,
      expert_version_id: request.expert_version_id,
      workflow_id: workflowId,
      workflow_type: ARCHIVIST_WORKFLOW_TYPE,
      workflow_definition_version: ARCHIVIST_DEFINITION_VERSION,
      phases: LIVE_ARCHIVIST_PIPELINE_PHASES,
      live_phases: output.phases,
      manuscript_id: request.manuscript_id,
      manuscript_version_id: request.manuscript_version_id,
      content_hash: request.content_hash,
      series_id: request.series_id ?? null,
      series_order: request.series_order ?? null,
      prior_authoritative_manuscript_versions:
        request.prior_authoritative_manuscript_versions ?? [],
      status: "completed",
      published: false,
      findings: output.review.findings,
      candidate_canon_delta: output.review.canon_delta,
      entity_ambiguities: output.review.entity_ambiguities,
      validation: { ok: true, errors: [] },
      provenance: { provider: cost.provider, model: cost.model },
      cost,
      cost_calls: ledger.calls,
      runtime_ms: runtimeMs,
      canon_writes: { accepted_facts: 0, accepted_bible_revisions: 0, persisted: false },
      read_model: null,
      repair_invoked: output.repair_invoked,
      repair_call_count: output.repair_call_count,
      series_canon_check_applied: output.series_canon_check_applied,
      prior_accepted_canon_count: output.prior_accepted_canon_count,
      review: output.review,
    };
  } catch (error) {
    const runtimeMs = Date.now() - started;
    const cost = ledger.finalize(runtimeMs);
    if (error instanceof WorkflowCancelledError) {
      return emptyLiveResult(request, {
        workflowId,
        status: "cancelled",
        code: "cancelled",
        diagnostics: ["workflow cancelled before publication"],
        runtimeMs,
        cost,
        costCalls: ledger.calls,
      });
    }
    if (error instanceof ProviderExecutionAbortedError) {
      return emptyLiveResult(request, {
        workflowId,
        status: "cancelled",
        code: "aborted",
        diagnostics: ["execution aborted before publication"],
        runtimeMs,
        cost,
        costCalls: ledger.calls,
      });
    }
    if (error instanceof LiveCanonWriteForbiddenError) {
      return emptyLiveResult(request, {
        workflowId,
        status: "failed",
        code: "canon_write_forbidden",
        diagnostics: [error.message],
        runtimeMs,
        cost,
        costCalls: ledger.calls,
      });
    }
    if (error instanceof ArchivistLiveDisabledError) {
      return emptyLiveResult(request, {
        workflowId,
        status: "failed",
        code: "archivist_live_disabled",
        diagnostics: [error.message],
        runtimeMs,
        cost,
        costCalls: ledger.calls,
      });
    }
    throw error;
  }
}
