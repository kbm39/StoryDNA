import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { adaptV2ProviderOutput } from "./adapter.ts";
import { estimateJsonTokens } from "./compactness.ts";
import { applyV4ObservationBudget } from "./observation-budget-v4.ts";
import { V2_PHASE2_HELD_OUT_IDS } from "./phase-2/index.ts";
import {
  V3_BALANCED_FIXTURE_REQUIRED_KINDS,
  V3_BALANCED_FIXTURE_SEGMENT,
} from "./opus-v2-full-manuscript-eval-v2/fixtures.ts";
import {
  V2_EXTRACTION_PROMPT_VERSION,
  V2_PROMPT_MAX_TOKENS,
} from "./prompt.ts";
import {
  V3_EXTRACTION_PROMPT_VERSION,
  V3_PROMPT_MAX_TOKENS,
  buildV3ObservationSystemPrompt,
} from "./prompt-v3.ts";
import { OPUS_V2_EVAL_V2_PROMPT_VERSION } from "./opus-v2-full-manuscript-eval-v2/lock.ts";
import {
  V4_EXTRACTION_PROMPT_VERSION,
  V4_OBSERVATION_HARD_CAP,
  V4_PROMPT_MAX_TOKENS,
  V4_PROMPT_SCHEMA_VERSION,
  V4_PROMPT_WIRED_TO_PAID_PATH,
  assertHistoricalPromptsUnchangedByV4,
  assertV4PromptCoversObservationKinds,
  buildV4ObservationSystemPrompt,
  buildV4ObservationUserPrompt,
  v4PromptKeepsV3Balance,
  v4PromptRemovesClockFirstStarvation,
} from "./prompt-v4.ts";
import type { V2Observation } from "./types.ts";

const ROOT = dirname(fileURLToPath(import.meta.url));

describe("archivist extraction prompt @v4", () => {
  it("does not mutate @v1, @v2, or @v3 identities or 6000-token V3", () => {
    assert.equal(assertHistoricalPromptsUnchangedByV4(), true);
    assert.equal(V2_EXTRACTION_PROMPT_VERSION, "archivist_v2_extraction_prompt@v2");
    assert.equal(V2_PROMPT_MAX_TOKENS, 4000);
    assert.equal(V3_EXTRACTION_PROMPT_VERSION, "archivist_v2_extraction_prompt@v3");
    assert.equal(V3_PROMPT_MAX_TOKENS, 6000);
    assert.equal(OPUS_V2_EVAL_V2_PROMPT_VERSION, "archivist_v2_extraction_prompt@v3");
    assert.match(buildV3ObservationSystemPrompt(), /prefer approximately 10–18/);
  });

  it("publishes @v4 on schema v2 with the same 6000 cap and a hard observation maximum", () => {
    assert.equal(V4_EXTRACTION_PROMPT_VERSION, "archivist_v2_extraction_prompt@v4");
    assert.equal(V4_PROMPT_SCHEMA_VERSION, "archivist_segment_observation@v2");
    assert.equal(V4_PROMPT_MAX_TOKENS, 6000);
    assert.equal(V4_PROMPT_WIRED_TO_PAID_PATH, false);
    assert.equal(V4_OBSERVATION_HARD_CAP, 16);
    assert.deepEqual(assertV4PromptCoversObservationKinds(), []);
    const prompt = buildV4ObservationSystemPrompt();
    assert.equal(v4PromptKeepsV3Balance(), true);
    assert.equal(v4PromptRemovesClockFirstStarvation(), true);
    assert.match(prompt, /HARD OBSERVATION CAP/);
    assert.match(prompt, /at most 16 observations/);
    assert.match(prompt, /Do not emit a second injury for the same entity and the same body_region/);
    assert.doesNotMatch(prompt, /prefer approximately 10–18/);
    assert.doesNotMatch(prompt, /TIER 1 — emit first/);
    const user = buildV4ObservationUserPrompt({
      segmentId: "seg-v4",
      segmentText: V3_BALANCED_FIXTURE_SEGMENT,
    });
    assert.match(user, /Emit at most 16 observations/);
    for (const kind of V3_BALANCED_FIXTURE_REQUIRED_KINDS) {
      assert.equal(prompt.includes(kind), true, `v4 prompt missing ${kind}`);
    }
  });

  it("keeps held-out Rule 8 IDs and Reckoning names out of prompt v4", () => {
    const prompt = buildV4ObservationSystemPrompt();
    const source = readFileSync(join(ROOT, "prompt-v4.ts"), "utf8");
    for (const id of V2_PHASE2_HELD_OUT_IDS) {
      assert.equal(source.includes(id), false, `prompt-v4.ts listed ${id}`);
    }
    assert.doesNotMatch(prompt, /R8-\d{3}/);
    assert.doesNotMatch(source, /hold fast/i);
    assert.equal(prompt.includes("Cole"), false);
    assert.equal(prompt.includes("Ari"), false);
  });

  it("applies the v4 budget without dropping the first distinct injury or travel row", () => {
    const rows = [
      { kind: "injury", entity: "Mara", region: "wrist" },
      { kind: "injury", entity: "Mara", region: "wrist" },
      { kind: "travel_leg", traveler: "Joss", origin: "quay", destination: "outer island" },
      { kind: "travel_leg", traveler: "Joss", origin: "quay", destination: "outer island" },
      { kind: "relationship", subject: "Nia" },
    ].map((row, index) => {
      if (row.kind === "injury") {
        return {
          id: `inj-${index}`,
          kind: "injury",
          payload: { entity: row.entity, body_region: row.region, laterality: "unspecified" },
          proposition: { subject: row.entity!, predicate: "injured", object: row.region!, polarity: "true", source_kind: "narration" },
          evidence: { locator: "CHAPTER TWO", excerpt: "wrist", source_segment: "seg" },
          confidence: "high",
          inferred: false,
        } as V2Observation;
      }
      if (row.kind === "travel_leg") {
        return {
          id: `tr-${index}`,
          kind: "travel_leg",
          payload: { traveler: row.traveler, origin: row.origin, destination: row.destination, mode: "ferry" },
          proposition: { subject: row.traveler!, predicate: "ferry", object: row.destination!, polarity: "true", source_kind: "narration" },
          evidence: { locator: "CHAPTER TWO", excerpt: "ferry", source_segment: "seg" },
          confidence: "high",
          inferred: false,
        } as V2Observation;
      }
      return {
        id: `rel-${index}`,
        kind: "relationship",
        payload: { subject: "Nia", counterparty: "Pax", relationship_type: "sibling", state: "exists" },
        proposition: { subject: "Nia", predicate: "sibling", object: "Pax", polarity: "true", source_kind: "narration" },
        evidence: { locator: "CHAPTER TWO", excerpt: "sister", source_segment: "seg" },
        confidence: "high",
        inferred: false,
      } as V2Observation;
    });
    const budgeted = applyV4ObservationBudget(rows);
    assert.equal(budgeted.dropped_duplicate, 2);
    assert.equal(budgeted.kept.length, 3);
    assert.equal(budgeted.kept.filter((item) => item.kind === "injury").length, 1);
    assert.equal(budgeted.kept.filter((item) => item.kind === "travel_leg").length, 1);
  });

  it("replays workflow b30594ca through the v4 budget and stays under the JSON room", (t) => {
    const rawDir = join(
      ROOT,
      "../../../../.calibration-results/archivist-opus-v2-full-manuscript-eval-v2/raw/b30594ca-c56f-4379-b40b-6a2349f259ed",
    );
    if (!existsSync(rawDir)) {
      t.skip("saved eval-v2 raw archive is not present");
      return;
    }
    const files = readdirSync(rawDir).filter(
      (name) => name.includes("observation") || name.includes("repair"),
    );
    const uncapped: V2Observation[] = [];
    const capped: V2Observation[] = [];
    const perSegment: number[] = [];
    for (const file of files) {
      const raw = JSON.parse(readFileSync(join(rawDir, file), "utf8")) as {
        raw_text?: string;
        segment_id?: string;
        finish_reason?: string;
      };
      const adapted = adaptV2ProviderOutput(raw.raw_text, raw.segment_id, {
        finishReason: raw.finish_reason,
      });
      uncapped.push(...adapted.retained);
      const budgeted = applyV4ObservationBudget(adapted.retained);
      capped.push(...budgeted.kept);
      perSegment.push(budgeted.kept.length);
      assert.ok(budgeted.kept.length <= V4_OBSERVATION_HARD_CAP);
    }
    const uncappedTokens = estimateJsonTokens(uncapped);
    const cappedTokens = estimateJsonTokens(capped);
    assert.ok(capped.length <= uncapped.length);
    assert.ok(cappedTokens < uncappedTokens);
    assert.ok(capped.filter((item) => item.kind === "injury").length >= 4);
    assert.ok(capped.filter((item) => item.kind === "travel_leg").length >= 3);
    assert.ok(capped.filter((item) => item.kind === "relationship").length >= 6);
    assert.ok(capped.filter((item) => item.kind === "identity").length >= 4);
    assert.ok(capped.filter((item) => item.kind === "location_presence").length >= 6);
    assert.ok(Math.max(...perSegment) <= 16);
    assert.ok(
      cappedTokens / files.length < 3500,
      `mean capped JSON tokens ${cappedTokens / files.length} should stay under 3500`,
    );
  });
});
