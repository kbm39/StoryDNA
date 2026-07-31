import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { AUTHOR_INTENT_CONTRACT_VERSION } from "@/lib/author-intent/contract.ts";
import type { AuthorIntentRecord } from "@/lib/author-intent/types.ts";
import { buildDeterministicEicPlan, intentTypeHasRecommendations } from "./recommendations.ts";
import { evaluateEicPlanGate, gateBlocksLaunch } from "./gate.ts";
import { isStudioEicEnabled, STUDIO_EIC_FLAG_NAME } from "./feature-flag.ts";
import { EIC_PLAN_CONTRACT_VERSION } from "./contract.ts";

function makeIntent(overrides: Partial<AuthorIntentRecord> = {}): AuthorIntentRecord {
  return Object.freeze({
    id: "intent-1",
    manuscript_id: "ms-1",
    manuscript_version_id: "ver-1",
    contract_version: AUTHOR_INTENT_CONTRACT_VERSION,
    intent_type: "query_preparation",
    custom_objective_text: null,
    author_success_definition: "Agent-ready query package",
    requested_experts: Object.freeze([]),
    declined_experts: Object.freeze([]),
    priority_domains: Object.freeze([]),
    budget_preference: null,
    time_preference: null,
    status: "active",
    created_by: "author-1",
    superseded_by_id: null,
    supersedes_intent_id: null,
    activated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  });
}

describe("deterministic EIC recommendations", () => {
  it("query preparation recommends Literary Agent", () => {
    const plan = buildDeterministicEicPlan({ intent: makeIntent({ intent_type: "query_preparation" }) });
    assert.equal(plan.contract_version, EIC_PLAN_CONTRACT_VERSION);
    assert.ok(plan.recommended_experts.some((e) => e.expert_key === "literary_agent"));
  });

  it("traditional publishing recommends Literary Agent", () => {
    const plan = buildDeterministicEicPlan({
      intent: makeIntent({ intent_type: "traditional_publishing" }),
    });
    assert.ok(plan.recommended_experts.some((e) => e.expert_key === "literary_agent"));
  });

  it("military realism recommends Military Expert", () => {
    const plan = buildDeterministicEicPlan({
      intent: makeIntent({ intent_type: "military_realism" }),
    });
    const me = [
      ...plan.recommended_experts,
      ...plan.experimental_experts,
      ...plan.unavailable_experts,
    ].find((e) => e.expert_key === "military_expert");
    assert.ok(me, "Military Expert should appear in plan");
  });

  it("continuity review shows Continuity Expert and Archivist as unavailable", () => {
    const plan = buildDeterministicEicPlan({
      intent: makeIntent({ intent_type: "continuity_review" }),
    });
    const keys = plan.unavailable_experts.map((e) => e.expert_key);
    assert.ok(keys.includes("continuity_expert"));
    assert.ok(keys.includes("archivist"));
  });

  it("series consistency shows Continuity, Timeline, and Archivist", () => {
    const plan = buildDeterministicEicPlan({
      intent: makeIntent({ intent_type: "series_consistency" }),
    });
    const keys = plan.unavailable_experts.map((e) => e.expert_key);
    assert.ok(keys.includes("continuity_expert"));
    assert.ok(keys.includes("timeline_expert"));
    assert.ok(keys.includes("archivist"));
  });

  it("custom intent has no silent expert selection", () => {
    const plan = buildDeterministicEicPlan({
      intent: makeIntent({
        intent_type: "custom",
        custom_objective_text: "Adapt for podcast",
      }),
    });
    assert.equal(plan.recommended_experts.length, 0);
    assert.equal(plan.required_experts.length, 0);
    assert.ok(plan.recommendation_reasons._custom);
    assert.equal(intentTypeHasRecommendations("custom"), false);
  });

  it("never marks plan entries as launchable", () => {
    const plan = buildDeterministicEicPlan({ intent: makeIntent() });
    const all = [
      ...plan.required_experts,
      ...plan.recommended_experts,
      ...plan.optional_experts,
      ...plan.experimental_experts,
    ];
    for (const entry of all) {
      assert.equal(entry.launchable, false);
    }
  });
});

describe("EIC plan gate", () => {
  it("blocks when intent is missing", () => {
    const result = evaluateEicPlanGate({
      gateEnabled: true,
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      activeIntent: null,
      existingActivePlan: null,
    });
    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.reason, "missing_intent");
    assert.equal(gateBlocksLaunch(result), true);
  });

  it("blocks on version mismatch", () => {
    const result = evaluateEicPlanGate({
      gateEnabled: true,
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-2",
      activeIntent: makeIntent({ manuscript_version_id: "ver-1" }),
      existingActivePlan: null,
    });
    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.reason, "version_mismatch");
  });

  it("allows when intent is valid", () => {
    const result = evaluateEicPlanGate({
      gateEnabled: true,
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      activeIntent: makeIntent(),
      existingActivePlan: null,
    });
    assert.equal(result.allowed, true);
    assert.equal(gateBlocksLaunch(result), false);
  });

  it("does not block when gate is disabled", () => {
    const result = evaluateEicPlanGate({
      gateEnabled: false,
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      activeIntent: null,
      existingActivePlan: null,
    });
    assert.equal(gateBlocksLaunch(result), false);
  });

  it("rejects unknown expert key at launch", () => {
    const result = evaluateEicPlanGate({
      gateEnabled: true,
      manuscriptId: "ms-1",
      manuscriptVersionId: "ver-1",
      activeIntent: makeIntent(),
      existingActivePlan: null,
      expertKeyToLaunch: "fake_expert",
    });
    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.reason, "unknown_expert");
  });
});

describe("EIC feature flag", () => {
  const saved = process.env[STUDIO_EIC_FLAG_NAME];
  const savedNodeEnv = process.env.NODE_ENV;

  it("defaults off", () => {
    delete process.env[STUDIO_EIC_FLAG_NAME];
    process.env.NODE_ENV = "development";
    assert.equal(isStudioEicEnabled(), false);
    if (saved === undefined) delete process.env[STUDIO_EIC_FLAG_NAME];
    else process.env[STUDIO_EIC_FLAG_NAME] = saved;
    process.env.NODE_ENV = savedNodeEnv;
  });
});

describe("no provider calls or workflow launches in EIC layer", () => {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const files = [
    "lib/eic/recommendations.ts",
    "lib/eic/gate.ts",
    "lib/eic/service.ts",
  ];

  for (const file of files) {
    it(`${file} does not call providers or launch workflows`, () => {
      const content = readFileSync(join(ROOT, file), "utf8");
      assert.doesNotMatch(content, /\bfetch\s*\(/);
      assert.doesNotMatch(content, /openai|anthropic|trigger\.dev/i);
      assert.doesNotMatch(content, /startLiteraryAgent|startMilitaryExpert/i);
    });
  }
});

describe("legacy bypass documentation", () => {
  it("documents legacy direct-launch bypass paths", async () => {
    const { LEGACY_DIRECT_LAUNCH_BYPASS } = await import("./legacy-bypass.ts");
    assert.ok(LEGACY_DIRECT_LAUNCH_BYPASS.paths.length > 0);
    assert.match(LEGACY_DIRECT_LAUNCH_BYPASS.description, /bypass/i);
  });
});
