/**
 * Generic Execute Expert orchestrator.
 *
 * Reuses Literary Agent guards (provider-call-guard, keep-alive, AbortSignal)
 * without copying the Literary Agent generation pipeline.
 * Live mode is not wired. Dry-run never reaches a provider.
 */

import { randomUUID } from "node:crypto";
import {
  assertProviderCallAllowed,
  assertPublishAllowed,
} from "@/lib/editorial-workflow/provider-call-guard.ts";
import { WorkflowCancelledError } from "@/lib/editorial-workflow/types.ts";
import {
  ProviderExecutionAbortedError,
  runWithProviderExecutionKeepAlive,
} from "@/lib/ai/provider-execution.ts";
import { createArchivistExecuteAdapter } from "@/experts/archivist/execute-adapter.ts";
import { createExpertCostLedger } from "./cost.ts";
import { DuplicateActiveWorkflowError, assertNoDuplicateActiveWorkflow } from "./duplicate.ts";
import {
  DryRunCanonWriteForbiddenError,
  DryRunProviderForbiddenError,
  assertDryRunCannotCallProvider,
} from "./dry-run-guard.ts";
import { assertVersionPin, isValidContentHash } from "./pin.ts";
import { phasesForExpert } from "./phases.ts";
import type {
  ExecuteExpertRequest,
  ExecuteExpertResult,
  ExpertExecuteAdapter,
  ExpertExecutionOptions,
  ExpertWorkflowPhase,
} from "./types.ts";

const ADAPTERS: Record<string, () => ExpertExecuteAdapter> = {
  archivist: createArchivistExecuteAdapter,
};

function fail(
  request: ExecuteExpertRequest,
  options: ExpertExecutionOptions,
  args: {
    code: NonNullable<ExecuteExpertResult["error_code"]>;
    status: ExecuteExpertResult["status"];
    diagnostics: string[];
    runtimeMs: number;
    workflowId: string;
  },
): ExecuteExpertResult {
  const ledger = createExpertCostLedger({
    expertKey: request.expert_key,
    mode: request.mode === "dry_run" ? "dry_run" : "live",
  });
  const cost = ledger.finalize(args.runtimeMs);
  return {
    ok: false,
    execution_mode: request.mode,
    expert_key: request.expert_key,
    expert_version: options.expertVersion ?? "",
    expert_version_id: request.expert_version_id,
    workflow_id: args.workflowId,
    workflow_type: request.expert_key === "archivist" ? "archivist_continuity_review" : "",
    workflow_definition_version: "",
    phases: phasesForExpert(request.expert_key),
    manuscript_id: request.manuscript_id,
    manuscript_version_id: request.manuscript_version_id,
    content_hash: request.content_hash,
    series_id: request.series_id ?? null,
    series_order: request.series_order ?? null,
    prior_authoritative_manuscript_versions:
      request.prior_authoritative_manuscript_versions ?? [],
    status: args.status,
    published: false,
    findings: [],
    candidate_canon_delta: [],
    entity_ambiguities: [],
    validation: { ok: false, errors: args.diagnostics },
    provenance: { provider: "none", model: "none" },
    cost: request.mode === "dry_run" ? { ...cost, cost_status: "exact", token_counts: "exact" } : cost,
    runtime_ms: args.runtimeMs,
    canon_writes: { accepted_facts: 0, accepted_bible_revisions: 0, persisted: false },
    read_model: null,
    error_code: args.code,
    diagnostics: args.diagnostics,
  };
}

function validateRequest(request: ExecuteExpertRequest): string | null {
  if (!request.expert_key?.trim()) return "expert_key is required";
  if (!request.expert_version_id?.trim()) return "expert_version_id is required";
  if (!request.manuscript_id?.trim()) return "manuscript_id is required";
  if (!request.manuscript_version_id?.trim()) return "manuscript_version_id is required";
  if (!isValidContentHash(request.content_hash ?? "")) {
    return "content_hash must be a 64-character lowercase hex sha256";
  }
  if (request.mode !== "dry_run" && request.mode !== "live") {
    return "mode must be dry_run or live";
  }
  return null;
}

async function walkPhases(
  phases: readonly string[],
  options: ExpertExecutionOptions,
): Promise<void> {
  for (const phase of phases) {
    await assertProviderCallAllowed(options.shouldCancel ?? options.providerCallHooks?.shouldCancel);
    if (options.abortSignal?.aborted) {
      throw new ProviderExecutionAbortedError();
    }
    await options.onPhase?.(phase as ExpertWorkflowPhase);
    await options.onExecutionHeartbeat?.();
    await options.providerCallHooks?.onExecutionHeartbeat?.();
    if (phase === "publishing") {
      await assertPublishAllowed(options.shouldCancel ?? options.providerCallHooks?.shouldCancel);
    }
  }
}

export async function executeExpert(
  request: ExecuteExpertRequest,
  options?: Partial<ExpertExecutionOptions>,
): Promise<ExecuteExpertResult> {
  const started = Date.now();
  const workflowId = options?.workflowId?.trim() || randomUUID();
  const merged: ExpertExecutionOptions = {
    ...options,
    expertKey: request.expert_key,
    expertVersionId: request.expert_version_id,
    manuscriptId: request.manuscript_id,
    manuscriptVersionId: request.manuscript_version_id,
    contentHash: request.content_hash,
    executionMode: request.mode,
    seriesContext: options?.seriesContext ?? {
      series_id: request.series_id,
      series_order: request.series_order,
      prior_authoritative_manuscript_versions: request.prior_authoritative_manuscript_versions,
    },
    workflowId,
  };

  const invalid = validateRequest(request);
  if (invalid) {
    return fail(request, merged, {
      code: "invalid_request",
      status: "failed",
      diagnostics: [invalid],
      runtimeMs: Date.now() - started,
      workflowId,
    });
  }

  if (request.mode === "live") {
    const code =
      request.expert_key === "archivist" ? "archivist_live_disabled" : "live_execution_not_wired";
    return fail(request, merged, {
      code,
      status: "failed",
      diagnostics: ["Live Execute Expert is not wired in this phase"],
      runtimeMs: Date.now() - started,
      workflowId,
    });
  }

  assertDryRunCannotCallProvider(request.mode);

  try {
    assertVersionPin(request, merged.pinned);
  } catch {
    return fail(request, merged, {
      code: "version_pin_mismatch",
      status: "failed",
      diagnostics: ["manuscript version or content hash does not match the pinned identity"],
      runtimeMs: Date.now() - started,
      workflowId,
    });
  }

  try {
    await assertNoDuplicateActiveWorkflow(request, merged);
  } catch (error) {
    if (error instanceof DuplicateActiveWorkflowError) {
      return fail(request, merged, {
        code: "duplicate_active_workflow",
        status: "failed",
        diagnostics: [`active workflow already exists: ${error.existing.workflow_id}`],
        runtimeMs: Date.now() - started,
        workflowId,
      });
    }
    throw error;
  }

  const createAdapter = ADAPTERS[request.expert_key];
  if (!createAdapter) {
    return fail(request, merged, {
      code: "expert_adapter_not_wired",
      status: "failed",
      diagnostics: [`No dry-run adapter for expert_key=${request.expert_key}`],
      runtimeMs: Date.now() - started,
      workflowId,
    });
  }

  const adapter = createAdapter();
  const ledger = createExpertCostLedger({ expertKey: request.expert_key, mode: "dry_run" });

  try {
    const output = await runWithProviderExecutionKeepAlive(
      async () => {
        await walkPhases(adapter.phases, merged);
        return adapter.runDryRun({ request, options: merged });
      },
      {
        onExecutionHeartbeat: merged.onExecutionHeartbeat ?? merged.providerCallHooks?.onExecutionHeartbeat,
        shouldCancel: merged.shouldCancel ?? merged.providerCallHooks?.shouldCancel,
        abortSignal: merged.abortSignal ?? merged.providerCallHooks?.abortSignal,
        heartbeatIntervalMs: merged.heartbeatIntervalMs,
      },
    );

    const runtimeMs = Date.now() - started;
    if (!output.validation.ok) {
      return {
        ...fail(request, merged, {
          code: "validation_failed",
          status: "failed",
          diagnostics: output.validation.errors,
          runtimeMs,
          workflowId,
        }),
        findings: output.findings,
        candidate_canon_delta: output.candidate_canon_delta,
        entity_ambiguities: output.entity_ambiguities,
        expert_version: output.expert_version,
        workflow_type: output.workflow_type,
        workflow_definition_version: output.workflow_definition_version,
        read_model: output.read_model,
      };
    }

    return {
      ok: true,
      execution_mode: "dry_run",
      expert_key: request.expert_key,
      expert_version: output.expert_version,
      expert_version_id: request.expert_version_id,
      workflow_id: workflowId,
      workflow_type: output.workflow_type,
      workflow_definition_version: output.workflow_definition_version,
      phases: adapter.phases,
      manuscript_id: request.manuscript_id,
      manuscript_version_id: request.manuscript_version_id,
      content_hash: request.content_hash,
      series_id: request.series_id ?? null,
      series_order: request.series_order ?? null,
      prior_authoritative_manuscript_versions:
        request.prior_authoritative_manuscript_versions ?? [],
      status: "completed",
      published: false,
      findings: output.findings,
      candidate_canon_delta: output.candidate_canon_delta,
      entity_ambiguities: output.entity_ambiguities,
      validation: output.validation,
      provenance: { provider: "none", model: "none" },
      cost: ledger.finalize(runtimeMs),
      runtime_ms: runtimeMs,
      canon_writes: { accepted_facts: 0, accepted_bible_revisions: 0, persisted: false },
      read_model: output.read_model,
    };
  } catch (error) {
    const runtimeMs = Date.now() - started;
    if (error instanceof WorkflowCancelledError) {
      return fail(request, merged, {
        code: "cancelled",
        status: "cancelled",
        diagnostics: ["workflow cancelled before publication"],
        runtimeMs,
        workflowId,
      });
    }
    if (error instanceof ProviderExecutionAbortedError) {
      return fail(request, merged, {
        code: "aborted",
        status: "cancelled",
        diagnostics: ["execution aborted before publication"],
        runtimeMs,
        workflowId,
      });
    }
    if (error instanceof DryRunProviderForbiddenError) {
      return fail(request, merged, {
        code: "dry_run_provider_forbidden",
        status: "failed",
        diagnostics: [error.message],
        runtimeMs,
        workflowId,
      });
    }
    if (error instanceof DryRunCanonWriteForbiddenError) {
      return fail(request, merged, {
        code: "canon_write_forbidden",
        status: "failed",
        diagnostics: [error.message],
        runtimeMs,
        workflowId,
      });
    }
    throw error;
  }
}
