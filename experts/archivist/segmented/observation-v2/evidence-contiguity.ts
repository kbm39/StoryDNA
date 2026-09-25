/**
 * Strict contiguous-excerpt gate for V2 observations.
 * Uses manuscriptPassageLocated. Does not rewrite excerpts. Does not call a model.
 */

import { manuscriptPassageLocated } from "@/lib/passage-locate.ts";

export const V2_EVIDENCE_GATE_VERSION = "archivist_v2_contiguous_evidence@v1" as const;

export type V2EvidenceStatus = "verified" | "unverified";

export function excerptIsContiguousInSegment(segmentText: string, excerpt: string): boolean {
  return manuscriptPassageLocated(segmentText, excerpt);
}

export function applySegmentEvidenceGate(args: {
  excerpt: string;
  segmentText: string | undefined;
}):
  | { applied: false }
  | { applied: true; contiguous: boolean; evidence_status: V2EvidenceStatus } {
  if (args.segmentText === undefined) return { applied: false };
  const contiguous = excerptIsContiguousInSegment(args.segmentText, args.excerpt);
  return {
    applied: true,
    contiguous,
    evidence_status: contiguous ? "verified" : "unverified",
  };
}
