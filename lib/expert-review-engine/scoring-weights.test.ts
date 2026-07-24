import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import {
  CRITERION_KEY_PATTERN,
  EXPERT_SCORING_WEIGHTS_SCHEMA_VERSION,
  EXPERT_SCORING_WEIGHTS_STRATEGY,
  type ExpertScoringWeights,
  validateExpertScoringWeights,
} from "./scoring-weights.ts";
import { hashExpertRuntimeDefinition, type ExpertRuntimeDefinition } from "./types.ts";
import { validateExpertRuntimeDefinition } from "./validate-runtime-definition.ts";
import { withRuntimeDefinitionHash } from "./rehash-runtime-definition.ts";
import {
  bootstrapExpertRuntimeRegistry,
  clearExpertRuntimeRegistryForTests,
  getExpertRuntimeDefinition,
} from "./registry/in-code.ts";

const EXPECTED_LA_DEFINITION_HASH =
  "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b";

function validScoringWeights(
  overrides: Partial<ExpertScoringWeights> = {},
): ExpertScoringWeights {
  return {
    schema_version: EXPERT_SCORING_WEIGHTS_SCHEMA_VERSION,
    strategy: EXPERT_SCORING_WEIGHTS_STRATEGY,
    weights: [
      { criterion_key: "alpha", weight: 0.6 },
      { criterion_key: "beta", weight: 0.4 },
    ],
    ...overrides,
  };
}

function withScoringWeights(
  scoring_weights: ExpertScoringWeights | null,
): ExpertRuntimeDefinition {
  const base = literaryAgentRuntimeDefinition();
  return withRuntimeDefinitionHash({ ...base, scoring_weights });
}

describe("validateExpertScoringWeights", () => {
  it("null is valid", () => {
    assert.equal(validateExpertScoringWeights(null).ok, true);
  });

  it("valid weighted config passes", () => {
    const result = validateExpertScoringWeights(validScoringWeights());
    assert.equal(result.ok, true);
  });

  it("missing schema_version fails", () => {
    const config = validScoringWeights();
    const { schema_version: _omit, ...rest } = config;
    void _omit;
    const result = validateExpertScoringWeights(rest as ExpertScoringWeights);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("schema_version")));
    }
  });

  it("unsupported schema_version fails", () => {
    const result = validateExpertScoringWeights(
      validScoringWeights({
        schema_version: "expert_scoring_weights@v999" as typeof EXPERT_SCORING_WEIGHTS_SCHEMA_VERSION,
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("schema_version")));
    }
  });

  it("unsupported strategy fails", () => {
    const result = validateExpertScoringWeights(
      validScoringWeights({
        strategy: "weighted_average" as typeof EXPERT_SCORING_WEIGHTS_STRATEGY,
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("strategy")));
    }
  });

  it("empty weights fails", () => {
    const result = validateExpertScoringWeights(validScoringWeights({ weights: [] }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("at least one entry")));
    }
  });

  it("malformed criterion_key fails", () => {
    const result = validateExpertScoringWeights(
      validScoringWeights({
        weights: [{ criterion_key: "Bad-Key", weight: 1 }],
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("criterion_key")));
    }
  });

  it("duplicate criterion_key fails", () => {
    const result = validateExpertScoringWeights(
      validScoringWeights({
        weights: [
          { criterion_key: "alpha", weight: 0.5 },
          { criterion_key: "alpha", weight: 0.5 },
        ],
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("duplicate criterion_key")));
    }
  });

  it("unsorted keys fail", () => {
    const result = validateExpertScoringWeights(
      validScoringWeights({
        weights: [
          { criterion_key: "beta", weight: 0.4 },
          { criterion_key: "alpha", weight: 0.6 },
        ],
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("sorted ascending")));
    }
  });

  it("negative weight fails", () => {
    const result = validateExpertScoringWeights(
      validScoringWeights({
        weights: [{ criterion_key: "alpha", weight: -0.1 }],
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("must not be negative")));
    }
  });

  it("NaN weight fails", () => {
    const result = validateExpertScoringWeights(
      validScoringWeights({
        weights: [{ criterion_key: "alpha", weight: Number.NaN }],
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("finite number")));
    }
  });

  it("Infinity weight fails", () => {
    const result = validateExpertScoringWeights(
      validScoringWeights({
        weights: [{ criterion_key: "alpha", weight: Number.POSITIVE_INFINITY }],
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("finite number")));
    }
  });

  it("all-zero weights fail", () => {
    const result = validateExpertScoringWeights(
      validScoringWeights({
        weights: [
          { criterion_key: "alpha", weight: 0 },
          { criterion_key: "beta", weight: 0 },
        ],
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("all zero")));
    }
  });

  it("incorrect total fails", () => {
    const result = validateExpertScoringWeights(
      validScoringWeights({
        weights: [
          { criterion_key: "alpha", weight: 0.5 },
          { criterion_key: "beta", weight: 0.3 },
        ],
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("must sum to 1")));
    }
  });

  it("deterministic serialization", () => {
    const config = validScoringWeights();
    const serializedA = JSON.stringify(config);
    const serializedB = JSON.stringify(config);
    assert.equal(serializedA, serializedB);
    for (const entry of config.weights) {
      assert.match(entry.criterion_key, CRITERION_KEY_PATTERN);
    }
  });
});

describe("scoring_weights runtime definition integration", () => {
  it("changing scoring_weights changes hash after rehash", () => {
    const base = literaryAgentRuntimeDefinition();
    const withWeights = withScoringWeights(validScoringWeights());
    assert.notEqual(
      withWeights.runtime_versions.definition_hash,
      base.runtime_versions.definition_hash,
    );
    assert.equal(validateExpertRuntimeDefinition(withWeights).ok, true);
  });

  it("stale hash fails after scoring_weights mutation", () => {
    const base = literaryAgentRuntimeDefinition();
    const stale = {
      ...base,
      scoring_weights: validScoringWeights(),
    };
    const result = validateExpertRuntimeDefinition(stale);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("definition_hash")));
    }
  });

  it("Literary Agent hash unchanged with null scoring_weights", () => {
    const def = literaryAgentRuntimeDefinition();
    assert.equal(def.scoring_weights, null);
    assert.equal(hashExpertRuntimeDefinition(def), EXPECTED_LA_DEFINITION_HASH);
    assert.equal(def.runtime_versions.definition_hash, EXPECTED_LA_DEFINITION_HASH);
    assert.equal(validateExpertRuntimeDefinition(def).ok, true);
  });

  it("registry-wide validation passes", () => {
    clearExpertRuntimeRegistryForTests();
    bootstrapExpertRuntimeRegistry();
    const entry = getExpertRuntimeDefinition("literary_agent");
    assert.ok(entry);
    assert.equal(entry!.definition.scoring_weights, null);
    assert.equal(validateExpertRuntimeDefinition(entry!.definition).ok, true);
    assert.equal(entry!.definitionHash, EXPECTED_LA_DEFINITION_HASH);
  });
});

describe("validateExpertRuntimeDefinition scoring_weights wiring", () => {
  beforeEach(() => {
    clearExpertRuntimeRegistryForTests();
  });

  it("rejects invalid scoring_weights on otherwise valid definition", () => {
    const def = withScoringWeights(
      validScoringWeights({
        weights: [{ criterion_key: "alpha", weight: 0.5 }],
      }),
    );
    const result = validateExpertRuntimeDefinition(def);
    assert.equal(result.ok, false);
  });

  it("accepts valid non-null scoring_weights after rehash", () => {
    const def = withScoringWeights(validScoringWeights());
    const result = validateExpertRuntimeDefinition(def);
    assert.equal(result.ok, true);
  });
});
