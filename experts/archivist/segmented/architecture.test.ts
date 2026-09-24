import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLiveProviderInvocationCount, resetLiveProviderInvocationCountForTests } from "@/lib/execute-expert/dry-run-guard.ts";
import { executeExpert } from "@/lib/execute-expert/execute.ts";
import { countManuscriptWords } from "@/lib/word-count.ts";
import { ARCHIVIST_FIXTURE_ENTITY_IDS } from "../entity-catalog.ts";
import { ARCHIVIST_LIVE_MODEL_CERTIFIED, isArchivistLiveExecutionAllowed } from "../live-flags.ts";
import { ARCHIVIST_CONSTITUTION } from "../constitution.ts";
import { archivistRuntimeDefinition } from "../runtime-definition.ts";
import { archivistRegistryDefinitionV1 } from "../registry-definition.ts";
import { RECKONING_REVISED_11_SOURCE_PIN } from "../reckoning-revised-11-source-pin.ts";
import { assertCertifiedSegmentedModel } from "./certified-model.ts";
import { CertifiedModelMismatchError, SourcePinMismatchError } from "./errors.ts";
import {
  canReuseValidatedCheckpoint,
  checkpointPinsFor,
  createPendingCheckpoints,
  markCheckpointFailed,
  markCheckpointValidated,
} from "./checkpoint.ts";
import { buildCoverageReport } from "./coverage.ts";
import { downgradeUnrehydratedConfirmed, rehydrateEvidenceRecord } from "./evidence-rehydration.ts";
import { buildSyntheticThirtyUnitManuscript, mockObservationForSegment } from "./fixtures.ts";
import {
  createMemoryManuscriptStore,
  loadManuscriptSnapshot,
  loadPinnedReckoningRevised11,
  storyDnaContentHash,
} from "./manuscript-loader.ts";
import { attachStoryDnaObservationProvenance, validateSegmentObservation } from "./observation-contract.ts";
import { assertSegmentedLiveMayNotStart, reconcileSegmentedOrphans } from "./orchestration.ts";
import { selectSegmentsToRun } from "./resume.ts";
import { planSegments } from "./segment-planner.ts";
import { RECKONING_REVISED_11_SEGMENT_PLAN, RECKONING_REVISED_11_STRUCTURAL_UNITS } from "./reckoning-revised-11-segment-plan.ts";
import { runLocalSegmentedSimulation } from "./simulation.ts";
import { assertExpectedReckoningStructure, extractStructuralUnits, splitOversizedUnit } from "./structural-units.ts";
import { DuplicateSegmentedResumeError } from "./errors.ts";

describe("segmented Archivist architecture", () => {
  it("fails closed on source-pin mismatch before execution", async () => {
    const { snapshot } = buildSyntheticThirtyUnitManuscript();
    const store = createMemoryManuscriptStore({
      ...snapshot,
      manuscript_id: RECKONING_REVISED_11_SOURCE_PIN.manuscript_id,
      manuscript_version_id: RECKONING_REVISED_11_SOURCE_PIN.manuscript_version_id,
      content_hash: RECKONING_REVISED_11_SOURCE_PIN.content_hash,
      source_filename: RECKONING_REVISED_11_SOURCE_PIN.source_filename,
      source_docx_sha256: RECKONING_REVISED_11_SOURCE_PIN.source_docx_sha256,
      analytical_word_count: RECKONING_REVISED_11_SOURCE_PIN.analytical_word_count,
      version_number: 1,
      is_current: true,
    });
    await assert.rejects(
      () => loadPinnedReckoningRevised11(store),
      SourcePinMismatchError,
    );
  });

  it("loads a mocked snapshot and verifies hash/non-empty text", async () => {
    const { snapshot } = buildSyntheticThirtyUnitManuscript();
    const loaded = await loadManuscriptSnapshot(createMemoryManuscriptStore(snapshot), {
      manuscript_id: snapshot.manuscript_id,
      manuscript_version_id: snapshot.manuscript_version_id,
      content_hash: snapshot.content_hash,
    });
    assert.equal(loaded.content_hash, storyDnaContentHash(loaded.extracted_text));
    assert.ok(loaded.extracted_text.trim().length > 0);
  });

  it("records the actual REVISED-11 14-segment plan without novel text", () => {
    assert.equal(RECKONING_REVISED_11_STRUCTURAL_UNITS.length, 30);
    assert.equal(RECKONING_REVISED_11_SEGMENT_PLAN.segment_count, 14);
    assert.equal(
      RECKONING_REVISED_11_STRUCTURAL_UNITS.reduce((sum, unit) => sum + unit.word_count, 0),
      110156,
    );
    assert.equal(
      RECKONING_REVISED_11_SEGMENT_PLAN.segments.reduce((sum, segment) => sum + segment.unique_words, 0),
      110156,
    );
    assert.equal(RECKONING_REVISED_11_SEGMENT_PLAN.coverage_percentage, 100);
    assert.equal(RECKONING_REVISED_11_SEGMENT_PLAN.complete, true);
  });

  it("detects 30 stable structural units", () => {
    const { text } = buildSyntheticThirtyUnitManuscript();
    const units = extractStructuralUnits(text);
    assertExpectedReckoningStructure(units);
    assert.equal(units.length, 30);
    assert.equal(units[0]?.unit_id, "prologue");
    assert.equal(units[29]?.unit_id, "chapter-29");
    assert.deepEqual(
      units.map((unit) => unit.unit_id),
      extractStructuralUnits(text).map((unit) => unit.unit_id),
    );
  });

  it("splits an oversized chapter at paragraph boundaries", () => {
    const { text } = buildSyntheticThirtyUnitManuscript({
      wordsPerUnit: 200,
      oversizedChapter: 7,
      oversizedWords: 15_000,
    });
    const units = extractStructuralUnits(text);
    const oversized = units.find((unit) => unit.unit_id === "chapter-07");
    assert.ok(oversized);
    const parts = splitOversizedUnit(oversized!, text, 12_000);
    assert.ok(parts.length >= 2);
    assert.ok(parts.every((part) => part.word_count <= 12_000));
    assert.equal(parts[0]?.start_offset, oversized!.start_offset);
    assert.equal(parts[parts.length - 1]?.end_offset, oversized!.end_offset);
  });

  it("plans chapter-aware segments with 100% unique coverage and separate overlap", () => {
    const { text, snapshot } = buildSyntheticThirtyUnitManuscript();
    const plan = planSegments(text, snapshot);
    assert.equal(plan.unit_count, 30);
    assert.ok(plan.segment_count >= 2);
    assert.notEqual(plan.segment_count, 10);
    const coverage = buildCoverageReport({
      text,
      plan,
      canonicalWordCount: countManuscriptWords(text),
    });
    assert.equal(coverage.units_represented, 30);
    assert.equal(coverage.unique_words_covered, coverage.canonical_manuscript_words);
    assert.equal(coverage.coverage_percentage, 100);
    assert.equal(coverage.uncovered_ranges.length, 0);
    assert.ok(coverage.overlap_words >= 0);
    assert.deepEqual(
      plan.segments.map((segment) => segment.segment_id),
      planSegments(text, snapshot).segments.map((segment) => segment.segment_id),
    );
    assert.equal(coverage.complete, true);
  });

  it("validates observations and keeps failed segments visible", () => {
    const invalid = validateSegmentObservation({
      schema: "archivist_segment_observation@v1",
      segment_id: "seg-01",
      entities: [{ alias: "Mara", entity_type: "person", entity_id: "invented", local_mentions: [] }],
    });
    assert.equal(invalid.ok, false);
    const { text, snapshot } = buildSyntheticThirtyUnitManuscript();
    const plan = planSegments(text, snapshot);
    const checkpoints = createPendingCheckpoints(plan);
    const failed = markCheckpointFailed(checkpoints[0]!, "parse failed");
    assert.equal(failed.status, "failed");
    assert.equal(failed.error, "parse failed");
  });

  it("reuses compatible checkpoints and rejects incompatible ones", () => {
    const { text, snapshot } = buildSyntheticThirtyUnitManuscript();
    const plan = planSegments(text, snapshot);
    const segment = plan.segments[0]!;
    const pins = checkpointPinsFor({ plan, segment });
    const observation = attachStoryDnaObservationProvenance(
      mockObservationForSegment({
        segmentId: segment.segment_id,
        primaryHeadings: segment.assignments.filter((item) => item.role === "primary").map((item) => item.heading),
      }),
      { ...snapshot, segment },
    );
    const validated = markCheckpointValidated(
      { ...pins, status: "pending", repair_used: false },
      observation,
    );
    assert.equal(canReuseValidatedCheckpoint(validated, pins), true);
    assert.equal(
      canReuseValidatedCheckpoint(
        { ...validated, content_hash: "0".repeat(64) },
        pins,
      ),
      false,
    );
    const checkpoints = createPendingCheckpoints(plan).map((item, index) =>
      index === 0 ? validated : item,
    );
    const selected = selectSegmentsToRun({ plan, checkpoints });
    assert.equal(selected.reuse.length, 1);
    assert.equal(selected.remaining.length, plan.segment_count - 1);
    assert.throws(
      () =>
        selectSegmentsToRun({
          plan,
          checkpoints: checkpoints.map((item, index) =>
            index === 1 ? { ...item, status: "running" } : item,
          ),
        }),
      DuplicateSegmentedResumeError,
    );
  });

  it("runs the local end-to-end simulation without provider calls", () => {
    resetLiveProviderInvocationCountForTests();
    const result = runLocalSegmentedSimulation();
    assert.equal(result.provider_calls, 0);
    assert.equal(getLiveProviderInvocationCount(), 0);
    assert.equal(result.canon_writes, 0);
    assert.equal(result.plan.unit_count, 30);
    assert.equal(result.coverage.complete, true);
    assert.equal(result.execution_scope, "full_manuscript");
    assert.ok(result.ok);
    assert.ok(result.review);
    assert.equal(result.review?.generation.provider, "none");
    assert.ok(result.review?.canon_delta.every((delta) => delta.status === "candidate"));
    const kinds = new Set(result.contradiction_pairs.map((pair) => pair.kind));
    assert.ok(kinds.has("appearance_unexplained"));
    assert.ok(kinds.has("knowledge_before_acquisition"));
    assert.ok(kinds.has("injury_laterality"));
    assert.ok(kinds.has("unique_object_possession"));
    const mara = result.book_graph.entities.find((entity) => entity.alias === "Mara");
    assert.equal(mara?.resolution, "resolved");
    assert.equal(mara?.entity_id, ARCHIVIST_FIXTURE_ENTITY_IDS.mara);
    assert.ok((mara?.source_segment_ids.length ?? 0) >= 2);
    const john = result.book_graph.unresolved_ambiguities.find((item) => item.alias === "John");
    assert.ok(john);
    assert.ok(result.cost_calls.length > 0);
    assert.ok(result.cost_calls.every((call) => SEGMENTED_ROLES.has(call.role)));
  });

  it("blocks final review on incomplete coverage and keeps failed segments", () => {
    const incomplete = runLocalSegmentedSimulation({ failCoverage: true });
    assert.equal(incomplete.ok, false);
    assert.equal(incomplete.review, null);
    const failed = runLocalSegmentedSimulation({ failOneSegment: true });
    assert.ok(failed.checkpoints.some((item) => item.status === "failed"));
    assert.equal(failed.ok, false);
  });

  it("cannot confirm when evidence cannot be rehydrated", () => {
    const record = rehydrateEvidenceRecord({
      record: {
        excerpt: "this quotation is not in the manuscript at all",
        locator: "CHAPTER ONE",
        evidence_role: "current_observation",
        verification_status: "located",
        source_kind: "manuscript",
      },
      manuscriptText: "PROLOGUE\n\nMara waited.\n",
      manuscript_id: "m",
      manuscript_version_id: "v",
      content_hash: "a".repeat(64),
    });
    assert.equal(record.verification_status, "unverified");
    const downgraded = downgradeUnrehydratedConfirmed({
      id: "f1",
      issue_type: "appearance",
      classification: "confirmed_contradiction",
      severity: "major",
      confidence: "high",
      current_location: { locator: "later" },
      current_evidence: [record],
      conflicting_evidence: [record],
      temporal_analysis: {
        relation: "earlier_later",
        explanation: "x",
        current_scope: { kind: "unknown" },
      },
      explanation: "x",
      suggested_resolution: "x",
      author_action: "pending",
      author_challenge_supported: true,
    });
    assert.equal(downgraded.classification, "possible_continuity_conflict");
  });

  it("fails certified model mismatch before a provider call", () => {
    assert.throws(
      () => assertCertifiedSegmentedModel({ provider: "anthropic", model: "claude-opus-4-8" }),
      CertifiedModelMismatchError,
    );
    assert.throws(
      () => runLocalSegmentedSimulation({ configuredModel: { model: "claude-opus-4-8" } }),
      CertifiedModelMismatchError,
    );
    assert.deepEqual(
      assertCertifiedSegmentedModel({
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
      }),
      { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
    );
  });

  it("cancels and reconciles orphans without publishing", async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      () => assertSegmentedLiveMayNotStart({ signal: controller.signal }),
      /cancelled|not authorized|WorkflowCancelled/i,
    );
    const { text, snapshot } = buildSyntheticThirtyUnitManuscript();
    const plan = planSegments(text, snapshot);
    const running = createPendingCheckpoints(plan).map((item, index) =>
      index === 0 ? { ...item, status: "running" as const } : item,
    );
    const reconciled = reconcileSegmentedOrphans(running, [running[0]!.segment_id]);
    assert.equal(reconciled[0]?.status, "failed");
    assert.equal(reconciled[0]?.error, "orphaned_running_checkpoint");
  });

  it("keeps live gates closed and public executeExpert fail-closed", async () => {
    assert.equal(ARCHIVIST_LIVE_MODEL_CERTIFIED, true);
    assert.equal(isArchivistLiveExecutionAllowed(), false);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
    assert.equal(archivistRegistryDefinitionV1().registry_metadata?.execution_wired, false);
    assert.equal(RECKONING_REVISED_11_SOURCE_PIN.authorized_to_run, false);
    await assert.rejects(() => assertSegmentedLiveMayNotStart());
    const result = await executeExpert({
      expert_key: "archivist",
      expert_version_id: "883407ad-4afe-4f3c-a69b-eaa3234fc9c6",
      manuscript_id: "ms",
      manuscript_version_id: "mv",
      content_hash: "a".repeat(64),
      mode: "live",
    });
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics?.join(" ").toLowerCase().includes("disabled") || result.error_code);
  });
});

const SEGMENTED_ROLES = new Set([
  "segment_observation",
  "segment_repair",
  "global_reconciliation",
  "global_repair",
]);
