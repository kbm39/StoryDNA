import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countManuscriptWords,
  manuscriptWordsInCharSlice,
  normalizeManuscriptWhitespace,
} from "./word-count.ts";

describe("countManuscriptWords", () => {
  it("returns 0 for null, empty, and whitespace", () => {
    assert.equal(countManuscriptWords(null), 0);
    assert.equal(countManuscriptWords(""), 0);
    assert.equal(countManuscriptWords("   \n\t  "), 0);
  });

  it("collapses repeated whitespace", () => {
    assert.equal(countManuscriptWords("one   two\tthree\nfour"), 4);
  });

  it("keeps contractions as one word", () => {
    assert.equal(countManuscriptWords("don't he's James's"), 3);
    assert.equal(countManuscriptWords("don\u2019t he\u2019s"), 2);
  });

  it("counts hyphenated compounds as one word", () => {
    assert.equal(countManuscriptWords("well-known twenty-one"), 2);
  });

  it("splits on em dashes", () => {
    assert.equal(countManuscriptWords("word1 — word2"), 2);
  });

  it("counts numerals", () => {
    assert.equal(countManuscriptWords("Chapter 42 had 3 ships"), 5);
  });

  it("ignores standalone punctuation", () => {
    assert.equal(countManuscriptWords('"Hello," she said. — Really?'), 4);
  });

  it("strips HTML/XML element tags", () => {
    assert.equal(countManuscriptWords("<p>Hello world</p>"), 2);
    assert.equal(countManuscriptWords("<w:t>Hello world</w:t>"), 2);
    assert.equal(countManuscriptWords("<p>Hello <b>world</b></p>"), 2);
  });

  it("preserves spaced angle brackets as prose, not tags", () => {
    assert.equal(countManuscriptWords("a < b > c"), 3);
  });

  it("strips only valid tag patterns (a<b>c treats <b> as markup)", () => {
    // `<b>` matches the element-tag pattern (name starts with a letter); prose letter b is not counted.
    assert.equal(countManuscriptWords("a<b>c"), 2);
  });

  it("counts non-ASCII letters", () => {
    assert.equal(countManuscriptWords("café résumé naïve"), 3);
  });

  it("counts manuscript text once (no double-count from duplicate blocks in input string)", () => {
    const once = "The quick brown fox jumps over the lazy dog.";
    assert.equal(countManuscriptWords(once), 9);
    assert.equal(countManuscriptWords(`${once} ${once}`), 18);
  });

  it("does not count reviewer report text mixed into a separate string", () => {
    const manuscript = "Hold fast. The reckoning comes.";
    const report = "Estimated 150k words. Grade: B+.";
    assert.equal(countManuscriptWords(manuscript), 5);
    assert.equal(countManuscriptWords(report), 5);
    assert.notEqual(countManuscriptWords(manuscript), countManuscriptWords(`${manuscript} ${report}`));
  });

  it("returns the same result for the same normalized text", () => {
    const text = "  Same   text\u00A0here  ";
    const a = countManuscriptWords(text);
    const b = countManuscriptWords(normalizeManuscriptWhitespace(text));
    assert.equal(a, b);
    assert.equal(a, countManuscriptWords(text));
  });
});

describe("manuscriptWordsInCharSlice", () => {
  it("returns full count when entire text is sent", () => {
    const text = "one two three four five";
    assert.equal(manuscriptWordsInCharSlice(text, text.length), 5);
  });

  it("returns proportional count for partial sends", () => {
    const text = "one two three four five six seven eight nine ten";
    const total = countManuscriptWords(text);
    const half = manuscriptWordsInCharSlice(text, Math.floor(text.length / 2), total);
    assert.ok(half >= 4 && half <= 6);
  });
});

describe("regression: metadata and prompts do not alter manuscript count", () => {
  it("adding JSON metadata keys to a separate blob does not change manuscript-only count", () => {
    const manuscript = "She opened the door and stepped into rain.";
    const metadata = '{"word_count":999999,"title":"Fake"}';
    assert.equal(countManuscriptWords(manuscript), 8);
    assert.notEqual(countManuscriptWords(manuscript), countManuscriptWords(`${manuscript} ${metadata}`));
  });
});
