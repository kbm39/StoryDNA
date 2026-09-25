import { RULE8_BENCHMARK_IDENTITY } from "./constants.ts";
import { RULE8_VERIFIED_CASES, RULE8_VERSION_CASES } from "./fixture.ts";
import { RULE8_CONTINUITY_INVENTORY } from "./inventory.ts";
import { buildRule8FactMap } from "./fact-map.ts";
import { scoreVerifiedCases } from "./score.ts";
import { RULE8_OBSERVATION_SCHEMA_GAPS } from "./schema-gap.ts";
import type { ReckoningRule8Applicability } from "./types.ts";

export {
  ARCHIVIST_RECKONING_RULE8_BENCHMARK_VERSION,
} from "./types.ts";
export { RULE8_BENCHMARK_IDENTITY } from "./constants.ts";
export { RULE8_CONTINUITY_INVENTORY } from "./inventory.ts";
export { RULE8_VERIFIED_CASES, RULE8_VERSION_CASES } from "./fixture.ts";
export { scoreVerifiedCases, countExcerptWords } from "./score.ts";
export { RULE8_OBSERVATION_SCHEMA_GAPS, currentFactGroups } from "./schema-gap.ts";
export { RULE8_RELEVANT_FACT_SIGNATURES, buildRule8FactMap } from "./fact-map.ts";

function countApplicability(status: ReckoningRule8Applicability): number {
  return RULE8_CONTINUITY_INVENTORY.filter((item) => item.applicability === status).length;
}

export function loadReckoningRule8Benchmark() {
  const metrics = scoreVerifiedCases(RULE8_VERIFIED_CASES);
  return {
    identity: RULE8_BENCHMARK_IDENTITY,
    inventory: RULE8_CONTINUITY_INVENTORY,
    inventoried: RULE8_CONTINUITY_INVENTORY.length,
    verified: RULE8_VERIFIED_CASES,
    version_cases: RULE8_VERSION_CASES,
    applicability_counts: {
      VERIFIED_IN_REVISED_13: countApplicability("VERIFIED_IN_REVISED_13"),
      PARTIALLY_PRESENT_IN_REVISED_13: countApplicability("PARTIALLY_PRESENT_IN_REVISED_13"),
      NOT_PRESENT_IN_REVISED_13: countApplicability("NOT_PRESENT_IN_REVISED_13"),
      AMBIGUOUS_VERSION_MAPPING: countApplicability("AMBIGUOUS_VERSION_MAPPING"),
      LEDGER_CONFORMANCE_ONLY: countApplicability("LEDGER_CONFORMANCE_ONLY"),
      OUT_OF_SCOPE: countApplicability("OUT_OF_SCOPE"),
    },
    metrics,
    fact_map: buildRule8FactMap(),
    schema_gaps: RULE8_OBSERVATION_SCHEMA_GAPS,
  };
}
