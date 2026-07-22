import type { ParsedIssue } from "../ai/review-engine.ts";
import { manuscriptPassageLocated } from "../passage-locate.ts";
import type { RevisionType } from "../types.ts";

/** Structural / advisory types export as Word comments — not track changes. */
export const COMMENT_EXPORT_TYPES = new Set<RevisionType>([
  "reorder",
  "move",
  "combine",
  "split",
  "comment_only",
]);

/** Uses the same algorithm as publish-time SQL (manuscript_passage_located). */
export function verifyOriginal(original: string, manuscriptText: string): boolean {
  return manuscriptPassageLocated(manuscriptText, original);
}

/**
 * Single authoritative payload builder for production publish verification.
 * Every candidate type uses strict passage location — no auto-verified comment types.
 */
export function buildReplacementPayload(
  issues: ParsedIssue[],
  manuscriptText: string,
): { issues: Record<string, unknown>[] } {
  return {
    issues: issues.map((issue) => ({
      text: issue.text,
      area: issue.area || null,
      severity: issue.severity,
      source_section: issue.source_section || null,
      success_criterion: issue.success_criterion || null,
      candidates: issue.candidates.map((c) => {
        const type = c.type as RevisionType;
        return {
          type,
          original: c.original,
          revised: c.revised,
          locator: c.locator || null,
          word_savings: c.word_savings,
          reason: c.reason || null,
          confidence: c.confidence,
          confidence_reason: c.confidence_reason || null,
          difficulty: c.difficulty || null,
          story_risk: c.story_risk || null,
          voice_risk: c.voice_risk || null,
          commercial_impact: c.commercial_impact || null,
          reader_impact: c.reader_impact || null,
          grade_delta: c.grade_delta,
          consequence_if_unchanged: c.consequence_if_unchanged || null,
          dependencies: c.dependencies || null,
          impacts: c.impacts,
          export_mode: COMMENT_EXPORT_TYPES.has(type) ? "comment" : "track_change",
          verified: verifyOriginal(c.original, manuscriptText),
        };
      }),
    })),
  };
}
