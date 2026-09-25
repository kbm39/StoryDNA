import { RULE8_VERIFIED_CASES } from "./fixture.ts";
import type { ReckoningRule8FactMap } from "./types.ts";

export const RULE8_RELEVANT_FACT_SIGNATURES = [
  "injury:Cole:ribs_cracked:bilateral",
  "injury:Cole:third_and_fourth:left",
  "injury:Cole:rib_fracture",
  "injury:Cole:third_and_fourth_on_the_left",
  "injury:Cole:left_arm_and_right_side_chest",
  "injury:Cole:chest_round_right_tracked_near_third",
  "injury:Cole:chest_tracked_near_basement_third_rib",
  "relationship:Cyrus:real_name_Ibrahim",
] as const;

export function buildRule8FactMap(
  retainedFactCount = 126,
  relevantSignatures: readonly string[] = RULE8_RELEVANT_FACT_SIGNATURES,
): ReckoningRule8FactMap {
  const defectsWithZero = RULE8_VERIFIED_CASES
    .filter((item) => item.relevant_retained_fact_count === 0)
    .map((item) => item.benchmark_id);
  return {
    retained_fact_count: retainedFactCount,
    relevant_fact_count: relevantSignatures.length,
    irrelevant_fact_count: retainedFactCount - relevantSignatures.length,
    relevant_fact_signatures: [...relevantSignatures],
    defects_with_zero_relevant_facts: defectsWithZero,
  };
}
