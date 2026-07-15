import type { CommercialRubricPayload, RubricCategoryScore } from "../commercial-fiction-rubric.ts";
import {
  DEFAULT_ROOT_ISSUE_CATEGORY_CAP,
  DEFAULT_ROOT_ISSUE_DEDUCTION_CAP,
} from "./constants.ts";
import { normalizeRootIssueKey, rootIssueLabel } from "./normalize-root-issue.ts";

export interface RubricDeductionEntry {
  category_key: string;
  category_name: string;
  deduction_index: number;
  deduction_label: string;
  deduction_reason: string;
  deduction_points: number;
  root_issue_key: string;
  example_texts: string[];
}

export interface DuplicateDeductionAnalysis {
  entries: RubricDeductionEntry[];
  violations: string[];
  duplicate_deduction_count: number;
  points_to_remove: Array<{ category_key: string; deduction_index: number; points: number; reason: string }>;
  blocked: boolean;
}

export interface DuplicateDeductionOptions {
  rootIssueCap?: number;
  categoryCap?: number;
}

/** Extract flat deduction entries from rubric payload. */
export function extractRubricDeductionEntries(payload: CommercialRubricPayload): RubricDeductionEntry[] {
  const out: RubricDeductionEntry[] = [];
  for (const cat of allCategories(payload)) {
    const labels = cat.deductions ?? [];
    const reasons = cat.deduction_reasons ?? [];
    const perPoint = labels.length > 0 ? cat.deduction / labels.length : 0;
    labels.forEach((label, idx) => {
      const reason = reasons[idx] ?? label;
      out.push({
        category_key: cat.category_key,
        category_name: cat.category_name,
        deduction_index: idx,
        deduction_label: label,
        deduction_reason: reason,
        deduction_points: perPoint,
        root_issue_key: normalizeRootIssueKey(`${label} ${reason}`),
        example_texts: (cat.examples ?? []).map((e) => e.text).filter(Boolean),
      });
    });
  }
  return out;
}

/** Detect duplicate root-issue stacking and compute point removals. */
export function analyzeDuplicateDeductions(
  payload: CommercialRubricPayload,
  options: DuplicateDeductionOptions = {},
): DuplicateDeductionAnalysis {
  const rootIssueCap = options.rootIssueCap ?? DEFAULT_ROOT_ISSUE_DEDUCTION_CAP;
  const categoryCap = options.categoryCap ?? DEFAULT_ROOT_ISSUE_CATEGORY_CAP;
  const entries = extractRubricDeductionEntries(payload);
  const violations: string[] = [];
  const points_to_remove: DuplicateDeductionAnalysis["points_to_remove"] = [];

  const byRoot = new Map<string, RubricDeductionEntry[]>();
  for (const e of entries) {
    const list = byRoot.get(e.root_issue_key) ?? [];
    list.push(e);
    byRoot.set(e.root_issue_key, list);
  }

  let duplicate_deduction_count = 0;

  for (const [rootKey, group] of byRoot) {
    if (rootKey === "unknown" || group.length <= 1) continue;

    const categories = new Set(group.map((g) => g.category_key));
    const totalPoints = group.reduce((s, g) => s + g.deduction_points, 0);

    if (categories.size > categoryCap) {
      duplicate_deduction_count += group.length - categoryCap;
      violations.push(
        `Root issue "${rootIssueLabel(rootKey)}" penalized across ${categories.size} categories (cap ${categoryCap}).`,
      );
    }

    if (totalPoints > rootIssueCap + 0.01) {
      let excess = totalPoints - rootIssueCap;
      duplicate_deduction_count += group.length - 1;
      violations.push(
        `Root issue "${rootIssueLabel(rootKey)}" total deduction ${totalPoints.toFixed(2)} exceeds cap ${rootIssueCap}.`,
      );

      // Remove excess from lowest-priority duplicates (keep first category's deductions).
      const sorted = [...group].sort((a, b) => {
        if (a.category_key === b.category_key) return b.deduction_index - a.deduction_index;
        return a.category_key.localeCompare(b.category_key);
      });
      for (let i = 1; i < sorted.length && excess > 0.01; i++) {
        const entry = sorted[i];
        const remove = Math.min(excess, entry.deduction_points);
        if (remove <= 0) continue;
        points_to_remove.push({
          category_key: entry.category_key,
          deduction_index: entry.deduction_index,
          points: remove,
          reason: `Duplicate root issue cap: ${rootIssueLabel(rootKey)}`,
        });
        excess -= remove;
      }
    }

    // Repeated evidence quotations across same root issue
    const quotes = new Map<string, number>();
    for (const e of group) {
      for (const q of e.example_texts) {
        const key = q.slice(0, 80).toLowerCase();
        quotes.set(key, (quotes.get(key) ?? 0) + 1);
      }
    }
    for (const [q, count] of quotes) {
      if (count > 1 && q.length > 20) {
        violations.push(
          `Repeated evidence quotation for "${rootIssueLabel(rootKey)}": "${q.slice(0, 60)}…" used ${count} times.`,
        );
      }
    }
  }

  return {
    entries,
    violations,
    duplicate_deduction_count,
    points_to_remove,
    blocked: violations.some((v) => v.includes("exceeds cap") || v.includes("penalized across")),
  };
}

/** Apply duplicate cap removals and recompute category earned points. */
export function applyDuplicateDeductionRemovals(
  payload: CommercialRubricPayload,
  analysis: DuplicateDeductionAnalysis,
): CommercialRubricPayload {
  if (analysis.points_to_remove.length === 0) return payload;

  const clone: CommercialRubricPayload = JSON.parse(JSON.stringify(payload));
  const removalByCat = new Map<string, number>();

  for (const r of analysis.points_to_remove) {
    removalByCat.set(r.category_key, (removalByCat.get(r.category_key) ?? 0) + r.points);
  }

  for (const cat of allCategories(clone)) {
    const remove = removalByCat.get(cat.category_key) ?? 0;
    if (remove <= 0) continue;
    cat.deduction = Math.max(0, Math.round((cat.deduction - remove) * 100) / 100);
    cat.points_earned = Math.max(0, cat.maximum_points - cat.deduction);
    cat.weighted_contribution = cat.points_earned;
  }

  return clone;
}

function allCategories(payload: CommercialRubricPayload): RubricCategoryScore[] {
  return [...payload.craft_categories, ...payload.acquisition_categories];
}
