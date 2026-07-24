/**
 * Expert scoring_weights metadata schema (P2-12).
 *
 * Audit-only metadata on ExpertRuntimeDefinition — NOT scoring execution.
 * Does not replace the commercial-fiction rubric, grade formulas, or runtime
 * grading logic; those remain in their certified modules unchanged.
 */

/** Supported scoring_weights schema version. */
export const EXPERT_SCORING_WEIGHTS_SCHEMA_VERSION = "expert_scoring_weights@v1" as const;

/** Supported aggregation strategy identifier. */
export const EXPERT_SCORING_WEIGHTS_STRATEGY = "weighted_sum" as const;

/**
 * Stable criterion key syntax — matches expert_key and rubric category_key conventions.
 * Lowercase snake_case identifiers only.
 */
export const CRITERION_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

/** Tolerance for Sum contract A: weights must sum to exactly 1. */
export const SCORING_WEIGHT_SUM_TOLERANCE = 1e-9;

export interface ExpertScoringWeightEntry {
  criterion_key: string;
  weight: number;
}

export interface ExpertScoringWeights {
  schema_version: typeof EXPERT_SCORING_WEIGHTS_SCHEMA_VERSION;
  strategy: typeof EXPERT_SCORING_WEIGHTS_STRATEGY;
  weights: ExpertScoringWeightEntry[];
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function validateExpertScoringWeights(
  value: ExpertScoringWeights | null,
): { ok: true } | { ok: false; errors: string[] } {
  if (value === null) {
    return { ok: true };
  }

  const errors: string[] = [];

  if (!isPlainObject(value)) {
    return { ok: false, errors: ["scoring_weights must be null or a plain object"] };
  }

  const obj = value as Record<string, unknown>;

  if (obj.schema_version !== EXPERT_SCORING_WEIGHTS_SCHEMA_VERSION) {
    errors.push(
      `scoring_weights.schema_version must be ${EXPERT_SCORING_WEIGHTS_SCHEMA_VERSION}`,
    );
  }

  if (obj.strategy !== EXPERT_SCORING_WEIGHTS_STRATEGY) {
    errors.push(`scoring_weights.strategy must be ${EXPERT_SCORING_WEIGHTS_STRATEGY}`);
  }

  if (!Array.isArray(obj.weights)) {
    errors.push("scoring_weights.weights must be an array");
    return errors.length === 0 ? { ok: true } : { ok: false, errors };
  }

  if (obj.weights.length === 0) {
    errors.push("scoring_weights.weights must contain at least one entry");
  }

  const seenKeys = new Set<string>();
  let sum = 0;
  let previousKey: string | null = null;
  let hasPositiveWeight = false;

  for (let i = 0; i < obj.weights.length; i++) {
    const entry = obj.weights[i];
    const label = `scoring_weights.weights[${i}]`;

    if (!isPlainObject(entry)) {
      errors.push(`${label} must be a plain object`);
      continue;
    }

    const criterionKey = entry.criterion_key;
    if (typeof criterionKey !== "string" || !CRITERION_KEY_PATTERN.test(criterionKey)) {
      errors.push(`${label}.criterion_key must match ${CRITERION_KEY_PATTERN}`);
    } else {
      if (seenKeys.has(criterionKey)) {
        errors.push(`scoring_weights.weights: duplicate criterion_key "${criterionKey}"`);
      } else {
        seenKeys.add(criterionKey);
      }

      if (previousKey !== null && criterionKey <= previousKey) {
        errors.push("scoring_weights.weights must be sorted ascending by criterion_key");
      }
      previousKey = criterionKey;
    }

    const weight = entry.weight;
    if (!isFiniteNonNegativeNumber(weight)) {
      if (typeof weight !== "number" || Number.isNaN(weight)) {
        errors.push(`${label}.weight must be a finite number`);
      } else if (!Number.isFinite(weight)) {
        errors.push(`${label}.weight must be a finite number`);
      } else {
        errors.push(`${label}.weight must not be negative`);
      }
    } else {
      sum += weight;
      if (weight > 0) {
        hasPositiveWeight = true;
      }
    }
  }

  if (obj.weights.length > 0 && !hasPositiveWeight) {
    errors.push("scoring_weights.weights must not be all zero");
  }

  if (hasPositiveWeight && Math.abs(sum - 1) > SCORING_WEIGHT_SUM_TOLERANCE) {
    errors.push(`scoring_weights.weights must sum to 1 (got ${sum})`);
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
