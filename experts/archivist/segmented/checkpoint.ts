import { ARCHIVIST_VERSION } from "../contracts.ts";
import { ARCHIVIST_CONSTITUTION_DEFINITION_HASH } from "../constitution-hash.ts";
import {
  ARCHIVIST_SEGMENT_CONTRACT_VERSION,
  CERTIFIED_ARCHIVIST_MODEL,
  CERTIFIED_ARCHIVIST_PROVIDER,
} from "./constants.ts";
import { CheckpointIncompatibleError } from "./errors.ts";
import type {
  ArchivistSegmentObservation,
  PlannedSegment,
  SegmentCheckpoint,
  SegmentCheckpointPins,
  SegmentPlan,
} from "./types.ts";

export function checkpointPinsFor(args: {
  plan: SegmentPlan;
  segment: PlannedSegment;
}): SegmentCheckpointPins {
  return {
    manuscript_id: args.plan.manuscript_id,
    manuscript_version_id: args.plan.manuscript_version_id,
    content_hash: args.plan.content_hash,
    archivist_version: ARCHIVIST_VERSION,
    archivist_definition_hash: ARCHIVIST_CONSTITUTION_DEFINITION_HASH,
    segment_contract_version: ARCHIVIST_SEGMENT_CONTRACT_VERSION,
    plan_fingerprint: args.plan.plan_fingerprint,
    segment_id: args.segment.segment_id,
    segment_source_hash: args.segment.source_hash,
    start_offset: args.segment.start_offset,
    end_offset: args.segment.end_offset,
    provider: CERTIFIED_ARCHIVIST_PROVIDER,
    model: CERTIFIED_ARCHIVIST_MODEL,
  };
}

export function createPendingCheckpoints(plan: SegmentPlan): SegmentCheckpoint[] {
  return plan.segments.map((segment) => ({
    ...checkpointPinsFor({ plan, segment }),
    status: "pending",
    repair_used: false,
  }));
}

export function markCheckpointRunning(checkpoint: SegmentCheckpoint): SegmentCheckpoint {
  return { ...checkpoint, status: "running", error: undefined };
}

export function markCheckpointValidated(
  checkpoint: SegmentCheckpoint,
  observation: ArchivistSegmentObservation,
  repairUsed = false,
): SegmentCheckpoint {
  return {
    ...checkpoint,
    status: "validated",
    observation,
    repair_used: repairUsed,
    error: undefined,
  };
}

export function markCheckpointFailed(
  checkpoint: SegmentCheckpoint,
  error: string,
  repairUsed = false,
): SegmentCheckpoint {
  return {
    ...checkpoint,
    status: "failed",
    error,
    repair_used: repairUsed,
  };
}

export function assertCheckpointCompatible(
  checkpoint: SegmentCheckpoint,
  expected: SegmentCheckpointPins,
): void {
  const fields: Array<keyof SegmentCheckpointPins> = [
    "manuscript_id",
    "manuscript_version_id",
    "content_hash",
    "archivist_version",
    "archivist_definition_hash",
    "segment_contract_version",
    "plan_fingerprint",
    "segment_id",
    "segment_source_hash",
    "provider",
    "model",
  ];
  for (const field of fields) {
    if (checkpoint[field] !== expected[field]) {
      throw new CheckpointIncompatibleError(`checkpoint ${field} mismatch`);
    }
  }
  if (
    checkpoint.start_offset !== expected.start_offset ||
    checkpoint.end_offset !== expected.end_offset
  ) {
    throw new CheckpointIncompatibleError("checkpoint range mismatch");
  }
}

export function canReuseValidatedCheckpoint(
  checkpoint: SegmentCheckpoint,
  expected: SegmentCheckpointPins,
): boolean {
  if (checkpoint.status !== "validated" || !checkpoint.observation) return false;
  try {
    assertCheckpointCompatible(checkpoint, expected);
    return true;
  } catch {
    return false;
  }
}
