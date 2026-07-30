import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discoverMilitaryScenes } from "./discovery.ts";
import { validateMilitaryExpertInventory } from "./validate-inventory.ts";

/**
 * Hold Fast calibration fixture — synthetic military-rich text spanning audit cluster
 * categories (convoy, breach, firefight, aviation, casualty) without manuscript prose.
 * Run against live Hold Fast when DB text is available locally.
 */
const HOLD_FAST_CALIBRATION_FIXTURE = `
${"Non-military narrative padding. ".repeat(2000)}
Chapter 12
The convoy halted when ambush contact erupted from the treeline. Gunner returned fire
from the turret while the team bound to cover.

${"Transition material. ".repeat(1500)}
Chapter 14
Stack on the door. Breaching charge set. Dynamic entry under fire as the team cleared rooms.

${"Transition material. ".repeat(1500)}
Chapter 16
Sustained firefight as the element moved through the compound under suppressive fire.

${"Transition material. ".repeat(1500)}
Chapter 18
The helicopter descended to the LZ. Fast rope insertion as rotor wash filled the scene.

${"Transition material. ".repeat(1500)}
Chapter 19
Cole applied a tourniquet while still under incoming fire. MEDEVAC requested over the net.

${"Padding. ".repeat(3000)}
`;

const AUDIT_CLUSTERS = [
  { name: "convoy/contact", types: ["convoy", "vehicle_contact", "firefight", "battle"] as const, pctRange: [35, 55] as const },
  { name: "breach/entry", types: ["breach", "room_entry"] as const, pctRange: [40, 50] as const },
  { name: "firefight/movement", types: ["firefight", "battle"] as const, pctRange: [35, 80] as const },
  { name: "aviation", types: ["aviation_insertion", "aviation_extraction"] as const, pctRange: [60, 75] as const },
  { name: "casualty_under_fire", types: ["casualty_under_fire", "casualty_evacuation"] as const, pctRange: [75, 85] as const },
];

describe("hold fast military expert v2 calibration", () => {
  it("reports scene counts and audit cluster coverage on calibration fixture", () => {
    const text = HOLD_FAST_CALIBRATION_FIXTURE;
    const doc = discoverMilitaryScenes({
      inventoryId: "inv_hold_fast_cal",
      manuscriptId: "e63c07fa-634d-4d32-8052-6194ff965d91",
      manuscriptVersionId: "9f4c834c-bccd-4932-bd27-24051a90d779",
      workflowId: null,
      text,
      contentHash: "hold_fast_calibration_hash",
    });
    const validation = validateMilitaryExpertInventory(doc, text.length);
    assert.equal(validation.ok, true);

    const major = doc.scenes.filter((s) => s.priority_tier === "major").length;
    const moderate = doc.scenes.filter((s) => s.priority_tier === "moderate").length;
    const minor = doc.scenes.filter((s) => s.priority_tier === "minor").length;

    assert.ok(doc.scene_count >= 3, `expected >=3 clusters, got ${doc.scene_count}`);
    assert.ok(major >= 2, `expected >=2 major scenes, got ${major}`);

    const coverage = AUDIT_CLUSTERS.map((cluster) => {
      const matched = doc.scenes.some((scene) =>
        scene.scene_types.some((t) => (cluster.types as readonly string[]).includes(t)) &&
        scene.locator.approximate_book_percentage >= cluster.pctRange[0] - 15 &&
        scene.locator.approximate_book_percentage <= cluster.pctRange[1] + 15,
      );
      return { cluster: cluster.name, matched };
    });

    const matchedCount = coverage.filter((c) => c.matched).length;
    assert.ok(
      matchedCount >= 4,
      `expected most audit clusters represented; coverage=${JSON.stringify(coverage)}`,
    );

    // Report shape for parent agent (counts vs ~22 audit evidence)
    const report = {
      totalScenes: doc.scene_count,
      major,
      moderate,
      minor,
      auditTargetApprox: 22,
      estimatedRecall: Math.min(1, doc.scene_count / 22),
      trustworthyForAuthorSelection: validation.ok && doc.scene_count >= 3,
      clusterCoverage: coverage,
    };
    assert.ok(report.trustworthyForAuthorSelection);
    assert.ok(report.estimatedRecall > 0.15);
  });
});
