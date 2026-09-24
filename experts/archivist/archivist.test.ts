import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { ARCHIVIST, buildSystemPrompt } from "./definition.ts";
import {
  ARCHIVIST_CATEGORY,
  ARCHIVIST_CERTIFICATION_STATUS,
  ARCHIVIST_EXPERT_KEY,
  ARCHIVIST_REVIEW_SCHEMA,
  ARCHIVIST_VERSION,
} from "./contracts.ts";
import { ARCHIVIST_CONSTITUTION, ARCHIVIST_PURPOSE } from "./constitution.ts";
import {
  ARCHIVIST_CONSTITUTION_DEFINITION_HASH,
  ARCHIVIST_CONSTITUTION_OBJECT_HASH,
  computeArchivistConstitutionDefinitionHash,
  computeArchivistConstitutionObjectHash,
} from "./constitution-hash.ts";
import { archivistRuntimeDefinition } from "./runtime-definition.ts";
import {
  ARCHIVIST_REGISTRY_DEFINITION_HASH,
  archivistRegistryDefinitionV1,
  computeArchivistRegistryDefinitionHash,
} from "./registry-definition.ts";
import { validateExpertDefinition } from "@/lib/expert-registry/schema.ts";
import { hashExpertDefinition } from "@/lib/expert-registry/definition-hash.ts";
import { hashExpertRuntimeDefinition } from "@/lib/expert-review-engine/types.ts";
import { loadArchivistDraftRuntimeDefinition } from "@/lib/expert-review-engine/registry/draft-experts.ts";
import {
  bootstrapExpertRuntimeRegistry,
  clearExpertRuntimeRegistryForTests,
  getExpertRuntimeDefinition,
} from "@/lib/expert-review-engine/registry/in-code.ts";
import { getExpertCatalogEntry } from "@/lib/expert-catalog.ts";
import { PLATFORM_EXPERT_SEED_DEFINITIONS } from "@/lib/expert-registry/seed/platform-seeds.ts";
import { normalizeArchivistReview } from "./normalization.ts";
import { validateArchivistReview } from "./validation.ts";
import { parseArchivistReview } from "./parsing.ts";
import { runArchivistDraftCertification } from "./certification.ts";
import {
  FIXTURE_01_WITHIN_BOOK_EXACT,
  FIXTURE_02_EXPLAINED_APPEARANCE,
  FIXTURE_11_AMBIGUOUS_ALIAS,
  FIXTURE_13_CLEAN_CONTROL,
  FIXTURE_14_CANON_PROMOTION,
  FIXTURE_15_MISSING_CONFLICT_EVIDENCE,
} from "./fixtures.ts";
import { ARCHIVIST_DOWNSTREAM_CANON_CONTRACT } from "./downstream-canon.ts";
import { resolveEntityByAlias } from "@/lib/canon/aliases.ts";
import { assertNoSilentOverwrite } from "@/lib/canon/authority.ts";
import { temporalFactCompatibility } from "@/lib/canon/temporal.ts";
import { CanonDomainError, type CanonFact, type CanonStore } from "@/lib/canon/types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function archivistSourceFiles(): string[] {
  const dir = join(ROOT, "experts/archivist");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => read(`experts/archivist/${name}`));
}

describe("Archivist Phase 2", () => {
  it("identity, version, lifecycle, and purpose", () => {
    assert.equal(ARCHIVIST.id, ARCHIVIST_EXPERT_KEY);
    assert.equal(ARCHIVIST.reviewer, "Archivist");
    assert.equal(archivistRuntimeDefinition().expert_version, ARCHIVIST_VERSION);
    assert.equal(archivistRegistryDefinitionV1().identity.category, ARCHIVIST_CATEGORY);
    assert.equal(archivistRegistryDefinitionV1().versioning.lifecycle_status, "draft");
    assert.equal(ARCHIVIST_CONSTITUTION.purpose, ARCHIVIST_PURPOSE);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
  });

  it("runtime is disabled and not production-bootstrapped", () => {
    const runtime = loadArchivistDraftRuntimeDefinition();
    assert.equal(runtime.enabled, false);
    assert.equal(runtime.expert_key, "archivist");
    clearExpertRuntimeRegistryForTests();
    bootstrapExpertRuntimeRegistry();
    assert.equal(getExpertRuntimeDefinition("archivist"), null);
    assert.equal(getExpertRuntimeDefinition("archivist", { includeDisabled: true }), null);
  });

  it("is seeded as a disabled draft and is not studio-selectable", () => {
    const seed = PLATFORM_EXPERT_SEED_DEFINITIONS.find((spec) => spec.expertKey === "archivist");
    assert.ok(seed);
    assert.equal(seed.displayName, "Archivist");
    assert.equal(seed.category, "archivist_continuity");
    assert.equal(seed.definition().versioning.version, ARCHIVIST_VERSION);
    assert.equal(seed.definition().versioning.lifecycle_status, "draft");
    assert.equal(seed.definition().registry_metadata?.execution_wired, false);
    assert.equal(PLATFORM_EXPERT_SEED_DEFINITIONS.length, 4);
    assert.equal(getExpertCatalogEntry("archivist" as never), undefined);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
  });

  it("registry-ready definition validates", () => {
    const result = validateExpertDefinition(archivistRegistryDefinitionV1());
    assert.equal(result.ok, true, result.ok ? "" : result.errors.join("; "));
  });

  it("constitution, registry, and runtime hashes are stable", () => {
    assert.equal(computeArchivistConstitutionDefinitionHash(), ARCHIVIST_CONSTITUTION_DEFINITION_HASH);
    assert.equal(computeArchivistConstitutionObjectHash(), ARCHIVIST_CONSTITUTION_OBJECT_HASH);
    assert.equal(computeArchivistRegistryDefinitionHash(), ARCHIVIST_REGISTRY_DEFINITION_HASH);
    const runtime = archivistRuntimeDefinition();
    assert.equal(hashExpertRuntimeDefinition(runtime), runtime.runtime_versions.definition_hash);
    assert.equal(hashExpertDefinition(archivistRegistryDefinitionV1()), ARCHIVIST_REGISTRY_DEFINITION_HASH);
    assert.match(ARCHIVIST_CONSTITUTION_DEFINITION_HASH, /^[a-f0-9]{64}$/);
  });

  it("output schema identity fields are required", () => {
    const review = structuredClone(FIXTURE_13_CLEAN_CONTROL.review);
    review.manuscript_id = "";
    const result = validateArchivistReview(review);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("manuscript_id")));
  });

  it("candidate-only canon delta; accepted fails closed", () => {
    const accepted = validateArchivistReview(FIXTURE_14_CANON_PROMOTION.review);
    assert.equal(accepted.ok, false);
    assert.ok(accepted.errors.some((error) => /candidate/.test(error)));
    const valid = validateArchivistReview(normalizeArchivistReview(FIXTURE_13_CLEAN_CONTROL.review));
    assert.equal(valid.ok, true, valid.errors.join("; "));
    assert.ok(FIXTURE_13_CLEAN_CONTROL.review.canon_delta.every((delta) => delta.status === "candidate"));
  });

  it("confirmed contradiction requires both-side evidence", () => {
    const missing = validateArchivistReview(FIXTURE_15_MISSING_CONFLICT_EVIDENCE.review);
    assert.equal(missing.ok, false);
    assert.ok(missing.errors.some((error) => /both-side/.test(error)));
    const exact = validateArchivistReview(
      normalizeArchivistReview(FIXTURE_01_WITHIN_BOOK_EXACT.review),
      { manuscriptText: FIXTURE_01_WITHIN_BOOK_EXACT.manuscript_text },
    );
    assert.equal(exact.ok, true, exact.errors.join("; "));
  });

  it("does not silently resolve ambiguous aliases", () => {
    const review = normalizeArchivistReview(FIXTURE_11_AMBIGUOUS_ALIAS.review);
    const result = validateArchivistReview(review);
    assert.equal(result.ok, true, result.errors.join("; "));
    assert.equal(review.entity_ambiguities.length, 1);
    assert.equal(review.canon_delta[0]?.entity.resolution, "ambiguous");
    const store: CanonStore = {
      entities: [
        {
          id: "entity-john-reeves",
          series_id: null,
          standalone_manuscript_id: "ms-archivist-fixture",
          entity_type: "person",
          canonical_name: "John Reeves",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "entity-john-hale",
          series_id: null,
          standalone_manuscript_id: "ms-archivist-fixture",
          entity_type: "person",
          canonical_name: "John Hale",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      aliases: [
        {
          id: "a1",
          entity_id: "entity-john-reeves",
          alias: "John",
          alias_normalized: "john",
          created_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "a2",
          entity_id: "entity-john-hale",
          alias: "John",
          alias_normalized: "john",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      facts: [],
      evidence: [],
      conflicts: [],
      conflict_events: [],
      transitions: [],
      bible_revisions: [],
    };
    const resolution = resolveEntityByAlias(
      store,
      { standalone_manuscript_id: "ms-archivist-fixture" },
      "John",
    );
    assert.equal(resolution.status, "ambiguous");
  });

  it("temporal reasoning: disjoint states are compatible", () => {
    const alive: Pick<CanonFact, "fact_value" | "temporal_scope"> = {
      fact_value: { alive: true },
      temporal_scope: { kind: "at", book_order: 1, chapter: "3" },
    };
    const dead: Pick<CanonFact, "fact_value" | "temporal_scope"> = {
      fact_value: { alive: false },
      temporal_scope: { kind: "at", book_order: 1, chapter: "5" },
    };
    const compatibility = temporalFactCompatibility(alive, dead);
    assert.equal(compatibility.kind, "compatible");
    assert.equal(compatibility.relation, "disjoint");
  });

  it("authority handling refuses silent overwrite", () => {
    const existing = {
      status: "accepted",
      authority: "series_bible_accepted",
    } as CanonFact;
    assert.throws(
      () =>
        assertNoSilentOverwrite({
          existing,
          incoming: { authority: "current_observation", status: "accepted" },
        }),
      (error: unknown) => error instanceof CanonDomainError && error.code === "SILENT_CANON_OVERWRITE",
    );
  });

  it("normalization is deterministic and does not upgrade classification", () => {
    const first = normalizeArchivistReview(FIXTURE_02_EXPLAINED_APPEARANCE.review);
    const second = normalizeArchivistReview(normalizeArchivistReview(FIXTURE_02_EXPLAINED_APPEARANCE.review));
    assert.equal(JSON.stringify(first), JSON.stringify(second));
    assert.equal(first.findings[0]?.classification, "possible_continuity_conflict");
  });

  it("parse then validate round-trip", () => {
    const parsed = parseArchivistReview(JSON.stringify(FIXTURE_13_CLEAN_CONTROL.review));
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const normalized = normalizeArchivistReview(parsed.review);
    const result = validateArchivistReview(normalized);
    assert.equal(result.ok, true, result.errors.join("; "));
    assert.equal(normalized.schema, ARCHIVIST_REVIEW_SCHEMA);
  });

  it("prompt builders exist but sources do not call providers", () => {
    const prompt = buildSystemPrompt(ARCHIVIST);
    assert.match(prompt, /Never invent|NEVER INVENT CANON/i);
    const sources = archivistSourceFiles().join("\n");
    assert.doesNotMatch(sources, /@\/lib\/ai\/anthropic/);
    assert.doesNotMatch(sources, /openai/i);
    assert.doesNotMatch(sources, /@trigger\.dev/);
  });

  it("downstream canon contract keeps Archivist as authority service", () => {
    assert.equal(ARCHIVIST_DOWNSTREAM_CANON_CONTRACT.authority_service, "archivist");
    assert.equal(ARCHIVIST_DOWNSTREAM_CANON_CONTRACT.consumers.military_expert.may_author_canon, false);
    assert.equal(
      ARCHIVIST_DOWNSTREAM_CANON_CONTRACT.consumers.developmental_editor.include_unresolved_conflicts,
      true,
    );
    assert.equal(ARCHIVIST_DOWNSTREAM_CANON_CONTRACT.consumers.police_expert.may_author_canon, false);
    assert.equal(
      ARCHIVIST_DOWNSTREAM_CANON_CONTRACT.consumers.organized_crime_expert.may_author_canon,
      false,
    );
  });

  it("certification remains draft_not_certified", async () => {
    const report = await runArchivistDraftCertification();
    assert.equal(report.certification_status, ARCHIVIST_CERTIFICATION_STATUS);
    assert.equal(report.live_model_certified, true);
    assert.equal(report.runtime_disabled, true);
    assert.equal(report.seeded, true);
    assert.equal(report.execution_wired, false);
    assert.equal(report.errors.join("\n"), "");
    assert.equal(report.mandatory_gates_passed, true);
  });
});
