/**
 * Literary Agent deterministic engine parity harness (P2-23).
 *
 * Compares P2-20 plan + P2-21 resolve + P2-22 execute against direct certified
 * function invocation for an approved deterministic subset. Not wired to production.
 */

import { buildCanonicalReviewInput } from "@/lib/canonical-review-input.ts";
import {
  LITERARY_AGENT,
  buildReviewPrompt,
  buildRevisionCandidatesPrompt,
  buildSystemPrompt,
} from "@/lib/ai/review-engine.ts";
import type { ParsedIssue } from "@/lib/ai/review-engine.ts";
import type { AuthorIntent } from "@/lib/types.ts";
import type { ReviewStatistics } from "@/lib/review-statistics.ts";
import { normalizeCommercialMemoStatistics } from "@/lib/commercial-review-repair.ts";
import { buildReplacementPayload } from "@/lib/editorial-generation/replacement-payload.ts";
import {
  LITERARY_AGENT_EXPERT_VERSION,
  literaryAgentRuntimeDefinition,
} from "@/experts/literary-agent/runtime-definition.ts";
import { collectAdvertisedModuleRefs } from "./collect-module-refs.ts";
import { compareCanonicalOutputs } from "./canonical-output.ts";
import {
  EXPERT_LITERARY_AGENT_PARITY_FLAG_NAME,
  readExpertLiteraryAgentParityEnabled,
} from "./feature-flags.ts";
import {
  EXPERT_MODULE_IMPORTERS,
  type ExpertModuleImportMapKey,
} from "./module-import-map.ts";
import {
  clearExpertModuleResolverCache,
  resolveExpertModuleReference,
  type ExpertModuleResolverDependencies,
} from "./module-resolver.ts";
import {
  executeResolvedExpertPlugin,
  type ExpertPluginExecutionRequest,
  type ExpertPluginExecutorDependencies,
} from "./plugin-executor.ts";
import {
  lookupAllowedPluginExport,
  type ExpertPluginInvocationKind,
} from "./plugin-invocation-contracts.ts";
import { runExpertReview, type RunExpertReviewDependencies } from "./run-expert-review.ts";

export const LITERARY_AGENT_PARITY_EXPERT_KEY = "literary_agent" as const;
export const LITERARY_AGENT_PARITY_DEFINITION_HASH =
  "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b" as const;

export const APPROVED_PARITY_EXPORTS = [
  {
    moduleId: "@/lib/canonical-review-input",
    exportName: "buildCanonicalReviewInput",
    invocationKind: "validator",
  },
  {
    moduleId: "@/lib/ai/review-engine",
    exportName: "buildSystemPrompt",
    invocationKind: "prompt_builder",
  },
  {
    moduleId: "@/lib/ai/review-engine",
    exportName: "buildReviewPrompt",
    invocationKind: "prompt_builder",
  },
  {
    moduleId: "@/lib/ai/review-engine",
    exportName: "buildRevisionCandidatesPrompt",
    invocationKind: "prompt_builder",
  },
  {
    moduleId: "@/lib/commercial-review-repair",
    exportName: "normalizeCommercialMemoStatistics",
    invocationKind: "normalizer",
  },
  {
    moduleId: "@/lib/editorial-generation/replacement-payload",
    exportName: "buildReplacementPayload",
    invocationKind: "payload_builder",
  },
] as const satisfies readonly {
  moduleId: string;
  exportName: string;
  invocationKind: ExpertPluginInvocationKind;
}[];

export type LiteraryAgentParityStatus =
  | "parity_match"
  | "parity_mismatch"
  | "plan_failed"
  | "resolver_failed"
  | "executor_failed"
  | "aborted"
  | "timeout"
  | "direct_invocation_failed"
  | "canonicalization_failed"
  | "parity_disabled"
  | "invocation_not_approved"
  | "unexpected_parity_failure";

export type LiteraryAgentParityFailureReason =
  | "aborted"
  | "timeout"
  | "invocation_failed"
  | "executor_disabled"
  | "invalid_execution_request"
  | "unresolved_export"
  | "invocation_kind_not_allowed"
  | "export_not_callable"
  | "input_contract_invalid"
  | "unsafe_export_category"
  | "unexpected_executor_failure";

export interface LiteraryAgentParityInvocationRequest {
  moduleId: string;
  exportName: string;
  invocationKind: ExpertPluginInvocationKind;
  args: Readonly<Record<string, unknown>>;
}

export interface LiteraryAgentDeterministicParityInput {
  expertKey: string;
  expertVersion: string;
  definitionHash: string;
  manuscriptId: string;
  manuscriptVersionId: string;
  invocation: LiteraryAgentParityInvocationRequest;
  correlationId: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface LiteraryAgentParityMismatchDiagnostic {
  path: string;
  engineValue: unknown;
  directValue: unknown;
}

export interface LiteraryAgentDeterministicParityResultBase {
  expertKey: string;
  expertVersion: string;
  definitionHash: string;
  /** Exact caller-supplied correlation ID. */
  correlationId: string;
  /** Derived invocation identifier: correlationId:moduleId:exportName */
  invocationId: string;
  moduleId: string;
  exportName: string;
  invocationKind: ExpertPluginInvocationKind;
  engineOutputHash?: string;
  directOutputHash?: string;
  mismatchDiagnostics: readonly LiteraryAgentParityMismatchDiagnostic[];
  executionPlanned: boolean;
  engineExecutionOccurred: boolean;
  productionExecutionOccurred: false;
  modelCalls: 0;
  writes: 0;
  durationMs: number;
}

export interface LiteraryAgentDeterministicParitySuccess
  extends LiteraryAgentDeterministicParityResultBase {
  ok: true;
  parityStatus: "parity_match" | "parity_mismatch";
}

export interface LiteraryAgentDeterministicParityFailure
  extends LiteraryAgentDeterministicParityResultBase {
  ok: false;
  parityStatus: Exclude<
    LiteraryAgentParityStatus,
    "parity_match" | "parity_mismatch"
  >;
  message: string;
  /** Present for executor-related failures when the underlying executor exposes a typed reason. */
  failureReason?: LiteraryAgentParityFailureReason;
}

export type LiteraryAgentDeterministicParityResult =
  | LiteraryAgentDeterministicParitySuccess
  | LiteraryAgentDeterministicParityFailure;

export interface LiteraryAgentParitySideEffectGuards {
  onModelCall?: () => void;
  onTriggerCall?: () => void;
  onSupabaseCall?: () => void;
  onReviewWrite?: () => void;
  onFileWrite?: () => void;
}

export interface LiteraryAgentParityDependencies {
  featureFlagReader?: () => boolean;
  bypassFeatureFlag?: boolean;
  runExpertReviewFn?: typeof runExpertReview;
  resolveModuleFn?: typeof resolveExpertModuleReference;
  executePluginFn?: typeof executeResolvedExpertPlugin;
  directInvokeFn?: (
    moduleId: string,
    exportName: string,
    args: Readonly<Record<string, unknown>>,
  ) => unknown;
  resolverDependencies?: ExpertModuleResolverDependencies;
  executorDependencies?: ExpertPluginExecutorDependencies;
  runExpertReviewDependencies?: RunExpertReviewDependencies;
  guards?: LiteraryAgentParitySideEffectGuards;
  now?: () => number;
}

type ApprovedParityExport = (typeof APPROVED_PARITY_EXPORTS)[number];

type PromptBuilderArgs = {
  def: typeof LITERARY_AGENT;
  intent?: AuthorIntent | null;
  options?: { wordCount?: number | null; statistics?: ReviewStatistics | null };
};

type RevisionCandidatesArgs = PromptBuilderArgs & {
  reviewMemo: string;
};

type ReplacementPayloadArgs = {
  issues: ParsedIssue[];
  manuscriptText: string;
};

/** Synthetic fixtures used by parity tests and approved-subset invariant checks. */
export const PARITY_SYNTHETIC_FIXTURES: Readonly<
  Record<string, Readonly<Record<string, unknown>>>
> = Object.freeze({
  [`@/lib/canonical-review-input::buildCanonicalReviewInput`]: Object.freeze({
    manuscriptVersionId: "msv-parity-synthetic",
    extractedText: Array.from({ length: 50 }, () => "word").join(" "),
    storedWordCount: 50,
    contentHash: "synthetic-content-hash",
  }),
  [`@/lib/ai/review-engine::buildSystemPrompt`]: Object.freeze(
    LITERARY_AGENT as unknown as Record<string, unknown>,
  ),
  [`@/lib/ai/review-engine::buildReviewPrompt`]: Object.freeze({
    def: LITERARY_AGENT,
    intent: null,
    options: { wordCount: 50 },
  }),
  [`@/lib/ai/review-engine::buildRevisionCandidatesPrompt`]: Object.freeze({
    def: LITERARY_AGENT,
    reviewMemo: "Synthetic acquisitions memo for parity testing.",
    intent: null,
    options: { wordCount: 50 },
  }),
  [`@/lib/commercial-review-repair::normalizeCommercialMemoStatistics`]: Object.freeze({
    memoContent: "This manuscript is 50 words long.",
    canonicalWordCount: 50,
  }),
  [`@/lib/editorial-generation/replacement-payload::buildReplacementPayload`]: Object.freeze({
    issues: [
      {
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
      },
    ],
    manuscriptText: [
      "Chapter One",
      "",
      "The morning sun rose over the valley.",
      "",
      "She walked slowly toward the river bank.",
    ].join("\n"),
  }),
});

/** Statically configured direct-invocation branches — one per approved export. */
export const DIRECT_INVOKE_PARITY_KEYS = new Set<string>(
  APPROVED_PARITY_EXPORTS.map((entry) => `${entry.moduleId}::${entry.exportName}`),
);

const approvedParityIndex = new Map<string, ApprovedParityExport>(
  APPROVED_PARITY_EXPORTS.map((entry) => [`${entry.moduleId}::${entry.exportName}`, entry]),
);

function parityKey(moduleId: string, exportName: string): string {
  return `${moduleId}::${exportName}`;
}

function isApprovedParityExport(moduleId: string, exportName: string): ApprovedParityExport | null {
  return approvedParityIndex.get(parityKey(moduleId, exportName)) ?? null;
}

function buildInvocationId(correlationId: string, moduleId: string, exportName: string): string {
  return `${correlationId}:${moduleId}:${exportName}`;
}

function baseResult(
  input: LiteraryAgentDeterministicParityInput,
  invocation: LiteraryAgentParityInvocationRequest,
  durationMs: number,
  partial: Partial<LiteraryAgentDeterministicParityResultBase> = {},
): LiteraryAgentDeterministicParityResultBase {
  return {
    expertKey: input.expertKey,
    expertVersion: input.expertVersion,
    definitionHash: input.definitionHash,
    correlationId: input.correlationId,
    invocationId: buildInvocationId(input.correlationId, invocation.moduleId, invocation.exportName),
    moduleId: invocation.moduleId,
    exportName: invocation.exportName,
    invocationKind: invocation.invocationKind,
    mismatchDiagnostics: [],
    executionPlanned: false,
    engineExecutionOccurred: false,
    productionExecutionOccurred: false,
    modelCalls: 0,
    writes: 0,
    durationMs,
    ...partial,
  };
}

function failureResult(
  input: LiteraryAgentDeterministicParityInput,
  invocation: LiteraryAgentParityInvocationRequest,
  startedAt: number,
  now: () => number,
  parityStatus: LiteraryAgentDeterministicParityFailure["parityStatus"],
  message: string,
  partial: Partial<LiteraryAgentDeterministicParityResultBase> = {},
  failureReason?: LiteraryAgentParityFailureReason,
): LiteraryAgentDeterministicParityFailure {
  return {
    ok: false,
    parityStatus,
    message,
    ...(failureReason ? { failureReason } : {}),
    ...baseResult(input, invocation, Math.max(0, now() - startedAt), partial),
  };
}

function validateSelector(input: LiteraryAgentDeterministicParityInput): string | null {
  if (input.expertKey !== LITERARY_AGENT_PARITY_EXPERT_KEY) {
    return `Unsupported expert_key: ${input.expertKey}`;
  }
  if (input.expertVersion !== LITERARY_AGENT_EXPERT_VERSION) {
    return `Unsupported expert_version: ${input.expertVersion}`;
  }
  if (input.definitionHash.toLowerCase() !== LITERARY_AGENT_PARITY_DEFINITION_HASH) {
    return `Unsupported definition_hash: ${input.definitionHash}`;
  }
  return null;
}

function findAdvertisedRef(moduleId: string, exportName: string) {
  return collectAdvertisedModuleRefs(literaryAgentRuntimeDefinition()).find(
    (ref) => ref.moduleId === moduleId && ref.exportName === exportName,
  );
}

/** Wrap multi-arg certified exports so P2-22 single-object invocation matches production semantics. */
async function loadParityModuleNamespace(
  moduleId: ExpertModuleImportMapKey,
): Promise<Record<string, unknown>> {
  const mod = (await EXPERT_MODULE_IMPORTERS[moduleId]()) as Record<string, unknown>;

  if (moduleId === "@/lib/ai/review-engine") {
    const reviewPrompt = mod.buildReviewPrompt as typeof buildReviewPrompt;
    const revisionCandidatesPrompt = mod.buildRevisionCandidatesPrompt as typeof buildRevisionCandidatesPrompt;
    return {
      ...mod,
      buildReviewPrompt: (args: PromptBuilderArgs) =>
        reviewPrompt(args.def, args.intent ?? null, args.options),
      buildRevisionCandidatesPrompt: (args: RevisionCandidatesArgs) =>
        revisionCandidatesPrompt(args.def, args.reviewMemo, args.intent ?? null, args.options),
    };
  }

  if (moduleId === "@/lib/editorial-generation/replacement-payload") {
    const original = mod.buildReplacementPayload as (
      issues: ParsedIssue[],
      manuscriptText: string,
    ) => unknown;
    return {
      ...mod,
      buildReplacementPayload: (args: ReplacementPayloadArgs) =>
        original(args.issues, args.manuscriptText),
    };
  }

  return mod;
}

function createParityImportMap(): ExpertModuleResolverDependencies["importMap"] {
  const wrappedImporters = {} as Record<
    ExpertModuleImportMapKey,
    () => Promise<Record<string, unknown>>
  >;
  for (const moduleId of Object.keys(EXPERT_MODULE_IMPORTERS) as ExpertModuleImportMapKey[]) {
    wrappedImporters[moduleId] = () => loadParityModuleNamespace(moduleId);
  }
  return wrappedImporters as ExpertModuleResolverDependencies["importMap"];
}

const defaultParityImportMap = createParityImportMap();

function invokeCertifiedDirectly(
  moduleId: string,
  exportName: string,
  args: Readonly<Record<string, unknown>>,
): unknown {
  switch (parityKey(moduleId, exportName)) {
    case parityKey("@/lib/canonical-review-input", "buildCanonicalReviewInput"):
      return buildCanonicalReviewInput(
        structuredClone(args) as unknown as Parameters<typeof buildCanonicalReviewInput>[0],
      );
    case parityKey("@/lib/ai/review-engine", "buildSystemPrompt"):
      return buildSystemPrompt(structuredClone(args) as unknown as typeof LITERARY_AGENT);
    case parityKey("@/lib/ai/review-engine", "buildReviewPrompt"): {
      const promptArgs = structuredClone(args) as PromptBuilderArgs;
      return buildReviewPrompt(promptArgs.def, promptArgs.intent ?? null, promptArgs.options);
    }
    case parityKey("@/lib/ai/review-engine", "buildRevisionCandidatesPrompt"): {
      const candidateArgs = structuredClone(args) as RevisionCandidatesArgs;
      return buildRevisionCandidatesPrompt(
        candidateArgs.def,
        candidateArgs.reviewMemo,
        candidateArgs.intent ?? null,
        candidateArgs.options,
      );
    }
    case parityKey("@/lib/commercial-review-repair", "normalizeCommercialMemoStatistics"):
      return normalizeCommercialMemoStatistics(
        structuredClone(args) as Parameters<typeof normalizeCommercialMemoStatistics>[0],
      );
    case parityKey("@/lib/editorial-generation/replacement-payload", "buildReplacementPayload"):
      return buildReplacementPayload(
        structuredClone(args.issues) as ParsedIssue[],
        String(args.manuscriptText),
      );
    default:
      throw new Error(`Direct invocation not configured for ${moduleId} ${exportName}`);
  }
}

function assertSideEffectGuards(guards: LiteraryAgentParitySideEffectGuards | undefined): void {
  guards?.onModelCall?.();
  guards?.onTriggerCall?.();
  guards?.onSupabaseCall?.();
  guards?.onReviewWrite?.();
  guards?.onFileWrite?.();
}

function freezeArgsClone(args: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return Object.freeze(structuredClone(args));
}

/**
 * Run a single approved Literary Agent deterministic parity comparison.
 *
 * Orchestrates plan-only runExpertReview, module resolution, P2-22 execution,
 * and direct certified invocation without production workflow side effects.
 */
export async function runLiteraryAgentDeterministicParity(
  input: LiteraryAgentDeterministicParityInput,
  dependencies: LiteraryAgentParityDependencies = {},
): Promise<LiteraryAgentDeterministicParityResult> {
  const now = dependencies.now ?? (() => Date.now());
  const startedAt = now();
  const invocation = input.invocation;
  const featureFlagReader =
    dependencies.featureFlagReader ?? readExpertLiteraryAgentParityEnabled;

  assertSideEffectGuards(dependencies.guards);

  if (!dependencies.bypassFeatureFlag && !featureFlagReader()) {
    return failureResult(
      input,
      invocation,
      startedAt,
      now,
      "parity_disabled",
      `Literary Agent parity harness is disabled (${EXPERT_LITERARY_AGENT_PARITY_FLAG_NAME} is off)`,
    );
  }

  const selectorError = validateSelector(input);
  if (selectorError) {
    return failureResult(
      input,
      invocation,
      startedAt,
      now,
      "invocation_not_approved",
      selectorError,
    );
  }

  const approved = isApprovedParityExport(invocation.moduleId, invocation.exportName);
  if (!approved) {
    return failureResult(
      input,
      invocation,
      startedAt,
      now,
      "invocation_not_approved",
      `Export is not in the P2-23 parity subset: ${invocation.moduleId} ${invocation.exportName}`,
    );
  }

  if (approved.invocationKind !== invocation.invocationKind) {
    return failureResult(
      input,
      invocation,
      startedAt,
      now,
      "invocation_not_approved",
      `Invocation kind mismatch for ${invocation.exportName}`,
    );
  }

  const allowlistEntry = lookupAllowedPluginExport(invocation.moduleId, invocation.exportName);
  if (!allowlistEntry) {
    return failureResult(
      input,
      invocation,
      startedAt,
      now,
      "invocation_not_approved",
      `Export is not on the P2-22 invocation allowlist: ${invocation.moduleId} ${invocation.exportName}`,
    );
  }

  const argsSnapshot = structuredClone(input.invocation.args);
  const runtimeSnapshot = structuredClone(literaryAgentRuntimeDefinition());

  const runExpertReviewFn = dependencies.runExpertReviewFn ?? runExpertReview;
  const planResult = await runExpertReviewFn(
    {
      manuscriptId: input.manuscriptId,
      manuscriptVersionId: input.manuscriptVersionId,
      executionMode: "plan_only",
      expertKey: input.expertKey,
      expertVersion: input.expertVersion,
      definitionHash: input.definitionHash,
      correlationId: input.correlationId,
    },
    {
      bypassFeatureFlag: true,
      ...dependencies.runExpertReviewDependencies,
    },
  );

  if (!planResult.ok) {
    return failureResult(
      input,
      invocation,
      startedAt,
      now,
      "plan_failed",
      planResult.message,
    );
  }

  if (JSON.stringify(input.invocation.args) !== JSON.stringify(argsSnapshot)) {
    return failureResult(
      input,
      invocation,
      startedAt,
      now,
      "unexpected_parity_failure",
      "Input fixture args were mutated during planning",
    );
  }

  if (JSON.stringify(literaryAgentRuntimeDefinition()) !== JSON.stringify(runtimeSnapshot)) {
    return failureResult(
      input,
      invocation,
      startedAt,
      now,
      "unexpected_parity_failure",
      "Literary Agent runtime definition was mutated during parity run",
    );
  }

  const advertised = findAdvertisedRef(invocation.moduleId, invocation.exportName);
  if (!advertised) {
    return failureResult(
      input,
      invocation,
      startedAt,
      now,
      "resolver_failed",
      `No advertised module reference for ${invocation.moduleId} ${invocation.exportName}`,
      { executionPlanned: true },
    );
  }

  clearExpertModuleResolverCache();

  const resolverDeps: ExpertModuleResolverDependencies = {
    bypassFeatureFlag: true,
    importMap: defaultParityImportMap,
    ...dependencies.resolverDependencies,
  };

  const resolveModuleFn = dependencies.resolveModuleFn ?? resolveExpertModuleReference;
  const resolveResult = await resolveModuleFn(
    {
      expertKey: advertised.expertKey,
      fieldPath: advertised.fieldPath,
      logicalId: advertised.logicalId,
      moduleId: advertised.moduleId,
      exportName: advertised.exportName,
      expectedExportKind: advertised.expectedExportKind,
    },
    resolverDeps,
  );

  if (!resolveResult.ok) {
    return failureResult(
      input,
      invocation,
      startedAt,
      now,
      "resolver_failed",
      resolveResult.message,
      { executionPlanned: true },
    );
  }

  const descriptorSnapshot = structuredClone({
    expertKey: resolveResult.descriptor.expertKey,
    fieldPath: resolveResult.descriptor.fieldPath,
    logicalId: resolveResult.descriptor.logicalId,
    moduleId: resolveResult.descriptor.moduleId,
    exportName: resolveResult.descriptor.exportName,
    exportKind: resolveResult.descriptor.exportKind,
  });

  const frozenArgs = freezeArgsClone(invocation.args);
  const executorRequest: ExpertPluginExecutionRequest = {
    descriptor: resolveResult.descriptor,
    invocationKind: invocation.invocationKind,
    input: { args: frozenArgs },
    context: { correlationId: input.correlationId },
    ...(typeof input.timeoutMs === "number" ? { timeoutMs: input.timeoutMs } : {}),
    ...(input.signal instanceof AbortSignal ? { signal: input.signal } : {}),
  };

  const executePluginFn = dependencies.executePluginFn ?? executeResolvedExpertPlugin;
  const engineResult = await executePluginFn(executorRequest, {
    bypassFeatureFlag: true,
    now,
    ...dependencies.executorDependencies,
  });

  if (
    JSON.stringify({
      expertKey: resolveResult.descriptor.expertKey,
      fieldPath: resolveResult.descriptor.fieldPath,
      logicalId: resolveResult.descriptor.logicalId,
      moduleId: resolveResult.descriptor.moduleId,
      exportName: resolveResult.descriptor.exportName,
      exportKind: resolveResult.descriptor.exportKind,
    }) !== JSON.stringify(descriptorSnapshot)
  ) {
    return failureResult(
      input,
      invocation,
      startedAt,
      now,
      "unexpected_parity_failure",
      "Resolver descriptor was mutated during execution",
      { executionPlanned: true },
    );
  }

  if (!engineResult.ok) {
    const executorCode = engineResult.code;
    const parityStatus =
      executorCode === "aborted"
        ? "aborted"
        : executorCode === "timeout"
          ? "timeout"
          : "executor_failed";
    const failureReason = executorCode as LiteraryAgentParityFailureReason;
    return failureResult(
      input,
      invocation,
      startedAt,
      now,
      parityStatus,
      engineResult.message,
      { executionPlanned: true },
      failureReason,
    );
  }

  const directArgs = freezeArgsClone(invocation.args);
  let directOutput: unknown;
  try {
    const directInvokeFn = dependencies.directInvokeFn ?? invokeCertifiedDirectly;
    directOutput = directInvokeFn(invocation.moduleId, invocation.exportName, directArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failureResult(
      input,
      invocation,
      startedAt,
      now,
      "direct_invocation_failed",
      message,
      {
        executionPlanned: true,
        engineExecutionOccurred: true,
      },
    );
  }

  if (JSON.stringify(directArgs) !== JSON.stringify(frozenArgs)) {
    return failureResult(
      input,
      invocation,
      startedAt,
      now,
      "unexpected_parity_failure",
      "Direct invocation input args were mutated",
      {
        executionPlanned: true,
        engineExecutionOccurred: true,
      },
    );
  }

  const comparison = compareCanonicalOutputs(engineResult.output, directOutput);
  if (!comparison.ok) {
    return failureResult(
      input,
      invocation,
      startedAt,
      now,
      "canonicalization_failed",
      `Canonicalization failed on ${comparison.side} output at ${comparison.error.path}: ${comparison.error.code}`,
      {
        executionPlanned: true,
        engineExecutionOccurred: true,
      },
    );
  }

  return {
    ok: true,
    parityStatus: comparison.match ? "parity_match" : "parity_mismatch",
    expertKey: input.expertKey,
    expertVersion: input.expertVersion,
    definitionHash: input.definitionHash,
    correlationId: input.correlationId,
    invocationId: buildInvocationId(input.correlationId, invocation.moduleId, invocation.exportName),
    moduleId: invocation.moduleId,
    exportName: invocation.exportName,
    invocationKind: invocation.invocationKind,
    engineOutputHash: comparison.engineHash,
    directOutputHash: comparison.directHash,
    mismatchDiagnostics: comparison.mismatches,
    executionPlanned: true,
    engineExecutionOccurred: true,
    productionExecutionOccurred: false,
    modelCalls: 0,
    writes: 0,
    durationMs: Math.max(0, now() - startedAt),
  };
}

export {
  EXPERT_LITERARY_AGENT_PARITY_FLAG_NAME,
  readExpertLiteraryAgentParityEnabled,
} from "./feature-flags.ts";
