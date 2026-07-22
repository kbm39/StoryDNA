import type { ParsedIssue } from "../ai/review-engine.ts";
import { manuscriptPassageLocated } from "../passage-locate.ts";
import type { RevisionType } from "../types.ts";

/** Uses the same algorithm as publish-time SQL (manuscript_passage_located). */
export function verifyOriginal(original: string, manuscriptText: string): boolean {
  return manuscriptPassageLocated(manuscriptText, original);
}

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
          reason: c.reason || null,
          locator: c.locator || null,
          verified: verifyOriginal(c.original, manuscriptText),
        };
      }),
    })),
  };
}
