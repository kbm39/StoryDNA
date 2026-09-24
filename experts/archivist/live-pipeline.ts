/**
 * Live Archivist pipeline:
 * validating → preparing → extract_observations → within_book_check →
 * series_canon_check (empty for Book 1 / standalone) → conflict_review →
 * validation → publishing.
 *
 * One structured-output provider call covers extract / within-book / series /
 * conflict review. Phases still heartbeat and honor cancellation.
 * Publishing never persists accepted canon.
 */

import type { CanonFact, CanonStore } from "@/lib/canon/types.ts";
import { ProviderExecutionAbortedError } from "@/lib/ai/provider-execution.ts";
import {
  assertProviderCallAllowed,
  assertPublishAllowed,
} from "@/lib/editorial-workflow/provider-call-guard.ts";
import { ARCHIVIST } from "./definition.ts";
import {
  ARCHIVIST_DEFINITION_VERSION,
  type ArchivistReview,
} from "./contracts.ts";
import { buildArchivistSystemPrompt } from "./prompts.ts";
import { validateArchivistReview } from "./validation.ts";
import type { ArchivistLiveProvider } from "./live-provider.ts";
import { completeArchivistStructuredOutput } from "./live-structured-output.ts";
import {
  applyArchivistLivePostprocess,
  liveReviewEmitsAcceptedCanon,
  liveReviewEmitsAuthorDisposition,
} from "./live-postprocess.ts";
import { applyArchivistSystemOwnedFields, buildArchivistModelOutputInstructions } from "./model-output.ts";
import type {
  LiveArchivistExecutionOptions,
  LiveArchivistPipelinePhase,
  LiveArchivistRequest,
} from "./live-types.ts";
import { LIVE_ARCHIVIST_PIPELINE_PHASES } from "./live-types.ts";
import type { ExpertCostLedger } from "@/lib/execute-expert/cost.ts";

export interface LiveArchivistPipelineSuccess {
  ok: true;
  review: ArchivistReview;
  phases: readonly LiveArchivistPipelinePhase[];
  repair_invoked: boolean;
  repair_call_count: number;
  series_canon_check_applied: boolean;
  prior_accepted_canon_count: number;
}

export interface LiveArchivistPipelineFailure {
  ok: false;
  code: "parse_failed" | "structured_output_invalid" | "validation_failed";
  message: string;
  phases: readonly LiveArchivistPipelinePhase[];
  repair_invoked: boolean;
  repair_call_count: number;
  series_canon_check_applied: boolean;
  prior_accepted_canon_count: number;
  review: ArchivistReview | null;
  validation_errors: string[];
}

export type LiveArchivistPipelineResult =
  | LiveArchivistPipelineSuccess
  | LiveArchivistPipelineFailure;

export function serializePriorAcceptedCanonForPrompt(facts: readonly CanonFact[]): string {
  if (facts.length === 0) {
    return "No accepted prior-volume Series Bible facts are available. This is a standalone or Book 1 pass. Do not invent prior canon.";
  }
  const readOnly = facts
    .filter((fact) => fact.status === "accepted")
    .map((fact) => ({
      id: fact.id,
      entity_id: fact.entity_id,
      fact_type: fact.fact_type,
      fact_value: fact.fact_value,
      temporal_scope: fact.temporal_scope,
      authority: fact.authority,
      status: fact.status,
      locator: fact.locator,
      source_manuscript_id: fact.source_manuscript_id,
      source_version_id: fact.source_version_id,
    }));
  return [
    "ACCEPTED PRIOR CANON (read-only). You may cite these as conflicting evidence.",
    "You must not accept, supersede, retcon, or rewrite them.",
    JSON.stringify(readOnly, null, 2),
  ].join("\n");
}

export async function loadPriorAcceptedCanonReadOnly(args: {
  series_id?: string | null;
  series_order?: number | null;
  canonicalContext?: CanonStore;
  loadPriorAcceptedCanon?: LiveArchivistExecutionOptions["loadPriorAcceptedCanon"];
  prior_authoritative_manuscript_versions?: LiveArchivistRequest["prior_authoritative_manuscript_versions"];
}): Promise<readonly CanonFact[]> {
  if (args.loadPriorAcceptedCanon) {
    return args.loadPriorAcceptedCanon({
      series_id: args.series_id,
      series_order: args.series_order,
      canonicalContext: args.canonicalContext,
      prior_authoritative_manuscript_versions: args.prior_authoritative_manuscript_versions,
    });
  }
  const store = args.canonicalContext;
  if (!store) return [];
  return store.facts.filter((fact) => fact.status === "accepted");
}

function bindLiveReviewIdentity(
  review: ArchivistReview,
  request: LiveArchivistRequest,
): ArchivistReview {
  return applyArchivistSystemOwnedFields(review, {
    manuscript_id: request.manuscript_id,
    manuscript_version_id: request.manuscript_version_id,
    content_hash: request.content_hash,
    series_id: request.series_id,
  });
}

export function buildLiveArchivistUserPrompt(args: {
  request: LiveArchivistRequest;
  priorAcceptedCanon: readonly CanonFact[];
  seriesCanonCheckApplicable: boolean;
}): string {
  const prior = serializePriorAcceptedCanonForPrompt(args.priorAcceptedCanon);
  return [
    ARCHIVIST.intro,
    "",
    buildArchivistModelOutputInstructions(),
    "",
    "Pipeline coverage required:",
    "- extract_observations",
    "- within_book_check",
    args.seriesCanonCheckApplicable
      ? "- series_canon_check against the read-only accepted prior canon below"
      : "- series_canon_check: no prior-volume inputs; do not invent series canon",
    "- conflict_review",
    "",
    "Canon delta status must be candidate. Never emit accepted facts.",
    "author_action must remain pending. Do not dismiss conflicts or approve retcons.",
    "Confirmed contradictions require current evidence, conflicting evidence, and locators for both.",
    "Never fabricate quotations. If evidence is insufficient, use possible_continuity_conflict or author_verification_needed.",
    "",
    `Manuscript id: ${args.request.manuscript_id}`,
    `Manuscript version: ${args.request.manuscript_version_id}`,
    `Content hash: ${args.request.content_hash}`,
    `Series id: ${args.request.series_id ?? "none"}`,
    `Series order: ${args.request.series_order ?? "unspecified"}`,
    `Workflow definition: ${ARCHIVIST_DEFINITION_VERSION}`,
    "",
    prior,
    "",
    "MANUSCRIPT:",
    args.request.manuscript_text,
  ].join("\n");
}

export async function runArchivistLivePipeline(args: {
  request: LiveArchivistRequest;
  options: LiveArchivistExecutionOptions;
  provider: ArchivistLiveProvider;
  ledger: ExpertCostLedger;
}): Promise<LiveArchivistPipelineResult> {
  const walked: LiveArchivistPipelinePhase[] = [];
  const cancel = args.options.shouldCancel ?? args.options.providerCallHooks?.shouldCancel;
  const abortSignal = args.options.abortSignal ?? args.options.providerCallHooks?.abortSignal;

  async function enter(phase: LiveArchivistPipelinePhase): Promise<void> {
    await assertProviderCallAllowed(cancel);
    if (abortSignal?.aborted) {
      throw new ProviderExecutionAbortedError();
    }
    walked.push(phase);
    await args.options.onPhase?.(phase);
    await args.options.onExecutionHeartbeat?.();
    await args.options.providerCallHooks?.onExecutionHeartbeat?.();
  }

  await enter("validating");
  await enter("preparing");

  const priorAcceptedCanon = await loadPriorAcceptedCanonReadOnly({
    series_id: args.request.series_id,
    series_order: args.request.series_order,
    canonicalContext: args.options.canonicalContext,
    loadPriorAcceptedCanon: args.options.loadPriorAcceptedCanon,
    prior_authoritative_manuscript_versions:
      args.request.prior_authoritative_manuscript_versions,
  });
  const seriesCanonCheckApplied =
    (args.request.prior_authoritative_manuscript_versions?.length ?? 0) > 0 ||
    priorAcceptedCanon.length > 0 ||
    (args.request.series_order != null && args.request.series_order > 1);

  await enter("extract_observations");
  await enter("within_book_check");
  await enter("series_canon_check");
  await enter("conflict_review");

  const structured = await completeArchivistStructuredOutput({
    provider: args.provider,
    system: buildArchivistSystemPrompt(ARCHIVIST),
    user: buildLiveArchivistUserPrompt({
      request: args.request,
      priorAcceptedCanon,
      seriesCanonCheckApplicable: seriesCanonCheckApplied,
    }),
    hooks: {
      ...args.options.providerCallHooks,
      onExecutionHeartbeat:
        args.options.onExecutionHeartbeat ?? args.options.providerCallHooks?.onExecutionHeartbeat,
      shouldCancel: cancel,
      abortSignal,
    },
    ledger: args.ledger,
    allowRepair: args.options.allowRepair,
  });

  await enter("validation");

  if (!structured.ok) {
    return {
      ok: false,
      code: structured.code,
      message: structured.message,
      phases: walked,
      repair_invoked: structured.repair_invoked,
      repair_call_count: structured.repair_call_count,
      series_canon_check_applied: seriesCanonCheckApplied,
      prior_accepted_canon_count: priorAcceptedCanon.length,
      review: null,
      validation_errors: [structured.message],
    };
  }

  const bound = bindLiveReviewIdentity(structured.review, args.request);
  const manuscriptText = args.request.manuscript_text.trim()
    ? args.request.manuscript_text
    : undefined;
  const postprocessed = applyArchivistLivePostprocess(bound, {
    manuscriptText,
    useCertificationEntityCatalog:
      args.options.allowPaidCertificationRun === true ||
      args.options.allowUnwiredForTests === true,
    entityContext: {
      catalog: args.options.entityCatalog,
      canonStore: args.options.canonicalContext,
      canonScope: args.request.series_id
        ? { series_id: args.request.series_id }
        : { standalone_manuscript_id: args.request.manuscript_id },
    },
  });

  if (liveReviewEmitsAcceptedCanon(postprocessed) || liveReviewEmitsAuthorDisposition(postprocessed)) {
    return {
      ok: false,
      code: "validation_failed",
      message: liveReviewEmitsAcceptedCanon(postprocessed)
        ? "Live Archivist emitted accepted canon; fail closed without coercion"
        : "Live Archivist emitted an author disposition; fail closed",
      phases: walked,
      repair_invoked: structured.repair_invoked,
      repair_call_count: structured.repair_call_count,
      series_canon_check_applied: seriesCanonCheckApplied,
      prior_accepted_canon_count: priorAcceptedCanon.length,
      review: postprocessed,
      validation_errors: [
        liveReviewEmitsAcceptedCanon(postprocessed)
          ? "canon_delta status must remain candidate"
          : "author_action must remain pending",
      ],
    };
  }

  const validation = validateArchivistReview(postprocessed, {
    manuscriptText: args.request.manuscript_text.trim()
      ? args.request.manuscript_text
      : undefined,
  });
  if (!validation.ok) {
    return {
      ok: false,
      code: "validation_failed",
      message: validation.errors[0] ?? "Archivist live output failed validation",
      phases: walked,
      repair_invoked: structured.repair_invoked,
      repair_call_count: structured.repair_call_count,
      series_canon_check_applied: seriesCanonCheckApplied,
      prior_accepted_canon_count: priorAcceptedCanon.length,
      review: postprocessed,
      validation_errors: validation.errors,
    };
  }

  await enter("publishing");
  await assertPublishAllowed(cancel);

  return {
    ok: true,
    review: postprocessed,
    phases: LIVE_ARCHIVIST_PIPELINE_PHASES,
    repair_invoked: structured.repair_invoked,
    repair_call_count: structured.repair_call_count,
    series_canon_check_applied: seriesCanonCheckApplied,
    prior_accepted_canon_count: priorAcceptedCanon.length,
  };
}
