import { RULE8_V2_COVERAGE_MATRIX } from "./coverage-matrix.ts";
import { RULE8_V2_FIXTURE_OBSERVATIONS } from "./fixtures.ts";
import { classifyV2PairingInterface } from "./pairing-interface.ts";
import { validateSegmentObservationV2 } from "./validate.ts";
import { rule8V2FixtureDocument } from "./fixtures.ts";
import type { V2Observation, V2RepresentabilityReport } from "./types.ts";

function byId(id: string): V2Observation | undefined {
  return RULE8_V2_FIXTURE_OBSERVATIONS.find((item) => item.id === id);
}

export function scoreV2Representability(): V2RepresentabilityReport {
  const document = rule8V2FixtureDocument();
  const validated = validateSegmentObservationV2(document);
  const notRepresentable: string[] = [];
  const missing: string[] = [];
  if (!validated.ok) {
    return {
      total_verified: RULE8_V2_COVERAGE_MATRIX.length,
      representable: 0,
      not_representable: RULE8_V2_COVERAGE_MATRIX.map((row) => row.benchmark_id),
      missing_features: validated.errors,
    };
  }
  for (const row of RULE8_V2_COVERAGE_MATRIX) {
    const observations = row.required_observations.map((item) => byId(item.id));
    if (observations.some((item) => !item)) {
      notRepresentable.push(row.benchmark_id);
      missing.push(`${row.benchmark_id}: missing fixture observation`);
      continue;
    }
    const sideA = observations[row.required_observations.findIndex((item) => item.role === "side_a")];
    const sideB = observations[row.required_observations.findIndex((item) => item.role === "side_b")];
    if (!sideA || !sideB) {
      notRepresentable.push(row.benchmark_id);
      missing.push(`${row.benchmark_id}: missing side`);
      continue;
    }
    const iface = classifyV2PairingInterface(sideA, sideB);
    if (iface === "not_comparable" || iface !== row.required_reasoning) {
      notRepresentable.push(row.benchmark_id);
      missing.push(`${row.benchmark_id}: pairing interface ${iface}, expected ${row.required_reasoning}`);
    }
  }
  return {
    total_verified: RULE8_V2_COVERAGE_MATRIX.length,
    representable: RULE8_V2_COVERAGE_MATRIX.length - notRepresentable.length,
    not_representable: notRepresentable,
    missing_features: missing,
  };
}
