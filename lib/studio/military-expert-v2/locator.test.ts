import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatAuthorLocator } from "./locator.ts";

describe("military expert v2 locator formatting", () => {
  it("never renders approximate page as exact", () => {
    const label = formatAuthorLocator({
      exact_page_number: 112,
      page_is_approximate: true,
      chapter_label: null,
      scene_heading: null,
      approximate_book_percentage: 45,
      internal_start_offset: 1000,
      internal_end_offset: 2000,
    });
    assert.match(label, /^approx\./);
  });

  it("uses chapter label when no page available", () => {
    const label = formatAuthorLocator({
      exact_page_number: null,
      page_is_approximate: false,
      chapter_label: "Chapter 24",
      scene_heading: "Birthday gift",
      approximate_book_percentage: 96,
      internal_start_offset: 1000,
      internal_end_offset: 2000,
    });
    assert.equal(label, "Chapter 24 · Birthday gift");
  });

  it("falls back to percentage — not internal offsets", () => {
    const label = formatAuthorLocator({
      exact_page_number: null,
      page_is_approximate: false,
      chapter_label: null,
      scene_heading: null,
      approximate_book_percentage: 76,
      internal_start_offset: 455200,
      internal_end_offset: 458900,
    });
    assert.match(label, /76%/);
    assert.doesNotMatch(label, /455200/);
  });
});
