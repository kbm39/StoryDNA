import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deepFreeze } from "./deep-freeze.ts";

function expectMutationFailure(fn: () => void, label: string): void {
  assert.throws(fn, TypeError, label);
}

describe("deepFreeze", () => {
  it("freezes nested plain objects and arrays", () => {
    const root = {
      items: [{ id: "a" }],
      meta: { count: 1 },
    };
    const frozen = deepFreeze(root);

    assert.equal(frozen, root);
    assert.ok(Object.isFrozen(root));
    assert.ok(Object.isFrozen(root.items));
    assert.ok(Object.isFrozen(root.items[0]));
    assert.ok(Object.isFrozen(root.meta));

    expectMutationFailure(() => {
      (root as { extra?: string }).extra = "x";
    }, "top-level assignment");
    expectMutationFailure(() => {
      root.meta.count = 2;
    }, "nested assignment");
    expectMutationFailure(() => {
      root.items.push({ id: "b" });
    }, "array push");
  });

  it("handles shared references without infinite recursion", () => {
    const shared = { label: "shared" };
    const root = { a: shared, b: shared };
    deepFreeze(root);

    assert.ok(Object.isFrozen(shared));
    assert.equal(root.a, root.b);
  });

  it("rejects Map values", () => {
    assert.throws(
      () => deepFreeze({ map: new Map([["k", "v"]]) }),
      /unsupported type \[object Map\]/,
    );
  });

  it("rejects Set values", () => {
    assert.throws(
      () => deepFreeze({ set: new Set(["x"]) }),
      /unsupported type \[object Set\]/,
    );
  });

  it("does not mutate the input when deepFreeze throws mid-tree", () => {
    const root = {
      ok: { nested: true },
      bad: new Map(),
    };
    assert.throws(() => deepFreeze(root), /unsupported type \[object Map\]/);
    assert.equal(Object.isFrozen(root), false);
    assert.equal(Object.isFrozen(root.ok), false);
  });
});
