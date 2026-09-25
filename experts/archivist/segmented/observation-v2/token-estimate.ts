import { emptySegmentObservation } from "../observation-contract.ts";
import { estimateJsonTokens } from "./compactness.ts";
import { rule8V2FixtureDocument } from "./fixtures.ts";

/**
 * $0 design estimate only. V1 repeats the same excerpt across fact groups.
 * V2 stores one observation plus typed payload.
 */
export function estimateV2TokenFootprint(): {
  v2_fixture_tokens: number;
  v1_duplicated_equivalent_tokens: number;
  v2_to_v1_ratio: number;
  note: string;
} {
  const v2 = rule8V2FixtureDocument();
  const v2Tokens = estimateJsonTokens(v2);
  const v1Shape = emptySegmentObservation("seg-rule8-v2-fixture");
  const clonedFacts = v2.observations.map((observation, index) => ({
    id: `v1-${index}`,
    alias: observation.proposition.subject,
    entity_type: "person",
    fact_type: "chronology",
    value: { ...observation.payload, kind: observation.kind },
    temporal_scope: { kind: "at", chapter: observation.evidence.locator },
    locator: { locator: observation.evidence.locator, chapter: observation.evidence.locator },
    excerpt: observation.evidence.excerpt,
    confidence: observation.confidence,
    inferred: false,
  }));
  const duplicated = {
    ...v1Shape,
    candidate_facts: clonedFacts,
    events: clonedFacts,
    chronology: clonedFacts,
    knowledge: clonedFacts,
    injuries: clonedFacts,
    locations: clonedFacts,
  };
  const v1Tokens = estimateJsonTokens(duplicated);
  return {
    v2_fixture_tokens: v2Tokens,
    v1_duplicated_equivalent_tokens: v1Tokens,
    v2_to_v1_ratio: Number((v2Tokens / v1Tokens).toFixed(3)),
    note:
      "V2 is a single observations array. A V1-shaped dump of the same evidence across six groups is several times larger.",
  };
}
