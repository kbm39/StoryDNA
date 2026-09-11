import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FIXTURE_CONTENT_HASH,
  FIXTURE_MANUSCRIPT_ID,
  FIXTURE_MANUSCRIPT_VERSION_ID,
} from "@/experts/archivist/fixtures.ts";
import { ARCHIVIST_VERSION } from "@/experts/archivist/contracts.ts";
import { createCanonStore } from "@/lib/canon/memory.ts";
import { promoteFactToAccepted } from "@/lib/canon/transitions.ts";
import { acceptBibleRevision, createDraftBibleRevision } from "@/lib/canon/bible.ts";
import { executeExpert } from "./execute.ts";
import {
  getLiveProviderInvocationCount,
  resetLiveProviderInvocationCountForTests,
} from "./dry-run-guard.ts";
import {
  persistAcceptedBibleRevisionFromDryRun,
  persistAcceptedCanonFromDryRun,
} from "@/experts/archivist/execute-adapter.ts";
import { ARCHIVIST_WORKFLOW_PHASES, ARCHIVIST_WORKFLOW_TYPE } from "./types.ts";
import type { ExecuteExpertRequest } from "./types.ts";

const EXPERT_VERSION_ID = "883407ad-4afe-4f3c-a69b-eaa3234fc9c6";

function request(overrides: Partial<ExecuteExpertRequest> = {}): ExecuteExpertRequest {
  return {
    expert_key: "archivist",
    expert_version_id: EXPERT_VERSION_ID,
    manuscript_id: FIXTURE_MANUSCRIPT_ID,
    manuscript_version_id: FIXTURE_MANUSCRIPT_VERSION_ID,
    content_hash: FIXTURE_CONTENT_HASH,
    mode: "dry_run",
    ...overrides,
  };
}

describe("generic Execute Expert", () => {
  it("runs Archivist dry_run end-to-end without publishing", async () => {
    resetLiveProviderInvocationCountForTests();
    const previous = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-test-present-but-unused";
    try {
      const phases: string[] = [];
      let heartbeats = 0;
      const result = await executeExpert(request(), {
        onPhase: (phase) => {
          phases.push(phase);
        },
        onExecutionHeartbeat: async () => {
          heartbeats += 1;
        },
      });
      assert.equal(result.ok, true);
      assert.equal(result.execution_mode, "dry_run");
      assert.equal(result.status, "completed");
      assert.equal(result.published, false);
      assert.equal(result.workflow_type, ARCHIVIST_WORKFLOW_TYPE);
      assert.deepEqual(result.phases, [...ARCHIVIST_WORKFLOW_PHASES]);
      assert.deepEqual(phases, [...ARCHIVIST_WORKFLOW_PHASES]);
      assert.ok(heartbeats >= ARCHIVIST_WORKFLOW_PHASES.length);
      assert.equal(result.expert_version, ARCHIVIST_VERSION);
      assert.equal(result.provenance.provider, "none");
      assert.equal(result.provenance.model, "none");
      assert.equal(result.cost.call_count, 0);
      assert.equal(result.cost.total_cost_usd, 0);
      assert.equal(result.cost.cost_status, "exact");
      assert.equal(result.cost.token_counts, "exact");
      assert.equal(getLiveProviderInvocationCount(), 0);
    } finally {
      if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = previous;
    }
  });

  it("blocks live Archivist execution", async () => {
    const result = await executeExpert(request({ mode: "live" }));
    assert.equal(result.ok, false);
    assert.equal(result.error_code, "archivist_live_disabled");
    assert.equal(result.published, false);
  });

  it("does not wire Military Expert, Developmental Editor, or other specialists", async () => {
    for (const expert_key of [
      "military_expert",
      "developmental_editor",
      "proofreader",
      "police_expert",
      "organized_crime_expert",
    ]) {
      const result = await executeExpert(request({ expert_key, mode: "dry_run" }));
      assert.equal(result.ok, false);
      assert.equal(result.error_code, "expert_adapter_not_wired");
    }
  });

  it("fails closed on version/content-hash mismatch", async () => {
    const result = await executeExpert(request(), {
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

  it("blocks a duplicate active expert workflow", async () => {
    const result = await executeExpert(request(), {
      findActiveWorkflow: () => ({
        workflow_id: "wf-active",
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

  it("cancellation produces no publication", async () => {
    const result = await executeExpert(request(), {
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
    const result = await executeExpert(request(), { abortSignal: controller.signal });
    assert.equal(result.ok, false);
    assert.equal(result.published, false);
    assert.equal(result.status, "cancelled");
    assert.equal(result.error_code, "aborted");
  });

  it("dry-run cannot write accepted canon or bible revisions", async () => {
    const store = createCanonStore();
    const result = await executeExpert(request(), { canonicalContext: store });
    assert.equal(result.ok, true);
    assert.equal(result.canon_writes.accepted_facts, 0);
    assert.equal(result.canon_writes.accepted_bible_revisions, 0);
    assert.equal(result.canon_writes.persisted, false);
    assert.equal(store.facts.filter((fact) => fact.status === "accepted").length, 0);
    assert.equal(store.bible_revisions.filter((row) => row.status === "accepted").length, 0);
    assert.throws(persistAcceptedCanonFromDryRun);
    assert.throws(persistAcceptedBibleRevisionFromDryRun);
    assert.throws(() =>
      promoteFactToAccepted(store, {
        factId: "missing",
        actor: "author",
      }),
    );
    assert.throws(() =>
      acceptBibleRevision(store, { revisionId: "missing", actor: "author" }),
    );
    assert.throws(() =>
      createDraftBibleRevision(store, {
        seriesId: "series-x",
        factIds: [],
        actor: "extraction",
      }),
    );
  });

  it("carries optional series context without requiring prior volumes", async () => {
    const result = await executeExpert(
      request({
        series_id: "series-archivist-fixture",
        series_order: 1,
        prior_authoritative_manuscript_versions: [],
      }),
    );
    assert.equal(result.ok, true);
    assert.equal(result.series_id, "series-archivist-fixture");
    assert.equal(result.series_order, 1);
    assert.deepEqual(result.prior_authoritative_manuscript_versions, []);
  });
});
