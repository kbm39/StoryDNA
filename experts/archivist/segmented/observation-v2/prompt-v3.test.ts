import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { V2_PHASE2_HELD_OUT_IDS } from "./phase-2/index.ts";
import {
  V2_EXTRACTION_PROMPT_VERSION,
  V2_PROMPT_MAX_TOKENS,
  assertHistoricalV1PromptPreserved,
  buildV2ObservationSystemPrompt,
  buildV2ObservationUserPrompt,
} from "./prompt.ts";
import {
  V3_EXTRACTION_PROMPT_VERSION,
  V3_ORGANIZATION_AFFILIATION_MAPPING,
  V3_OUTPUT_ORDER_INSTRUCTION,
  V3_PROMPT_MAX_TOKENS,
  V3_PROMPT_SCHEMA_VERSION,
  V3_PROMPT_WIRED_TO_PAID_PATH,
  assertHistoricalPromptsUnchangedByV3,
  assertV3PromptCoversObservationKinds,
  buildV3ObservationSystemPrompt,
  buildV3ObservationUserPrompt,
  v3PromptForbidsEditorialOutput,
  v3PromptRemovesClockFirstStarvation,
} from "./prompt-v3.ts";
import {
  V3_BALANCED_FIXTURE_DIMENSIONS,
  V3_BALANCED_FIXTURE_REQUIRED_KINDS,
  V3_BALANCED_FIXTURE_SEGMENT,
} from "./opus-v2-full-manuscript-eval-v2/fixtures.ts";

const ROOT = dirname(fileURLToPath(import.meta.url));

const HELD_OUT_FORBIDDEN = [
  ...V2_PHASE2_HELD_OUT_IDS,
  "Cole",
  "Ari",
  "Hank",
  "Preacher",
  "numi numi",
  "REVISED-13",
] as const;

describe("archivist extraction prompt @v3", () => {
  it("preserves historical @v1 and @v2 identities and 4000-token V2 prompt", () => {
    assert.equal(assertHistoricalV1PromptPreserved(), true);
    assert.equal(V2_EXTRACTION_PROMPT_VERSION, "archivist_v2_extraction_prompt@v2");
    assert.equal(V2_PROMPT_MAX_TOKENS, 4000);
    assert.match(buildV2ObservationSystemPrompt(), /TIER 1 — emit first/);
    assert.match(buildV2ObservationUserPrompt({
      segmentId: "seg-v2",
      segmentText: "placeholder",
    }), /Emit Tier 1 before Tier 2/);
    assert.equal(assertHistoricalPromptsUnchangedByV3(), true);
  });

  it("publishes a new @v3 identity on schema v2 with max_tokens 6000", () => {
    assert.equal(V3_EXTRACTION_PROMPT_VERSION, "archivist_v2_extraction_prompt@v3");
    assert.equal(V3_PROMPT_SCHEMA_VERSION, "archivist_segment_observation@v2");
    assert.equal(V3_PROMPT_MAX_TOKENS, 6000);
    assert.equal(V3_PROMPT_WIRED_TO_PAID_PATH, false);
    assert.equal(V3_OUTPUT_ORDER_INSTRUCTION, "manuscript_appearance_order");
    assert.deepEqual(assertV3PromptCoversObservationKinds(), []);
  });

  it("removes clock-first starvation and requires a balanced scan", () => {
    const prompt = buildV3ObservationSystemPrompt();
    assert.equal(v3PromptRemovesClockFirstStarvation(), true);
    assert.match(prompt, /SCAN FIRST\. EMIT SECOND/);
    assert.match(prompt, /BALANCED set of observations/);
    assert.match(prompt, /Do not exhaust any single kind/);
    assert.match(prompt, /Do not emit all timestamps before other kinds/);
    assert.doesNotMatch(prompt, /TIER 1 — emit first/);
    assert.doesNotMatch(prompt, /Emit Tier 1 before Tier 2/);
    assert.doesNotMatch(prompt, /Finish all high-value observations before incidental observations/);
  });

  it("requires timestamp discipline, injury, travel, relationship, identity, location, object, capability, and knowledge", () => {
    const prompt = buildV3ObservationSystemPrompt();
    assert.match(prompt, /TIMESTAMP DISCIPLINE/);
    assert.match(prompt, /Do not extract every temporal expression/);
    assert.match(prompt, /Do not produce a timestamp dump/);
    assert.match(prompt, /INJURY — scan the entire segment/);
    assert.match(prompt, /kind=injury/);
    assert.match(prompt, /laterality='unspecified'/);
    assert.match(prompt, /Do not leave an explicit injury represented only as a generic statement/);
    assert.match(prompt, /TRAVEL — scan the entire segment/);
    assert.match(prompt, /kind=travel_leg/);
    assert.match(prompt, /Do not leave a continuity-relevant journey represented only as timestamps/);
    assert.match(prompt, /RELATIONSHIP — scan for persistent relationships/);
    assert.match(prompt, /spouse, parent, child, sibling, colleague/);
    assert.match(prompt, /Do not infer unstated family relationships/);
    assert.match(prompt, /IDENTITY — scan for full name/);
    assert.match(prompt, /prefer that explicit surface name/);
    assert.match(prompt, /LOCATION \/ PRESENCE/);
    assert.match(prompt, /Do not rely only on a timestamp locator when character presence itself is a continuity fact/);
    assert.match(prompt, /OBJECT \/ EQUIPMENT/);
    assert.match(prompt, /emit a second object_equipment observation/);
    assert.match(prompt, /OPERATIONAL CAPABILITY/);
    assert.match(prompt, /available \| unavailable \| unknown \| used/);
    assert.match(prompt, /Use before acquisition/);
    assert.match(prompt, /known: character explicitly uses/);
    assert.match(prompt, /learned: character receives an explanation/);
  });

  it("maps organization\/affiliation onto existing kinds and forbids contradiction hunting", () => {
    const prompt = buildV3ObservationSystemPrompt();
    assert.equal(V3_ORGANIZATION_AFFILIATION_MAPPING.schema_kind_added, false);
    assert.match(prompt, /ORGANIZATION \/ AFFILIATION — no new schema kind/);
    assert.match(prompt, /Do not invent an organization observation kind/);
    assert.equal(v3PromptForbidsEditorialOutput(), true);
    assert.match(prompt, /Do not find contradictions/);
    assert.match(prompt, /Do not find continuity errors/);
    assert.match(prompt, /Do not ask: What is inconsistent\?/);
    assert.match(prompt, /Do not ask: Find continuity errors/);
    assert.match(prompt, /prefer approximately 10–18 continuity-grade observations/);
    assert.match(prompt, /DIVERSITY CHECK BEFORE FINALIZING JSON/);
    assert.match(prompt, /manuscript appearance order/);
    const user = buildV3ObservationUserPrompt({
      segmentId: "seg-v3",
      segmentText: V3_BALANCED_FIXTURE_SEGMENT,
    });
    assert.match(user, /manuscript appearance order/);
    assert.doesNotMatch(user, /Emit Tier 1 before Tier 2/);
  });

  it("asks the synthetic fixture to cover every required continuity dimension at \$0", () => {
    const prompt = buildV3ObservationSystemPrompt();
    const user = buildV3ObservationUserPrompt({
      segmentId: "seg-v3-balanced-synthetic",
      segmentText: V3_BALANCED_FIXTURE_SEGMENT,
    });
    for (const kind of V3_BALANCED_FIXTURE_REQUIRED_KINDS) {
      assert.equal(prompt.includes(kind), true, `v3 prompt missing ${kind}`);
    }
    assert.match(V3_BALANCED_FIXTURE_SEGMENT, /06:10/);
    assert.match(V3_BALANCED_FIXTURE_SEGMENT, /06:50/);
    assert.match(V3_BALANCED_FIXTURE_SEGMENT, /left wrist/);
    assert.match(V3_BALANCED_FIXTURE_SEGMENT, /harbor launch/);
    assert.match(V3_BALANCED_FIXTURE_SEGMENT, /brother/);
    assert.match(V3_BALANCED_FIXTURE_SEGMENT, /Warden/);
    assert.match(V3_BALANCED_FIXTURE_SEGMENT, /brass compass/);
    assert.match(V3_BALANCED_FIXTURE_SEGMENT, /radio is dead/);
    assert.match(V3_BALANCED_FIXTURE_SEGMENT, /fired its only flare/);
    assert.match(V3_BALANCED_FIXTURE_SEGMENT, /Blue means the cache is live/);
    assert.match(V3_BALANCED_FIXTURE_SEGMENT, /chart table/);
    assert.equal(V3_BALANCED_FIXTURE_DIMENSIONS.alias.includes("Warden"), true);
    assert.match(user, /SEGMENT TEXT:/);
  });

  it("keeps held-out Rule 8 IDs and Reckoning names out of prompt v3 and the synthetic fixture", () => {
    const prompt = buildV3ObservationSystemPrompt();
    const fixture = readFileSync(join(ROOT, "opus-v2-full-manuscript-eval-v2/fixtures.ts"), "utf8");
    const source = readFileSync(join(ROOT, "prompt-v3.ts"), "utf8");
    for (const needle of HELD_OUT_FORBIDDEN) {
      assert.equal(prompt.includes(needle), false, `v3 prompt leaked ${needle}`);
      assert.equal(V3_BALANCED_FIXTURE_SEGMENT.includes(needle), false, `fixture leaked ${needle}`);
    }
    for (const id of V2_PHASE2_HELD_OUT_IDS) {
      assert.equal(source.includes(id), false, `prompt-v3.ts listed ${id}`);
      assert.equal(fixture.includes(id), false, `v3 fixture listed ${id}`);
    }
    assert.doesNotMatch(prompt, /R8-\d{3}/);
    assert.doesNotMatch(source, /hold fast/i);
  });
});
