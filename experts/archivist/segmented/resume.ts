import { DuplicateSegmentedResumeError } from "./errors.ts";
import {
  assertCheckpointCompatible,
  canReuseValidatedCheckpoint,
  checkpointPinsFor,
} from "./checkpoint.ts";
import type { PlannedSegment, SegmentCheckpoint, SegmentPlan } from "./types.ts";

export function hasDuplicateActiveResume(
  checkpoints: readonly SegmentCheckpoint[],
): boolean {
  return checkpoints.some((item) => item.status === "running");
}

export function assertNoDuplicateActiveResume(
  checkpoints: readonly SegmentCheckpoint[],
): void {
  if (hasDuplicateActiveResume(checkpoints)) {
    throw new DuplicateSegmentedResumeError();
  }
}

export function selectSegmentsToRun(args: {
  plan: SegmentPlan;
  checkpoints: readonly SegmentCheckpoint[];
}): {
  reuse: PlannedSegment[];
  remaining: PlannedSegment[];
  rejected: Array<{ segment_id: string; reason: string }>;
} {
  assertNoDuplicateActiveResume(args.checkpoints);
  const byId = new Map(args.checkpoints.map((item) => [item.segment_id, item]));
  const reuse: PlannedSegment[] = [];
  const remaining: PlannedSegment[] = [];
  const rejected: Array<{ segment_id: string; reason: string }> = [];

  for (const segment of args.plan.segments) {
    const expected = checkpointPinsFor({ plan: args.plan, segment });
    const existing = byId.get(segment.segment_id);
    if (!existing) {
      remaining.push(segment);
      continue;
    }
    if (canReuseValidatedCheckpoint(existing, expected)) {
      reuse.push(segment);
      continue;
    }
    if (existing.status === "validated") {
      try {
        assertCheckpointCompatible(existing, expected);
      } catch (error) {
        rejected.push({
          segment_id: segment.segment_id,
          reason: error instanceof Error ? error.message : "incompatible checkpoint",
        });
      }
    }
    remaining.push(segment);
  }
  return { reuse, remaining, rejected };
}
