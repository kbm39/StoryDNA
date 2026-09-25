/**
 * Strict contiguous-excerpt gate for V2 observations.
 * Uses manuscriptPassageLocated, then narrow typographic punctuation equivalence.
 * Does not rewrite excerpts. Does not call a model.
 */

import { manuscriptPassageLocated } from "@/lib/passage-locate.ts";
import {
  matchContiguousWithTypographicPunctuation,
  type V2EvidenceMatchMethod,
} from "./unicode-punctuation-equivalence.ts";

export const V2_EVIDENCE_GATE_VERSION = "archivist_v2_contiguous_evidence@v1" as const;

export type V2EvidenceStatus = "verified" | "unverified";
export type { V2EvidenceMatchMethod };

export function excerptIsContiguousInSegment(segmentText: string, excerpt: string): boolean {
  const gate = applySegmentEvidenceGate({ excerpt, segmentText });
  return gate.applied ? gate.contiguous : false;
}

export function applySegmentEvidenceGate(args: {
  excerpt: string;
  segmentText: string | undefined;
}):
  | { applied: false }
  | {
      applied: true;
      contiguous: boolean;
      evidence_status: V2EvidenceStatus;
      evidence_match_method: V2EvidenceMatchMethod | null;
      normalized_punctuation: boolean;
      raw_excerpt: string;
      raw_source_match_window: string | null;
    } {
  if (args.segmentText === undefined) return { applied: false };
  const exact = manuscriptPassageLocated(args.segmentText, args.excerpt);
  const match = matchContiguousWithTypographicPunctuation({
    segmentText: args.segmentText,
    excerpt: args.excerpt,
    exactLocated: exact,
  });
  return {
    applied: true,
    contiguous: match.contiguous,
    evidence_status: match.contiguous ? "verified" : "unverified",
    evidence_match_method: match.method,
    normalized_punctuation: match.normalized_punctuation,
    raw_excerpt: match.raw_excerpt,
    raw_source_match_window: match.raw_source_match_window,
  };
}
