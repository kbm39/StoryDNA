import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { executeExpert } from "@/lib/execute-expert/execute.ts";
import {
  getLiveProviderInvocationCount,
  resetLiveProviderInvocationCountForTests,
} from "@/lib/execute-expert/dry-run-guard.ts";
import { createCanonStore } from "@/lib/canon/memory.ts";
import { WorkflowCancelledError } from "@/lib/editorial-workflow/types.ts";
import {
  FIXTURE_01_WITHIN_BOOK_EXACT,
  FIXTURE_13_CLEAN_CONTROL,
  FIXTURE_14_CANON_PROMOTION,
  FIXTURE_15_MISSING_CONFLICT_EVIDENCE,
  FIXTURE_CONTENT_HASH,
  FIXTURE_MANUSCRIPT_ID,
  FIXTURE_MANUSCRIPT_VERSION_ID,
  FIXTURE_MANUSCRIPT_WITHIN_BOOK,
} from "./fixtures.ts";
import type { ArchivistFinding, ArchivistReview } from "./contracts.ts";
import {
  ARCHIVIST_LIVE_MODEL_CERTIFIED,
  archivistLiveGateSnapshot,
  persistAcceptedBibleRevisionFromLive,
  persistAcceptedCanonFromLive,
  persistAuthorDispositionFromLive,
} from "./live-flags.ts";
import {
  createAnthropicArchivistLiveProvider,
  createDisabledArchivistLiveProvider,
  createMockArchivistLiveProvider,
  resolveArchivistLiveModel,
  resolveArchivistLiveProviderName,
} from "./live-provider.ts";
import { runArchivistLiveExecution } from "./live-execute.ts";
import { LIVE_ARCHIVIST_PIPELINE_PHASES } from "./live-types.ts";
import type { LiveArchivistExecutionOptions, LiveArchivistRequest } from "./live-types.ts";
import { ARCHIVIST_CONSTITUTION } from "./constitution.ts";
import { archivistRuntimeDefinition } from "./runtime-definition.ts";
import { archivistRegistryDefinitionV1 } from "./registry-definition.ts";
import { HOLD_FAST_PILOT_PLAN, HOLD_FAST_PILOT_SEQUENCE } from "./hold-fast-pilot.ts";
import { reconcileArchivistOrphanedWorkflowState } from "./live-orphan.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const EXPERT_VERSION_ID = "883407ad-4afe-4f3c-a69b-eaa3234fc9c6";

function liveRequest(overrides: Partial<LiveArchivistRequest> = {}): LiveArchivistRequest {
  return {
    expert_key: "archivist",
    expert_version_id: EXPERT_VERSION_ID,
    manuscript_id: FIXTURE_MANUSCRIPT_ID,
    manuscript_version_id: FIXTURE_MANUSCRIPT_VERSION_ID,
    content_hash: FIXTURE_CONTENT_HASH,
    mode: "live",
    manuscript_text: FIXTURE_MANUSCRIPT_WITHIN_BOOK,
    ...overrides,
  };
}

function mockReturning(review: ArchivistReview | string) {
  return createMockArchivistLiveProvider({
    complete: async ({ role }) => ({
      content: typeof review === "string" ? review : JSON.stringify(review),
      usage: {
        inputTokens: role === "archivist_review_repair" ? 30 : 80,
        outputTokens: role === "archivist_review_repair" ? 12 : 40,
        cachedTokens: 2,
        cacheCreationTokens: 1,
      },
    }),
  });
}

async function runLive(args: {
  review?: ArchivistReview | string;
  request?: Partial<LiveArchivistRequest>;
  provider?: ReturnType<typeof createMockArchivistLiveProvider>;
  shouldCancel?: () => Promise<boolean>;
  abortSignal?: AbortSignal;
  findActiveWorkflow?: LiveArchivistExecutionOptions["findActiveWorkflow"];
  pinned?: {
    manuscript_id: string;
    manuscript_version_id: string;
    content_hash: string;
  };
  canonicalContext?: ReturnType<typeof createCanonStore>;
  heartbeatIntervalMs?: number;
  onExecutionHeartbeat?: () => Promise<void>;
  allowRepair?: boolean;
  series_order?: number;
}) {
  return runArchivistLiveExecution({
    request: liveRequest({
      ...args.request,
      series_order: args.series_order ?? args.request?.series_order,
    }),
    options: {
      expertKey: "archivist",
      manuscriptId: FIXTURE_MANUSCRIPT_ID,
      manuscriptVersionId: FIXTURE_MANUSCRIPT_VERSION_ID,
      contentHash: FIXTURE_CONTENT_HASH,
      executionMode: "live",
      allowUnwiredForTests: true,
      provider: args.provider ?? mockReturning(args.review ?? FIXTURE_01_WITHIN_BOOK_EXACT.review),
      shouldCancel: args.shouldCancel,
      abortSignal: args.abortSignal,
      findActiveWorkflow: args.findActiveWorkflow,
      pinned: args.pinned,
      canonicalContext: args.canonicalContext,
      heartbeatIntervalMs: args.heartbeatIntervalMs,
      onExecutionHeartbeat: args.onExecutionHeartbeat,
      allowRepair: args.allowRepair,
    },
  });
}

describe("Archivist live execution path — disabled, mock-certified", () => {
  it("keeps execution gates closed and the public executeExpert live path fail-closed", async () => {
    const gates = archivistLiveGateSnapshot();
    assert.equal(gates.execution_wired, false);
    assert.equal(gates.runtime_enabled, false);
    assert.equal(gates.studio_selectable, false);
    assert.equal(gates.live_model_certified, true);
    assert.equal(ARCHIVIST_LIVE_MODEL_CERTIFIED, true);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
    assert.equal(archivistRegistryDefinitionV1().registry_metadata?.execution_wired, false);

    const publicLive = await executeExpert({
      expert_key: "archivist",
      expert_version_id: EXPERT_VERSION_ID,
      manuscript_id: FIXTURE_MANUSCRIPT_ID,
      manuscript_version_id: FIXTURE_MANUSCRIPT_VERSION_ID,
      content_hash: FIXTURE_CONTENT_HASH,
      mode: "live",
    });
    assert.equal(publicLive.ok, false);
    assert.equal(publicLive.error_code, "archivist_live_disabled");
    assert.equal(publicLive.published, false);
  });

  it("refuses paid Anthropic construction from the default factory and disabled adapter", async () => {
    resetLiveProviderInvocationCountForTests();
    const disabled = createDisabledArchivistLiveProvider();
    await assert.rejects(() => disabled.complete({ role: "archivist_review", system: "s", user: "u" }));
    const anthropic = createAnthropicArchivistLiveProvider();
    await assert.rejects(
      () => anthropic.complete({ role: "archivist_review", system: "s", user: "u" }),
    );
    assert.equal(getLiveProviderInvocationCount(), 0);
    assert.equal(resolveArchivistLiveProviderName(), "anthropic");
    assert.ok(resolveArchivistLiveModel());
  });

  it("walks the live pipeline with a mock provider, heartbeats, and candidate-only output", async () => {
    resetLiveProviderInvocationCountForTests();
    const phases: string[] = [];
    let heartbeats = 0;
    const result = await runArchivistLiveExecution({
      request: liveRequest(),
      options: {
        expertKey: "archivist",
        manuscriptId: FIXTURE_MANUSCRIPT_ID,
        manuscriptVersionId: FIXTURE_MANUSCRIPT_VERSION_ID,
        contentHash: FIXTURE_CONTENT_HASH,
        executionMode: "live",
        allowUnwiredForTests: true,
        provider: mockReturning(FIXTURE_01_WITHIN_BOOK_EXACT.review),
        onPhase: (phase) => {
          phases.push(phase);
        },
        onExecutionHeartbeat: async () => {
          heartbeats += 1;
        },
      },
    });
    assert.equal(result.ok, true, result.diagnostics?.join("; "));
    assert.equal(result.published, false);
    assert.deepEqual([...result.live_phases], [...LIVE_ARCHIVIST_PIPELINE_PHASES]);
    assert.deepEqual(phases, [...LIVE_ARCHIVIST_PIPELINE_PHASES]);
    assert.ok(heartbeats >= LIVE_ARCHIVIST_PIPELINE_PHASES.length);
    assert.equal(getLiveProviderInvocationCount(), 1);
    assert.equal(result.cost.call_count, 1);
    assert.equal(result.cost.provider, "anthropic");
    assert.ok(result.cost.total_cost_usd > 0);
    assert.equal(result.cost.token_counts, "exact");
    assert.equal(result.cost_calls[0]?.role, "archivist_review");
    assert.equal(result.cost_calls[0]?.token_status, "exact");
    assert.equal(result.cost_calls[0]?.cachedTokens, 2);
    assert.equal(result.cost_calls[0]?.cacheCreationTokens, 1);
    assert.ok((result.candidate_canon_delta as { status: string }[]).every((delta) => delta.status === "candidate"));
    assert.equal(result.canon_writes.accepted_facts, 0);
    assert.equal(result.canon_writes.persisted, false);
    assert.throws(persistAcceptedCanonFromLive);
    assert.throws(persistAcceptedBibleRevisionFromLive);
    assert.throws(persistAuthorDispositionFromLive);
  });

  it("records provider usage before parse failure and does not drop the call", async () => {
    resetLiveProviderInvocationCountForTests();
    const result = await runLive({
      review: "{not-json",
      allowRepair: false,
    });
    assert.equal(result.ok, false);
    assert.equal(result.published, false);
    assert.equal(result.error_code, "parse_failed");
    assert.equal(result.cost.call_count, 1);
    assert.equal(result.cost_calls[0]?.status, "parse_failed");
    assert.equal(result.cost.input_tokens, 80);
    assert.equal(getLiveProviderInvocationCount(), 1);
  });

  it("allows at most one representation-only repair and records repair cost separately", async () => {
    resetLiveProviderInvocationCountForTests();
    const roles: string[] = [];
    const provider = createMockArchivistLiveProvider({
      complete: async ({ role }) => {
        roles.push(role);
        if (role === "archivist_review") {
          return {
            content: "not-json",
            usage: { inputTokens: 11, outputTokens: 5, cachedTokens: 0, cacheCreationTokens: 0 },
          };
        }
        return {
          content: JSON.stringify(FIXTURE_13_CLEAN_CONTROL.review),
          usage: { inputTokens: 9, outputTokens: 4, cachedTokens: 1, cacheCreationTokens: 0 },
        };
      },
    });
    const result = await runLive({ provider });
    assert.equal(result.ok, true, result.diagnostics?.join("; "));
    assert.deepEqual(roles, ["archivist_review", "archivist_review_repair"]);
    assert.equal(result.repair_invoked, true);
    assert.equal(result.repair_call_count, 1);
    assert.equal(result.cost.call_count, 2);
    assert.equal(result.cost_calls[0]?.role, "archivist_review");
    assert.equal(result.cost_calls[1]?.role, "archivist_review_repair");
    assert.ok((result.cost_calls[1]?.costUsd ?? 0) > 0);
    assert.equal(result.cost.input_tokens, 20);
    assert.equal(getLiveProviderInvocationCount(), 2);
  });

  it("fail-closes after a second malformed output without a third provider call", async () => {
    const roles: string[] = [];
    const provider = createMockArchivistLiveProvider({
      complete: async ({ role }) => {
        roles.push(role);
        return {
          content: "still-broken",
          usage: { inputTokens: 7, outputTokens: 3, cachedTokens: 0, cacheCreationTokens: 0 },
        };
      },
    });
    const result = await runLive({ provider });
    assert.equal(result.ok, false);
    assert.equal(result.error_code, "structured_output_invalid");
    assert.equal(result.published, false);
    assert.deepEqual(roles, ["archivist_review", "archivist_review_repair"]);
    assert.equal(result.cost.call_count, 2);
  });

  it("downgrades one-sided confirmed findings instead of inventing evidence", async () => {
    const result = await runLive({
      review: FIXTURE_15_MISSING_CONFLICT_EVIDENCE.review,
      request: { manuscript_text: "" },
    });
    assert.equal(result.ok, true, result.diagnostics?.join("; "));
    const findings = result.findings as ArchivistFinding[];
    assert.equal(findings.filter((finding) => finding.classification === "confirmed_contradiction").length, 0);
    assert.ok(
      findings.some(
        (finding) =>
          finding.classification === "possible_continuity_conflict" ||
          finding.classification === "author_verification_needed",
      ),
    );
  });

  it("fail-closes on accepted canon emissions without writing Series Bible facts", async () => {
    const store = createCanonStore();
    store.facts.push({
      id: "accepted-prior",
      series_id: "series-hold-fast",
      entity_id: "entity-mara",
      fact_type: "appearance",
      fact_value: { eye_color: "blue" },
      temporal_scope: { kind: "at", book_order: 1, chapter: "3" },
      source_manuscript_id: FIXTURE_MANUSCRIPT_ID,
      source_version_id: FIXTURE_MANUSCRIPT_VERSION_ID,
      source_content_hash: FIXTURE_CONTENT_HASH,
      locator: "Chapter 3",
      confidence: "high",
      authority: "series_bible_accepted",
      status: "accepted",
      superseded_by_fact_id: null,
      created_by: "author",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const result = await runLive({
      review: FIXTURE_14_CANON_PROMOTION.review,
      canonicalContext: store,
      request: { manuscript_text: "" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.published, false);
    assert.equal(result.canon_writes.accepted_facts, 0);
    assert.equal(result.canon_writes.accepted_bible_revisions, 0);
    assert.equal(store.facts.filter((fact) => fact.status === "accepted").length, 1);
    assert.equal(store.bible_revisions.length, 0);
  });

  it("loads prior accepted canon read-only for later books and does not auto-accept", async () => {
    const store = createCanonStore();
    store.facts.push({
      id: "book1-age",
      series_id: "series-hold-fast",
      entity_id: "entity-mara",
      fact_type: "age",
      fact_value: { age: 31 },
      temporal_scope: { kind: "at", book_order: 1 },
      source_manuscript_id: "ms-book-1",
      source_version_id: "mv-book-1",
      source_content_hash: FIXTURE_CONTENT_HASH,
      locator: "Chapter 18",
      confidence: "high",
      authority: "prior_volume_canon",
      status: "accepted",
      superseded_by_fact_id: null,
      created_by: "author",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const result = await runLive({
      review: FIXTURE_13_CLEAN_CONTROL.review,
      canonicalContext: store,
      series_order: 2,
      request: {
        series_id: "series-hold-fast",
        prior_authoritative_manuscript_versions: [
          {
            manuscript_id: "ms-book-1",
            manuscript_version_id: "mv-book-1",
            content_hash: FIXTURE_CONTENT_HASH,
          },
        ],
      },
    });
    assert.equal(result.ok, true, result.diagnostics?.join("; "));
    assert.equal(result.series_canon_check_applied, true);
    assert.equal(result.prior_accepted_canon_count, 1);
    assert.equal(store.facts[0]?.status, "accepted");
    assert.equal(result.canon_writes.persisted, false);
  });

  it("cancels before publication and does not publish", async () => {
    const result = await runLive({
      shouldCancel: async () => true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, "cancelled");
    assert.equal(result.published, false);
    assert.equal(result.error_code, "cancelled");
  });

  it("AbortSignal aborts before publication", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await runLive({ abortSignal: controller.signal });
    assert.equal(result.ok, false);
    assert.equal(result.published, false);
    assert.equal(result.status, "cancelled");
    assert.equal(result.error_code, "aborted");
  });

  it("does not publish when cancellation arrives during the provider wait", async () => {
    const provider = createMockArchivistLiveProvider({
      complete: async (_request, { signal }) => {
        await new Promise<void>((_resolve, reject) => {
          const fail = () => {
            reject(new WorkflowCancelledError());
          };
          if (signal.aborted) fail();
          else signal.addEventListener("abort", fail, { once: true });
        });
        return { content: "{}" };
      },
    });
    const controller = new AbortController();
    const pending = runLive({
      provider,
      abortSignal: controller.signal,
      heartbeatIntervalMs: 15,
    });
    setTimeout(() => controller.abort(), 30);
    const result = await pending;
    assert.equal(result.ok, false);
    assert.equal(result.published, false);
    assert.ok(result.error_code === "cancelled" || result.error_code === "aborted");
  });

  it("heartbeats while the mock provider call is in flight", async () => {
    let ticks = 0;
    const provider = createMockArchivistLiveProvider({
      complete: async () => {
        await new Promise((resolve) => setTimeout(resolve, 70));
        return {
          content: JSON.stringify(FIXTURE_13_CLEAN_CONTROL.review),
          usage: { inputTokens: 4, outputTokens: 2, cachedTokens: 0, cacheCreationTokens: 0 },
        };
      },
    });
    const result = await runLive({
      provider,
      heartbeatIntervalMs: 15,
      onExecutionHeartbeat: async () => {
        ticks += 1;
      },
    });
    assert.equal(result.ok, true, result.diagnostics?.join("; "));
    assert.ok(ticks >= 3, `expected keep-alive heartbeats, got ${ticks}`);
  });

  it("pins manuscript version and content hash", async () => {
    const result = await runLive({
      pinned: {
        manuscript_id: FIXTURE_MANUSCRIPT_ID,
        manuscript_version_id: FIXTURE_MANUSCRIPT_VERSION_ID,
        content_hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error_code, "version_pin_mismatch");
    assert.equal(result.published, false);
  });

  it("blocks a duplicate active Archivist workflow", async () => {
    const result = await runLive({
      findActiveWorkflow: () => ({
        workflow_id: "wf-live-active",
        expert_key: "archivist",
        manuscript_id: FIXTURE_MANUSCRIPT_ID,
        manuscript_version_id: FIXTURE_MANUSCRIPT_VERSION_ID,
        status: "running",
      }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.error_code, "duplicate_active_workflow");
    assert.equal(result.published, false);
  });

  it("dry-run remains $0 and provider-free after the live path exists", async () => {
    resetLiveProviderInvocationCountForTests();
    const result = await executeExpert({
      expert_key: "archivist",
      expert_version_id: EXPERT_VERSION_ID,
      manuscript_id: FIXTURE_MANUSCRIPT_ID,
      manuscript_version_id: FIXTURE_MANUSCRIPT_VERSION_ID,
      content_hash: FIXTURE_CONTENT_HASH,
      mode: "dry_run",
    });
    assert.equal(result.ok, true);
    assert.equal(result.cost.total_cost_usd, 0);
    assert.equal(result.cost.call_count, 0);
    assert.equal(result.provenance.provider, "none");
    assert.equal(getLiveProviderInvocationCount(), 0);
  });

  it("does not change the approved dry-run UI or expose live mode there", () => {
    const panel = readFileSync(join(ROOT, "app/manuscripts/[id]/ArchivistDryRunPanel.tsx"), "utf8");
    const action = readFileSync(join(ROOT, "app/actions/archivist-dry-run.ts"), "utf8");
    const execute = readFileSync(join(ROOT, "lib/execute-expert/execute.ts"), "utf8");
    assert.match(action, /mode is hard-coded to dry_run/);
    assert.doesNotMatch(panel, /mode:\s*"live"/);
    assert.doesNotMatch(action, /runArchivistLiveExecution/);
    assert.doesNotMatch(execute, /runArchivistLiveExecution/);
    assert.doesNotMatch(execute, /@\/lib\/ai\/anthropic/);
  });

  it("reuses proven provider keep-alive, hooks, and cost-first accounting", () => {
    const providerSrc = readFileSync(join(ROOT, "experts/archivist/live-provider.ts"), "utf8");
    const structuredSrc = readFileSync(join(ROOT, "experts/archivist/live-structured-output.ts"), "utf8");
    const executeSrc = readFileSync(join(ROOT, "experts/archivist/live-execute.ts"), "utf8");
    assert.match(providerSrc, /runWithProviderExecutionKeepAlive/);
    assert.match(providerSrc, /assertProviderCallAllowed/);
    assert.match(providerSrc, /noteLiveProviderInvocation\("live"\)/);
    assert.match(providerSrc, /AbortSignal/);
    assert.match(providerSrc, /shouldCancel/);
    assert.match(structuredSrc, /recordCall\(args\.ledger/);
    assert.match(structuredSrc, /parseArchivistReview/);
    assert.match(executeSrc, /createExpertCostLedger/);
    assert.match(executeSrc, /assertNoDuplicateActiveWorkflow/);
    assert.match(executeSrc, /assertVersionPin/);
  });

  it("reuses orphan reconciliation without inserting Archivist workflow rows", async () => {
    const result = await reconcileArchivistOrphanedWorkflowState({
      workflowId: "missing",
      expectedTriggerRunId: "run_missing",
      getWorkflow: async () => null,
      retrieveRun: async () => ({ id: "run_missing", status: "CRASHED" }),
      markFailed: async () => {
        throw new Error("must not mark failed when workflow is missing");
      },
      markCancelled: async () => {
        throw new Error("must not mark cancelled when workflow is missing");
      },
      safeErrorForCode: (code) => code,
    });
    assert.equal(result.ok, false);
    assert.equal(result.action, "refused_missing");
  });

  it("defines the Hold Fast pilot sequence without running or auto-accepting", () => {
    assert.deepEqual(
      HOLD_FAST_PILOT_SEQUENCE.map((step) => step.id),
      ["A", "B", "C", "D", "E", "F", "G"],
    );
    assert.equal(HOLD_FAST_PILOT_PLAN.author_acceptance_automated, false);
    assert.equal(HOLD_FAST_PILOT_PLAN.run_now, false);
    assert.equal(HOLD_FAST_PILOT_PLAN.upload_or_link_now, false);
    assert.equal(HOLD_FAST_PILOT_PLAN.reckoning_pilot.authorized_to_run, false);
    assert.equal(HOLD_FAST_PILOT_PLAN.reckoning_pilot.run_now, false);
    assert.equal(HOLD_FAST_PILOT_PLAN.reckoning_pilot.automatic_canon_changes, false);
    assert.equal(HOLD_FAST_PILOT_PLAN.book_2_gate.authorized, false);
    assert.ok(HOLD_FAST_PILOT_SEQUENCE.every((step) => step.automated_author_acceptance === false));
  });
});
