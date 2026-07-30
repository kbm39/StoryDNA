import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MILITARY_EXPERT_SCENE_REVIEW_CONTRACT_VERSION,
  isVagueSceneReviewText,
  parseMilitaryExpertSceneReviewDocument,
} from "./scene-review-contract.ts";

const basePoint = {
  title: "Clear team roles during entry",
  scene_specific_explanation:
    "The scene identifies which operator holds security versus which element moves first during the breach sequence.",
  why_it_matters:
    "Military readers expect visible team roles so the action remains followable under stress.",
  manuscript_evidence_locator: "mid-scene, after stack formation",
  relevant_military_domains: ["team_coordination", "room_entry_or_breach"],
  confidence: "high",
  revision_significance: "important",
  determination: "confirmed",
};

const sampleReview = {
  contract_version: MILITARY_EXPERT_SCENE_REVIEW_CONTRACT_VERSION,
  scene_review_id: "sr_me-s-001_abc",
  inventory_id: "inv_test",
  selection_snapshot_id: "snap_test",
  scene_id: "ME-S-001",
  manuscript_id: "ms_test",
  manuscript_version_id: "mv_test",
  workflow_id: "wf_test",
  locator: {
    exact_page_number: null,
    page_is_approximate: true,
    chapter_label: "Chapter 1",
    scene_heading: null,
    approximate_book_percentage: 5,
    internal_start_offset: 1000,
    internal_end_offset: 2500,
  },
  scene_types: ["firefight"],
  action_categories: ["firefight_or_battle"],
  participants: ["Alpha Team"],
  review_status: "complete",
  authenticity_strengths: [basePoint],
  authenticity_concerns: [],
  supporting_evidence: [
    {
      excerpt_locator: "opening exchange",
      excerpt_text: "Alpha holds the corridor while Bravo advances.",
      relevance: "Shows basic team split during contact.",
    },
  ],
  contrary_evidence: [],
  safe_editorial_suggestions: [
    {
      suggestion: "Consider clarifying who maintains rear security during the initial exchange.",
      rationale: "Improves reader follow-through without prescribing tactics.",
      addresses_concern_title: null,
    },
  ],
  realism_summary:
    "The scene presents a readable small-unit contact with identifiable roles, though rear-security responsibility could be clearer for military readers.",
  confidence: "medium",
  category_tags: ["firefight_or_battle", "team_coordination"],
  provider_metadata: {
    model: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    input_tokens: 2000,
    output_tokens: 800,
    cost_usd: 0.05,
    correlation_id: "corr_test",
    captured_at: new Date().toISOString(),
  },
  parsed_review_hash: "hash_test",
  retry_count: 0,
  repair_count: 0,
  created_at: new Date().toISOString(),
  completed_at: new Date().toISOString(),
};

describe("military expert scene review contract", () => {
  it("parses valid scene review document", () => {
    const doc = parseMilitaryExpertSceneReviewDocument(sampleReview);
    assert.ok(doc);
    assert.equal(doc.scene_id, "ME-S-001");
  });

  it("rejects vague statements", () => {
    assert.ok(isVagueSceneReviewText("The tactics could be more realistic."));
    assert.ok(isVagueSceneReviewText("Military authenticity needs improvement."));
    assert.ok(!isVagueSceneReviewText(basePoint.scene_specific_explanation));
  });

  it("rejects review with vague concern explanation", () => {
    const doc = parseMilitaryExpertSceneReviewDocument({
      ...sampleReview,
      authenticity_concerns: [
        {
          ...basePoint,
          title: "Generic concern",
          scene_specific_explanation: "The scene is unrealistic.",
          why_it_matters: "Because realism matters.",
        },
      ],
    });
    assert.equal(doc, null);
  });
});
