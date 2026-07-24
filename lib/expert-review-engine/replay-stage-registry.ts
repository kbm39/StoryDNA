/**
 * Closed Literary Agent replay stage registry (P2-24).
 *
 * No dynamic module IDs, export names, or arbitrary functions.
 */

export const LITERARY_AGENT_REPLAY_STAGE_IDS = [
  "canonical_manuscript_metadata_verification",
  "memo_truncation_gate",
  "pre_rubric_validation",
  "rubric_parse",
  "post_scoring_validation",
  "memo_statistics_normalization",
  "combined_review_validation",
  "revision_payload",
  "final_payload",
  "canonical_result_comparison",
] as const;

export type LiteraryAgentReplayStageId = (typeof LITERARY_AGENT_REPLAY_STAGE_IDS)[number];

export type LiteraryAgentReplayStageCategory =
  | "canonical_input"
  | "validation"
  | "parsing"
  | "normalization"
  | "scoring"
  | "payload_construction"
  | "comparison";

export interface LiteraryAgentReplayStageDefinition {
  stageId: LiteraryAgentReplayStageId;
  order: number;
  moduleId: string;
  exportName: string;
  category: LiteraryAgentReplayStageCategory;
  /** Whether P2-22 plugin execution may be used for this stage (optional path). */
  p22ExecutionAllowed: boolean;
  /** Whether direct certified invocation is the primary replay path. */
  directCertifiedComparisonAvailable: boolean;
  prohibitedSideEffects: readonly (
    | "model_call"
    | "repair_model_call"
    | "supabase_write"
    | "publish"
    | "file_write"
    | "trigger"
    | "production_workflow"
  )[];
  dependsOn: readonly LiteraryAgentReplayStageId[];
}

export const LITERARY_AGENT_REPLAY_STAGE_REGISTRY: readonly LiteraryAgentReplayStageDefinition[] =
  Object.freeze([
    {
      stageId: "canonical_manuscript_metadata_verification",
      order: 1,
      moduleId: "@/lib/canonical-review-input",
      exportName: "buildCanonicalReviewInput",
      category: "canonical_input",
      p22ExecutionAllowed: true,
      directCertifiedComparisonAvailable: true,
      prohibitedSideEffects: [
        "model_call",
        "repair_model_call",
        "supabase_write",
        "publish",
        "file_write",
        "trigger",
        "production_workflow",
      ],
      dependsOn: [],
    },
    {
      stageId: "memo_truncation_gate",
      order: 2,
      moduleId: "@/lib/commercial-review-generation",
      exportName: "evaluateCallAGeneration",
      category: "validation",
      p22ExecutionAllowed: false,
      directCertifiedComparisonAvailable: true,
      prohibitedSideEffects: [
        "model_call",
        "repair_model_call",
        "supabase_write",
        "publish",
        "file_write",
        "trigger",
        "production_workflow",
      ],
      dependsOn: ["canonical_manuscript_metadata_verification"],
    },
    {
      stageId: "pre_rubric_validation",
      order: 3,
      moduleId: "@/lib/commercial-review-generation",
      exportName: "validateMemoBeforeRubric",
      category: "validation",
      p22ExecutionAllowed: true,
      directCertifiedComparisonAvailable: true,
      prohibitedSideEffects: [
        "model_call",
        "repair_model_call",
        "supabase_write",
        "publish",
        "file_write",
        "trigger",
        "production_workflow",
      ],
      dependsOn: ["memo_truncation_gate"],
    },
    {
      stageId: "rubric_parse",
      order: 4,
      moduleId: "@/lib/commercial-review-generation",
      exportName: "assessRubricGenerationResult",
      category: "parsing",
      p22ExecutionAllowed: false,
      directCertifiedComparisonAvailable: true,
      prohibitedSideEffects: [
        "model_call",
        "repair_model_call",
        "supabase_write",
        "publish",
        "file_write",
        "trigger",
        "production_workflow",
      ],
      dependsOn: ["pre_rubric_validation"],
    },
    {
      stageId: "post_scoring_validation",
      order: 5,
      moduleId: "@/lib/contrary-evidence/post-scoring-validation",
      exportName: "validatePostScoringRubric",
      category: "scoring",
      p22ExecutionAllowed: true,
      directCertifiedComparisonAvailable: true,
      prohibitedSideEffects: [
        "model_call",
        "repair_model_call",
        "supabase_write",
        "publish",
        "file_write",
        "trigger",
        "production_workflow",
      ],
      dependsOn: ["rubric_parse"],
    },
    {
      stageId: "memo_statistics_normalization",
      order: 6,
      moduleId: "@/lib/commercial-review-repair",
      exportName: "normalizeCommercialMemoStatistics",
      category: "normalization",
      p22ExecutionAllowed: true,
      directCertifiedComparisonAvailable: true,
      prohibitedSideEffects: [
        "model_call",
        "repair_model_call",
        "supabase_write",
        "publish",
        "file_write",
        "trigger",
        "production_workflow",
      ],
      dependsOn: ["post_scoring_validation"],
    },
    {
      stageId: "combined_review_validation",
      order: 7,
      moduleId: "@/lib/commercial-review-generation",
      exportName: "validateCombinedCommercialReview",
      category: "validation",
      p22ExecutionAllowed: true,
      directCertifiedComparisonAvailable: true,
      prohibitedSideEffects: [
        "model_call",
        "repair_model_call",
        "supabase_write",
        "publish",
        "file_write",
        "trigger",
        "production_workflow",
      ],
      dependsOn: ["memo_statistics_normalization"],
    },
    {
      stageId: "revision_payload",
      order: 8,
      moduleId: "@/lib/editorial-generation/replacement-payload",
      exportName: "buildReplacementPayload",
      category: "payload_construction",
      p22ExecutionAllowed: true,
      directCertifiedComparisonAvailable: true,
      prohibitedSideEffects: [
        "model_call",
        "repair_model_call",
        "supabase_write",
        "publish",
        "file_write",
        "trigger",
        "production_workflow",
      ],
      dependsOn: ["combined_review_validation"],
    },
    {
      stageId: "final_payload",
      order: 9,
      moduleId: "@/lib/commercial-review-pipeline",
      exportName: "buildReviewGradingRecord",
      category: "payload_construction",
      p22ExecutionAllowed: false,
      directCertifiedComparisonAvailable: true,
      prohibitedSideEffects: [
        "model_call",
        "repair_model_call",
        "supabase_write",
        "publish",
        "file_write",
        "trigger",
        "production_workflow",
      ],
      dependsOn: ["revision_payload"],
    },
    {
      stageId: "canonical_result_comparison",
      order: 10,
      moduleId: "@/lib/expert-review-engine/canonical-output",
      exportName: "compareCanonicalOutputs",
      category: "comparison",
      p22ExecutionAllowed: false,
      directCertifiedComparisonAvailable: true,
      prohibitedSideEffects: [
        "model_call",
        "repair_model_call",
        "supabase_write",
        "publish",
        "file_write",
        "trigger",
        "production_workflow",
      ],
      dependsOn: ["final_payload"],
    },
  ]);

const stageIndex = new Map<string, LiteraryAgentReplayStageDefinition>(
  LITERARY_AGENT_REPLAY_STAGE_REGISTRY.map((stage) => [stage.stageId, stage]),
);

const moduleExportIndex = new Map<string, LiteraryAgentReplayStageDefinition>(
  LITERARY_AGENT_REPLAY_STAGE_REGISTRY.map((stage) => [
    `${stage.moduleId}::${stage.exportName}`,
    stage,
  ]),
);

/** Resolve a registered replay stage by ID. Returns null for unknown IDs. */
export function getLiteraryAgentReplayStage(
  stageId: string,
): LiteraryAgentReplayStageDefinition | null {
  return stageIndex.get(stageId) ?? null;
}

/** True when moduleId+exportName matches a registered replay stage. */
export function isRegisteredReplayStageExport(moduleId: string, exportName: string): boolean {
  return moduleExportIndex.has(`${moduleId}::${exportName}`);
}

/** Fail closed when stageId is not in the closed registry. */
export function assertRegisteredReplayStageId(
  stageId: string,
): LiteraryAgentReplayStageDefinition | null {
  return getLiteraryAgentReplayStage(stageId);
}

/** Registry in deterministic execution order. */
export function orderedLiteraryAgentReplayStages(): readonly LiteraryAgentReplayStageDefinition[] {
  return LITERARY_AGENT_REPLAY_STAGE_REGISTRY;
}

/** Closed registry size — used by tests to prove no dynamic expansion. */
export const LITERARY_AGENT_REPLAY_STAGE_COUNT = LITERARY_AGENT_REPLAY_STAGE_REGISTRY.length;
