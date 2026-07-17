import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalJsonString,
  hashExpertDefinition,
  isValidDefinitionHash,
  verifyExpertDefinitionHash,
} from "./definition-hash.ts";
import { minimalValidExpertDefinition } from "./test-fixtures.ts";

describe("definition-hash", () => {
  it("produces stable hash for same definition", () => {
    const def = minimalValidExpertDefinition();
    const h1 = hashExpertDefinition(def);
    const h2 = hashExpertDefinition(def);
    assert.equal(h1, h2);
    assert.equal(isValidDefinitionHash(h1), true);
  });

  it("is key-order independent", () => {
    const a = { z: 1, a: 2, m: { y: 3, b: 4 } };
    const b = { a: 2, m: { b: 4, y: 3 }, z: 1 };
    assert.equal(hashExpertDefinition(a), hashExpertDefinition(b));
    assert.equal(canonicalJsonString(a), canonicalJsonString(b));
  });

  it("changes hash when definition changes", () => {
    const def1 = minimalValidExpertDefinition();
    const def2 = minimalValidExpertDefinition({
      purpose: { ...def1.purpose, mission: "Different mission" },
    });
    assert.notEqual(hashExpertDefinition(def1), hashExpertDefinition(def2));
  });

  it("preserves array order (semantic order)", () => {
    const a = { items: ["first", "second"] };
    const b = { items: ["second", "first"] };
    assert.notEqual(hashExpertDefinition(a), hashExpertDefinition(b));
  });

  it("verifyExpertDefinitionHash returns true for matching hash", () => {
    const def = minimalValidExpertDefinition();
    const hash = hashExpertDefinition(def);
    assert.equal(verifyExpertDefinitionHash(def, hash), true);
    assert.equal(verifyExpertDefinitionHash(def, "deadbeef".repeat(8)), false);
  });
});
