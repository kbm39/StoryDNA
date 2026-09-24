/**
 * Internal $0 segmented rehearsal.
 * Exercises the real loader/plan/checkpoint/merge/assembly path.
 * provider=none, model=none, no SDK, no public live enablement.
 */

import { createExpertCostLedger } from "@/lib/execute-expert/cost.ts";
import {
  getLiveProviderInvocationCount,
  resetLiveProviderInvocationCountForTests,
} from "@/lib/execute-expert/dry-run-guard.ts";
import { countManuscriptWords } from "@/lib/word-count.ts";
import { ARCHIVIST_VERSION } from "../contracts.ts";
import { ARCHIVIST_CONSTITUTION_DEFINITION_HASH } from "../constitution-hash.ts";
import {
  ARCHIVIST_LIVE_MODEL_CERTIFIED,
  isArchivistLiveExecutionAllowed,
  persistAcceptedCanonFromLive,
} from "../live-flags.ts";
import { ARCHIVIST_CONSTITUTION } from "../constitution.ts";
import { archivistRuntimeDefinition } from "../runtime-definition.ts";
import { RECKONING_REVISED_11_SOURCE_PIN } from "../reckoning-revised-11-source-pin.ts";
import { RECKONING_REVISED_11_2_SOURCE_PIN } from "../reckoning-revised-11-2-source-pin.ts";
import { mergeSegmentObservations } from "./book-graph.ts";
import {
  canReuseValidatedCheckpoint,
  checkpointPinsFor,
  createPendingCheckpoints,
  markCheckpointFailed,
  markCheckpointValidated,
} from "./checkpoint.ts";
import { pairDeterministicContradictions } from "./contradiction-pairing.ts";
import { assertCompleteCoverage, buildCoverageReport } from "./coverage.ts";
import { CoverageIncompleteError, SegmentedExecutionUnauthorizedError } from "./errors.ts";
import { assembleSegmentedArchivistReview, executionScopeForCoverage } from "./final-assembly.ts";
import { loadManuscriptSnapshot, loadPinnedReckoningRevised112 } from "./manuscript-loader.ts";
import {
  attachStoryDnaObservationProvenance,
  validateSegmentObservation,
} from "./observation-contract.ts";
import type { SegmentedPersistence } from "./persistence.ts";
import { rehearsalObservationForSegment } from "./rehearsal-observations.ts";
import { selectSegmentsToRun } from "./resume.ts";
import { planSegments } from "./segment-planner.ts";
import type {
  FullNovelCoverageReport,
  PinnedManuscriptStore,
  SegmentCheckpoint,
  SegmentedSimulationResult,
} from "./types.ts";

export const SEGMENTED_REHEARSAL_MODE = "internal_zero_cost_rehearsal" as const;

export interface SegmentedRehearsalOptions {
  manuscriptStore: PinnedManuscriptStore;
  persistence: SegmentedPersistence;
  workflowId?: string;
  resumeWorkflowId?: string;
  failSegmentOrdinal?: number;
  omitSegmentOrdinal?: number;
  usePinnedLoader?: boolean;
  identity?: {
    manuscript_id: string;
    manuscript_version_id: string;
    content_hash: string;
  };
}

export interface SegmentedRehearsalResult extends SegmentedSimulationResult {
  workflow_id: string;
  rehearsal_mode: typeof SEGMENTED_REHEARSAL_MODE;
  provider: "none";
  model: "none";
  reused_segment_ids: string[];
  rerun_segment_ids: string[];
  duplicate_scheduling: false;
  cost_usd: 0;
  cost_status: "exact";
  input_tokens: 0;
  output_tokens: 0;
  cached_tokens: 0;
}

export function assertRehearsalGatesClosed(): void {
  if (ARCHIVIST_CONSTITUTION.execution_wired) {
    throw new SegmentedExecutionUnauthorizedError("execution_wired must remain false");
  }
  if (archivistRuntimeDefinition().enabled) {
    throw new SegmentedExecutionUnauthorizedError("runtime must remain disabled");
  }
  if (ARCHIVIST_CONSTITUTION.studio_selectable) {
    throw new SegmentedExecutionUnauthorizedError("studio_selectable must remain false");
  }
  if (RECKONING_REVISED_11_SOURCE_PIN.authorized_to_run !== false) {
    throw new SegmentedExecutionUnauthorizedError("authorized_to_run must remain false");
  }
  if (RECKONING_REVISED_11_2_SOURCE_PIN.authorized_to_run !== false) {
    throw new SegmentedExecutionUnauthorizedError("authorized_to_run must remain false");
  }
  if (isArchivistLiveExecutionAllowed() !== false) {
    throw new SegmentedExecutionUnauthorizedError("public live execution must remain fail-closed");
  }
  if (ARCHIVIST_LIVE_MODEL_CERTIFIED !== true) {
    throw new SegmentedExecutionUnauthorizedError("live_model_certified must remain true");
  }
}

function attachLoadedObservations(
  checkpoints: SegmentCheckpoint[],
  observations: Awaited<ReturnType<SegmentedPersistence["loadObservations"]>>,
): SegmentCheckpoint[] {
  return checkpoints.map((checkpoint) => {
    const observation = observations.find((item) => item.segment_id === checkpoint.segment_id);
    return observation ? { ...checkpoint, observation } : checkpoint;
  });
}

export async function runSegmentedRehearsal(
  options: SegmentedRehearsalOptions,
): Promise<SegmentedRehearsalResult> {
  assertRehearsalGatesClosed();
  resetLiveProviderInvocationCountForTests();
  const ledger = createExpertCostLedger({ expertKey: "archivist", mode: "dry_run" });
  const snapshot = options.usePinnedLoader === false && options.identity
    ? await loadManuscriptSnapshot(options.manuscriptStore, options.identity)
    : await loadPinnedReckoningRevised112(options.manuscriptStore);

  const active = await options.persistence.listActiveWorkflows();
  if (active.length > 0 && !options.resumeWorkflowId) {
    throw new SegmentedExecutionUnauthorizedError("active segmented rehearsal already exists");
  }

  const plan = planSegments(snapshot.extracted_text, snapshot);
  const coverageBase = buildCoverageReport({
    text: snapshot.extracted_text,
    plan,
    canonicalWordCount: countManuscriptWords(snapshot.extracted_text),
  });

  const workflow = options.resumeWorkflowId
    ? await options.persistence.getWorkflow(options.resumeWorkflowId)
    : await options.persistence.createWorkflow({
        id: options.workflowId,
        manuscript_id: snapshot.manuscript_id,
        manuscript_version_id: snapshot.manuscript_version_id,
        content_hash: snapshot.content_hash,
        archivist_version: ARCHIVIST_VERSION,
        archivist_definition_hash: ARCHIVIST_CONSTITUTION_DEFINITION_HASH,
        status: "running",
        authorized_to_run: false,
      });
  if (!workflow) throw new Error("rehearsal workflow missing");
  await options.persistence.updateWorkflowStatus(workflow.id, "running");
  if (!options.resumeWorkflowId) {
    await options.persistence.savePlan(workflow.id, plan);
    await options.persistence.saveCheckpoints(workflow.id, createPendingCheckpoints(plan));
  }

  let checkpoints = attachLoadedObservations(
    await options.persistence.loadCheckpoints(workflow.id),
    await options.persistence.loadObservations(workflow.id),
  );
  if (checkpoints.length === 0) {
    checkpoints = createPendingCheckpoints(plan);
    await options.persistence.saveCheckpoints(workflow.id, checkpoints);
  }

  const selection = selectSegmentsToRun({ plan, checkpoints });
  const reused = selection.reuse.map((segment) => segment.segment_id);
  const rerun: string[] = [];

  for (const segment of selection.remaining) {
    if (options.omitSegmentOrdinal === segment.ordinal) continue;
    const current = checkpoints.find((item) => item.segment_id === segment.segment_id);
    if (!current) continue;
    if (options.failSegmentOrdinal === segment.ordinal) {
      const failed = markCheckpointFailed(current, `rehearsal injected failure at segment ${segment.ordinal}`);
      checkpoints = checkpoints.map((item) => (item.segment_id === failed.segment_id ? failed : item));
      await options.persistence.saveCheckpoints(workflow.id, checkpoints);
      rerun.push(segment.segment_id);
      break;
    }
    const raw = rehearsalObservationForSegment({
      segment,
      units: plan.units,
      text: snapshot.extracted_text,
    });
    const parsed = validateSegmentObservation(raw, segment.segment_id);
    if (!parsed.ok) {
      const failed = markCheckpointFailed(current, parsed.errors.join("; "));
      checkpoints = checkpoints.map((item) => (item.segment_id === failed.segment_id ? failed : item));
      await options.persistence.saveCheckpoints(workflow.id, checkpoints);
      rerun.push(segment.segment_id);
      continue;
    }
    const observation = attachStoryDnaObservationProvenance(parsed.observation, {
      manuscript_id: snapshot.manuscript_id,
      manuscript_version_id: snapshot.manuscript_version_id,
      content_hash: snapshot.content_hash,
      segment,
    });
    const validated = markCheckpointValidated(current, observation);
    checkpoints = checkpoints.map((item) => (item.segment_id === validated.segment_id ? validated : item));
    await options.persistence.saveCheckpoints(workflow.id, checkpoints);
    await options.persistence.saveObservation(workflow.id, validated, validated.observation!);
    rerun.push(segment.segment_id);
  }

  const validatedIds = checkpoints
    .filter((item) => item.status === "validated")
    .map((item) => item.segment_id);
  const failedVisible = checkpoints.filter((item) => item.status === "failed");
  const missingSegments = plan.segments
    .filter((segment) => !validatedIds.includes(segment.segment_id))
    .map((segment) => segment.segment_id);
  const coverage: FullNovelCoverageReport = buildCoverageReport({
    text: snapshot.extracted_text,
    plan,
    canonicalWordCount: countManuscriptWords(snapshot.extracted_text),
    includedSegmentIds: validatedIds,
  });
  coverage.overlap_words = coverageBase.overlap_words;
  coverage.complete =
    coverage.unique_words_covered === coverage.canonical_manuscript_words &&
    coverage.units_represented === coverage.unit_count &&
    coverage.uncovered_ranges.length === 0 &&
    failedVisible.length === 0 &&
    validatedIds.length === plan.segment_count &&
    coverage.coverage_percentage === 100;

  const graph = mergeSegmentObservations({
    manuscript_id: snapshot.manuscript_id,
    manuscript_version_id: snapshot.manuscript_version_id,
    content_hash: snapshot.content_hash,
    checkpoints,
  });
  const pairs = pairDeterministicContradictions(graph);
  await options.persistence.saveBookGraph(workflow.id, graph);
  await options.persistence.saveCoverage(workflow.id, coverage);

  const diagnostics: string[] = [];
  if (missingSegments.length > 0) {
    diagnostics.push(`uncovered segments: ${missingSegments.join(", ")}`);
  }
  let review = null;
  let ok = coverage.complete;
  try {
    if (!coverage.complete) {
      throw new CoverageIncompleteError(
        `incomplete coverage blocks final review (${coverage.unique_words_covered}/${coverage.canonical_manuscript_words}; missing ${missingSegments.join(", ") || "unknown"})`,
      );
    }
    assertCompleteCoverage(coverage);
    review = assembleSegmentedArchivistReview({
      coverage,
      graph,
      pairs,
      manuscriptText: snapshot.extracted_text,
      manuscript_id: snapshot.manuscript_id,
      manuscript_version_id: snapshot.manuscript_version_id,
      content_hash: snapshot.content_hash,
    });
  } catch (error) {
    ok = false;
    diagnostics.push(error instanceof Error ? error.message : String(error));
  }

  try {
    persistAcceptedCanonFromLive();
  } catch {
    // expected
  }

  await options.persistence.saveCandidateReview(workflow.id, review, review?.canon_delta ?? []);
  await options.persistence.saveCostLedger(workflow.id, []);
  await options.persistence.updateWorkflowStatus(workflow.id, ok ? "completed" : "failed");
  ledger.finalize(0);
  if (getLiveProviderInvocationCount() !== 0) {
    throw new SegmentedExecutionUnauthorizedError("rehearsal invoked a live provider");
  }

  return {
    ok,
    workflow_id: workflow.id,
    rehearsal_mode: SEGMENTED_REHEARSAL_MODE,
    provider: "none",
    model: "none",
    execution_scope: executionScopeForCoverage(coverage),
    coverage,
    plan,
    checkpoints,
    book_graph: graph,
    contradiction_pairs: pairs,
    reconciliation_batches: [],
    candidate_canon: review?.canon_delta ?? [],
    review,
    cost_projection: {
      segment_count: plan.segment_count,
      unique_manuscript_words: coverage.unique_words_covered,
      overlap_words: coverage.overlap_words,
      estimated_input_tokens: 0,
      expected_segment_output_tokens: 0,
      reconciliation_pair_count: pairs.length,
      expected_reconciliation_calls: 0,
      repair_allowance: 0,
      expected_provider_calls: 0,
      low_usd: 0,
      expected_usd: 0,
      high_usd: 0,
      recommended_hard_ceiling_usd: 1,
      runtime_estimate_minutes: { low: 0, expected: 0, high: 0 },
      hypothetical_calls: [],
    },
    cost_calls: ledger.calls,
    provider_calls: 0,
    canon_writes: 0,
    diagnostics,
    reused_segment_ids: reused,
    rerun_segment_ids: rerun,
    duplicate_scheduling: false,
    cost_usd: 0,
    cost_status: "exact",
    input_tokens: 0,
    output_tokens: 0,
    cached_tokens: 0,
  };
}

export function rejectIncompatibleResume(args: {
  plan: Parameters<typeof selectSegmentsToRun>[0]["plan"];
  checkpoints: SegmentCheckpoint[];
  mutated: Partial<SegmentCheckpoint>;
}): { rejected: boolean; reason: string } {
  const first = args.checkpoints.find((item) => item.status === "validated");
  if (!first) return { rejected: true, reason: "no validated checkpoint" };
  const expected = checkpointPinsFor({
    plan: args.plan,
    segment: args.plan.segments.find((segment) => segment.segment_id === first.segment_id)!,
  });
  const ok = canReuseValidatedCheckpoint({ ...first, ...args.mutated }, expected);
  return {
    rejected: !ok,
    reason: ok ? "unexpected reuse" : "checkpoint compatibility pin mismatch",
  };
}

export function costExactZero(result: SegmentedRehearsalResult): boolean {
  return (
    result.provider_calls === 0 &&
    result.cost_usd === 0 &&
    result.input_tokens === 0 &&
    result.output_tokens === 0 &&
    result.cached_tokens === 0 &&
    result.cost_status === "exact" &&
    result.cost_calls.length === 0 &&
    result.provider === "none" &&
    result.model === "none"
  );
}
