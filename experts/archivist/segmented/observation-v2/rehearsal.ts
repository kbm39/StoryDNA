/**
 * $0 V2 extraction rehearsal.
 * provider=none, model=none. Fixture output → adapter → validate → dedupe.
 * Does not score continuity detection. Does not call a provider.
 */

import {
  getLiveProviderInvocationCount,
  resetLiveProviderInvocationCountForTests,
} from "@/lib/execute-expert/dry-run-guard.ts";
import { adaptV2ProviderOutput } from "./adapter.ts";
import { estimateJsonTokens } from "./compactness.ts";
import { RULE8_V2_COVERAGE_MATRIX } from "./coverage-matrix.ts";
import {
  fixtureObservationsForCase,
  requiredObservationIdsForCase,
  simulateV2FixtureProviderOutput,
  V2_FIXTURE_MODEL,
  V2_FIXTURE_PROVIDER,
} from "./fixture-provider.ts";
import { rule8V2FixtureDocument } from "./fixtures.ts";
import { classifyV2PairingInterface } from "./pairing-interface.ts";
import { estimateV2TokenFootprint } from "./token-estimate.ts";
import type { V2Observation } from "./types.ts";
import { observationIsConfirmationGrade } from "./validate.ts";

export const V2_FIXTURE_REHEARSAL_MODE = "internal_zero_cost_v2_fixture_rehearsal" as const;

export interface V2FixtureCaseRehearsal {
  benchmark_id: string;
  required_observations: string[];
  fixture_observations_supplied: number;
  fixture_observations_retained: number;
  fixture_observations_quarantined: number;
  required_ids_retained: string[];
  required_ids_missing: string[];
  evidence_attached: boolean;
  identity_merge_detected: boolean;
  structurally_representable: boolean;
  cross_case_leakage: string[];
}

export interface V2FixtureRehearsalReport {
  rehearsal_mode: typeof V2_FIXTURE_REHEARSAL_MODE;
  provider: typeof V2_FIXTURE_PROVIDER;
  model: typeof V2_FIXTURE_MODEL;
  provider_calls: 0;
  incremental_cost_usd: 0;
  canon_writes: 0;
  cases: V2FixtureCaseRehearsal[];
  representable: number;
  broken: string[];
  compactness: {
    adapted_tokens: number;
    v2_fixture_tokens: number;
    v1_duplicated_equivalent_tokens: number;
    adapted_to_v1_ratio: number;
  };
}

function byId(observations: V2Observation[], id: string): V2Observation | undefined {
  return observations.find((item) => item.id === id);
}

function otherCaseIds(benchmarkId: string): Set<string> {
  const allowed = new Set(fixtureObservationsForCase(benchmarkId).map((item) => item.id));
  const leaked = new Set<string>();
  for (const row of RULE8_V2_COVERAGE_MATRIX) {
    if (row.benchmark_id === benchmarkId) continue;
    for (const required of row.required_observations) {
      if (!allowed.has(required.id)) leaked.add(required.id);
    }
  }
  return leaked;
}

export function rehearseV2FixtureExtraction(): V2FixtureRehearsalReport {
  resetLiveProviderInvocationCountForTests();
  const cases: V2FixtureCaseRehearsal[] = [];
  const broken: string[] = [];

  for (const row of RULE8_V2_COVERAGE_MATRIX) {
    const simulated = simulateV2FixtureProviderOutput(row.benchmark_id);
    const adapted = adaptV2ProviderOutput(simulated.raw, `seg-${row.benchmark_id.toLowerCase()}`);
    const retainedIds = new Set((adapted.retained ?? []).map((item) => item.id));
    const required = requiredObservationIdsForCase(row.benchmark_id);
    const missing = required.filter((id) => !retainedIds.has(id));
    const sideA = byId(adapted.retained, row.required_observations.find((item) => item.role === "side_a")?.id ?? "");
    const sideB = byId(adapted.retained, row.required_observations.find((item) => item.role === "side_b")?.id ?? "");
    const iface = sideA && sideB ? classifyV2PairingInterface(sideA, sideB) : "not_comparable";
    const evidenceAttached = required.every((id) => {
      const observation = byId(adapted.retained, id);
      return Boolean(observation?.evidence.locator && observation.evidence.excerpt.length >= 8);
    });
    const leakage = [...retainedIds].filter((id) => otherCaseIds(row.benchmark_id).has(id));
    const identityMerge = adapted.retained.some((item) => "entity_id" in item && (item as { entity_id?: unknown }).entity_id);
    const representable =
      adapted.ok &&
      missing.length === 0 &&
      iface === row.required_reasoning &&
      evidenceAttached &&
      leakage.length === 0 &&
      !identityMerge;
    if (!representable) broken.push(row.benchmark_id);
    cases.push({
      benchmark_id: row.benchmark_id,
      required_observations: required,
      fixture_observations_supplied: simulated.observations.length,
      fixture_observations_retained: adapted.retained.length,
      fixture_observations_quarantined: adapted.quarantined.filter((item) => item.reason !== "duplicate").length,
      required_ids_retained: required.filter((id) => retainedIds.has(id)),
      required_ids_missing: missing,
      evidence_attached: evidenceAttached,
      identity_merge_detected: identityMerge,
      structurally_representable: representable,
      cross_case_leakage: leakage,
    });
  }

  const full = adaptV2ProviderOutput(JSON.stringify(rule8V2FixtureDocument()), "seg-rule8-v2-fixture");
  const footprint = estimateV2TokenFootprint();
  const adaptedTokens = full.document ? estimateJsonTokens(full.document) : 0;
  void getLiveProviderInvocationCount();

  return {
    rehearsal_mode: V2_FIXTURE_REHEARSAL_MODE,
    provider: V2_FIXTURE_PROVIDER,
    model: V2_FIXTURE_MODEL,
    provider_calls: 0,
    incremental_cost_usd: 0,
    canon_writes: 0,
    cases,
    representable: cases.filter((item) => item.structurally_representable).length,
    broken,
    compactness: {
      adapted_tokens: adaptedTokens,
      v2_fixture_tokens: footprint.v2_fixture_tokens,
      v1_duplicated_equivalent_tokens: footprint.v1_duplicated_equivalent_tokens,
      adapted_to_v1_ratio: Number((adaptedTokens / footprint.v1_duplicated_equivalent_tokens).toFixed(3)),
    },
  };
}

export function confirmationGradeRetained(observations: V2Observation[]): number {
  return observations.filter(observationIsConfirmationGrade).length;
}
