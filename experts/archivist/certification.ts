/**
 * Draft Archivist certification harness — reports draft_not_certified.
 * Does not certify live model behavior.
 */

import { deepFreeze } from "@/lib/expert-review-engine/deep-freeze.ts";
import { validateExpertRuntimeDefinition } from "@/lib/expert-review-engine/validate-runtime-definition.ts";
import { verifyAdvertisedModuleRefs } from "@/lib/expert-review-engine/verify-module-refs.ts";
import { validateExpertDefinition } from "@/lib/expert-registry/schema.ts";
import { hashExpertDefinition } from "@/lib/expert-registry/definition-hash.ts";
import { hashExpertRuntimeDefinition } from "@/lib/expert-review-engine/types.ts";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import { LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH } from "@/lib/expert-review-engine/literary-agent-constitution-hash.ts";
import { literaryAgentRegistryDefinitionV1 } from "@/lib/expert-registry/seed/literary-agent-registry.v1.ts";
import { PLATFORM_EXPERT_SEED_DEFINITIONS } from "@/lib/expert-registry/seed/platform-seeds.ts";
import { ARCHIVIST } from "./definition.ts";
import {
  ARCHIVIST_CONSTITUTION_DEFINITION_HASH,
  computeArchivistConstitutionDefinitionHash,
} from "./constitution-hash.ts";
import { archivistRegistryDefinitionV1 } from "./registry-definition.ts";
import { normalizeArchivistReview } from "./normalization.ts";
import { validateArchivistReview } from "./validation.ts";
import { archivistRuntimeDefinition } from "./runtime-definition.ts";
import { confirmedContradictionHasBothSides } from "./evidence.ts";
import {
  ARCHIVIST_CERTIFICATION_FIXTURES,
  type ArchivistCertificationFixture,
} from "./fixtures.ts";
import {
  ARCHIVIST_CERTIFICATION_STATUS,
  ARCHIVIST_EXPERT_KEY,
  type ArchivistCertificationStatus,
} from "./contracts.ts";

const EXPECTED_LA_RUNTIME_HASH =
  "bb022e5dce030d053c13b7720c92f253fbc70d3e09eb9c474d3616e33eab813b";
const EXPECTED_LA_CONSTITUTION_HASH =
  "3c6f5df3f7dbef286f2f36aab82c807b66615005acd3153227287f33b4ee6ac2";
const EXPECTED_LA_REGISTRY_SEED_HASH =
  "beb0c2966feb87fd003dbf174b3ace22eb9a586ac92c8e1eddbcd19ffecaa64e";

export const ARCHIVIST_CERTIFICATION_GATES = [
  "safety_canon_control_fixtures",
  "confirmed_both_side_evidence",
  "no_invented_accepted_canon",
  "no_silent_ambiguous_entity_resolution",
  "clean_control_zero_confirmed",
  "intentional_retcon_handled",
  "temporal_non_conflicts_remain_non_conflicts",
] as const;

export type ArchivistCertificationGate = (typeof ARCHIVIST_CERTIFICATION_GATES)[number];

export interface ArchivistGateResult {
  gate: ArchivistCertificationGate;
  passed: boolean;
  detail: string;
}

export interface ArchivistDraftCertificationReport {
  certification_status: ArchivistCertificationStatus;
  live_model_certified: false;
  expert_key: string;
  expert_version: string;
  constitution_definition_hash: string;
  runtime_definition_hash: string;
  registry_definition_hash: string;
  definition_validation_ok: boolean;
  runtime_validation_ok: boolean;
  module_refs_ok: boolean;
  runtime_disabled: boolean;
  execution_wired: false;
  seeded: false;
  fixtures_evaluated: number;
  fixture_failures: string[];
  gates: ArchivistGateResult[];
  mandatory_gates_passed: boolean;
  literary_agent_runtime_hash_unchanged: boolean;
  literary_agent_constitution_hash_unchanged: boolean;
  literary_agent_registry_seed_hash_unchanged: boolean;
  errors: string[];
}

function evaluateFixture(fixture: ArchivistCertificationFixture): string | null {
  const normalized = normalizeArchivistReview(fixture.review);
  const result = validateArchivistReview(normalized, {
    manuscriptText: fixture.manuscript_text,
  });
  if (result.ok !== fixture.expect.validation_ok) {
    return `${fixture.id}: expected validation_ok=${fixture.expect.validation_ok}, got ${result.ok}${
      result.errors.length ? ` (${result.errors[0]})` : ""
    }`;
  }
  if (fixture.expect.validation_ok) {
    const confirmed = normalized.findings.filter(
      (finding) => finding.classification === "confirmed_contradiction",
    );
    if (confirmed.length !== fixture.expect.confirmed_count) {
      return `${fixture.id}: expected ${fixture.expect.confirmed_count} confirmed, got ${confirmed.length}`;
    }
    if (
      fixture.expect.entity_ambiguity_count != null &&
      normalized.entity_ambiguities.length !== fixture.expect.entity_ambiguity_count
    ) {
      return `${fixture.id}: expected ${fixture.expect.entity_ambiguity_count} ambiguities`;
    }
  }
  return null;
}

function gateResults(fixtureFailures: string[]): ArchivistGateResult[] {
  const byId = new Map(ARCHIVIST_CERTIFICATION_FIXTURES.map((fixture) => [fixture.id, fixture]));
  const failedIds = new Set(
    fixtureFailures.map((failure) => failure.slice(0, failure.indexOf(":") || failure.length)),
  );

  const safetyFixtures = ARCHIVIST_CERTIFICATION_FIXTURES.filter((fixture) => fixture.safety);
  const safetyPassed = safetyFixtures.every((fixture) => !failedIds.has(fixture.id));

  const validConfirmed = ARCHIVIST_CERTIFICATION_FIXTURES.filter(
    (fixture) => fixture.expect.validation_ok,
  ).flatMap((fixture) =>
    normalizeArchivistReview(fixture.review).findings.filter(
      (finding) => finding.classification === "confirmed_contradiction",
    ),
  );
  const bothSides = validConfirmed.every((finding) => confirmedContradictionHasBothSides(finding));

  const acceptedDeltas = ARCHIVIST_CERTIFICATION_FIXTURES.filter((fixture) =>
    fixture.review.canon_delta.some((delta) => (delta.status as string) === "accepted"),
  );
  const acceptedFailClosed = acceptedDeltas.every((fixture) => fixture.expect.validation_ok === false);

  const aliasFixture = byId.get("ambiguous_alias")!;
  const aliasNormalized = normalizeArchivistReview(aliasFixture.review);
  const silentResolve = aliasNormalized.canon_delta.some(
    (delta) =>
      delta.entity.alias.toLowerCase() === "john" && delta.entity.resolution === "resolved",
  );

  const clean = normalizeArchivistReview(byId.get("no_false_positive_control")!.review);
  const retcon = normalizeArchivistReview(byId.get("intentional_retcon")!.review);
  const temporal = normalizeArchivistReview(byId.get("alive_dead_temporal_control")!.review);
  const explained = normalizeArchivistReview(byId.get("explained_apparent_conflict")!.review);

  return [
    {
      gate: "safety_canon_control_fixtures",
      passed: safetyPassed,
      detail: safetyPassed ? "all safety fixtures passed" : "one or more safety fixtures failed",
    },
    {
      gate: "confirmed_both_side_evidence",
      passed: bothSides,
      detail: bothSides
        ? "all valid confirmed findings have both-side evidence"
        : "confirmed finding missing a side",
    },
    {
      gate: "no_invented_accepted_canon",
      passed: acceptedFailClosed,
      detail: acceptedFailClosed
        ? "accepted canon_delta fails closed"
        : "accepted canon_delta was allowed",
    },
    {
      gate: "no_silent_ambiguous_entity_resolution",
      passed: !silentResolve && aliasNormalized.entity_ambiguities.length === 1,
      detail: silentResolve ? "John was silently resolved" : "alias John left ambiguous",
    },
    {
      gate: "clean_control_zero_confirmed",
      passed: clean.metrics.confirmed_contradiction_count === 0,
      detail: `clean control confirmed=${clean.metrics.confirmed_contradiction_count}`,
    },
    {
      gate: "intentional_retcon_handled",
      passed: retcon.metrics.confirmed_contradiction_count === 0,
      detail: `retcon confirmed=${retcon.metrics.confirmed_contradiction_count}`,
    },
    {
      gate: "temporal_non_conflicts_remain_non_conflicts",
      passed:
        temporal.metrics.confirmed_contradiction_count === 0 &&
        explained.metrics.confirmed_contradiction_count === 0,
      detail: "alive-then-dead and explained appearance remain unconfirmed",
    },
  ];
}

export async function runArchivistDraftCertification(): Promise<ArchivistDraftCertificationReport> {
  const errors: string[] = [];
  const runtime = archivistRuntimeDefinition();
  const registryDefinition = archivistRegistryDefinitionV1();

  const definitionValidation = validateExpertDefinition(registryDefinition);
  if (!definitionValidation.ok) errors.push(...definitionValidation.errors);

  const runtimeValidation = validateExpertRuntimeDefinition(runtime);
  if (!runtimeValidation.ok) errors.push(...runtimeValidation.errors);

  const moduleRefs = await verifyAdvertisedModuleRefs(runtime);
  if (!moduleRefs.ok) {
    errors.push(...moduleRefs.failures.map((failure) => failure.reason));
  }

  const fixtureFailures = ARCHIVIST_CERTIFICATION_FIXTURES.map(evaluateFixture).filter(
    (failure): failure is string => failure != null,
  );
  errors.push(...fixtureFailures);

  const gates = gateResults(fixtureFailures);
  const mandatory_gates_passed = gates.every((gate) => gate.passed);

  const constitutionHash = computeArchivistConstitutionDefinitionHash();
  const runtimeHash = hashExpertRuntimeDefinition(runtime);
  const registryHash = hashExpertDefinition(registryDefinition);

  const laRuntimeHash = hashExpertRuntimeDefinition(literaryAgentRuntimeDefinition());
  const seeded = PLATFORM_EXPERT_SEED_DEFINITIONS.some((spec) => spec.expertKey === ARCHIVIST_EXPERT_KEY);

  deepFreeze(structuredClone(ARCHIVIST));
  deepFreeze(structuredClone(runtime));

  if (constitutionHash !== ARCHIVIST_CONSTITUTION_DEFINITION_HASH) {
    errors.push("constitution hash mismatch against canonical export");
  }
  if (runtimeHash !== runtime.runtime_versions.definition_hash) {
    errors.push("runtime hash mismatch against runtime_versions.definition_hash");
  }
  if (runtime.enabled) errors.push("runtime.enabled must be false");
  if (registryDefinition.registry_metadata?.execution_wired) {
    errors.push("registry execution_wired must be false");
  }
  if (seeded) errors.push("Archivist must not be present in PLATFORM_EXPERT_SEED_DEFINITIONS");

  return {
    certification_status: ARCHIVIST_CERTIFICATION_STATUS,
    live_model_certified: false,
    expert_key: runtime.expert_key,
    expert_version: runtime.expert_version,
    constitution_definition_hash: constitutionHash,
    runtime_definition_hash: runtimeHash,
    registry_definition_hash: registryHash,
    definition_validation_ok: definitionValidation.ok,
    runtime_validation_ok: runtimeValidation.ok,
    module_refs_ok: moduleRefs.ok,
    runtime_disabled: runtime.enabled === false,
    execution_wired: false,
    seeded: false,
    fixtures_evaluated: ARCHIVIST_CERTIFICATION_FIXTURES.length,
    fixture_failures: fixtureFailures,
    gates,
    mandatory_gates_passed,
    literary_agent_runtime_hash_unchanged: laRuntimeHash === EXPECTED_LA_RUNTIME_HASH,
    literary_agent_constitution_hash_unchanged:
      LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH === EXPECTED_LA_CONSTITUTION_HASH,
    literary_agent_registry_seed_hash_unchanged:
      hashExpertDefinition(literaryAgentRegistryDefinitionV1()) === EXPECTED_LA_REGISTRY_SEED_HASH,
    errors,
  };
}
