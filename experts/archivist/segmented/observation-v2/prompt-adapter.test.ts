import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  getLiveProviderInvocationCount,
  resetLiveProviderInvocationCountForTests,
} from "@/lib/execute-expert/dry-run-guard.ts";
import { emptySegmentObservation, validateSegmentObservation } from "../observation-contract.ts";
import { ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA } from "../constants.ts";
import { ARCHIVIST_CONSTITUTION } from "../../constitution.ts";
import { isArchivistLiveExecutionAllowed } from "../../live-flags.ts";
import {
  ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2,
  V2_ADAPTER_WIRED_TO_PAID_PATH,
  V2_FIXTURE_MODEL,
  V2_FIXTURE_PROVIDER,
  V2_OBSERVATION_KINDS,
  V2_PROMPT_WIRED_TO_PAID_PATH,
  V2_REQUIRED_PROMPT_KINDS,
  V2_SANITIZED_EXAMPLE_CASES,
  adaptV2ProviderOutput,
  assertV2PromptCoversObservationKinds,
  buildV2ObservationSystemPrompt,
  buildV2ObservationUserPrompt,
  emptySegmentObservationV2,
  estimateV2TokenFootprint,
  rehearseV2FixtureExtraction,
  rule8V2FixtureDocument,
  sanitizedV2Examples,
  simulateV2FixtureProviderOutput,
  v2PromptForbidsEditorialOutput,
  validateSegmentObservationV2,
} from "./index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

function fixtureJson(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(rule8V2FixtureDocument())) as Record<string, unknown>;
}

describe("archivist v2 prompt + compact adapter", () => {
  it("requests every required V2 observation kind and forbids editorial output", () => {
    assert.deepEqual([...V2_REQUIRED_PROMPT_KINDS], [...V2_OBSERVATION_KINDS]);
    assert.deepEqual(assertV2PromptCoversObservationKinds(), []);
    assert.equal(v2PromptForbidsEditorialOutput(), true);
    const prompt = buildV2ObservationSystemPrompt();
    assert.match(prompt, /observations\[\]/);
    assert.match(prompt, /archivist_segment_observation@v2/);
    assert.match(prompt, /Do not ask or answer: What are the continuity problems\?/);
    assert.doesNotMatch(prompt, /^What are the continuity problems\?/m);
    assert.match(prompt, /polarity must be the strings "true" \| "false" \| "unknown"/);
    assert.match(prompt, /knowledge_state: known \| unknown \| learned \| inferred \| claimed/);
    assert.match(prompt, /identity_claim: also_known_as \| role \| same_as \| unlinked/);
    assert.match(prompt, /Do not collapse explicit departure and arrival clocks/);
    assert.match(prompt, /Do not put the vehicle in traveler when a human traveler is named/);
    assert.match(prompt, /emit a second object_equipment observation/);
    assert.match(prompt, /knowledge_state=learned/);
    assert.match(prompt, /different reasoning dimensions/);
    assert.match(prompt, /operational_capability with state=used/);
    assert.match(prompt, /Do not create statement rows from narration/);
    assert.match(prompt, /Do not stitch sentences across intervening prose/);
    assert.match(prompt, /location_presence requires an explicit location/);
    assert.match(prompt, /laterality='unspecified'/);
    assert.match(prompt, /Nested proposition is optional when the typed payload already contains/);
    assert.match(prompt, /polarity must be the strings "true" \| "false" \| "unknown"/);
    assert.match(prompt, /capability state: available \| unavailable \| unknown \| used/);
    const user = buildV2ObservationUserPrompt({
      segmentId: "seg-01",
      segmentText: "placeholder segment text for prompt contract",
    });
    assert.match(user, /segment_id: seg-01/);
    assert.equal(V2_PROMPT_WIRED_TO_PAID_PATH, false);
    assert.equal(V2_ADAPTER_WIRED_TO_PAID_PATH, false);
  });

  it("adapts clean fixture JSON and preserves evidence", () => {
    const adapted = adaptV2ProviderOutput(rule8V2FixtureDocument(), "seg-rule8-v2-fixture");
    assert.equal(adapted.ok, true, adapted.hard_failure_detail ?? "");
    assert.ok(adapted.document);
    assert.equal(adapted.document?.schema, ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2);
    assert.ok(adapted.retained.length > 0);
    for (const observation of adapted.retained) {
      assert.ok(observation.evidence.locator);
      assert.ok(observation.evidence.excerpt.length >= 8);
      assert.ok(observation.evidence.source_segment);
    }
  });

  it("normalizes kind enums, polarity, and safe field aliases", () => {
    const base = fixtureJson();
    const source = (base.observations as Record<string, unknown>[])[0]!;
    const aliased = {
      ...base,
      observations: [
        {
          observation_id: "alias-travel",
          kind: "travel",
          traveler_name: "Dana",
          from_location: "Istanbul",
          to_location: "Izmir",
          mode: "Sikorsky",
          subject: "Sikorsky",
          predicate: "flew",
          value: "Istanbul to Izmir",
          polarity: "yes",
          source_kind: "narration",
          locator: { locator: "CHAPTER ALIAS" },
          excerpt: "alias excerpt long enough",
          source_segment: "seg-alias",
          confidence: "HIGH",
          inferred: "false",
        },
        {
          ...source,
          kind: "time",
          payload: { raw: "0447", clock: "04:47" },
          proposition: {
            ...(source.proposition as object),
            polarity: true,
          },
        },
      ],
    };
    const adapted = adaptV2ProviderOutput(aliased);
    assert.equal(adapted.ok, true, adapted.hard_failure_detail ?? adapted.quarantined.map((item) => item.detail).join("; "));
    const travel = adapted.retained.find((item) => item.id === "alias-travel");
    assert.ok(travel && travel.kind === "travel_leg");
    assert.equal(travel.proposition.polarity, "true");
    if (travel.kind === "travel_leg") {
      assert.equal(travel.payload.origin, "Istanbul");
      assert.equal(travel.payload.destination, "Izmir");
    }
    const stamp = adapted.retained.find((item) => item.kind === "timestamp");
    assert.ok(stamp && stamp.kind === "timestamp");
    assert.equal(stamp.payload.raw_expression, "0447");
    assert.equal(stamp.payload.clock_time, "04:47");
  });

  it("validates evidence, timestamps, events, statements, and knowledge", () => {
    const missing = fixtureJson();
    const first = (missing.observations as Record<string, unknown>[])[0]!;
    delete first.evidence;
    delete first.excerpt;
    delete first.locator;
    const second = (missing.observations as Record<string, unknown>[])[1]!;
    const adapted = adaptV2ProviderOutput(missing);
    assert.equal(adapted.ok, true);
    assert.ok(adapted.quarantined.some((item) => item.reason === "insufficient_evidence"));
    assert.ok(adapted.retained.some((item) => item.id === second.id));

    const invented = fixtureJson();
    const morning = (invented.observations as Record<string, unknown>[]).find((item) => item.id === "r8-004-ts-morning")!;
    (morning.payload as Record<string, unknown>).clock_time = "04:47";
    const clock = adaptV2ProviderOutput(invented);
    assert.equal(clock.ok, true);
    assert.ok(clock.quarantined.some((item) => item.reason === "invented_clock"));
    assert.ok(!clock.retained.some((item) => item.id === "r8-004-ts-morning"));

    const narration = fixtureJson();
    const knowledge = (narration.observations as Record<string, unknown>[]).find((item) => item.id === "r8-011-kn-use")!;
    (knowledge.payload as Record<string, unknown>).perspective = "narration";
    const known = adaptV2ProviderOutput(narration);
    assert.ok(known.quarantined.some((item) => item.reason === "narration_as_knowledge"));
  });

  it("validates travel, capability, injury, relationship, identity, location, and objects", () => {
    const combined = fixtureJson();
    const injury = (combined.observations as Record<string, unknown>[]).find((item) => item.id === "r8-029-inj-right")!;
    (injury.payload as Record<string, unknown>).body_region = "chest and arm";
    const split = adaptV2ProviderOutput(combined);
    assert.ok(split.quarantined.some((item) => item.reason === "combined_injury_region"));
    assert.equal(split.retained.some((item) => item.id === "r8-029-inj-right"), false);
    assert.equal(split.retained.some((item) => item.id === "r8-029-inj-left-rib"), true);

    const distance = fixtureJson();
    const travel = (distance.observations as Record<string, unknown>[]).find((item) => item.id === "r8-025-travel")!;
    (travel.payload as Record<string, unknown>).distance_if_explicit = 312;
    const calculated = adaptV2ProviderOutput(distance);
    assert.ok(calculated.quarantined.some((item) => item.reason === "calculated_distance"));
    assert.equal(calculated.ok, true);
  });

  it("strips model-owned entity IDs and hard-fails accepted canon", () => {
    const withId = fixtureJson();
    (withId.entities as Record<string, unknown>[])[0]!.entity_id = "person:cole";
    (withId.observations as Record<string, unknown>[])[0]!.entity_id = "person:cole";
    const stripped = adaptV2ProviderOutput(withId);
    assert.equal(stripped.ok, true);
    assert.ok(stripped.entity_ids_stripped >= 2);
    assert.equal(
      stripped.document?.entities.some((item) => "entity_id" in item && (item as { entity_id?: unknown }).entity_id),
      false,
    );

    const accepted = { ...fixtureJson(), status: "accepted" };
    const failed = adaptV2ProviderOutput(accepted);
    assert.equal(failed.ok, false);
    assert.equal(failed.hard_failure, "accepted_canon");
  });

  it("suppresses exact semantic duplicates without dropping distinct claims", () => {
    const document = fixtureJson();
    const first = (document.observations as Record<string, unknown>[])[0]!;
    (document.observations as Record<string, unknown>[]).push({ ...first, id: `${String(first.id)}-dup` });
    const adapted = adaptV2ProviderOutput(document);
    assert.equal(adapted.ok, true);
    assert.equal(adapted.suppressed_duplicates, 1);
    const ids = adapted.retained.map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("preserves compactness versus a duplicated V1 dump", () => {
    const adapted = adaptV2ProviderOutput(rule8V2FixtureDocument(), "seg-rule8-v2-fixture");
    const estimate = estimateV2TokenFootprint();
    assert.ok(adapted.compactness.output_tokens > 0);
    assert.ok(adapted.compactness.output_tokens < estimate.v1_duplicated_equivalent_tokens * 0.5);
    assert.ok(adapted.compactness.output_tokens / estimate.v2_fixture_tokens < 1.2);
  });

  it("rehearses all 24 frozen cases with provider=none", () => {
    resetLiveProviderInvocationCountForTests();
    const report = rehearseV2FixtureExtraction();
    assert.equal(report.provider, V2_FIXTURE_PROVIDER);
    assert.equal(report.model, V2_FIXTURE_MODEL);
    assert.equal(report.provider_calls, 0);
    assert.equal(report.incremental_cost_usd, 0);
    assert.equal(report.canon_writes, 0);
    assert.equal(report.cases.length, 24);
    assert.equal(report.representable, 24, report.broken.join(", "));
    assert.deepEqual(report.broken, []);
    assert.ok(report.compactness.adapted_to_v1_ratio < 0.5);
    for (const row of report.cases) {
      assert.equal(row.required_ids_missing.length, 0, row.benchmark_id);
      assert.equal(row.evidence_attached, true, row.benchmark_id);
      assert.equal(row.identity_merge_detected, false, row.benchmark_id);
      assert.deepEqual(row.cross_case_leakage, [], row.benchmark_id);
      assert.equal(row.structurally_representable, true, row.benchmark_id);
      assert.ok(row.fixture_observations_supplied >= row.required_observations.length, row.benchmark_id);
      assert.ok(row.fixture_observations_retained >= row.required_observations.length, row.benchmark_id);
    }
    assert.equal(getLiveProviderInvocationCount(), 0);
  });

  it("creates sanitized examples for the required Rule 8 cases", () => {
    const examples = sanitizedV2Examples();
    assert.deepEqual(Object.keys(examples), [...V2_SANITIZED_EXAMPLE_CASES]);
    for (const id of V2_SANITIZED_EXAMPLE_CASES) {
      const document = examples[id];
      assert.ok(document.observations.length >= 2, id);
      for (const observation of document.observations) {
        assert.equal(observation.evidence.excerpt, "[contiguous excerpt]");
        assert.equal(observation.evidence.manuscript_id, undefined);
      }
    }
  });

  it("keeps V1 readable and does not reinterpret it as V2", () => {
    const v1 = emptySegmentObservation("seg-01");
    assert.equal(v1.schema, ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA);
    assert.equal(validateSegmentObservation(v1).ok, true);
    const adapted = adaptV2ProviderOutput(v1);
    assert.equal(adapted.ok, false);
    assert.equal(adapted.hard_failure, "v1_cannot_be_reinterpreted");
    const v2 = emptySegmentObservationV2("seg-01");
    assert.equal(validateSegmentObservation(v2).ok, false);
    assert.equal(validateSegmentObservationV2(v1).ok, false);
  });

  it("does not call a provider, write canon, or switch the live contract", () => {
    resetLiveProviderInvocationCountForTests();
    const simulated = simulateV2FixtureProviderOutput("R8-010");
    assert.equal(simulated.provider, "none");
    assert.equal(simulated.model, "none");
    assert.equal(simulated.provider_calls, 0);
    adaptV2ProviderOutput(simulated.raw);
    rehearseV2FixtureExtraction();
    assert.equal(getLiveProviderInvocationCount(), 0);
    assert.equal(isArchivistLiveExecutionAllowed(), false);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    const files = [
      "prompt.ts",
      "adapter.ts",
      "enum-normalization.ts",
      "evidence-contiguity.ts",
      "fixture-provider.ts",
      "rehearsal.ts",
      "examples.ts",
      "index.ts",
    ];
    for (const file of files) {
      const source = readFileSync(join(ROOT, file), "utf8");
      assert.doesNotMatch(source, /@anthropic-ai\/sdk|from "openai"|createAnthropic|runPaidSegmentedPilot/);
      assert.doesNotMatch(source, /saveBookGraph|saveCandidateReview|acceptCanon|writeAccepted/);
    }
  });
});
