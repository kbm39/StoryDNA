import { createExpertCostLedger } from "@/lib/execute-expert/cost.ts";
import { getLiveProviderInvocationCount } from "@/lib/execute-expert/dry-run-guard.ts";
import { countManuscriptWords } from "@/lib/word-count.ts";
import { ARCHIVIST_EXPERT_KEY } from "../contracts.ts";
import { persistAcceptedCanonFromLive } from "../live-flags.ts";
import { mergeSegmentObservations } from "./book-graph.ts";
import {
  createPendingCheckpoints,
  markCheckpointFailed,
  markCheckpointValidated,
} from "./checkpoint.ts";
import { assertCertifiedSegmentedModel } from "./certified-model.ts";
import { pairDeterministicContradictions } from "./contradiction-pairing.ts";
import { projectSegmentedRunCost } from "./cost-model.ts";
import { buildCoverageReport } from "./coverage.ts";
import { CoverageIncompleteError } from "./errors.ts";
import { assembleSegmentedArchivistReview, executionScopeForCoverage } from "./final-assembly.ts";
import { buildSyntheticThirtyUnitManuscript, mockObservationForSegment } from "./fixtures.ts";
import {
  attachStoryDnaObservationProvenance,
  validateSegmentObservation,
} from "./observation-contract.ts";
import { batchReconciliationItems, buildReconciliationItems } from "./reconciliation.ts";
import { selectSegmentsToRun } from "./resume.ts";
import { planSegments } from "./segment-planner.ts";
import type { SegmentCheckpoint, SegmentedSimulationResult } from "./types.ts";

export function runLocalSegmentedSimulation(args?: {
  failCoverage?: boolean;
  failOneSegment?: boolean;
  reuseValidated?: boolean;
  oversizedChapter?: number;
  configuredModel?: { provider?: string; model?: string };
}): SegmentedSimulationResult {
  const started = Date.now();
  const diagnostics: string[] = [];
  assertCertifiedSegmentedModel({
    provider: args?.configuredModel?.provider ?? "anthropic",
    model: args?.configuredModel?.model ?? "claude-haiku-4-5-20251001",
  });

  const { text, snapshot } = buildSyntheticThirtyUnitManuscript({
    wordsPerUnit: 900,
    oversizedChapter: args?.oversizedChapter,
    oversizedWords: args?.oversizedChapter != null ? 15_000 : undefined,
  });
  const plan = planSegments(text, snapshot, { requireReckoningThirtyUnits: true });
  const coverage = buildCoverageReport({
    text,
    plan,
    canonicalWordCount: args?.failCoverage
      ? countManuscriptWords(text) + 1
      : countManuscriptWords(text),
  });

  const ledger = createExpertCostLedger({ expertKey: ARCHIVIST_EXPERT_KEY, mode: "live" });
  let checkpoints = createPendingCheckpoints(plan);
  if (args?.reuseValidated) {
    const first = plan.segments[0]!;
    const observation = attachStoryDnaObservationProvenance(
      mockObservationForSegment({
        segmentId: first.segment_id,
        primaryHeadings: first.assignments
          .filter((item) => item.role === "primary")
          .map((item) => item.heading),
      }),
      { ...snapshot, segment: first },
    );
    checkpoints[0] = markCheckpointValidated(checkpoints[0]!, observation);
  }

  const selection = selectSegmentsToRun({ plan, checkpoints });
  for (const segment of selection.remaining) {
    const pending = checkpoints.find((item) => item.segment_id === segment.segment_id);
    if (!pending) continue;
    if (args?.failOneSegment && segment.ordinal === plan.segments.length) {
      ledger.record({
        role: "segment_observation",
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
        usage: { inputTokens: 10, outputTokens: 4, cachedTokens: 0, cacheCreationTokens: 0 },
        durationMs: 1,
        costUsd: 0,
        status: "parse_failed",
      });
      const failed = markCheckpointFailed(pending, "mock segment parse failure");
      checkpoints = checkpoints.map((item) =>
        item.segment_id === failed.segment_id ? failed : item,
      );
      diagnostics.push(`failed segment remains visible: ${failed.segment_id}`);
      continue;
    }

    ledger.record({
      role: "segment_observation",
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      usage: {
        inputTokens: segment.approximate_input_tokens,
        outputTokens: 20,
        cachedTokens: 0,
        cacheCreationTokens: 0,
      },
      durationMs: 1,
      costUsd: 0,
      status: "ok",
    });
    const raw = mockObservationForSegment({
      segmentId: segment.segment_id,
      primaryHeadings: segment.assignments
        .filter((item) => item.role === "primary")
        .map((item) => item.heading),
    });
    const parsed = validateSegmentObservation(raw, segment.segment_id);
    if (!parsed.ok) {
      const failed = markCheckpointFailed(pending, parsed.errors.join("; "));
      checkpoints = checkpoints.map((item) =>
        item.segment_id === failed.segment_id ? failed : item,
      );
      continue;
    }
    const observation = attachStoryDnaObservationProvenance(parsed.observation, {
      manuscript_id: snapshot.manuscript_id,
      manuscript_version_id: snapshot.manuscript_version_id,
      content_hash: snapshot.content_hash,
      segment,
    });
    checkpoints = checkpoints.map((item) =>
      item.segment_id === pending.segment_id
        ? markCheckpointValidated(item, observation)
        : item,
    );
  }

  const failedVisible = checkpoints.filter((item) => item.status === "failed");
  const graph = mergeSegmentObservations({
    manuscript_id: snapshot.manuscript_id,
    manuscript_version_id: snapshot.manuscript_version_id,
    content_hash: snapshot.content_hash,
    checkpoints,
  });
  const pairs = pairDeterministicContradictions(graph);
  const batches = batchReconciliationItems(buildReconciliationItems(pairs));
  for (const batch of batches) {
    ledger.record({
      role: "global_reconciliation",
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      usage: {
        inputTokens: 80 * batch.items.length,
        outputTokens: 20,
        cachedTokens: 0,
        cacheCreationTokens: 0,
      },
      durationMs: 1,
      costUsd: 0,
      status: "ok",
    });
  }

  const projection = projectSegmentedRunCost({ plan, coverage, pairs });
  let review = null;
  let ok = failedVisible.length === 0 && coverage.complete;
  try {
    if (!coverage.complete) {
      throw new CoverageIncompleteError("incomplete coverage blocks final review");
    }
    if (failedVisible.length > 0) {
      throw new CoverageIncompleteError("failed segments block final review");
    }
    review = assembleSegmentedArchivistReview({
      coverage,
      graph,
      pairs,
      manuscriptText: text,
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
    // expected fail-closed
  }

  ledger.finalize(Date.now() - started);
  return {
    ok,
    execution_scope: executionScopeForCoverage(coverage),
    coverage,
    plan,
    checkpoints,
    book_graph: graph,
    contradiction_pairs: pairs,
    reconciliation_batches: batches,
    candidate_canon: review?.canon_delta ?? [],
    review,
    cost_projection: projection,
    cost_calls: ledger.calls,
    provider_calls: 0,
    canon_writes: 0,
    diagnostics: [
      ...diagnostics,
      `live_provider_invocations=${getLiveProviderInvocationCount()}`,
    ],
  };
}

export function visibleFailedCheckpoints(
  checkpoints: readonly SegmentCheckpoint[],
): SegmentCheckpoint[] {
  return checkpoints.filter((item) => item.status === "failed");
}
