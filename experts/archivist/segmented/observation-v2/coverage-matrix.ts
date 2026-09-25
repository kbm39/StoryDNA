import { RULE8_VERIFIED_CASES } from "@/experts/archivist/benchmarks/reckoning-rule8/fixture.ts";
import type { V2CoverageRow, V2PairingInterface } from "./types.ts";

export const RULE8_V2_COVERAGE_MATRIX: V2CoverageRow[] = [
  {
    benchmark_id: "R8-001",
    required_reasoning: "clock_vs_clock",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-001-ts-0210", kind: "timestamp", role: "side_a", purpose: "0210 discovery clock" },
      { id: "r8-001-ev-found", kind: "event", role: "side_a", purpose: "Lior found hanged" },
      { id: "r8-001-ts-214", kind: "timestamp", role: "side_b", purpose: "2:14 log clock" },
      { id: "r8-001-ts-231", kind: "timestamp", role: "support", purpose: "2:31 file-open clock" },
    ],
  },
  {
    benchmark_id: "R8-004",
    required_reasoning: "clock_vs_clock",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-004-ts-morning", kind: "timestamp", role: "side_a", purpose: "this morning" },
      { id: "r8-004-st-morning", kind: "statement", role: "support", purpose: "talking since this morning" },
      { id: "r8-004-ev-holding", kind: "event", role: "side_b", purpose: "already in holding" },
    ],
  },
  {
    benchmark_id: "R8-005",
    required_reasoning: "statement_vs_event",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-005-st-avi-told", kind: "statement", role: "side_a", purpose: "Avi already told Ari" },
      { id: "r8-005-st-kessler", kind: "statement", role: "side_b", purpose: "Kessler says Avi did not tell" },
    ],
  },
  {
    benchmark_id: "R8-006",
    required_reasoning: "location_presence",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-006-st-capital", kind: "statement", role: "side_a", purpose: "Istanbul called capital" },
      { id: "r8-006-loc-sultanahmet", kind: "location_presence", role: "side_b", purpose: "action slugged Istanbul" },
    ],
  },
  {
    benchmark_id: "R8-007",
    required_reasoning: "object_equipment",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-007-obj-launch", kind: "object_equipment", role: "side_a", purpose: "called a launch" },
      { id: "r8-007-obj-zodiac", kind: "object_equipment", role: "side_b", purpose: "same boat is a Zodiac" },
    ],
  },
  {
    benchmark_id: "R8-010",
    required_reasoning: "operational_capability",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-010-st-air", kind: "statement", role: "side_a", purpose: "air cover unavailable" },
      { id: "r8-010-st-strike", kind: "statement", role: "support", purpose: "strike package unavailable" },
      { id: "r8-010-ev-missiles", kind: "event", role: "support", purpose: "Hank fires two missiles" },
      { id: "r8-010-cap-used", kind: "operational_capability", role: "side_b", purpose: "air cover used" },
    ],
  },
  {
    benchmark_id: "R8-011",
    required_reasoning: "knowledge_acquisition_vs_use",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-011-kn-use", kind: "knowledge", role: "side_a", purpose: "Cole uses numi numi" },
      { id: "r8-011-kn-learn", kind: "knowledge", role: "side_b", purpose: "Ari later teaches the name" },
    ],
  },
  {
    benchmark_id: "R8-012",
    required_reasoning: "relationship_state",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-012-rel-daughter", kind: "relationship", role: "side_a", purpose: "has a daughter" },
      { id: "r8-012-st-child", kind: "statement", role: "side_b", purpose: "tell the child" },
    ],
  },
  {
    benchmark_id: "R8-013",
    required_reasoning: "statement_vs_event",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-013-ev-brief", kind: "event", role: "side_a", purpose: "Mitchell briefed" },
      { id: "r8-013-st-not-told", kind: "statement", role: "side_b", purpose: "Mitchell says not told" },
    ],
  },
  {
    benchmark_id: "R8-014",
    required_reasoning: "location_presence",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-014-st-earpiece", kind: "statement", role: "side_a", purpose: "Cyrus heard the earpiece" },
      { id: "r8-014-loc-stack", kind: "location_presence", role: "side_b", purpose: "Noa on container stack" },
    ],
  },
  {
    benchmark_id: "R8-015",
    required_reasoning: "statement_vs_event",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-015-st-kj", kind: "statement", role: "side_a", purpose: "Preacher names only King James" },
      { id: "r8-015-st-ruth", kind: "statement", role: "side_b", purpose: "Galit names Ruth" },
      { id: "r8-015-kn-galit", kind: "knowledge", role: "support", purpose: "Galit already knows Ruth" },
    ],
  },
  {
    benchmark_id: "R8-016",
    required_reasoning: "statement_vs_event",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-016-st-galit", kind: "statement", role: "side_a", purpose: "Galit ran vetting" },
      { id: "r8-016-st-avi", kind: "statement", role: "side_b", purpose: "vendor vetted" },
    ],
  },
  {
    benchmark_id: "R8-018",
    required_reasoning: "location_presence",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-018-st-dock", kind: "statement", role: "side_a", purpose: "picked up at the dock" },
      { id: "r8-014-loc-stack", kind: "location_presence", role: "side_b", purpose: "Noa on container stack" },
    ],
  },
  {
    benchmark_id: "R8-019",
    required_reasoning: "location_presence",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-019-st-door", kind: "statement", role: "side_a", purpose: "stood in the door" },
      { id: "r8-019-loc-ac", kind: "location_presence", role: "side_b", purpose: "behind the AC unit" },
    ],
  },
  {
    benchmark_id: "R8-020",
    required_reasoning: "injury_state",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-020-inj-bruise", kind: "injury", role: "side_a", purpose: "bruised, not broken" },
      { id: "r8-020-inj-cracked", kind: "injury", role: "side_b", purpose: "cracked ribs" },
    ],
  },
  {
    benchmark_id: "R8-021",
    required_reasoning: "location_presence",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-021-st-tarmac", kind: "statement", role: "side_a", purpose: "hit on this tarmac" },
      { id: "r8-021-loc-izmir", kind: "location_presence", role: "side_b", purpose: "graze at Izmir" },
    ],
  },
  {
    benchmark_id: "R8-023",
    required_reasoning: "identity",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-023-id-contractor", kind: "identity", role: "side_a", purpose: "unlinked contractor" },
      { id: "r8-023-id-ibrahim", kind: "identity", role: "side_b", purpose: "Cyrus also known as Ibrahim" },
      { id: "r8-023-kn-dalia", kind: "knowledge", role: "support", purpose: "Dalia does not recognize him" },
    ],
  },
  {
    benchmark_id: "R8-025",
    required_reasoning: "travel_leg",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-025-ts-0447", kind: "timestamp", role: "side_a", purpose: "Istanbul 0447" },
      { id: "r8-025-travel", kind: "travel_leg", role: "side_b", purpose: "Sikorsky Istanbul to Izmir" },
      { id: "r8-025-ts-0517", kind: "timestamp", role: "support", purpose: "Izmir 0517" },
    ],
  },
  {
    benchmark_id: "R8-026",
    required_reasoning: "clock_vs_clock",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-026-st-flew", kind: "statement", role: "side_a", purpose: "flew the moment she heard" },
      { id: "r8-026-ts-three", kind: "timestamp", role: "side_b", purpose: "Three Days Later" },
    ],
  },
  {
    benchmark_id: "R8-027",
    required_reasoning: "clock_vs_clock",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-027-ts-three", kind: "timestamp", role: "side_a", purpose: "three days" },
      { id: "r8-027-st-three", kind: "statement", role: "support", purpose: "decision running three days" },
      { id: "r8-004-ev-holding", kind: "event", role: "side_b", purpose: "in holding before the compound" },
    ],
  },
  {
    benchmark_id: "R8-029",
    required_reasoning: "injury_state",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-029-inj-right", kind: "injury", role: "side_a", purpose: "right chest wound" },
      { id: "r8-029-inj-left-rib", kind: "injury", role: "side_b", purpose: "left basement third rib" },
      { id: "r8-029-ev-tracked", kind: "event", role: "support", purpose: "same round tracked to that rib" },
    ],
  },
  {
    benchmark_id: "R8-031",
    required_reasoning: "location_presence",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-031-loc-ankara", kind: "location_presence", role: "side_a", purpose: "Viper in Ankara" },
      { id: "r8-031-loc-ta", kind: "location_presence", role: "side_b", purpose: "straight from Tel Aviv" },
    ],
  },
  {
    benchmark_id: "R8-038",
    required_reasoning: "object_equipment",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-038-obj-storage", kind: "object_equipment", role: "side_a", purpose: "storage facility" },
      { id: "r8-038-loc-mall", kind: "location_presence", role: "side_b", purpose: "strip mall" },
    ],
  },
  {
    benchmark_id: "R8-042",
    required_reasoning: "travel_leg",
    representable: true,
    missing_contract_feature: null,
    required_observations: [
      { id: "r8-042-ts-1009", kind: "timestamp", role: "side_a", purpose: "facility 10:09" },
      { id: "r8-042-travel-eilat", kind: "travel_leg", role: "side_b", purpose: "facility to Eilat" },
      { id: "r8-042-ts-forty", kind: "timestamp", role: "support", purpose: "forty minutes later" },
    ],
  },
];

const MATRIX_REASONING: Record<string, V2PairingInterface> = Object.fromEntries(
  RULE8_V2_COVERAGE_MATRIX.map((row) => [row.benchmark_id, row.required_reasoning]),
);

export function expectedReasoningFor(benchmarkId: string): V2PairingInterface | undefined {
  return MATRIX_REASONING[benchmarkId];
}

export function assertMatrixCoversFrozenBenchmark(): string[] {
  const verified = new Set(RULE8_VERIFIED_CASES.map((item) => item.benchmark_id));
  const covered = new Set(RULE8_V2_COVERAGE_MATRIX.map((item) => item.benchmark_id));
  return [...verified].filter((id) => !covered.has(id));
}
