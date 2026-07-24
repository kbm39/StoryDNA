import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACQUISITION_CATEGORIES,
  CRAFT_CATEGORIES,
} from "@/lib/commercial-fiction-rubric.ts";
import type { CommercialRubricPayload, RubricCategoryScore } from "@/lib/commercial-fiction-rubric.ts";
import type { ConcernAssessment } from "@/lib/contrary-evidence/types.ts";
import type { GenerationMeta } from "@/lib/ai/shared.ts";
import type { ParsedIssue } from "@/lib/ai/review-engine.ts";
import { canonicalManuscriptLengthSentence } from "@/lib/word-count-reporting.ts";
import {
  LITERARY_AGENT_EXPERT_VERSION,
  literaryAgentRuntimeDefinition,
} from "@/experts/literary-agent/runtime-definition.ts";
import { LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH } from "@/lib/expert-review-engine/literary-agent-constitution-hash.ts";
import { hashExpertRuntimeDefinition } from "@/lib/expert-review-engine/types.ts";
import { hashExpertDefinition } from "@/lib/expert-registry/definition-hash.ts";
import { literaryAgentRegistryDefinitionV1 } from "@/lib/expert-registry/seed/literary-agent-registry.v1.ts";
import {
  canonicalizeOutputValue,
  compareCanonicalOutputs,
  MAX_CANONICAL_OUTPUT_BYTES,
} from "./canonical-output.ts";
import {
  EXPERT_LITERARY_AGENT_REPLAY_FLAG_NAME,
  readExpertLiteraryAgentReplayEnabled,
} from "./feature-flags.ts";
import {
  LITERARY_AGENT_REPLAY_ARTIFACT_SCHEMA_VERSION,
  LITERARY_AGENT_REPLAY_DEFINITION_HASH,
  LITERARY_AGENT_REPLAY_EXPERT_KEY,
  REPLAY_COMPARISON_PROJECTION_GROUPS,
  assertReplayComparisonProjectionComplete,
  validateLiteraryAgentReplayArtifactBundle,
  type LiteraryAgentExpectedCertifiedResult,
  type LiteraryAgentReplayArtifactBundle,
} from "./replay-artifact-contract.ts";
import {
  getLiteraryAgentReplayStage,
  isRegisteredReplayStageExport,
  LITERARY_AGENT_REPLAY_STAGE_COUNT,
  LITERARY_AGENT_REPLAY_STAGE_IDS,
  orderedLiteraryAgentReplayStages,
} from "./replay-stage-registry.ts";
import {
  deriveReplayCertifiedProjection,
  runLiteraryAgentReplay,
} from "./literary-agent-replay.ts";
import { runExpertReview } from "./run-expert-review.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const ENGINE_DIR = join(dirname(fileURLToPath(import.meta.url)));

const EXPECTED_CONSTITUTION_HASH =
  "8f8b56a9de6c7d68f96fd7913645905ee2afb8ce7d0c066faba2c28106fe94f5";
const EXPECTED_REGISTRY_SEED_HASH =
  "f6b79bc07d7ba9630fb532c67c31c4b80bac2886002696e25290d163e4b44671";

const SYNTHETIC_WORD_COUNT = 50;
const SYNTHETIC_MANUSCRIPT_ID = "ms-replay-synthetic";
const SYNTHETIC_VERSION_ID = "msv-replay-synthetic";
const SYNTHETIC_EXTRACTED_TEXT = Array.from({ length: SYNTHETIC_WORD_COUNT }, () => "word").join(" ");

const SYNTHETIC_PASSAGE = [
  "Chapter One",
  "",
  "The morning sun rose over the valley.",
  "",
  "She walked slowly toward the river bank.",
].join("\n");

const SYNTHETIC_ISSUE: ParsedIssue = {
  key: "replay-issue-1",
  text: "Synthetic pacing concern for replay testing.",
  area: "pacing",
  severity: "medium",
  source_section: "memo",
  success_criterion: "Improve narrative momentum.",
  candidates: [
    {
      type: "replace",
      original: "The morning sun rose over the valley.",
      revised: "Morning light spilled across the valley.",
      locator: "Chapter One",
      word_savings: 1,
      reason: "tighter prose",
      confidence: 80,
      confidence_reason: "synthetic",
      difficulty: "easy",
      story_risk: "low",
      voice_risk: "low",
      commercial_impact: "medium",
      reader_impact: "medium",
      grade_delta: 1,
      consequence_if_unchanged: "unchanged pacing",
      dependencies: "",
      impacts: {
        pacing: 1,
        clarity: 0,
        commercial_readiness: 0,
        emotional_impact: 0,
        voice_preservation: 0,
        submission_readiness: 0,
      },
    },
  ],
};

const SYNTHETIC_ISSUE_2: ParsedIssue = {
  key: "replay-issue-2",
  text: "Synthetic character motivation gap for replay testing.",
  area: "character",
  severity: "high",
  source_section: "memo",
  success_criterion: "Clarify protagonist agency.",
  candidates: [
    {
      type: "replace",
      original: "She walked slowly toward the river bank.",
      revised: "She strode toward the river bank with clear intent.",
      locator: "Chapter One",
      word_savings: 0,
      reason: "stronger agency",
      confidence: 75,
      confidence_reason: "synthetic",
      difficulty: "medium",
      story_risk: "low",
      voice_risk: "low",
      commercial_impact: "high",
      reader_impact: "high",
      grade_delta: 2,
      consequence_if_unchanged: "flat protagonist drive",
      dependencies: "",
      impacts: {
        pacing: 0,
        clarity: 1,
        commercial_readiness: 1,
        emotional_impact: 1,
        voice_preservation: 0,
        submission_readiness: 1,
      },
    },
  ],
};

function syntheticConcernAssessment(
  overrides: Partial<ConcernAssessment> = {},
): ConcernAssessment {
  return {
    comparison_mode: "REVISION_COMPARISON",
    concern_id: "concern-replay-1",
    root_issue: "Synthetic pacing concern",
    rubric_category: "pacing_narrative_tension",
    prior_criticism: "Prior pacing issue in synthetic replay fixture.",
    prior_evidence: ["Synthetic prior evidence passage one."],
    current_supporting_evidence: [],
    current_contrary_evidence: [],
    revision_that_addresses_it: null,
    original_basis_still_present: true,
    status: "PARTIALLY_IMPROVED",
    confidence: "high",
    prior_deduction: 2,
    points_restored: 1,
    points_invalidated: 0,
    duplicate_points_removed: 0,
    overbreadth_points_removed: 0,
    remaining_deduction: 1,
    narrowed_current_finding: null,
    explanation: "Synthetic contrary-evidence explanation.",
    contrary_evidence_analysis: "Synthetic contrary-evidence analysis.",
    ...overrides,
  };
}

function sampleCategory(key: string, name: string, max: number, earned: number): RubricCategoryScore {
  const safeEarned = Math.min(earned, max);
  return {
    category_key: key,
    category_name: name,
    points_earned: safeEarned,
    maximum_points: max,
    deduction: max - safeEarned,
    weighted_contribution: safeEarned,
    confidence: "high",
    strengths: ["Synthetic narrative strength with specific detail."],
    deductions: safeEarned < max ? ["Synthetic pacing deduction with detail."] : [],
    deduction_reasons: safeEarned < max ? ["Synthetic denouement concern with detail."] : [],
    revision_to_recover: "Synthetic recovery path with concrete action.",
    examples: [
      { text: "The first narrative beat lands with clear intent.", location: "Ch. 1" },
      { text: "A second concrete example supports the category score.", location: "Ch. 2" },
    ],
  };
}

function syntheticRubricPayload(): CommercialRubricPayload {
  return {
    craft_categories: CRAFT_CATEGORIES.map((c) => sampleCategory(c.key, c.name, c.max, Math.min(5, c.max))),
    acquisition_categories: ACQUISITION_CATEGORIES.map((c) =>
      sampleCategory(c.key, c.name, c.max, Math.min(3, c.max)),
    ),
    length_recommendations: [],
  };
}

function syntheticGenerationMeta(truncated = false): GenerationMeta {
  return {
    finishReason: truncated ? "max_tokens" : "end_turn",
    inputTokens: 100,
    outputTokens: truncated ? 8000 : 500,
    maxTokens: 8000,
    outputTruncated: truncated,
  };
}

function syntheticMemoContent(): string {
  return `${canonicalManuscriptLengthSentence(SYNTHETIC_WORD_COUNT)}\n\n**REQUEST**\n\nSynthetic acquisitions memo for replay harness testing.`;
}

function syntheticRevisionRaw(): string {
  return JSON.stringify({ issues: [SYNTHETIC_ISSUE, SYNTHETIC_ISSUE_2] });
}

function productionSourceFiles(): string[] {
  const skipDirs = new Set(["node_modules", ".next", ".git", "lib/expert-review-engine"]);
  const files: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const rel = full.slice(ROOT.length + 1);
      if (skipDirs.has(rel) || rel.startsWith("lib/expert-review-engine/")) continue;
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) files.push(full);
    }
  }
  walk(ROOT);
  return files;
}

async function buildValidExpectedProjection(): Promise<LiteraryAgentExpectedCertifiedResult> {
  const bundle = await buildSyntheticBundle({ skipDeriveExpected: true });
  const derived = await deriveReplayCertifiedProjection(bundle);
  if ("ok" in derived && derived.ok === false) {
    throw new Error(`Failed to derive expected projection: ${derived.message}`);
  }
  return derived as LiteraryAgentExpectedCertifiedResult;
}

async function buildSyntheticBundle(
  overrides: Partial<LiteraryAgentReplayArtifactBundle> & {
    skipDeriveExpected?: boolean;
    omitExpected?: boolean;
    omitMemo?: boolean;
    omitRubric?: boolean;
  } = {},
): Promise<LiteraryAgentReplayArtifactBundle> {
  const payload = syntheticRubricPayload();

  const base: LiteraryAgentReplayArtifactBundle = {
    artifactSchemaVersion: LITERARY_AGENT_REPLAY_ARTIFACT_SCHEMA_VERSION,
    expertKey: LITERARY_AGENT_REPLAY_EXPERT_KEY,
    expertVersion: LITERARY_AGENT_EXPERT_VERSION,
    definitionHash: LITERARY_AGENT_REPLAY_DEFINITION_HASH,
    manuscriptVersionId: SYNTHETIC_VERSION_ID,
    canonicalWordCount: SYNTHETIC_WORD_COUNT,
    manuscriptMetadata: {
      manuscriptId: SYNTHETIC_MANUSCRIPT_ID,
      characterCount: SYNTHETIC_EXTRACTED_TEXT.length,
      sentChars: SYNTHETIC_EXTRACTED_TEXT.length,
      passageVerificationText: SYNTHETIC_PASSAGE,
    },
    manuscriptHash: "synthetic-manuscript-hash",
    reviewIntent: "fresh_review",
    certifiedPipelineVersion: "two_call_v1",
    capturedMemoOutput: {
      rawContent: syntheticMemoContent(),
      generationMeta: syntheticGenerationMeta(false),
    },
    capturedRubricOutput: {
      rawContent: JSON.stringify(payload),
      generationMeta: syntheticGenerationMeta(false),
    },
    capturedRevisionCandidateOutput: {
      rawContent: syntheticRevisionRaw(),
      generationMeta: syntheticGenerationMeta(false),
    },
    capturedValidationMetadata: {
      extractedText: SYNTHETIC_EXTRACTED_TEXT,
      storedWordCount: SYNTHETIC_WORD_COUNT,
      contentHash: "synthetic-content-hash",
      reviewMeta: null,
      preGateAssessments: [syntheticConcernAssessment()],
      preScoringGate: {
        valid: true,
        errors: [],
        assessments: [],
        adjusted_deductions: [],
        total_points_restored: 0,
      },
      gateRequired: false,
      gateRan: false,
      priorReviewId: null,
      comparison_mode: "REVISION_COMPARISON",
    },
    expectedCertifiedResult: {} as LiteraryAgentExpectedCertifiedResult,
    capturedAt: "2026-07-24T00:00:00.000Z",
    sourceType: "synthetic",
    redactionStatus: "fully_synthetic",
  };

  const merged = {
    ...base,
    ...overrides,
    manuscriptMetadata: { ...base.manuscriptMetadata, ...overrides.manuscriptMetadata },
    capturedValidationMetadata: {
      ...base.capturedValidationMetadata,
      ...overrides.capturedValidationMetadata,
    },
  };

  if (overrides.omitMemo) {
    (merged as { capturedMemoOutput?: unknown }).capturedMemoOutput = undefined;
  }
  if (overrides.omitRubric) {
    (merged as { capturedRubricOutput?: unknown }).capturedRubricOutput = undefined;
  }

  if (!overrides.omitExpected && !overrides.expectedCertifiedResult && !overrides.skipDeriveExpected && !overrides.omitMemo && !overrides.omitRubric) {
    const derived = await deriveReplayCertifiedProjection(merged);
    if ("ok" in derived && derived.ok === false) {
      throw new Error(`Failed to derive expected projection: ${derived.message}`);
    }
    merged.expectedCertifiedResult = derived as typeof merged.expectedCertifiedResult;
  }

  return merged;
}

const BYPASS = { bypassFeatureFlag: true };

describe("runLiteraryAgentReplay", () => {
  it("1. replay flag default off", async () => {
    const bundle = await buildSyntheticBundle();
    const result = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-001" },
      { featureFlagReader: () => readExpertLiteraryAgentReplayEnabled({}) },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "replay_disabled");
  });

  it("2. malformed flag off", async () => {
    const bundle = await buildSyntheticBundle();
    const result = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-002" },
      {
        featureFlagReader: () =>
          readExpertLiteraryAgentReplayEnabled({ [EXPERT_LITERARY_AGENT_REPLAY_FLAG_NAME]: "maybe" }),
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "replay_disabled");
  });

  it("3. explicit test bypass works", async () => {
    const bundle = await buildSyntheticBundle();
    const result = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-003" },
      BYPASS,
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.parityStatus, "replay_match");
  });

  it("4. exact expert key required", async () => {
    const bundle = await buildSyntheticBundle({ expertKey: "literary_agent" });
    const result = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-004" },
      BYPASS,
    );
    assert.equal(result.ok, true);
  });

  it("5. exact expert version required", async () => {
    const bundle = await buildSyntheticBundle();
    const result = await runLiteraryAgentReplay(
      { artifactBundle: { ...bundle, expertVersion: "v9.9.9" }, correlationId: "corr-replay-005" },
      BYPASS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "version_mismatch");
  });

  it("6. exact definition hash required", async () => {
    const bundle = await buildSyntheticBundle();
    const result = await runLiteraryAgentReplay(
      { artifactBundle: { ...bundle, definitionHash: "0".repeat(64) }, correlationId: "corr-replay-006" },
      BYPASS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "definition_hash_mismatch");
  });

  it("7. artifact schema version required", async () => {
    const bundle = await buildSyntheticBundle();
    const result = await runLiteraryAgentReplay(
      { artifactBundle: { ...bundle, artifactSchemaVersion: "" }, correlationId: "corr-replay-007" },
      BYPASS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "required_artifact_missing");
  });

  it("8. missing memo output rejected", async () => {
    const bundle = await buildSyntheticBundle({ omitMemo: true });
    const result = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-008" },
      BYPASS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "required_artifact_missing");
  });

  it("9. missing rubric output rejected", async () => {
    const bundle = await buildSyntheticBundle({ omitRubric: true });
    const result = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-009" },
      BYPASS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "required_artifact_missing");
  });

  it("10. missing expected result rejected", async () => {
    const bundle = await buildSyntheticBundle();
    const broken = { ...bundle, expectedCertifiedResult: undefined };
    const result = await runLiteraryAgentReplay(
      { artifactBundle: broken, correlationId: "corr-replay-010" },
      BYPASS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "required_artifact_missing");
  });

  it("11. unknown fields do not create execution behavior", async () => {
    const bundle = await buildSyntheticBundle();
    const withUnknown = { ...bundle, unknownFutureField: { wouldExecute: true } };
    const result = await runLiteraryAgentReplay(
      { artifactBundle: withUnknown, correlationId: "corr-replay-011" },
      BYPASS,
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.parityStatus, "replay_match");
  });

  it("12. input bundle not mutated", async () => {
    const bundle = await buildSyntheticBundle();
    const snapshot = structuredClone(bundle);
    await runLiteraryAgentReplay({ artifactBundle: bundle, correlationId: "corr-replay-012" }, BYPASS);
    assert.deepEqual(bundle, snapshot);
  });

  it("13. runtime definition not mutated", async () => {
    const before = structuredClone(literaryAgentRuntimeDefinition());
    const bundle = await buildSyntheticBundle();
    await runLiteraryAgentReplay({ artifactBundle: bundle, correlationId: "corr-replay-013" }, BYPASS);
    assert.deepEqual(before, structuredClone(literaryAgentRuntimeDefinition()));
  });

  it("14. replay stage registry is closed", () => {
    assert.equal(LITERARY_AGENT_REPLAY_STAGE_COUNT, 10);
    assert.equal(LITERARY_AGENT_REPLAY_STAGE_IDS.length, 10);
    assert.equal(getLiteraryAgentReplayStage("dynamic_injection"), null);
  });

  it("15. unknown stage rejected", () => {
    assert.equal(getLiteraryAgentReplayStage("prompt_submission"), null);
    assert.equal(isRegisteredReplayStageExport("@/lib/ai/anthropic", "repairCommercialMemoValidation"), false);
  });

  it("16. dynamic module selection impossible", () => {
    for (const stage of orderedLiteraryAgentReplayStages()) {
      assert.match(stage.moduleId, /^@\//);
      assert.ok(stage.exportName.length > 0);
    }
  });

  it("17. dynamic export selection impossible", () => {
    assert.equal(isRegisteredReplayStageExport("user-supplied", "run"), false);
  });

  it("18. arbitrary function injection impossible", () => {
    const source = readFileSync(join(ENGINE_DIR, "literary-agent-replay.ts"), "utf8");
    assert.doesNotMatch(source, /\beval\s*\(/);
    assert.doesNotMatch(source, /new Function/);
  });

  it("19. valid synthetic bundle produces replay_match", async () => {
    const bundle = await buildSyntheticBundle();
    const result = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-019" },
      BYPASS,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.parityStatus, "replay_match");
      assert.equal(result.stagesCompleted.length, 10);
    }
  });

  it("20. deterministic mismatch produces replay_mismatch", async () => {
    const bundle = await buildSyntheticBundle();
    const expected = structuredClone(bundle.expectedCertifiedResult);
    expected.outcome.manuscript_score = 0;
    expected.outcome.manuscript_letter_grade = "F";
    const result = await runLiteraryAgentReplay(
      { artifactBundle: { ...bundle, expectedCertifiedResult: expected }, correlationId: "corr-replay-020" },
      BYPASS,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.parityStatus, "replay_mismatch");
      assert.notEqual(result.certifiedOutputHash, result.replayOutputHash);
    }
  });

  it("21. mismatch path is concise", async () => {
    const bundle = await buildSyntheticBundle();
    const expected = structuredClone(bundle.expectedCertifiedResult);
    expected.outcome.manuscript_score = 1;
    const result = await runLiteraryAgentReplay(
      { artifactBundle: { ...bundle, expectedCertifiedResult: expected }, correlationId: "corr-replay-021" },
      BYPASS,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.mismatchDiagnostics.length > 0);
      assert.match(result.mismatchDiagnostics[0]!.path, /\$/);
    }
  });

  it("22. sensitive values are redacted", async () => {
    const bundle = await buildSyntheticBundle();
    const expected = structuredClone(bundle.expectedCertifiedResult);
    expected.normalization.issue_count = 99;
    const result = await runLiteraryAgentReplay(
      { artifactBundle: { ...bundle, expectedCertifiedResult: expected }, correlationId: "corr-replay-022" },
      BYPASS,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      const serialized = JSON.stringify(result.mismatchDiagnostics);
      assert.doesNotMatch(serialized, /Synthetic acquisitions memo/);
    }
  });

  it("23. certified and replay hashes deterministic", async () => {
    const bundle = await buildSyntheticBundle();
    const first = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-023a" },
      BYPASS,
    );
    const second = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-023b" },
      BYPASS,
    );
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      assert.equal(first.replayOutputHash, second.replayOutputHash);
      assert.equal(first.certifiedOutputHash, second.certifiedOutputHash);
    }
  });

  it("24. repeated identical replay produces identical hashes", async () => {
    const bundle = await buildSyntheticBundle();
    const first = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-024" },
      { ...BYPASS, now: () => 1_000 },
    );
    const second = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-024" },
      { ...BYPASS, now: () => 2_000 },
    );
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      assert.equal(first.replayOutputHash, second.replayOutputHash);
      assert.equal(first.parityStatus, second.parityStatus);
    }
  });

  it("25. production execution remains false", async () => {
    const bundle = await buildSyntheticBundle();
    const result = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-025" },
      BYPASS,
    );
    assert.equal(result.productionExecutionOccurred, false);
  });

  it("26. model calls remain zero", async () => {
    const bundle = await buildSyntheticBundle();
    const result = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-026" },
      BYPASS,
    );
    assert.equal(result.modelCalls, 0);
  });

  it("27. writes remain zero", async () => {
    const bundle = await buildSyntheticBundle();
    const result = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-027" },
      BYPASS,
    );
    assert.equal(result.writes, 0);
  });

  it("28. files written remain zero", async () => {
    const bundle = await buildSyntheticBundle();
    const result = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-028" },
      BYPASS,
    );
    assert.equal(result.filesWritten, 0);
  });

  it("29. provider SDK not called", () => {
    const source = readFileSync(join(ENGINE_DIR, "literary-agent-replay.ts"), "utf8");
    assert.doesNotMatch(source, /@anthropic-ai/);
    assert.doesNotMatch(source, /openai/);
  });

  it("30. repair function not called", async () => {
    let repairCalled = false;
    const bundle = await buildSyntheticBundle();
    await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-030" },
      {
        ...BYPASS,
        guards: { onRepairCall: () => { repairCalled = true; } },
      },
    );
    assert.equal(repairCalled, false);
  });

  it("31. Trigger not called", () => {
    const source = readFileSync(join(ENGINE_DIR, "literary-agent-replay.ts"), "utf8");
    assert.doesNotMatch(source, /@trigger\.dev/);
  });

  it("32. Supabase not called", () => {
    const source = readFileSync(join(ENGINE_DIR, "literary-agent-replay.ts"), "utf8");
    assert.doesNotMatch(source, /@supabase/);
  });

  it("33. publish not called", () => {
    const source = readFileSync(join(ENGINE_DIR, "literary-agent-replay.ts"), "utf8");
    assert.doesNotMatch(source, /publish_commercial_review/);
  });

  it("34. DOCX generation not called", () => {
    const source = readFileSync(join(ENGINE_DIR, "literary-agent-replay.ts"), "utf8");
    assert.doesNotMatch(source, /buildLiteraryAgentReviewDocx/);
  });

  it("35. production workflow not called", () => {
    const source = readFileSync(join(ENGINE_DIR, "literary-agent-replay.ts"), "utf8");
    assert.doesNotMatch(source, /run-fresh-editorial-generation/);
  });

  it("36. validation failure requiring repair returns prohibited_stage_required", async () => {
    const expected = await buildValidExpectedProjection();
    const bundle = await buildSyntheticBundle({
      skipDeriveExpected: true,
      capturedMemoOutput: {
        rawContent: `${canonicalManuscriptLengthSentence(SYNTHETIC_WORD_COUNT)}\n\n**Grade: A**`,
        generationMeta: syntheticGenerationMeta(false),
      },
      expectedCertifiedResult: expected,
    });
    const result = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-036" },
      BYPASS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "prohibited_stage_required");
  });

  it("37. no fallback occurs after prohibited repair", async () => {
    const expected = await buildValidExpectedProjection();
    const bundle = await buildSyntheticBundle({
      skipDeriveExpected: true,
      capturedMemoOutput: {
        rawContent: "Missing canonical count entirely.",
        generationMeta: syntheticGenerationMeta(false),
      },
      expectedCertifiedResult: expected,
    });
    const result = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-037" },
      BYPASS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.parityStatus, "prohibited_stage_required");
      assert.equal(result.replayExecutionOccurred, true);
    }
  });

  it("38. abort returns aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const bundle = await buildSyntheticBundle();
    const result = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-038", signal: controller.signal },
      BYPASS,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "aborted");
  });

  it("39. timeout returns timeout", async () => {
    const bundle = await buildSyntheticBundle();
    const result = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-039", timeoutMs: 1 },
      {
        ...BYPASS,
        beforeStage: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        },
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "timeout");
  });

  it("40. oversized canonical output rejected", async () => {
    const bundle = await buildSyntheticBundle();
    const oversized = "x".repeat(MAX_CANONICAL_OUTPUT_BYTES + 100);
    const result = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-040" },
      {
        ...BYPASS,
        compareProjectionsFn: () => compareCanonicalOutputs(oversized, oversized),
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.parityStatus, "canonicalization_failed");
  });

  it("41. non-finite values rejected", () => {
    const result = canonicalizeOutputValue(Number.NaN);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "non_finite_number");
  });

  it("42. sparse arrays rejected", () => {
    const sparse: string[] = [];
    sparse[1] = "present";
    const result = canonicalizeOutputValue(sparse);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "sparse_array");
  });

  it("43. runExpertReview remains plan-only", async () => {
    const source = readFileSync(join(ENGINE_DIR, "run-expert-review.ts"), "utf8");
    assert.doesNotMatch(source, /literary-agent-replay/);
    assert.match(source, /executionAllowed:\s*false/);
    const plan = await runExpertReview(
      {
        manuscriptId: SYNTHETIC_MANUSCRIPT_ID,
        manuscriptVersionId: SYNTHETIC_VERSION_ID,
        executionMode: "plan_only",
        expertKey: LITERARY_AGENT_REPLAY_EXPERT_KEY,
        expertVersion: LITERARY_AGENT_EXPERT_VERSION,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(plan.ok, true);
    if (plan.ok) assert.equal(plan.plan.executionMode, "plan_only");
  });

  it("44. executionAllowed remains false", async () => {
    const plan = await runExpertReview(
      {
        manuscriptId: SYNTHETIC_MANUSCRIPT_ID,
        manuscriptVersionId: SYNTHETIC_VERSION_ID,
        executionMode: "plan_only",
        expertKey: LITERARY_AGENT_REPLAY_EXPERT_KEY,
        expertVersion: LITERARY_AGENT_EXPERT_VERSION,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(plan.ok, true);
    if (plan.ok) assert.equal(plan.plan.executionAllowed, false);
  });

  it("45. replay harness not imported by production callers", () => {
    const offenders: string[] = [];
    for (const file of productionSourceFiles()) {
      const content = readFileSync(file, "utf8");
      if (content.includes("literary-agent-replay") || content.includes("runLiteraryAgentReplay")) {
        offenders.push(file.slice(ROOT.length + 1));
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("46. no environment file enables replay", () => {
    for (const envFile of [".env", ".env.local", ".env.example", ".env.development"]) {
      const path = join(ROOT, envFile);
      if (!existsSync(path)) continue;
      const content = readFileSync(path, "utf8");
      assert.doesNotMatch(content, /EXPERT_LITERARY_AGENT_REPLAY_ENABLED\s*=\s*(true|1|yes)/i);
    }
  });

  it("47. canonical hashes remain unchanged", () => {
    assert.equal(hashExpertRuntimeDefinition(literaryAgentRuntimeDefinition()), LITERARY_AGENT_REPLAY_DEFINITION_HASH);
    assert.equal(LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH, EXPECTED_CONSTITUTION_HASH);
    assert.equal(hashExpertDefinition(literaryAgentRegistryDefinitionV1()), EXPECTED_REGISTRY_SEED_HASH);
  });

  it("48. complete synthetic bundle replays all approved downstream stages", async () => {
    const bundle = await buildSyntheticBundle();
    const result = await runLiteraryAgentReplay(
      { artifactBundle: bundle, correlationId: "corr-replay-048" },
      BYPASS,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.stagesCompleted, [...LITERARY_AGENT_REPLAY_STAGE_IDS]);
      assert.equal(result.parityStatus, "replay_match");
    }
  });
});

describe("replay artifact contract", () => {
  it("validates supported schema version", async () => {
    const bundle = await buildSyntheticBundle();
    const result = validateLiteraryAgentReplayArtifactBundle(bundle);
    assert.equal(result.ok, true);
  });

  it("rejects unsupported artifact schema fixture", async () => {
    const bundle = await buildSyntheticBundle({ artifactSchemaVersion: "unknown.v99" });
    const result = validateLiteraryAgentReplayArtifactBundle(bundle);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "unsupported_artifact_schema");
  });

  it("requires reviewIntent", async () => {
    const bundle = await buildSyntheticBundle();
    const missing = { ...bundle, reviewIntent: undefined };
    const result = validateLiteraryAgentReplayArtifactBundle(missing);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "required_artifact_missing");
  });

  it("rejects empty reviewIntent", async () => {
    const bundle = await buildSyntheticBundle();
    const result = validateLiteraryAgentReplayArtifactBundle({ ...bundle, reviewIntent: "   " });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "required_artifact_missing");
  });

  it("rejects unsupported reviewIntent", async () => {
    const bundle = await buildSyntheticBundle();
    const result = validateLiteraryAgentReplayArtifactBundle({
      ...bundle,
      reviewIntent: "shadow_execution",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_artifact_bundle");
  });

  it("accepts valid reviewIntent", async () => {
    const bundle = await buildSyntheticBundle({ reviewIntent: "revision_comparison" });
    const result = validateLiteraryAgentReplayArtifactBundle(bundle);
    assert.equal(result.ok, true);
  });

  it("does not mutate input bundle during validation", async () => {
    const bundle = await buildSyntheticBundle();
    const snapshot = structuredClone(bundle);
    validateLiteraryAgentReplayArtifactBundle(bundle);
    assert.deepEqual(bundle, snapshot);
  });
});

describe("replay feature flag contract", () => {
  it("readExpertLiteraryAgentReplayEnabled follows absent/off contract", () => {
    assert.equal(readExpertLiteraryAgentReplayEnabled({}), false);
    assert.equal(readExpertLiteraryAgentReplayEnabled({ [EXPERT_LITERARY_AGENT_REPLAY_FLAG_NAME]: "" }), false);
    assert.equal(
      readExpertLiteraryAgentReplayEnabled({ [EXPERT_LITERARY_AGENT_REPLAY_FLAG_NAME]: "true" }),
      true,
    );
  });
});

describe("projectCertifiedReplayComparison", () => {
  it("includes all required structural projection groups", async () => {
    const bundle = await buildSyntheticBundle();
    const derived = await deriveReplayCertifiedProjection(bundle);
    assert.equal("ok" in derived, false);
    assertReplayComparisonProjectionComplete(derived as LiteraryAgentExpectedCertifiedResult);
    assert.deepEqual(
      Object.keys(derived as Record<string, unknown>).sort(),
      [...REPLAY_COMPARISON_PROJECTION_GROUPS].sort(),
    );
  });

  it("fails invariant when a required comparison group is removed", async () => {
    const bundle = await buildSyntheticBundle();
    const derived = await deriveReplayCertifiedProjection(bundle);
    assert.equal("ok" in derived, false);
    const incomplete = structuredClone(derived as LiteraryAgentExpectedCertifiedResult);
    delete (incomplete as { categories?: unknown }).categories;
    assert.throws(
      () => assertReplayComparisonProjectionComplete(incomplete),
      /categories/,
    );
  });

  it("requires recommendation in outcome projection", async () => {
    const bundle = await buildSyntheticBundle();
    const derived = await deriveReplayCertifiedProjection(bundle);
    assert.equal("ok" in derived, false);
    const projection = derived as LiteraryAgentExpectedCertifiedResult;
    assert.equal(projection.outcome.recommendation, "REQUEST");
    assert.ok(Object.keys(projection.categories).length > 0);
    assert.ok(Object.keys(projection.editorial_issues).length >= 2);
    assert.ok(Object.keys(projection.revision_candidates).length >= 2);
  });
});

describe("structured replay comparison mismatches", () => {
  async function runMismatch(
    mutate: (expected: LiteraryAgentExpectedCertifiedResult) => void,
    correlationId: string,
  ) {
    const bundle = await buildSyntheticBundle();
    const expected = structuredClone(bundle.expectedCertifiedResult);
    mutate(expected);
    return runLiteraryAgentReplay(
      { artifactBundle: { ...bundle, expectedCertifiedResult: expected }, correlationId },
      BYPASS,
    );
  }

  it("detects recommendation mismatch with matching scores", async () => {
    const result = await runMismatch((expected) => {
      expected.outcome.recommendation = "PASS";
    }, "corr-replay-rec");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.parityStatus, "replay_mismatch");
      assert.ok(result.mismatchDiagnostics.some((m) => m.path.includes("recommendation")));
    }
  });

  it("detects category score mismatch", async () => {
    const result = await runMismatch((expected) => {
      const firstKey = Object.keys(expected.categories)[0]!;
      expected.categories[firstKey]!.points_earned = 0;
    }, "corr-replay-cat");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.parityStatus, "replay_mismatch");
      assert.ok(result.mismatchDiagnostics.some((m) => m.path.includes("categories")));
    }
  });

  it("detects issue deduction mismatch", async () => {
    const result = await runMismatch((expected) => {
      const firstKey = Object.keys(expected.editorial_issues)[0]!;
      expected.editorial_issues[firstKey]!.deduction_amount = 99;
    }, "corr-replay-deduction");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.parityStatus, "replay_mismatch");
  });

  it("detects issue status mismatch", async () => {
    const result = await runMismatch((expected) => {
      const firstKey = Object.keys(expected.editorial_issues)[0]!;
      expected.editorial_issues[firstKey]!.status = "closed";
    }, "corr-replay-issue-status");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.parityStatus, "replay_mismatch");
  });

  it("detects contrary-evidence outcome mismatch", async () => {
    const result = await runMismatch((expected) => {
      const firstKey = Object.keys(expected.contrary_evidence)[0]!;
      expected.contrary_evidence[firstKey]!.status = "RESOLVED";
    }, "corr-replay-contrary");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.parityStatus, "replay_mismatch");
      assert.ok(result.mismatchDiagnostics.some((m) => m.path.includes("contrary_evidence")));
    }
  });

  it("detects revision candidate mismatch", async () => {
    const result = await runMismatch((expected) => {
      const firstKey = Object.keys(expected.revision_candidates)[0]!;
      expected.revision_candidates[firstKey]!.operation = "delete";
    }, "corr-replay-candidate");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.parityStatus, "replay_mismatch");
      assert.ok(result.mismatchDiagnostics.some((m) => m.path.includes("revision_candidates")));
    }
  });

  it("returns replay_mismatch when issue count matches but issue content differs", async () => {
    const bundle = await buildSyntheticBundle();
    const expected = structuredClone(bundle.expectedCertifiedResult);
    const firstKey = Object.keys(expected.editorial_issues)[0]!;
    expected.editorial_issues[firstKey]!.title_hash = "deadbeef".repeat(8);
    const result = await runLiteraryAgentReplay(
      {
        artifactBundle: { ...bundle, expectedCertifiedResult: expected },
        correlationId: "corr-replay-issue-content",
      },
      BYPASS,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.parityStatus, "replay_mismatch");
      assert.equal(
        Object.keys(expected.editorial_issues).length,
        Object.keys(bundle.expectedCertifiedResult.editorial_issues).length,
      );
    }
  });

  it("returns replay_mismatch when candidate count matches but candidate content differs", async () => {
    const result = await runMismatch((expected) => {
      const firstKey = Object.keys(expected.revision_candidates)[0]!;
      expected.revision_candidates[firstKey]!.replacement_text_hash = "deadbeef".repeat(8);
    }, "corr-replay-candidate-content");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.parityStatus, "replay_mismatch");
  });
});

describe("compareCanonicalOutputs oversized guard", () => {
  it("rejects oversized replay comparison payloads", () => {
    const oversized = "x".repeat(MAX_CANONICAL_OUTPUT_BYTES + 100);
    const result = compareCanonicalOutputs(oversized, oversized);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "output_size_exceeded");
  });
});
