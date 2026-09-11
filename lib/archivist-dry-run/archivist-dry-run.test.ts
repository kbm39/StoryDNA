import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { persistAcceptedBibleRevisionFromDryRun, persistAcceptedCanonFromDryRun } from "@/experts/archivist/execute-adapter.ts";
import { ARCHIVIST_DRY_RUN_SCENARIOS } from "@/experts/archivist/dry-run-scenarios.ts";
import { ARCHIVIST_CONSTITUTION } from "@/experts/archivist/constitution.ts";
import { archivistRuntimeDefinition } from "@/experts/archivist/runtime-definition.ts";
import { EXPERT_CATALOG_ENTRIES, getExpertCatalogEntry } from "@/lib/expert-catalog.ts";
import { getLiveProviderInvocationCount, resetLiveProviderInvocationCountForTests } from "@/lib/execute-expert/dry-run-guard.ts";
import { isArchivistDryRunUiAllowed } from "./allow.ts";
import { presentFinding, presentCanonCandidate, presentEntityAmbiguity, resolveArchivistDryRunScenario, ARCHIVIST_DRY_RUN_SCENARIO_OPTIONS } from "./present.ts";
import { runArchivistDryRunForManuscript } from "./run.ts";
import {
  ARCHIVIST_DRY_RUN_BANNERS,
  ARCHIVIST_DRY_RUN_FUTURE_ACTION_NOTE,
  DEFAULT_ARCHIVIST_DRY_RUN_SCENARIO,
  type ArchivistDryRunSnapshot,
} from "./types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const HASH = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function snapshot(overrides: Partial<ArchivistDryRunSnapshot> = {}): ArchivistDryRunSnapshot {
  return {
    title: "Local test manuscript",
    manuscript_id: "ms-local-archivist",
    manuscript_version_id: "mv-local-archivist",
    version_number: 1,
    content_hash: HASH,
    analytical_word_count: 108296,
    execution_mode: "dry_run",
    series_id: null,
    series_order: null,
    ...overrides,
  };
}

async function run(
  overrides: Parameters<typeof runArchivistDryRunForManuscript>[0] = { manuscriptId: "ms-local-archivist" },
) {
  const pin = snapshot();
  return runArchivistDryRunForManuscript({
    loadSnapshot: async () => pin,
    reloadSnapshot: async () => pin,
    ...overrides,
    manuscriptId: overrides.manuscriptId ?? pin.manuscript_id,
  });
}

describe("Archivist localhost dry-run UI", () => {
  it("hard-codes dry_run and does not accept a live mode argument on the server action", () => {
    const action = readFileSync(join(ROOT, "app/actions/archivist-dry-run.ts"), "utf8");
    const runner = readFileSync(join(ROOT, "lib/archivist-dry-run/run.ts"), "utf8");
    assert.match(action, /mode is hard-coded to dry_run/);
    assert.match(runner, /mode: HARD_CODED_DRY_RUN_MODE/);
    assert.match(runner, /const HARD_CODED_DRY_RUN_MODE = "dry_run"/);
    assert.doesNotMatch(action, /mode:\s*"live"/);
    assert.doesNotMatch(action, /args\.mode|request\.mode|body\.mode/);
    assert.match(
      action,
      /export async function runArchivistDryRunAction\(\s*manuscriptId: string,\s*scenario\?: string,/,
    );
  });

  it("manuscript page can invoke Archivist dry-run without adding Archivist to the Expert Team catalog", () => {
    const page = readFileSync(join(ROOT, "app/manuscripts/[id]/page.tsx"), "utf8");
    const panel = readFileSync(join(ROOT, "app/manuscripts/[id]/ArchivistDryRunPanel.tsx"), "utf8");
    assert.match(page, /import ArchivistDryRunPanel/);
    assert.match(page, /<ArchivistDryRunPanel manuscriptId=\{id\} \/>/);
    assert.match(page, /import LiteraryAgentPublishingSection/);
    assert.match(panel, /runArchivistDryRunAction/);
    assert.match(panel, /Run Archivist Dry Run — \$0/);
    assert.equal(getExpertCatalogEntry("archivist" as never), undefined);
    assert.equal(
      EXPERT_CATALOG_ENTRIES.some((entry) => String(entry.key) === "archivist"),
      false,
    );
  });

  it("fails closed in Production and on Vercel production", async () => {
    const previousNode = process.env.NODE_ENV;
    const previousVercel = process.env.VERCEL_ENV;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.VERCEL_ENV;
      assert.equal(isArchivistDryRunUiAllowed(), false);
      const blocked = await run({ manuscriptId: "ms-local-archivist" });
      assert.equal(blocked.ok, false);
      if (!blocked.ok) assert.equal(blocked.error_code, "dry_run_ui_not_allowed");
      process.env.NODE_ENV = "development";
      process.env.VERCEL_ENV = "production";
      assert.equal(isArchivistDryRunUiAllowed(), false);
      process.env.NODE_ENV = "development";
      delete process.env.VERCEL_ENV;
      assert.equal(isArchivistDryRunUiAllowed(), true);
    } finally {
      if (previousNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNode;
      if (previousVercel === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = previousVercel;
    }
  });

  it("runs the pinned manuscript dry-run with $0 exact, provider none, and no canon writes", async () => {
    resetLiveProviderInvocationCountForTests();
    const previous = process.env.ANTHROPIC_API_KEY;
    const previousOpenAI = process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-test-present-but-unused";
    process.env.OPENAI_API_KEY = "sk-test-not-used";
    try {
      const result = await run({ manuscriptId: "ms-local-archivist" });
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.summary.execution_mode, "dry_run");
      assert.equal(result.summary.provider, "none");
      assert.equal(result.summary.model, "none");
      assert.equal(result.summary.cost_usd, 0);
      assert.equal(result.summary.cost_status, "exact");
      assert.equal(result.summary.call_count, 0);
      assert.equal(result.summary.input_tokens, 0);
      assert.equal(result.summary.output_tokens, 0);
      assert.equal(result.summary.published, false);
      assert.equal(result.pin.manuscript_id, "ms-local-archivist");
      assert.equal(result.pin.manuscript_version_id, "mv-local-archivist");
      assert.equal(result.pin.content_hash, HASH);
      assert.equal(result.pin.analytical_word_count, 108296);
      assert.equal(result.pin.execution_mode, "dry_run");
      assert.deepEqual([...result.banners], [...ARCHIVIST_DRY_RUN_BANNERS]);
      assert.equal(result.canon_writes.persisted, false);
      assert.equal(result.canon_writes.accepted_facts, 0);
      assert.equal(result.canon_writes.accepted_bible_revisions, 0);
      assert.equal(getLiveProviderInvocationCount(), 0);
      assert.ok(result.findings.some((finding) => finding.is_confirmed_contradiction));
      const confirmed = result.findings.find((finding) => finding.is_confirmed_contradiction);
      assert.ok(confirmed);
      assert.ok(confirmed.current_evidence.length >= 1);
      assert.ok(confirmed.conflicting_evidence.length >= 1);
      assert.ok(result.candidates.every((candidate) => candidate.status === "candidate"));
      assert.ok(result.future_actions.every((action) => action.disabled && action.note === ARCHIVIST_DRY_RUN_FUTURE_ACTION_NOTE));
    } finally {
      if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = previous;
      if (previousOpenAI === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousOpenAI;
    }
  });

  it("browser/user cannot request live mode", async () => {
    const result = await run({ manuscriptId: "ms-local-archivist", mode: "live" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error_code, "live_mode_forbidden");
  });

  it("rejects unsupported or injected scenarios", async () => {
    const unknown = await run({ manuscriptId: "ms-local-archivist", scenario: "not-a-real-scenario" });
    assert.equal(unknown.ok, false);
    if (!unknown.ok) assert.equal(unknown.error_code, "unsupported_scenario");
    const injected = await run({
      manuscriptId: "ms-local-archivist",
      scenario: JSON.stringify({ findings: [] }),
    });
    assert.equal(injected.ok, false);
    if (!injected.ok) assert.equal(injected.error_code, "unsupported_scenario");
    assert.deepEqual(
      [...ARCHIVIST_DRY_RUN_SCENARIO_OPTIONS.map((option) => option.value)],
      [...ARCHIVIST_DRY_RUN_SCENARIOS],
    );
    assert.deepEqual(resolveArchivistDryRunScenario(undefined), {
      ok: true,
      scenario: DEFAULT_ARCHIVIST_DRY_RUN_SCENARIO,
    });
  });

  it("fails closed on malformed requests, missing pin fields, cancellation, and mid-run pin changes", async () => {
    const malformed = await run({ manuscriptId: "  " });
    assert.equal(malformed.ok, false);
    if (!malformed.ok) assert.equal(malformed.error_code, "malformed_request");

    const cancelled = await run({
      manuscriptId: "ms-local-archivist",
      executionOptions: { shouldCancel: async () => true },
    });
    assert.equal(cancelled.ok, false);
    if (!cancelled.ok) assert.equal(cancelled.error_code, "cancelled");

    const pin = snapshot();
    const changed = await runArchivistDryRunForManuscript({
      manuscriptId: pin.manuscript_id,
      loadSnapshot: async () => pin,
      reloadSnapshot: async () => snapshot({ content_hash: "b".repeat(64) }),
    });
    assert.equal(changed.ok, false);
    if (!changed.ok) assert.equal(changed.error_code, "version_pin_mismatch");
  });

  it("presents confirmed evidence, candidate-only canon, and unresolved aliases without guessing", () => {
    const finding = presentFinding({
      id: "f1",
      issue_type: "appearance",
      classification: "confirmed_contradiction",
      severity: "major",
      confidence: "high",
      current_location: { locator: "Chapter 3" },
      current_evidence: [{ excerpt: "blue eyes", locator: "Chapter 3", source_kind: "manuscript" }],
      conflicting_location: { locator: "Chapter 22" },
      conflicting_source: "manuscript",
      conflicting_evidence: [{ excerpt: "green eyes", locator: "Chapter 22", source_kind: "manuscript" }],
      temporal_analysis: { explanation: "Same present." },
      explanation: "Eye color conflict.",
      suggested_resolution: "Align the later passage.",
    });
    assert.ok(finding);
    assert.equal(finding.classification_label, "CONFIRMED CONTRADICTION");
    assert.equal(finding.current_evidence[0]?.excerpt, "blue eyes");
    assert.equal(finding.conflicting_evidence[0]?.excerpt, "green eyes");
    assert.doesNotMatch(JSON.stringify(finding), /\b[A-F]\b grade/);

    const candidate = presentCanonCandidate({
      id: "c1",
      entity: { canonical_name: "Mara Quinn", alias: "Mara" },
      entity_type: "person",
      fact_type: "appearance",
      proposed_fact_value: { eye_color: "blue" },
      temporal_scope: { kind: "at", chapter: "3" },
      source_location: { locator: "Chapter 3" },
      evidence: [{ excerpt: "blue eyes", locator: "Chapter 3" }],
      confidence: "high",
      proposed_authority: "current_observation",
      status: "candidate",
    });
    assert.ok(candidate);
    assert.equal(candidate.status, "candidate");
    assert.match(candidate.proposed_value, /Eye Color: blue/);

    const ambiguity = presentEntityAmbiguity({
      id: "a1",
      alias: "John",
      candidate_entities: [
        { canonical_name: "John Reed", entity_id: "e1" },
        { canonical_name: "John Calder", entity_id: "e2" },
      ],
      context: "Two Johns appear.",
      confidence: "medium",
      recommended_author_verification: "Confirm which John.",
    });
    assert.ok(ambiguity);
    assert.equal(ambiguity.did_not_guess, true);
    assert.equal(ambiguity.candidate_entities.length, 2);
  });

  it("does not persist canon or Series Bible and author-action preview cannot mutate state", () => {
    assert.throws(persistAcceptedCanonFromDryRun);
    assert.throws(persistAcceptedBibleRevisionFromDryRun);
    const panel = readFileSync(join(ROOT, "app/manuscripts/[id]/ArchivistDryRunPanel.tsx"), "utf8");
    assert.match(panel, /disabled/);
    assert.match(panel, /\{action\.note\}/);
    assert.doesNotMatch(panel, /Accept Canon/);
    assert.doesNotMatch(panel, /promoteFactToAccepted|acceptBibleRevision/);
    const types = readFileSync(join(ROOT, "lib/archivist-dry-run/types.ts"), "utf8");
    assert.match(types, /Coming in live Archivist/);
    const runner = readFileSync(join(ROOT, "lib/archivist-dry-run/run.ts"), "utf8");
    assert.doesNotMatch(runner, /promoteFactToAccepted|acceptBibleRevision|from\("canon_/);
  });

  it("dry-run banner and fixture copy are present in the panel", () => {
    const panel = readFileSync(join(ROOT, "app/manuscripts/[id]/ArchivistDryRunPanel.tsx"), "utf8");
    assert.match(panel, /result\.banners\.map/);
    assert.match(panel, /Uses deterministic test scenarios\. No AI provider call\. No canon changes are saved\./);
    assert.match(panel, /These are proposed facts only/);
    assert.match(panel, /StoryDNA did not guess/);
    assert.match(panel, /\$0 exact/);
    const types = readFileSync(join(ROOT, "lib/archivist-dry-run/types.ts"), "utf8");
    for (const line of ARCHIVIST_DRY_RUN_BANNERS) {
      assert.match(types, new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("does not import providers or Trigger on the UI/action path", () => {
    const files = [
      "app/actions/archivist-dry-run.ts",
      "lib/archivist-dry-run/run.ts",
      "lib/archivist-dry-run/load.ts",
      "lib/archivist-dry-run/allow.ts",
      "app/manuscripts/[id]/ArchivistDryRunPanel.tsx",
    ];
    const joined = files.map((file) => readFileSync(join(ROOT, file), "utf8")).join("\n");
    assert.doesNotMatch(joined, /@\/lib\/ai\/anthropic/);
    assert.doesNotMatch(joined, /@\/lib\/ai\/openai/);
    assert.doesNotMatch(joined, /from "openai"/);
    assert.doesNotMatch(joined, /from "@anthropic-ai\/sdk"/);
    assert.doesNotMatch(joined, /@trigger\.dev/);
    assert.doesNotMatch(joined, /startLiteraryAgentWorkflow/);
  });

  it("leaves Literary Agent manuscript-page wiring and Military Expert unchanged", () => {
    const page = readFileSync(join(ROOT, "app/manuscripts/[id]/page.tsx"), "utf8");
    const literary = readFileSync(join(ROOT, "app/manuscripts/[id]/LiteraryAgentPublishingSection.tsx"), "utf8");
    const catalog = readFileSync(join(ROOT, "lib/expert-catalog.ts"), "utf8");
    assert.match(page, /LiteraryAgentPublishingSection/);
    assert.match(literary, /RunAgentReviewButton/);
    assert.match(literary, /ExpertTeamSelector/);
    assert.doesNotMatch(literary, /ArchivistDryRunPanel|runArchivistDryRunAction/);
    assert.doesNotMatch(catalog, /archivist/);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
    const military = getExpertCatalogEntry("military_expert");
    assert.ok(military);
    assert.equal(military.availability, "coming_soon");
    assert.equal(military.selectionEnabled, false);
  });

  it("ambiguous-alias scenario displays unresolved candidates", async () => {
    const result = await run({
      manuscriptId: "ms-local-archivist",
      scenario: "ambiguous_alias",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.ambiguities.length >= 1);
    assert.ok(result.ambiguities.every((row) => row.did_not_guess));
  });
});
