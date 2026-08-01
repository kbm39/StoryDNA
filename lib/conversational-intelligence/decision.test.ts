import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateFollowUpDecision, scoreStageConfidence } from "./decision.ts";

describe("follow-up decision model", () => {
  it("1. adequate long answer reflects and continues", () => {
    const result = evaluateFollowUpDecision({
      stage_id: "eic_intake.primary_vision",
      understanding_field: "primary_vision",
      author_answer:
        "A military thriller about a squad navigating loyalty and loss, set during a contested deployment where every decision carries moral weight.",
      skipped: false,
      required: true,
      clarification_already_used: false,
      is_clarification_follow_up: false,
    });
    assert.equal(result.outcome, "reflect_and_continue");
    assert.equal(result.advance_stage, true);
  });

  it("2. short required answer triggers clarify_once when material", () => {
    const result = evaluateFollowUpDecision({
      stage_id: "eic_intake.primary_vision",
      understanding_field: "primary_vision",
      author_answer: "War book",
      skipped: false,
      required: true,
      clarification_already_used: false,
      is_clarification_follow_up: false,
    });
    assert.equal(result.outcome, "clarify_once");
    assert.equal(result.response_type, "clarification");
    assert.equal(result.advance_stage, false);
  });

  it("3. max one clarification per stage — second pass acknowledges", () => {
    const result = evaluateFollowUpDecision({
      stage_id: "eic_intake.primary_vision",
      understanding_field: "primary_vision",
      author_answer: "War",
      skipped: false,
      required: true,
      clarification_already_used: true,
      is_clarification_follow_up: false,
    });
    assert.notEqual(result.outcome, "clarify_once");
    assert.equal(result.advance_stage, false);
  });

  it("4. unsure answer is adequate without clarification", () => {
    const result = evaluateFollowUpDecision({
      stage_id: "eic_intake.market_position",
      understanding_field: "market_position",
      author_answer: "unsure",
      skipped: false,
      required: true,
      clarification_already_used: false,
      is_clarification_follow_up: false,
    });
    assert.equal(result.outcome, "acknowledge_and_continue");
    assert.equal(scoreStageConfidence({
      stage_id: "eic_intake.market_position",
      author_answer: "unsure",
      skipped: false,
      required: true,
      is_clarification_follow_up: false,
    }), 0.5);
  });

  it("5. optional skipped stage uses author_skipped_optional", () => {
    const result = evaluateFollowUpDecision({
      stage_id: "eic_intake.desired_reader_experience",
      understanding_field: "desired_reader_experience",
      author_answer: null,
      skipped: true,
      required: false,
      clarification_already_used: false,
      is_clarification_follow_up: false,
    });
    assert.equal(result.outcome, "author_skipped_optional");
    assert.equal(result.advance_stage, true);
  });

  it("6. clarification follow-up advances with acknowledgment", () => {
    const result = evaluateFollowUpDecision({
      stage_id: "eic_intake.success_definition",
      understanding_field: "success_definition",
      author_answer: "Query-ready for literary agents",
      skipped: false,
      required: true,
      clarification_already_used: true,
      is_clarification_follow_up: true,
    });
    assert.equal(result.outcome, "acknowledge_and_continue");
    assert.ok(result.confidence_score >= 0.7);
    assert.equal(result.advance_stage, true);
  });

  it("7. unsafe input is blocked", () => {
    const result = evaluateFollowUpDecision({
      stage_id: "eic_intake.primary_vision",
      understanding_field: "primary_vision",
      author_answer: '<script>alert("x")</script>',
      skipped: false,
      required: true,
      clarification_already_used: false,
      is_clarification_follow_up: false,
    });
    assert.equal(result.outcome, "blocked_unsafe_or_invalid");
  });
});
