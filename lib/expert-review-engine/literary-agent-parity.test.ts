import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LITERARY_AGENT } from "@/lib/ai/review-engine.ts";
import type { ParsedIssue } from "@/lib/ai/review-engine.ts";
import {
  LITERARY_AGENT_EXPERT_VERSION,
  literaryAgentRuntimeDefinition,
} from "@/experts/literary-agent/runtime-definition.ts";
import { LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH } from "@/lib/expert-review-engine/literary-agent-constitution-hash.ts";
import { hashExpertRuntimeDefinition } from "@/lib/expert-review-engine/types.ts";
import { hashExpertDefinition } from "@/lib/expert-registry/definition-hash.ts";
import { literaryAgentRegistryDefinitionV1 } from "@/lib/expert-registry/seed/literary-agent-registry.v1.ts";
import { compareCanonicalOutputs, hashCanonicalOutput } from "./canonical-output.ts";
import {
  EXPERT_LITERARY_AGENT_PARITY_FLAG_NAME,
  readExpertLiteraryAgentParityEnabled,
} from "./feature-flags.ts";
import { clearExpertModuleResolverCache } from "./module-resolver.ts";
import { runExpertReview } from "./run-expert-review.ts";
import {
  LITERARY_AGENT_PARITY_DEFINITION_HASH,
  LITERARY_AGENT_PARITY_EXPERT_KEY,
  runLiteraryAgentDeterministicParity,
  type LiteraryAgentDeterministicParityInput,
} from "./literary-agent-parity.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const ENGINE_DIR = join(dirname(fileURLToPath(import.meta.url)));

const EXPECTED_CONSTITUTION_HASH =
  "8f8b56a9de6c7d68f96fd7913645905ee2afb8ce7d0c066faba2c28106fe94f5";
const EXPECTED_REGISTRY_SEED_HASH =
  "f6b79bc07d7ba9630fb532c67c31c4b80bac2886002696e25290d163e4b44671";

const SYNTHETIC_MANUSCRIPT = [
  "Chapter One",
  "",
  "The morning sun rose over the valley.",
  "",
  "She walked slowly toward the river bank.",
].join("\n");

const SYNTHETIC_ISSUE: ParsedIssue = {
  key: "parity-issue",
  text: "Test issue",
  area: "prose",
  severity: "medium",
  source_section: "memo",
  success_criterion: "fixed",
  candidates: [
    {
      type: "replace",
      original: "The morning sun rose over the valley.",
      revised: "Morning light spilled across the valley.",
      locator: "Chapter One",
      word_savings: 1,
      reason: "test",
      confidence: 80,
      confidence_reason: "test",
      difficulty: "easy",
      story_risk: "low",
      voice_risk: "low",
      commercial_impact: "medium",
      reader_impact: "medium",
      grade_delta: 1,
      consequence_if_unchanged: "unchanged",
      dependencies: "",
      impacts: {
        pacing: 0,
        clarity: 1,
        commercial_readiness: 0,
        emotional_impact: 0,
        voice_preservation: 0,
        submission_readiness: 0,
      },
    },
  ],
};

function productionSourceFiles(): string[] {
  const skipDirs = new Set(["node_modules", ".next", ".git", "lib/expert-review-engine"]);
  const files: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const rel = full.slice(ROOT.length + 1);
      if (skipDirs.has(rel) || rel.startsWith("lib/expert-review-engine/")) continue;
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
        files.push(full);
      }
    }
  }

  walk(ROOT);
  return files;
}

function baseInput(
  overrides: Partial<LiteraryAgentDeterministicParityInput> = {},
): LiteraryAgentDeterministicParityInput {
  return {
    expertKey: LITERARY_AGENT_PARITY_EXPERT_KEY,
    expertVersion: LITERARY_AGENT_EXPERT_VERSION,
    definitionHash: LITERARY_AGENT_PARITY_DEFINITION_HASH,
    manuscriptId: "ms-parity-synthetic",
    manuscriptVersionId: "msv-parity-synthetic",
    correlationId: "corr-parity-001",
    invocation: {
      moduleId: "@/lib/canonical-review-input",
      exportName: "buildCanonicalReviewInput",
      invocationKind: "validator",
      args: {
        manuscriptVersionId: "msv-parity-synthetic",
        extractedText: Array.from({ length: 50 }, () => "word").join(" "),
        storedWordCount: 50,
        contentHash: "synthetic-content-hash",
      },
    },
    ...overrides,
  };
}

const BYPASS = { bypassFeatureFlag: true };

describe("runLiteraryAgentDeterministicParity", () => {
  beforeEach(() => {
    clearExpertModuleResolverCache();
  });

  it("1. parity adapter default-off", async () => {
    const result = await runLiteraryAgentDeterministicParity(baseInput(), {
      featureFlagReader: () => readExpertLiteraryAgentParityEnabled({}),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.parityStatus, "parity_disabled");
    }
  });

  it("2. malformed flag off", async () => {
    const result = await runLiteraryAgentDeterministicParity(baseInput(), {
      featureFlagReader: () =>
        readExpertLiteraryAgentParityEnabled({ [EXPERT_LITERARY_AGENT_PARITY_FLAG_NAME]: "maybe" }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "parity_disabled");
  });

  it("3. test bypass works", async () => {
    const result = await runLiteraryAgentDeterministicParity(baseInput(), BYPASS);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.parityStatus, "parity_match");
  });

  it("4. exact Literary Agent selector required", async () => {
    const result = await runLiteraryAgentDeterministicParity(
      baseInput({ expertKey: "literary_agent", expertVersion: LITERARY_AGENT_EXPERT_VERSION }),
      BYPASS,
    );
    assert.equal(result.ok, true);
  });

  it("5. wrong expert rejected", async () => {
    const result = await runLiteraryAgentDeterministicParity(
      baseInput({ expertKey: "developmental_editor" }),
      BYPASS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "invocation_not_approved");
  });

  it("6. wrong version rejected", async () => {
    const result = await runLiteraryAgentDeterministicParity(
      baseInput({ expertVersion: "v9.9.9" }),
      BYPASS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "invocation_not_approved");
  });

  it("7. wrong definition hash rejected", async () => {
    const result = await runLiteraryAgentDeterministicParity(
      baseInput({ definitionHash: "0".repeat(64) }),
      BYPASS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "invocation_not_approved");
  });

  it("8. approved invocation resolves", async () => {
    const result = await runLiteraryAgentDeterministicParity(baseInput(), BYPASS);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.moduleId, "@/lib/canonical-review-input");
      assert.equal(result.exportName, "buildCanonicalReviewInput");
    }
  });

  it("9. approved invocation executes through P2-22", async () => {
    const result = await runLiteraryAgentDeterministicParity(baseInput(), BYPASS);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.engineExecutionOccurred, true);
  });

  it("10. direct certified invocation occurs independently", async () => {
    let directCalled = false;
    const result = await runLiteraryAgentDeterministicParity(baseInput(), {
      ...BYPASS,
      directInvokeFn: (moduleId, exportName, args) => {
        directCalled = true;
        assert.equal(moduleId, "@/lib/canonical-review-input");
        assert.equal(exportName, "buildCanonicalReviewInput");
        assert.ok("extractedText" in args);
        return { ok: true, input: { canonicalWordCount: 50 } };
      },
    });
    assert.equal(directCalled, true);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.parityStatus, "parity_mismatch");
  });

  it("11. equivalent outputs produce parity_match", async () => {
    const result = await runLiteraryAgentDeterministicParity(baseInput(), BYPASS);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.parityStatus, "parity_match");
      assert.equal(result.engineOutputHash, result.directOutputHash);
    }
  });

  it("12. different output produces parity_mismatch", async () => {
    const result = await runLiteraryAgentDeterministicParity(baseInput(), {
      ...BYPASS,
      directInvokeFn: () => ({ ok: false, error: "synthetic mismatch" }),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.parityStatus, "parity_mismatch");
      assert.notEqual(result.engineOutputHash, result.directOutputHash);
    }
  });

  it("13. mismatch diagnostic identifies a concise path", async () => {
    const result = await runLiteraryAgentDeterministicParity(baseInput(), {
      ...BYPASS,
      directInvokeFn: () => ({ ok: true, input: { canonicalWordCount: 999 } }),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.parityStatus, "parity_mismatch");
      assert.ok(result.mismatchDiagnostics.length > 0);
      assert.match(result.mismatchDiagnostics[0]!.path, /\$/);
    }
  });

  it("14. engine and direct output hashes are deterministic", async () => {
    const first = await runLiteraryAgentDeterministicParity(baseInput(), BYPASS);
    const second = await runLiteraryAgentDeterministicParity(baseInput(), BYPASS);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      assert.equal(first.engineOutputHash, second.engineOutputHash);
      assert.equal(first.directOutputHash, second.directOutputHash);
    }
  });

  it("15. repeated identical parity runs are identical aside from allowed timing values", async () => {
    const first = await runLiteraryAgentDeterministicParity(baseInput(), {
      ...BYPASS,
      now: () => 1_000,
    });
    const second = await runLiteraryAgentDeterministicParity(baseInput(), {
      ...BYPASS,
      now: () => 2_000,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      assert.equal(first.parityStatus, second.parityStatus);
      assert.equal(first.engineOutputHash, second.engineOutputHash);
      assert.equal(first.directOutputHash, second.directOutputHash);
      assert.equal(first.durationMs, 0);
      assert.equal(second.durationMs, 0);
    }
  });

  it("16. input fixture not mutated", async () => {
    const input = baseInput();
    const argsSnapshot = structuredClone(input.invocation.args);
    await runLiteraryAgentDeterministicParity(input, BYPASS);
    assert.deepEqual(input.invocation.args, argsSnapshot);
  });

  it("17. runtime definition not mutated", async () => {
    const before = structuredClone(literaryAgentRuntimeDefinition());
    await runLiteraryAgentDeterministicParity(baseInput(), BYPASS);
    const after = structuredClone(literaryAgentRuntimeDefinition());
    assert.deepEqual(before, after);
  });

  it("18. resolver descriptor not mutated", async () => {
    const result = await runLiteraryAgentDeterministicParity(baseInput(), BYPASS);
    assert.equal(result.ok, true);
  });

  it("19. unapproved export rejected", async () => {
    const result = await runLiteraryAgentDeterministicParity(
      baseInput({
        invocation: {
          moduleId: "@/lib/ai/review-engine",
          exportName: "generateAgentReview",
          invocationKind: "prompt_builder",
          args: {},
        },
      }),
      BYPASS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "invocation_not_approved");
  });

  it("20. model-calling export rejected", async () => {
    const result = await runLiteraryAgentDeterministicParity(
      baseInput({
        invocation: {
          moduleId: "@/lib/commercial-fiction-rubric",
          exportName: "buildCommercialRubricGenerationPrompt",
          invocationKind: "prompt_builder",
          args: {},
        },
      }),
      BYPASS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "invocation_not_approved");
  });

  it("21. repair export rejected", async () => {
    const result = await runLiteraryAgentDeterministicParity(
      baseInput({
        invocation: {
          moduleId: "@/lib/ai/anthropic",
          exportName: "repairCommercialMemoValidation",
          invocationKind: "validator",
          args: {},
        },
      }),
      BYPASS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "invocation_not_approved");
  });

  it("22. publishing export rejected", async () => {
    const result = await runLiteraryAgentDeterministicParity(
      baseInput({
        invocation: {
          moduleId: "@/lib/supabase/server",
          exportName: "publish_commercial_review_generation",
          invocationKind: "payload_builder",
          args: {},
        },
      }),
      BYPASS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "invocation_not_approved");
  });

  it("23. DOCX/file export rejected", async () => {
    const result = await runLiteraryAgentDeterministicParity(
      baseInput({
        invocation: {
          moduleId: "@/lib/literary-agent-docx",
          exportName: "buildLiteraryAgentReviewDocx",
          invocationKind: "payload_builder",
          args: {},
        },
      }),
      BYPASS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "invocation_not_approved");
  });

  it("24. provider SDK not called", () => {
    const source = readFileSync(join(ENGINE_DIR, "literary-agent-parity.ts"), "utf8");
    assert.doesNotMatch(source, /@anthropic-ai/);
    assert.doesNotMatch(source, /Anthropic/);
    assert.doesNotMatch(source, /openai/);
  });

  it("25. Trigger not called", () => {
    const source = readFileSync(join(ENGINE_DIR, "literary-agent-parity.ts"), "utf8");
    assert.doesNotMatch(source, /@trigger\.dev/);
    assert.doesNotMatch(source, /trigger-client/);
  });

  it("26. Supabase not called", () => {
    const source = readFileSync(join(ENGINE_DIR, "literary-agent-parity.ts"), "utf8");
    assert.doesNotMatch(source, /@supabase/);
    assert.doesNotMatch(source, /\.insert\(/);
    assert.doesNotMatch(source, /\.update\(/);
  });

  it("27. no review write", () => {
    const source = readFileSync(join(ENGINE_DIR, "literary-agent-parity.ts"), "utf8");
    assert.doesNotMatch(source, /publish_commercial_review/);
    assert.doesNotMatch(source, /writeReview/);
  });

  it("28. no file write", () => {
    const source = readFileSync(join(ENGINE_DIR, "literary-agent-parity.ts"), "utf8");
    assert.doesNotMatch(source, /writeFileSync/);
    assert.doesNotMatch(source, /createWriteStream/);
  });

  it("29. modelCalls is zero", async () => {
    const result = await runLiteraryAgentDeterministicParity(baseInput(), BYPASS);
    assert.equal(result.modelCalls, 0);
  });

  it("30. writes is zero", async () => {
    const result = await runLiteraryAgentDeterministicParity(baseInput(), BYPASS);
    assert.equal(result.writes, 0);
  });

  it("31. productionExecutionOccurred is false", async () => {
    const result = await runLiteraryAgentDeterministicParity(baseInput(), BYPASS);
    assert.equal(result.productionExecutionOccurred, false);
  });

  it("32. runExpertReview remains plan-only", async () => {
    const source = readFileSync(join(ENGINE_DIR, "run-expert-review.ts"), "utf8");
    assert.doesNotMatch(source, /literary-agent-parity/);
    assert.doesNotMatch(source, /executeResolvedExpertPlugin/);
    assert.match(source, /executionAllowed:\s*false/);

    const result = await runExpertReview(
      {
        manuscriptId: "ms-parity-plan",
        manuscriptVersionId: "msv-parity-plan",
        executionMode: "plan_only",
        expertKey: LITERARY_AGENT_PARITY_EXPERT_KEY,
        expertVersion: LITERARY_AGENT_EXPERT_VERSION,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.plan.executionMode, "plan_only");
  });

  it("33. executionAllowed remains false", async () => {
    const result = await runExpertReview(
      {
        manuscriptId: "ms-parity-plan",
        manuscriptVersionId: "msv-parity-plan",
        executionMode: "plan_only",
        expertKey: LITERARY_AGENT_PARITY_EXPERT_KEY,
        expertVersion: LITERARY_AGENT_EXPERT_VERSION,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.plan.executionAllowed, false);
  });

  it("34. at least three real deterministic Literary Agent exports achieve parity", async () => {
    const exportsToTest = [
      baseInput(),
      baseInput({
        invocation: {
          moduleId: "@/lib/ai/review-engine",
          exportName: "buildSystemPrompt",
          invocationKind: "prompt_builder",
          args: LITERARY_AGENT as unknown as Record<string, unknown>,
        },
      }),
      baseInput({
        invocation: {
          moduleId: "@/lib/commercial-review-repair",
          exportName: "normalizeCommercialMemoStatistics",
          invocationKind: "normalizer",
          args: {
            memoContent: "This manuscript is 50 words long.",
            canonicalWordCount: 50,
          },
        },
      }),
    ];

    for (const input of exportsToTest) {
      const result = await runLiteraryAgentDeterministicParity(input, BYPASS);
      assert.equal(result.ok, true, `${input.invocation.exportName} should parity match`);
      if (result.ok) assert.equal(result.parityStatus, "parity_match");
    }
  });

  it("35. buildCanonicalReviewInput achieves parity with synthetic input", async () => {
    const result = await runLiteraryAgentDeterministicParity(baseInput(), BYPASS);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.parityStatus, "parity_match");
  });

  it("36. one prompt builder achieves parity", async () => {
    const result = await runLiteraryAgentDeterministicParity(
      baseInput({
        invocation: {
          moduleId: "@/lib/ai/review-engine",
          exportName: "buildSystemPrompt",
          invocationKind: "prompt_builder",
          args: LITERARY_AGENT as unknown as Record<string, unknown>,
        },
      }),
      BYPASS,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.parityStatus, "parity_match");
      assert.equal(typeof result.engineOutputHash, "string");
    }
  });

  it("37. buildReplacementPayload achieves parity with synthetic fixture", async () => {
    const result = await runLiteraryAgentDeterministicParity(
      baseInput({
        invocation: {
          moduleId: "@/lib/editorial-generation/replacement-payload",
          exportName: "buildReplacementPayload",
          invocationKind: "payload_builder",
          args: {
            issues: [SYNTHETIC_ISSUE],
            manuscriptText: SYNTHETIC_MANUSCRIPT,
          },
        },
      }),
      BYPASS,
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.parityStatus, "parity_match");
  });

  it("38. abort behavior returns typed failure", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await runLiteraryAgentDeterministicParity(
      baseInput({ signal: controller.signal }),
      BYPASS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "executor_failed");
  });

  it("39. timeout behavior returns typed failure", async () => {
    const result = await runLiteraryAgentDeterministicParity(baseInput({ timeoutMs: 1 }), {
      ...BYPASS,
      executePluginFn: async () => ({
        ok: false,
        code: "timeout",
        message: "Plugin invocation timed out",
      }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "executor_failed");
  });

  it("40. canonical hashes remain unchanged", () => {
    const runtimeHash = hashExpertRuntimeDefinition(literaryAgentRuntimeDefinition());
    assert.equal(runtimeHash, LITERARY_AGENT_PARITY_DEFINITION_HASH);
    assert.equal(LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH, EXPECTED_CONSTITUTION_HASH);
    assert.equal(
      hashExpertDefinition(literaryAgentRegistryDefinitionV1()),
      EXPECTED_REGISTRY_SEED_HASH,
    );
  });

  it("41. no production caller imports the parity adapter", () => {
    const offenders: string[] = [];
    for (const file of productionSourceFiles()) {
      const content = readFileSync(file, "utf8");
      if (
        content.includes("literary-agent-parity") ||
        content.includes("runLiteraryAgentDeterministicParity")
      ) {
        offenders.push(file.slice(ROOT.length + 1));
      }
    }
    assert.deepEqual(offenders, []);
  });
});

describe("compareCanonicalOutputs", () => {
  it("rejects function values", () => {
    const result = compareCanonicalOutputs({ ok: true }, { ok: () => true });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "function");
  });

  it("hashes are stable for equivalent objects", () => {
    const hashA = hashCanonicalOutput({ b: 2, a: 1, nested: { z: 3, y: 2 } });
    const hashB = hashCanonicalOutput({ nested: { y: 2, z: 3 }, a: 1, b: 2 });
    assert.equal(hashA, hashB);
  });
});

describe("parity feature flag contract", () => {
  it("readExpertLiteraryAgentParityEnabled follows absent/off contract", () => {
    assert.equal(readExpertLiteraryAgentParityEnabled({}), false);
    assert.equal(
      readExpertLiteraryAgentParityEnabled({ [EXPERT_LITERARY_AGENT_PARITY_FLAG_NAME]: "" }),
      false,
    );
    assert.equal(
      readExpertLiteraryAgentParityEnabled({ [EXPERT_LITERARY_AGENT_PARITY_FLAG_NAME]: "true" }),
      true,
    );
  });
});
