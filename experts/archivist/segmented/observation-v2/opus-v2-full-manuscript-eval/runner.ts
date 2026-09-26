/**
 * Isolated $0 rehearsal orchestrator for the experimental Opus V2 full-manuscript eval.
 * Uses the real checkpoint/coverage/pairing/canon path with fixture observations.
 * Never constructs a provider. Never writes the historical REVISED-13 workflow.
 */

import { randomUUID } from "node:crypto";
import type { CanonFactType } from "@/lib/canon/types.ts";
import {
  ARCHIVIST_EXPERT_KEY,
  ARCHIVIST_REVIEW_SCHEMA,
  ARCHIVIST_VERSION,
  type ArchivistCanonDelta,
  type ArchivistFinding,
  type ArchivistReview,
} from "../../../contracts.ts";
import { ARCHIVIST_CONSTITUTION_DEFINITION_HASH } from "../../../constitution-hash.ts";
import {
  RECKONING_REVISED_13_SEGMENT_PLAN,
  RECKONING_REVISED_13_STRUCTURAL_UNITS,
} from "../../reckoning-revised-13-segment-plan.ts";
import { createMemorySegmentedPersistence, type SegmentedPersistence } from "../../persistence.ts";
import { RECONCILIATION_MAX_BATCH_SIZE } from "../../constants.ts";
import type {
  ArchivistSegmentObservation,
  FullNovelCoverageReport,
  PlannedSegment,
  SegmentCheckpoint,
  SegmentPlan,
  StructuralManuscriptUnit,
} from "../../types.ts";
import { diagnoseV2ObservationPair, type V2ComparisonDiagnosis } from "../comparison.ts";
import type { ArchivistSegmentObservationV2, V2Observation } from "../types.ts";
import { emptySegmentObservationV2, observationIsConfirmationGrade, validateSegmentObservationV2 } from "../validate.ts";
import {
  assertNotHistoricalRevised13Workflow,
  assertOpusV2EvalPaidExecutionForbidden,
  assertOpusV2EvalPins,
  OpusV2EvalUnauthorizedError,
} from "./authorization.ts";
import { rehearsalObservationsForSegment } from "./fixtures.ts";
import {
  OPUS_V2_EVAL_EFFORT,
  OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID,
  OPUS_V2_EVAL_MODEL,
  OPUS_V2_EVAL_PROMPT_VERSION,
  OPUS_V2_EVAL_PROVIDER,
  OPUS_V2_EVAL_RECONCILIATION_BATCH_SIZE,
  OPUS_V2_EVAL_SCHEMA_VERSION,
  OPUS_V2_EVAL_SOURCE_PIN,
  OPUS_V2_EVAL_VERSION,
} from "./lock.ts";

export interface OpusV2EvalCheckpoint extends SegmentCheckpoint {
  prompt_version: string;
  schema_version: string;
  effort: typeof OPUS_V2_EVAL_EFFORT;
}

const experimentalByStore = new WeakMap<object, Map<string, string>>();

function pinKey(): string {
  return [
    OPUS_V2_EVAL_SOURCE_PIN.manuscript_id,
    OPUS_V2_EVAL_SOURCE_PIN.content_hash,
    OPUS_V2_EVAL_VERSION,
  ].join(":");
}

export function rehearsalPlanFromFrozenRevised13(): SegmentPlan {
  const units: StructuralManuscriptUnit[] = RECKONING_REVISED_13_STRUCTURAL_UNITS.map((unit, index) => ({
    unit_id: unit.unit_id,
    ordinal: index + 1,
    heading: unit.heading,
    heading_kind: unit.heading === "PROLOGUE" ? "prologue" : "chapter",
    chapter_number: unit.heading === "PROLOGUE" ? null : index,
    start_offset: index * 1000,
    end_offset: index * 1000 + unit.word_count,
    word_count: unit.word_count,
    approximate_token_count: Math.ceil(unit.word_count * 1.35),
    part_index: 1,
    part_count: 1,
    locator: { kind: "char_range", start: index * 1000, end: index * 1000 + unit.word_count, unit_id: unit.unit_id },
  }));
  const segments: PlannedSegment[] = RECKONING_REVISED_13_SEGMENT_PLAN.segments.map((row, index) => ({
    segment_id: row.segment_id,
    ordinal: index + 1,
    primary_unit_ids: [...row.primary],
    overlap_unit_ids: [],
    assignments: row.primary.map((unitId) => {
      const unit = units.find((item) => item.unit_id === unitId)!;
      return {
        unit_id: unit.unit_id,
        heading: unit.heading,
        role: "primary" as const,
        start_offset: unit.start_offset,
        end_offset: unit.end_offset,
        word_count: unit.word_count,
      };
    }),
    start_offset: index * 1000,
    end_offset: index * 1000 + row.unique_words,
    unique_word_count: row.unique_words,
    overlap_word_count: row.overlap_words,
    approximate_input_tokens: Math.ceil(row.unique_words * 1.35),
    source_hash: row.source_hash,
  }));
  return {
    planner_version: RECKONING_REVISED_13_SEGMENT_PLAN.planner_version,
    plan_fingerprint: RECKONING_REVISED_13_SEGMENT_PLAN.plan_fingerprint,
    manuscript_id: OPUS_V2_EVAL_SOURCE_PIN.manuscript_id,
    manuscript_version_id: OPUS_V2_EVAL_SOURCE_PIN.manuscript_version_id,
    content_hash: OPUS_V2_EVAL_SOURCE_PIN.content_hash,
    unit_count: units.length,
    segment_count: segments.length,
    units,
    segments,
  };
}

export function rehearsalCoverageFromPlan(plan: SegmentPlan): FullNovelCoverageReport {
  return {
    schema: "archivist_full_novel_coverage@v1",
    manuscript_id: plan.manuscript_id,
    manuscript_version_id: plan.manuscript_version_id,
    content_hash: plan.content_hash,
    canonical_manuscript_words: OPUS_V2_EVAL_SOURCE_PIN.analytical_word_count,
    unit_count: plan.unit_count,
    units_represented: plan.unit_count,
    segment_count: plan.segment_count,
    segments: plan.segments.map((segment) => ({
      segment_id: segment.segment_id,
      start_offset: segment.start_offset,
      end_offset: segment.end_offset,
      words_assigned: segment.unique_word_count + segment.overlap_word_count,
      unique_words: segment.unique_word_count,
      overlap_words: segment.overlap_word_count,
    })),
    unique_words_covered: OPUS_V2_EVAL_SOURCE_PIN.analytical_word_count,
    overlap_words: RECKONING_REVISED_13_SEGMENT_PLAN.overlap_words,
    uncovered_ranges: [],
    duplicated_ranges: [],
    coverage_percentage: 100,
    complete: true,
  };
}

export function assertPlanMatchesFrozenRevised13(
  plan: SegmentPlan,
  coverage: FullNovelCoverageReport,
): void {
  assertOpusV2EvalPins({
    manuscript_id: plan.manuscript_id,
    manuscript_version_id: plan.manuscript_version_id,
    content_hash: plan.content_hash,
    plan_fingerprint: plan.plan_fingerprint,
  });
  if (plan.plan_fingerprint !== OPUS_V2_EVAL_SOURCE_PIN.plan_fingerprint) {
    throw new OpusV2EvalUnauthorizedError("plan_fingerprint_mismatch");
  }
  if (coverage.unique_words_covered !== OPUS_V2_EVAL_SOURCE_PIN.analytical_word_count) {
    throw new OpusV2EvalUnauthorizedError("unique_coverage_mismatch");
  }
  if (!coverage.complete || coverage.uncovered_ranges.length > 0 || coverage.coverage_percentage !== 100) {
    throw new OpusV2EvalUnauthorizedError("coverage_incomplete");
  }
  if (plan.unit_count !== 30 || coverage.units_represented !== 30) {
    throw new OpusV2EvalUnauthorizedError("structural_unit_mismatch");
  }
}

export function createOpusV2EvalCheckpoints(plan: SegmentPlan): OpusV2EvalCheckpoint[] {
  return plan.segments.map((segment) => ({
    manuscript_id: plan.manuscript_id,
    manuscript_version_id: plan.manuscript_version_id,
    content_hash: plan.content_hash,
    archivist_version: ARCHIVIST_VERSION,
    archivist_definition_hash: ARCHIVIST_CONSTITUTION_DEFINITION_HASH,
    segment_contract_version: OPUS_V2_EVAL_SCHEMA_VERSION,
    plan_fingerprint: plan.plan_fingerprint,
    segment_id: segment.segment_id,
    segment_source_hash: segment.source_hash,
    start_offset: segment.start_offset,
    end_offset: segment.end_offset,
    provider: OPUS_V2_EVAL_PROVIDER,
    model: OPUS_V2_EVAL_MODEL,
    prompt_version: OPUS_V2_EVAL_PROMPT_VERSION,
    schema_version: OPUS_V2_EVAL_SCHEMA_VERSION,
    effort: OPUS_V2_EVAL_EFFORT,
    status: "pending",
    repair_used: false,
  }));
}

export function opusV2EvalCheckpointCompatible(
  checkpoint: OpusV2EvalCheckpoint,
  expected: OpusV2EvalCheckpoint,
): boolean {
  return (
    checkpoint.manuscript_id === expected.manuscript_id &&
    checkpoint.manuscript_version_id === expected.manuscript_version_id &&
    checkpoint.content_hash === expected.content_hash &&
    checkpoint.plan_fingerprint === expected.plan_fingerprint &&
    checkpoint.segment_id === expected.segment_id &&
    checkpoint.segment_source_hash === expected.segment_source_hash &&
    checkpoint.provider === expected.provider &&
    checkpoint.model === expected.model &&
    checkpoint.prompt_version === expected.prompt_version &&
    checkpoint.schema_version === expected.schema_version &&
    checkpoint.effort === expected.effort
  );
}

export function selectOpusV2EvalSegments(args: {
  plan: SegmentPlan;
  checkpoints: readonly OpusV2EvalCheckpoint[];
}): {
  reuse: PlannedSegment[];
  remaining: PlannedSegment[];
  rejected: Array<{ segment_id: string; reason: string }>;
} {
  if (args.checkpoints.some((item) => item.status === "running")) {
    throw new OpusV2EvalUnauthorizedError("duplicate_active_resume");
  }
  const expected = createOpusV2EvalCheckpoints(args.plan);
  const byId = new Map(args.checkpoints.map((item) => [item.segment_id, item]));
  const reuse: PlannedSegment[] = [];
  const remaining: PlannedSegment[] = [];
  const rejected: Array<{ segment_id: string; reason: string }> = [];
  for (const segment of args.plan.segments) {
    const want = expected.find((item) => item.segment_id === segment.segment_id)!;
    const existing = byId.get(segment.segment_id);
    if (!existing) {
      remaining.push(segment);
      continue;
    }
    if (existing.status === "validated" && existing.observation && opusV2EvalCheckpointCompatible(existing, want)) {
      reuse.push(segment);
      continue;
    }
    if (existing.status === "validated" && !opusV2EvalCheckpointCompatible(existing, want)) {
      rejected.push({ segment_id: segment.segment_id, reason: "incompatible checkpoint pins" });
    }
    remaining.push(segment);
  }
  return { reuse, remaining, rejected };
}

export function assertIncompatibleResumeRejected(args: {
  content_hash?: string;
  plan_fingerprint?: string;
  prompt_version?: string;
  schema_version?: string;
  model?: string;
  effort?: string;
  workflow_id?: string;
}): void {
  if (args.workflow_id) assertNotHistoricalRevised13Workflow(args.workflow_id);
  assertOpusV2EvalPins({
    manuscript_id: OPUS_V2_EVAL_SOURCE_PIN.manuscript_id,
    manuscript_version_id: OPUS_V2_EVAL_SOURCE_PIN.manuscript_version_id,
    content_hash: args.content_hash ?? OPUS_V2_EVAL_SOURCE_PIN.content_hash,
    plan_fingerprint: args.plan_fingerprint ?? OPUS_V2_EVAL_SOURCE_PIN.plan_fingerprint,
    prompt_version: args.prompt_version,
    schema_version: args.schema_version,
    model: args.model,
    effort: args.effort,
  });
}

function factTypeForKind(kind: V2Observation["kind"]): CanonFactType {
  if (kind === "knowledge") return "knowledge_state";
  if (kind === "injury") return "injury";
  if (kind === "relationship") return "relationship";
  if (kind === "identity") return "rank_title";
  if (kind === "location_presence") return "location";
  if (kind === "travel_leg") return "travel";
  if (kind === "object_equipment") return "possession";
  if (kind === "timestamp") return "chronology";
  if (kind === "operational_capability") return "other";
  return "other";
}

export function candidateCanonFromV2Observations(
  observations: readonly V2Observation[],
): ArchivistCanonDelta[] {
  return observations.map((observation, index) => ({
    id: observation.id || `candidate-${index + 1}`,
    entity: {
      resolution: "unresolved",
      alias: observation.proposition.subject,
      entity_type: "person",
    },
    entity_type: "person",
    fact_type: factTypeForKind(observation.kind),
    proposed_fact_value: { ...(observation.payload as unknown as Record<string, unknown>), kind: observation.kind },
    temporal_scope: { kind: "at", chapter: observation.evidence.locator },
    source_location: { locator: observation.evidence.locator, chapter: observation.evidence.locator },
    evidence: [
      {
        excerpt: observation.evidence.excerpt,
        locator: observation.evidence.locator,
        evidence_role: "current_observation",
        verification_status: observation.evidence.evidence_status === "unverified" ? "unverified" : "located",
        source_kind: "manuscript",
      },
    ],
    confidence: observation.confidence,
    proposed_authority: "current_observation",
    status: "candidate",
    inferred: false,
    created_by: "extraction",
  }));
}

export function diagnoseAllV2Pairs(observations: readonly V2Observation[]): V2ComparisonDiagnosis[] {
  const rows: V2ComparisonDiagnosis[] = [];
  for (let i = 0; i < observations.length; i++) {
    for (let j = i + 1; j < observations.length; j++) {
      const left = observations[i]!;
      const right = observations[j]!;
      const subjects = [left.proposition.subject, right.proposition.subject].map((name) => name.toLowerCase());
      const ambiguous = subjects.includes("the captain") ? ["the captain"] : [];
      const resolved = subjects.filter((name) => name !== "the captain");
      rows.push(diagnoseV2ObservationPair(left, right, {
        ambiguous_aliases: ambiguous,
        resolved_aliases: resolved,
      }));
    }
  }
  return rows;
}

export function classifyRehearsalFinding(
  diagnosis: V2ComparisonDiagnosis,
  left: V2Observation,
  right: V2Observation,
): ArchivistFinding | null {
  if (diagnosis.eligibility !== "comparable") return null;
  const bothValid = observationIsConfirmationGrade(left) && observationIsConfirmationGrade(right);
  const classification = diagnosis.confirmation_blocked || !bothValid
    ? "author_verification_needed"
    : "possible_continuity_conflict";
  return {
    id: `${diagnosis.pairing_interface}:${left.id}:${right.id}`,
    issue_type: "other",
    classification,
    final_classification: classification,
    confirmation_eligibility: bothValid && !diagnosis.confirmation_blocked ? "eligible" : "ineligible",
    severity: "moderate",
    confidence: "medium",
    current_location: { locator: left.evidence.locator, chapter: left.evidence.locator },
    current_evidence: [{
      excerpt: left.evidence.excerpt,
      locator: left.evidence.locator,
      evidence_role: "current_observation",
      verification_status: "located",
      source_kind: "manuscript",
    }],
    conflicting_evidence: [{
      excerpt: right.evidence.excerpt,
      locator: right.evidence.locator,
      evidence_role: "current_observation",
      verification_status: "located",
      source_kind: "manuscript",
    }],
    temporal_analysis: {
      relation: "unknown",
      explanation: diagnosis.explanation,
      current_scope: { kind: "at", chapter: left.evidence.locator },
    },
    explanation: diagnosis.explanation,
    suggested_resolution: "Author should reconcile the two observations.",
    author_action: "pending",
    author_challenge_supported: true,
    subject_entity: left.proposition.subject,
    compared_attribute: diagnosis.pairing_interface,
    comparison_key: diagnosis.pairing_interface,
    comparison_reason: diagnosis.reason,
  };
}

export function assembleOpusV2EvalReview(args: {
  observations: readonly V2Observation[];
  findings: readonly ArchivistFinding[];
  canon: readonly ArchivistCanonDelta[];
}): ArchivistReview {
  const confirmed = args.findings.filter((item) => item.classification === "confirmed_contradiction").length;
  const possible = args.findings.filter((item) => item.classification === "possible_continuity_conflict").length;
  const avn = args.findings.filter((item) => item.classification === "author_verification_needed").length;
  return {
    schema: ARCHIVIST_REVIEW_SCHEMA,
    expert_key: ARCHIVIST_EXPERT_KEY,
    expert_version: ARCHIVIST_VERSION,
    manuscript_id: OPUS_V2_EVAL_SOURCE_PIN.manuscript_id,
    manuscript_version_id: OPUS_V2_EVAL_SOURCE_PIN.manuscript_version_id,
    content_hash: OPUS_V2_EVAL_SOURCE_PIN.content_hash,
    summary: {
      confirmed_contradiction_count: confirmed,
      possible_conflict_count: possible,
      author_verification_count: avn,
      narrative:
        "Isolated Opus V2 full-manuscript eval rehearsal. Candidate-only. No accepted canon. Pairing uses diagnoseV2ObservationPair. Simulated reconciliation does not confirm.",
    },
    findings: [...args.findings],
    canon_delta: [...args.canon],
    entity_ambiguities: [],
    metrics: {
      finding_count: args.findings.length,
      confirmed_contradiction_count: confirmed,
      possible_conflict_count: possible,
      author_verification_count: avn,
      canon_delta_count: args.canon.length,
      entity_ambiguity_count: 1,
      evidence_record_count: args.observations.length,
    },
    generation: {
      provider: "none",
      model: "none",
      prompt_version: OPUS_V2_EVAL_PROMPT_VERSION,
      validator_version: OPUS_V2_EVAL_SCHEMA_VERSION,
      normalization_version: OPUS_V2_EVAL_VERSION,
      definition_hash: ARCHIVIST_CONSTITUTION_DEFINITION_HASH,
    },
    author_challenge_supported: true,
  };
}

export interface OpusV2EvalRehearsalResult {
  workflow_id: string;
  historical_workflow_id: typeof OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID;
  historical_workflow_touched: false;
  execution_scope: "complete" | "incomplete";
  provider_calls: 0;
  cost_usd: 0;
  accepted_canon: 0;
  series_bible_writes: 0;
  segment_count: number;
  validated: number;
  failed: number;
  pending: number;
  reused: string[];
  rescheduled: string[];
  duplicate_scheduling: false;
  coverage_complete: boolean;
  unique_words_covered: number;
  candidate_canon_count: number;
  comparable_pairs: number;
  rejected_pairs: number;
  compatible_transitions: number;
  equivalent_pairs: number;
  findings: ArchivistFinding[];
  review_persisted: boolean;
  ambiguities_blocked_confirmation: number;
}

export async function runOpusV2EvalRehearsal(args?: {
  persistence?: SegmentedPersistence;
  resume_workflow_id?: string;
  fail_segment_id?: string;
  workflow_id?: string;
}): Promise<OpusV2EvalRehearsalResult> {
  assertOpusV2EvalPaidExecutionForbidden();
  const persistence = args?.persistence ?? createMemorySegmentedPersistence();
  const plan = rehearsalPlanFromFrozenRevised13();
  const coverage = rehearsalCoverageFromPlan(plan);
  assertPlanMatchesFrozenRevised13(plan, coverage);

  if (args?.resume_workflow_id) {
    assertNotHistoricalRevised13Workflow(args.resume_workflow_id);
  }
  if (args?.workflow_id) {
    assertNotHistoricalRevised13Workflow(args.workflow_id);
  }

  const storeMap = experimentalByStore.get(persistence) ?? new Map<string, string>();
  experimentalByStore.set(persistence, storeMap);
  const existingId = storeMap.get(pinKey());
  let workflowId = args?.resume_workflow_id ?? args?.workflow_id ?? existingId;
  if (!args?.resume_workflow_id && existingId && existingId !== args?.workflow_id) {
    throw new OpusV2EvalUnauthorizedError("duplicate_experimental_workflow");
  }
  if (!args?.resume_workflow_id && args?.workflow_id && existingId && existingId !== args.workflow_id) {
    throw new OpusV2EvalUnauthorizedError("duplicate_experimental_workflow");
  }
  if (workflowId === OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID) {
    throw new OpusV2EvalUnauthorizedError("historical_revised_13_workflow_is_immutable");
  }

  if (!workflowId || !(await persistence.getWorkflow(workflowId))) {
    if (args?.resume_workflow_id) {
      throw new OpusV2EvalUnauthorizedError("resume_workflow_missing");
    }
    const created = await persistence.createWorkflow({
      id: args?.workflow_id ?? randomUUID(),
      manuscript_id: plan.manuscript_id,
      manuscript_version_id: plan.manuscript_version_id,
      content_hash: plan.content_hash,
      archivist_version: OPUS_V2_EVAL_VERSION,
      archivist_definition_hash: ARCHIVIST_CONSTITUTION_DEFINITION_HASH,
      status: "running",
      authorized_to_run: false,
    });
    workflowId = created.id;
    storeMap.set(pinKey(), workflowId);
    await persistence.savePlan(workflowId, plan);
    await persistence.saveCheckpoints(workflowId, createOpusV2EvalCheckpoints(plan));
  }

  const loaded = (await persistence.loadCheckpoints(workflowId)) as OpusV2EvalCheckpoint[];
  const selected = selectOpusV2EvalSegments({ plan, checkpoints: loaded });
  if (selected.rejected.length) {
    throw new OpusV2EvalUnauthorizedError(selected.rejected[0]!.reason);
  }

  const byId = new Map(loaded.map((item) => [item.segment_id, item]));
  const rescheduled: string[] = [];
  for (const segment of selected.remaining) {
    const current = byId.get(segment.segment_id) ?? createOpusV2EvalCheckpoints(plan).find((item) => item.segment_id === segment.segment_id)!;
    if (args?.fail_segment_id === segment.segment_id) {
      byId.set(segment.segment_id, { ...current, status: "failed", error: "injected rehearsal failure" });
      break;
    }
    const document = rehearsalObservationsForSegment(segment.segment_id);
    const validatedDoc = validateSegmentObservationV2(document, segment.segment_id);
    if (!validatedDoc.ok) {
      byId.set(segment.segment_id, { ...current, status: "failed", error: validatedDoc.errors.join("; ") });
      continue;
    }
    const persisted = {
      ...document,
      schema: document.schema,
    } as unknown as ArchivistSegmentObservation;
    const validated: OpusV2EvalCheckpoint = {
      ...current,
      status: "validated",
      observation: persisted,
      repair_used: false,
      error: undefined,
    };
    byId.set(segment.segment_id, validated);
    await persistence.saveObservation(workflowId, validated, persisted);
    rescheduled.push(segment.segment_id);
  }

  const checkpoints = plan.segments.map((segment) => byId.get(segment.segment_id)!);
  await persistence.saveCheckpoints(workflowId, checkpoints);
  await persistence.saveCoverage(workflowId, coverage);

  const validated = checkpoints.filter((item) => item.status === "validated").length;
  const failed = checkpoints.filter((item) => item.status === "failed").length;
  const pending = checkpoints.filter((item) => item.status === "pending").length;
  const complete = validated === plan.segment_count && failed === 0 && pending === 0;

  const documents = checkpoints
    .filter((item) => item.status === "validated")
    .map((item) => (item.observation as unknown as ArchivistSegmentObservationV2) ?? emptySegmentObservationV2(item.segment_id));
  const observations = documents.flatMap((doc) => doc.observations);
  const diagnoses = diagnoseAllV2Pairs(observations);
  const comparable = diagnoses.filter((row) => row.eligibility === "comparable");
  const equivalent = diagnoses.filter((row) => row.eligibility === "equivalent");
  const compatible = diagnoses.filter((row) => row.reason === "compatible_state_transition" || row.reason === "different_time");
  const rejected = diagnoses.filter((row) => row.eligibility !== "comparable");
  const byIdObs = new Map(observations.map((row) => [row.id, row]));
  const findings = comparable
    .map((row) => classifyRehearsalFinding(row, byIdObs.get(row.left_id)!, byIdObs.get(row.right_id)!))
    .filter((row): row is ArchivistFinding => Boolean(row));
  const canon = candidateCanonFromV2Observations(observations);
  if (canon.some((row) => row.status !== "candidate")) {
    throw new Error("accepted canon is blocked");
  }

  let reviewPersisted = false;
  if (complete) {
    const review = assembleOpusV2EvalReview({ observations, findings, canon });
    await persistence.saveCandidateReview(workflowId, review, canon);
    await persistence.updateWorkflowStatus(workflowId, "completed");
    reviewPersisted = true;
  } else {
    await persistence.updateWorkflowStatus(workflowId, "running");
  }

  return {
    workflow_id: workflowId,
    historical_workflow_id: OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID,
    historical_workflow_touched: false,
    execution_scope: complete ? "complete" : "incomplete",
    provider_calls: 0,
    cost_usd: 0,
    accepted_canon: 0,
    series_bible_writes: 0,
    segment_count: plan.segment_count,
    validated,
    failed,
    pending,
    reused: selected.reuse.map((item) => item.segment_id),
    rescheduled,
    duplicate_scheduling: false,
    coverage_complete: complete && coverage.complete,
    unique_words_covered: coverage.unique_words_covered,
    candidate_canon_count: canon.length,
    comparable_pairs: comparable.length,
    rejected_pairs: rejected.length,
    compatible_transitions: compatible.length,
    equivalent_pairs: equivalent.length,
    findings,
    review_persisted: reviewPersisted,
    ambiguities_blocked_confirmation: findings.filter((item) => item.classification === "author_verification_needed").length,
  };
}

export const OPUS_V2_EVAL_RECONCILIATION_CONTRACT = {
  batch_size: OPUS_V2_EVAL_RECONCILIATION_BATCH_SIZE,
  shared_batch_constant: RECONCILIATION_MAX_BATCH_SIZE,
  receives: [
    "comparison_interface",
    "entity_context",
    "observation_a",
    "observation_b",
    "evidence_a",
    "evidence_b",
    "locators",
    "temporal_relationship",
    "identity_status",
    "confirmation_blocked",
  ],
  never: ["full_novel", "rule_8_answer", "accepted_canon"],
} as const;
