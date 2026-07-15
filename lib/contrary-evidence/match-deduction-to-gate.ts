/**
 * Match raw rubric deductions to pre-scoring gate assessments.
 */
import type { RubricDeductionEntry } from "./duplicate-deductions.ts";
import { normalizeRootIssueKey } from "./normalize-root-issue.ts";
import { slugFromText } from "./slug.ts";
import type { ConcernAssessment } from "./types.ts";

export interface DeductionMatch {
  assessment: ConcernAssessment | null;
  concern_id: string | null;
  match_method: "concern_id" | "root_category" | "evidence_fingerprint" | "none";
}

/** Reconstruct likely concern_id for a rubric deduction (matches extraction slug logic). */
export function reconstructConcernId(entry: RubricDeductionEntry): string {
  const root = slugFromText(entry.deduction_reason || entry.deduction_label, entry.category_key);
  return `${entry.category_key}_${root}`.replace(/__+/g, "_");
}

export function evidenceFingerprint(texts: string[]): string {
  return texts
    .map((t) => t.slice(0, 80).toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean)
    .sort()
    .join("|");
}

export function matchDeductionToAssessment(
  entry: RubricDeductionEntry,
  assessments: ConcernAssessment[],
  assessmentById: Map<string, ConcernAssessment>,
): DeductionMatch {
  const candidateId = reconstructConcernId(entry);
  if (assessmentById.has(candidateId)) {
    return { assessment: assessmentById.get(candidateId)!, concern_id: candidateId, match_method: "concern_id" };
  }

  // Suffix variants from dedupeId (e.g. _2, _3)
  for (const [id, a] of assessmentById) {
    if (id.startsWith(candidateId) || candidateId.startsWith(id.split("_")[0])) {
      if (a.rubric_category === entry.category_key) {
        const rootMatch =
          normalizeRootIssueKey(a.root_issue) === entry.root_issue_key ||
          normalizeRootIssueKey(a.root_issue) === normalizeRootIssueKey(entry.deduction_reason);
        if (rootMatch) {
          return { assessment: a, concern_id: id, match_method: "concern_id" };
        }
      }
    }
  }

  const rootKey = entry.root_issue_key;
  const byRootCat = assessments.filter(
    (a) =>
      a.rubric_category === entry.category_key &&
      normalizeRootIssueKey(a.root_issue) === rootKey,
  );
  if (byRootCat.length === 1) {
    return {
      assessment: byRootCat[0],
      concern_id: byRootCat[0].concern_id,
      match_method: "root_category",
    };
  }
  if (byRootCat.length > 1) {
    const label = entry.deduction_label.toLowerCase();
    const best = byRootCat.find((a) => a.prior_criticism.toLowerCase().includes(label.slice(0, 30)));
    if (best) {
      return { assessment: best, concern_id: best.concern_id, match_method: "root_category" };
    }
    return { assessment: byRootCat[0], concern_id: byRootCat[0].concern_id, match_method: "root_category" };
  }

  const fp = evidenceFingerprint(entry.example_texts);
  if (fp) {
    for (const a of assessments) {
      const aFp = evidenceFingerprint([
        ...a.prior_evidence,
        ...a.current_supporting_evidence.map((e) => e.text),
      ]);
      if (aFp && fp === aFp) {
        return { assessment: a, concern_id: a.concern_id, match_method: "evidence_fingerprint" };
      }
    }
  }

  return { assessment: null, concern_id: null, match_method: "none" };
}

export function indexAssessments(assessments: ConcernAssessment[]): Map<string, ConcernAssessment> {
  return new Map(assessments.map((a) => [a.concern_id, a]));
}
