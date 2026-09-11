import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { executeExpert } from "@/lib/execute-expert/execute.ts";
import { confirmedContradictionHasBothSides } from "./evidence.ts";
import {
  ARCHIVIST_CONSTITUTION,
} from "./constitution.ts";
import { archivistRuntimeDefinition } from "./runtime-definition.ts";
import { archivistRegistryDefinitionV1 } from "./registry-definition.ts";
import { getExpertCatalogEntry } from "@/lib/expert-catalog.ts";
import {
  bootstrapExpertRuntimeRegistry,
  clearExpertRuntimeRegistryForTests,
  getExpertRuntimeDefinition,
} from "@/lib/expert-review-engine/registry/in-code.ts";
import { ARCHIVIST_DRY_RUN_SCENARIOS } from "./dry-run-scenarios.ts";
import {
  FIXTURE_CONTENT_HASH,
  FIXTURE_MANUSCRIPT_ID,
  FIXTURE_MANUSCRIPT_VERSION_ID,
} from "./fixtures.ts";
import type { ArchivistCanonDelta, ArchivistFinding } from "./contracts.ts";
import { ARCHIVIST_CERTIFICATION_STATUS } from "./contracts.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const EXPERT_VERSION_ID = "883407ad-4afe-4f3c-a69b-eaa3234fc9c6";

async function dryRun(scenario: (typeof ARCHIVIST_DRY_RUN_SCENARIOS)[number]) {
  return executeExpert({
    expert_key: "archivist",
    expert_version_id: EXPERT_VERSION_ID,
    manuscript_id: FIXTURE_MANUSCRIPT_ID,
    manuscript_version_id: FIXTURE_MANUSCRIPT_VERSION_ID,
    content_hash: FIXTURE_CONTENT_HASH,
    mode: "dry_run",
    dry_run_scenario: scenario,
  });
}

describe("Archivist zero-cost dry-run", () => {
  it("runs parser, normalizer, and validator for every dry-run scenario", async () => {
    for (const scenario of ARCHIVIST_DRY_RUN_SCENARIOS) {
      const result = await dryRun(scenario);
      assert.equal(result.ok, true, `${scenario}: ${result.diagnostics?.join("; ")}`);
      assert.equal(result.validation.ok, true, scenario);
      assert.equal(result.execution_mode, "dry_run");
      assert.equal(result.cost.total_cost_usd, 0);
      assert.equal(result.cost.call_count, 0);
      assert.equal(result.published, false);
    }
  });

  it("confirmed within-book finding requires both-side evidence", async () => {
    const result = await dryRun("confirmed_within_book");
    const findings = result.findings as ArchivistFinding[];
    const confirmed = findings.filter((finding) => finding.classification === "confirmed_contradiction");
    assert.ok(confirmed.length >= 1);
    for (const finding of confirmed) {
      assert.equal(confirmedContradictionHasBothSides(finding), true);
    }
  });

  it("explained temporal change is not a confirmed contradiction", async () => {
    const result = await dryRun("explained_temporal_non_conflict");
    const findings = result.findings as ArchivistFinding[];
    assert.equal(
      findings.filter((finding) => finding.classification === "confirmed_contradiction").length,
      0,
    );
  });

  it("author_verification_needed remains a verification finding", async () => {
    const result = await dryRun("author_verification_needed");
    const findings = result.findings as ArchivistFinding[];
    assert.ok(findings.some((finding) => finding.classification === "author_verification_needed"));
    assert.equal(
      findings.filter((finding) => finding.classification === "confirmed_contradiction").length,
      0,
    );
  });

  it("ambiguous alias remains ambiguous", async () => {
    const result = await dryRun("ambiguous_alias");
    assert.ok((result.entity_ambiguities as unknown[]).length >= 1);
    const deltas = result.candidate_canon_delta as ArchivistCanonDelta[];
    assert.ok(deltas.every((delta) => delta.entity.resolution !== "resolved"));
  });

  it("candidate canon remains candidate", async () => {
    const result = await dryRun("candidate_canon_delta");
    const deltas = result.candidate_canon_delta as ArchivistCanonDelta[];
    assert.ok(deltas.length >= 1);
    assert.ok(deltas.every((delta) => delta.status === "candidate"));
  });

  it("clean/no-conflict case has zero confirmed findings", async () => {
    const result = await dryRun("clean_no_conflict");
    const findings = result.findings as ArchivistFinding[];
    assert.equal(findings.length, 0);
    assert.equal(result.read_model?.cost_usd, 0);
    assert.equal(result.read_model?.execution_mode, "dry_run");
  });

  it("read model exposes findings, evidence, candidates, and $0 dry-run cost", async () => {
    const result = await dryRun("confirmed_within_book");
    const model = result.read_model;
    assert.ok(model);
    assert.equal(model.expert_display_name, "Archivist");
    assert.equal(model.cost_usd, 0);
    assert.equal(model.cost_status, "exact");
    assert.ok(model.findings[0]?.current_evidence);
    assert.ok(model.findings[0]?.conflicting_evidence);
    assert.ok(model.findings[0]?.suggested_resolution);
    assert.ok(model.canon_candidates.length >= 1);
  });

  it("remains unwired, disabled, and not Studio-selectable", () => {
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
    assert.equal(archivistRegistryDefinitionV1().registry_metadata?.execution_wired, false);
    assert.equal(getExpertCatalogEntry("archivist" as never), undefined);
    clearExpertRuntimeRegistryForTests();
    bootstrapExpertRuntimeRegistry();
    assert.equal(getExpertRuntimeDefinition("archivist"), null);
    assert.equal(getExpertRuntimeDefinition("archivist", { includeDisabled: true }), null);
    assert.equal(ARCHIVIST_CERTIFICATION_STATUS, "draft_not_certified");
  });

  it("adapter and dry-run sources do not import providers or Trigger", () => {
    const sources = [
      "experts/archivist/execute-adapter.ts",
      "experts/archivist/dry-run-scenarios.ts",
      "lib/execute-expert/execute.ts",
    ]
      .map((file) => readFileSync(join(ROOT, file), "utf8"))
      .join("\n");
    assert.doesNotMatch(sources, /@\/lib\/ai\/anthropic/);
    assert.doesNotMatch(sources, /from "openai"/);
    assert.doesNotMatch(sources, /@trigger\.dev/);
  });
});
