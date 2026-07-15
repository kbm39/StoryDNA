import assert from "node:assert/strict";
import JSZip from "jszip";
import { describe, it } from "node:test";
import { readDocxSourceWordCount } from "./docx-properties.ts";
import {
  dualWordCountDisplay,
  HOLD_FAST_WORD_COUNT_FIXTURE,
  legacyWhitespaceSplitCount,
  STORYDNA_COUNT_METHOD,
  storyDnaAnalyticalOpening,
  WORD_COUNT_DUAL_EXPLANATION,
} from "./word-count-reporting.ts";
import { authoritativeStatisticsBlock, buildReviewStatistics } from "./review-statistics.ts";
import { resultingWordCountFromCut } from "./rubric-validation.ts";

const APP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Words>${HOLD_FAST_WORD_COUNT_FIXTURE.sourceDocumentWordCount}</Words>
  <Characters>629000</Characters>
</Properties>`;

async function holdFastAppXmlDocx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("docProps/app.xml", APP_XML);
  zip.file("[Content_Types].xml", "<Types></Types>");
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

describe("readDocxSourceWordCount", () => {
  it("reads Microsoft Word <Words> from docProps/app.xml", async () => {
    const buf = await holdFastAppXmlDocx();
    assert.equal(await readDocxSourceWordCount(buf), HOLD_FAST_WORD_COUNT_FIXTURE.sourceDocumentWordCount);
  });

  it("returns null when app.xml is missing", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", "<Types></Types>");
    const buf = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
    assert.equal(await readDocxSourceWordCount(buf), null);
  });
});

describe("Hold Fast dual-count regression", () => {
  const f = HOLD_FAST_WORD_COUNT_FIXTURE;

  it("fixture constants match independent verification", () => {
    assert.equal(f.sourceDocumentWordCount, 111_576);
    assert.equal(f.canonicalWordCount, 111_491);
    assert.equal(f.legacySplitCount, 111_441);
    assert.equal(f.differenceWords, 85);
    assert.equal(f.percentDifference, 0.08);
  });

  it("dual display shows 85-word / 0.08% difference", () => {
    const report = dualWordCountDisplay({
      canonicalWordCount: f.canonicalWordCount,
      sourceDocumentWordCount: f.sourceDocumentWordCount,
    });
    assert.ok(report);
    assert.equal(report!.differenceWords, 85);
    assert.equal(report!.percentDifferenceLabel, "0.08%");
    assert.equal(report!.sourceUnavailable, false);
  });

  it("shows unavailable when embedded Word count is missing", () => {
    const report = dualWordCountDisplay({
      canonicalWordCount: f.canonicalWordCount,
      sourceDocumentWordCount: null,
    });
    assert.ok(report);
    assert.equal(report!.sourceUnavailable, true);
  });

  it("legacy split fixture is distinct from canonical analytical count", () => {
    assert.equal(f.legacySplitCount, 111_441);
    assert.notEqual(f.legacySplitCount, f.canonicalWordCount);
    assert.equal(legacyWhitespaceSplitCount("one two three"), 3);
  });

  it("review statistics use canonical 111491 only", () => {
    const stats = buildReviewStatistics({
      manuscriptId: "ms",
      manuscriptVersionId: "ver",
      extractedText: "word ".repeat(f.canonicalWordCount),
      sentChars: f.canonicalWordCount * 5,
      storedWordCount: f.sourceDocumentWordCount,
    });
    assert.equal(stats.canonical_word_count, f.canonicalWordCount);
    assert.equal(stats.count_method, STORYDNA_COUNT_METHOD);
    assert.notEqual(stats.canonical_word_count, f.sourceDocumentWordCount);
  });

  it("authoritative prompt block exposes canonical_word_count and count_method only", () => {
    const stats = buildReviewStatistics({
      manuscriptId: "ms",
      extractedText: "word ".repeat(f.canonicalWordCount),
      sentChars: f.canonicalWordCount * 5,
    });
    const block = authoritativeStatisticsBlock(stats);
    assert.match(block, /canonical_word_count: 111,491/);
    assert.match(block, /count_method: STORYDNA_UNICODE_V1/);
    assert.match(block, /CANONICAL MANUSCRIPT LENGTH/);
    assert.match(block, /The manuscript is 111,491 words/);
    assert.doesNotMatch(block, /111,576/);
    assert.doesNotMatch(block, /111,441/);
  });

  it("Literary Agent opening sentence uses canonical current-total format", () => {
    assert.equal(
      storyDnaAnalyticalOpening(f.canonicalWordCount),
      "The manuscript is 111,491 words.",
    );
  });

  it("cut arithmetic uses canonical 111491", () => {
    assert.equal(resultingWordCountFromCut(f.canonicalWordCount, 20), 89_193);
    assert.equal(resultingWordCountFromCut(f.canonicalWordCount, 25), 83_618);
  });

  it("includes dual-count explanation constant", () => {
    assert.match(WORD_COUNT_DUAL_EXPLANATION, /Word processors use different tokenization rules/);
    assert.match(WORD_COUNT_DUAL_EXPLANATION, /Unicode-aware analytical counter/);
  });
});
