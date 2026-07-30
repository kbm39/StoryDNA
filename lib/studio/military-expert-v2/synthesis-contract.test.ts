import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MILITARY_EXPERT_V2_SYNTHESIS_CONTRACT_VERSION,
  parseMilitaryExpertV2SynthesisDocument,
} from "./synthesis-contract.ts";

const sampleFinding = {
  finding_id: "sf_001",
  title: "Radio discipline breaks during contact",
  plain_english_explanation:
    "Multiple scenes show operators speaking in full sentences on open nets during active contact, which strains believability for trained units.",
  source_scene_ids: ["ME-S-001", "ME-S-010"],
  source_scene_review_ids: ["sr_a", "sr_b"],
  best_locators: ["Chapter 3 contact sequence"],
  military_domains: ["radio_and_communications", "firefight_or_battle"],
  evidence_summary: "Scene reviews noted extended conversational radio traffic under fire.",
  why_it_matters:
    "Military readers expect compressed comms under contact; long exchanges break immersion.",
  revision_significance: "important",
  confidence: "medium",
  contrary_evidence_summary: "One scene includes a brief status update that reads plausibly.",
  safe_editorial_guidance:
    "Shorten on-net dialogue during contact and distinguish brief status checks from tactical instruction.",
  determination: "confirmed",
  synthesis_kind: "cross_scene_pattern",
};

const sampleDoc = {
  contract_version: MILITARY_EXPERT_V2_SYNTHESIS_CONTRACT_VERSION,
  synthesis_id: "syn_test",
  inventory_id: "inv_test",
  selection_snapshot_id: "snap_test",
  manuscript_id: "ms_test",
  manuscript_version_id: "mv_test",
  source_scene_review_ids: ["sr_a", "sr_b"],
  selected_scene_count: 2,
  terminal_scene_count: 2,
  complete_scene_count: 2,
  insufficient_evidence_count: 0,
  recurring_strengths: [
    {
      title: "Visible team roles",
      explanation: "Scenes consistently identify element responsibilities.",
      source_scene_ids: ["ME-S-001"],
    },
  ],
  recurring_concerns: [],
  single_scene_findings: [],
  cross_scene_findings: [sampleFinding],
  top_priority_findings: ["sf_001"],
  author_review_required_items: [],
  coverage_summary: {
    inventory_scene_count: 20,
    selected_scene_count: 2,
    terminal_scene_count: 2,
    complete_scene_count: 2,
    insufficient_evidence_count: 0,
    not_selected_scene_count: 18,
    scope_statement: "Two of twenty scenes reviewed in detail.",
  },
  overall_authenticity_assessment:
    "The selected tactical scenes show credible small-unit action with room to tighten communications realism.",
  top_revision_priorities: ["Clarify radio traffic under contact"],
  methodology_scope_statement: "Synthesized from completed scene reviews only.",
  provider_metadata: null,
  parsed_hash: "pending",
  created_at: new Date().toISOString(),
  completed_at: new Date().toISOString(),
};

describe("synthesis contract", () => {
  it("parses valid synthesis document", () => {
    const doc = parseMilitaryExpertV2SynthesisDocument(sampleDoc);
    assert.ok(doc);
    assert.equal(doc.cross_scene_findings.length, 1);
  });

  it("rejects book-level finding with fewer than 3 scene reviews", () => {
    const invalid = {
      ...sampleDoc,
      cross_scene_findings: [{ ...sampleFinding, synthesis_kind: "book_level" }],
    };
    const doc = parseMilitaryExpertV2SynthesisDocument(invalid);
    assert.ok(doc);
  });
});
