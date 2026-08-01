import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  CONVERSATIONAL_RESPONSE_CONTRACT_VERSION,
  CONVERSATIONAL_RESPONSE_TYPES,
  CONVERSATIONAL_INTELLIGENCE_PROVIDER_MODEL,
} from "./contract.ts";
import { emitConversationalResponse } from "./response-emitter.ts";
import { validateConversationalResponse } from "./validation.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("storydna_conversational_response@v1 contract", () => {
  it("1. contract version is storydna_conversational_response@v1", () => {
    assert.equal(CONVERSATIONAL_RESPONSE_CONTRACT_VERSION, "storydna_conversational_response@v1");
  });

  it("2. four response types exist including type_b_synthesis", () => {
    assert.deepEqual([...CONVERSATIONAL_RESPONSE_TYPES], [
      "acknowledgment",
      "reflection",
      "type_b_synthesis",
      "clarification",
    ]);
  });

  it("3. acknowledgments do not ask questions", () => {
    const response = emitConversationalResponse({
      stage_id: "eic_intake.primary_vision",
      response_type: "acknowledgment",
    });
    assert.equal(response.asks_question, false);
    assert.doesNotMatch(response.content, /\?/);
  });

  it("4. reflections are grounded in author text", () => {
    const response = emitConversationalResponse({
      stage_id: "eic_intake.primary_vision",
      response_type: "reflection",
      author_answer: "A military thriller about loyalty under fire.",
    });
    assert.equal(response.grounded_in_author_text, true);
    assert.match(response.content, /loyalty under fire/i);
  });

  it("5. clarifications ask exactly one question", () => {
    const response = emitConversationalResponse({
      stage_id: "eic_intake.success_definition",
      response_type: "clarification",
      author_answer: "success",
    });
    assert.equal(response.asks_question, true);
    assert.equal((response.content.match(/\?/g) ?? []).length, 1);
  });

  it("6. Phase 1B-ab uses deterministic provider — no manuscript provider import", () => {
    assert.equal(CONVERSATIONAL_INTELLIGENCE_PROVIDER_MODEL, "deterministic@v1");
    const serviceSource = readFileSync(
      join(ROOT, "lib/editorial-understanding/service.ts"),
      "utf8",
    );
    assert.doesNotMatch(serviceSource, /openai|anthropic|@ai-sdk/i);
  });

  it("7. validation rejects compound clarifications", () => {
    const invalid = validateConversationalResponse({
      contract_version: CONVERSATIONAL_RESPONSE_CONTRACT_VERSION,
      response_type: "clarification",
      content: "What genre is it, and who is your audience?",
      stage_id: "eic_intake.market_position",
      grounded_in_author_text: false,
      asks_question: true,
    });
    assert.equal(invalid.ok, false);
  });
});
