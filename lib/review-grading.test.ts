import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { letterGradeFromScore, letterGradeMatchesScore } from "./grade-calculation.ts";
import {
  resultingWordCountFromCut,
  validateLengthRecommendations,
  validateCommercialRubric,
  extractRubricPayload,
  validateRubricCategoryKeys,
} from "./rubric-validation.ts";
import {
  validateWordCountClaims,
  REVIEW_BLOCKED_STATISTICS_MESSAGE,
} from "./word-count-validation.ts";
import { buildReviewStatistics } from "./review-statistics.ts";
import {
  validateCommercialReviewContent,
  firstWordCountContradiction,
  buildReviewGradingRecord,
  validateCommercialMemoOnly,
} from "./commercial-review-pipeline.ts";
import {
  validateProseLetterGrade,
  normalizeProseGradeLine,
  REVIEW_BLOCKED_PROSE_GRADE_MESSAGE,
} from "./prose-grade-validation.ts";
import {
  buildCommercialReviewRepairPrompt,
  normalizeCommercialReviewStatisticsText,
} from "./commercial-review-repair.ts";
import type { CommercialRubricPayload, RubricCategoryScore } from "./commercial-fiction-rubric.ts";
import {
  ACQUISITION_CATEGORIES,
  CRAFT_CATEGORIES,
  REQUIRED_ACQUISITION_KEYS,
  REQUIRED_CRAFT_KEYS,
} from "./commercial-fiction-rubric.ts";

import { storyDnaAnalyticalOpening } from "./word-count-reporting.ts";

const CANONICAL = 108_845;
const EXACT_OPENING = storyDnaAnalyticalOpening(CANONICAL);

function sampleCategory(
  key: string,
  name: string,
  max: number,
  earned: number,
): RubricCategoryScore {
  return {
    category_key: key,
    category_name: name,
    points_earned: earned,
    maximum_points: max,
    deduction: max - earned,
    weighted_contribution: earned,
    confidence: "high",
    strengths: ["Specific opening hook in Ch. 1"],
    deductions: earned < max ? ["Midsection pacing sags in Ch. 12–14"] : [],
    deduction_reasons: earned < max ? ["Extended aftermath dilutes tension"] : [],
    revision_to_recover: "Tighten Ch. 12–14 aftermath by 15%",
    examples: [
      { text: "She gripped the wheel when the sirens started.", location: "Ch. 1" },
      { text: "The warehouse confrontation pays off the setup from Ch. 3.", location: "Ch. 18" },
    ],
  };
}

function fullRubricPayload(craftEarned: number[], acqEarned: number[]): CommercialRubricPayload {
  return {
    craft_categories: CRAFT_CATEGORIES.map((c, i) =>
      sampleCategory(c.key, c.name, c.max, craftEarned[i] ?? c.max),
    ),
    acquisition_categories: ACQUISITION_CATEGORIES.map((c, i) =>
      sampleCategory(c.key, c.name, c.max, acqEarned[i] ?? c.max),
    ),
    length_recommendations: [],
  };
}

function rubricJson(payload: CommercialRubricPayload): string {
  return `${EXACT_OPENING}\n\nMemo text here.\n\n<!-- STORYDNA_RUBRIC_JSON -->\n${JSON.stringify(payload)}`;
}

describe("word count validation", () => {
  it("passes exact canonical count", () => {
    const r = validateWordCountClaims(EXACT_OPENING, CANONICAL);
    assert.equal(r.valid, true);
  });

  it('passes "108,845 words" with exact statement', () => {
    const r = validateWordCountClaims(
      `${EXACT_OPENING} Total length confirmed at 108,845 words.`,
      CANONICAL,
    );
    assert.equal(r.valid, true);
  });

  it("fails when exact canonical statement is missing", () => {
    const r = validateWordCountClaims("This draft is long but well paced.", CANONICAL);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("exactly one current-total")));
  });

  it('accepts "about 109,000 words" within editorial tolerance near canonical', () => {
    const r = validateWordCountClaims(
      `${EXACT_OPENING} At about 109,000 words, pacing is an issue.`,
      CANONICAL,
    );
    assert.equal(r.valid, true);
  });

  it('fails "150,000 words"', () => {
    const r = validateWordCountClaims(
      `${EXACT_OPENING} This 150,000 word manuscript needs cuts.`,
      CANONICAL,
    );
    assert.equal(r.valid, false);
  });

  it('fails "150k-ish"', () => {
    const r = validateWordCountClaims(
      `${EXACT_OPENING} A 150k-ish draft with commercial potential.`,
      CANONICAL,
    );
    assert.equal(r.valid, false);
  });

  it('fails "175,000 words"', () => {
    const r = validateWordCountClaims(
      `${EXACT_OPENING} At 175,000 words it is oversized.`,
      CANONICAL,
    );
    assert.equal(r.valid, false);
  });

  describe("Hold Fast regression — prohibited length claims", () => {
    const prohibited = [
      "This is a 150k-ish draft.",
      "The manuscript is comfortably north of 130,000 words.",
      "There is a 105–115k book inside this.",
      "Cut 20–25% to reach 105–115k.",
    ];

    for (const phrase of prohibited) {
      it(`fails: "${phrase}"`, () => {
        const r = validateWordCountClaims(`${EXACT_OPENING} ${phrase}`, CANONICAL);
        assert.equal(r.valid, false);
      });
    }
  });

  it("validates cut arithmetic: 20% of 108845 ≈ 87076", () => {
    assert.equal(resultingWordCountFromCut(CANONICAL, 20), 87_076);
    const r = validateWordCountClaims(
      `${EXACT_OPENING} A 20% cut yields approximately 87,076 words.`,
      CANONICAL,
    );
    assert.equal(r.valid, true);
  });

  it("words_analyzed cannot replace canonical_word_count in statistics object", () => {
    const stats = buildReviewStatistics({
      manuscriptId: "m1",
      extractedText: "word ".repeat(CANONICAL),
      sentChars: 50_000,
      storedWordCount: CANONICAL,
    });
    assert.equal(stats.canonical_word_count, CANONICAL);
    assert.ok(stats.words_analyzed < stats.canonical_word_count);
    assert.notEqual(stats.words_analyzed, stats.canonical_word_count);
  });

  it("text-derived count is authoritative over a stale stored DB count", () => {
    const stats = buildReviewStatistics({
      manuscriptId: "m1",
      extractedText: "Hold fast. The reckoning comes.",
      sentChars: 100,
      storedWordCount: CANONICAL,
    });
    assert.equal(stats.canonical_word_count, 5);
    assert.notEqual(stats.canonical_word_count, CANONICAL);
  });

  it("falls back to stored count when extracted text is empty", () => {
    const stats = buildReviewStatistics({
      manuscriptId: "m1",
      extractedText: "",
      sentChars: 0,
      storedWordCount: CANONICAL,
    });
    assert.equal(stats.canonical_word_count, CANONICAL);
  });
});

describe("grade calculation", () => {
  it("78 produces C+", () => assert.equal(letterGradeFromScore(78), "C+"));
  it("84 produces B", () => assert.equal(letterGradeFromScore(84), "B"));
  it("89 produces B+", () => assert.equal(letterGradeFromScore(89), "B+"));
  it("92 produces A-", () => assert.equal(letterGradeFromScore(92), "A-"));
  it("97 produces A+", () => assert.equal(letterGradeFromScore(97), "A+"));
  it("letter grade matches band", () => {
    assert.equal(letterGradeMatchesScore("C+", 78), true);
    assert.equal(letterGradeMatchesScore("B", 78), false);
  });
});

describe("rubric validation", () => {
  it("category total equals subtotals and overall", () => {
    const craft = [7, 9, 9, 9, 8, 6, 5, 7];
    const acq = [6, 5, 4, 3, 4, 2];
    const payload = fullRubricPayload(craft, acq);
    const total = craft.reduce((a, b) => a + b, 0) + acq.reduce((a, b) => a + b, 0);
    const result = validateCommercialRubric({
      payload,
      parseError: null,
      canonicalWordCount: CANONICAL,
      fullTextSupplied: true,
      statisticsValid: true,
    });
    assert.equal(result.manuscriptScore, total);
    assert.equal(result.craftScore, craft.reduce((a, b) => a + b, 0));
    assert.equal(result.acquisitionScore, acq.reduce((a, b) => a + b, 0));
    assert.equal(result.valid, true);
  });

  it("category cannot exceed maximum", () => {
    const payload = fullRubricPayload(CRAFT_CATEGORIES.map((c) => c.max + 1), ACQUISITION_CATEGORIES.map(() => 0));
    const result = validateCommercialRubric({
      payload,
      parseError: null,
      canonicalWordCount: CANONICAL,
      fullTextSupplied: true,
      statisticsValid: true,
    });
    assert.equal(result.valid, false);
  });

  it("missing evidence blocks final grade", () => {
    const payload = fullRubricPayload(CRAFT_CATEGORIES.map(() => 5), ACQUISITION_CATEGORIES.map(() => 3));
    payload.craft_categories[0].examples = [];
    payload.craft_categories[0].insufficient_evidence = true;
    const result = validateCommercialRubric({
      payload,
      parseError: null,
      canonicalWordCount: CANONICAL,
      fullTextSupplied: true,
      statisticsValid: true,
    });
    assert.equal(result.valid, false);
    assert.equal(result.gradeStatus, "WITHHELD — INSUFFICIENT EVIDENCE");
  });

  it("partial coverage creates provisional status", () => {
    const payload = fullRubricPayload(CRAFT_CATEGORIES.map(() => 5), ACQUISITION_CATEGORIES.map(() => 3));
    const result = validateCommercialRubric({
      payload,
      parseError: null,
      canonicalWordCount: CANONICAL,
      fullTextSupplied: false,
      statisticsValid: true,
    });
    assert.equal(result.gradeStatus, "PROVISIONAL_PARTIAL_COVERAGE");
    assert.equal(result.valid, true);
  });
});

describe("length math", () => {
  it("108845 minus 10% ≈ 97961", () => {
    assert.equal(resultingWordCountFromCut(CANONICAL, 10), 97_961);
  });
  it("108845 minus 20% ≈ 87076", () => {
    assert.equal(resultingWordCountFromCut(CANONICAL, 20), 87_076);
  });
  it("108845 minus 25% ≈ 81634", () => {
    assert.equal(resultingWordCountFromCut(CANONICAL, 25), 81_634);
  });
  it("inconsistent cut arithmetic fails validation", () => {
    const result = validateLengthRecommendations(
      [
        {
          authoritative_current_word_count: CANONICAL,
          recommended_cut_percentage: 20,
          recommended_cut_words: null,
          resulting_word_count: 50_000,
          genre_target_range: "80k–100k",
          configuration_source: "STORYDNA_COMMERCIAL_FICTION_LENGTH_V1",
          basis: "pacing",
          rationale: "test",
        },
      ],
      CANONICAL,
    );
    assert.equal(result.valid, false);
  });
});

describe("commercial review pipeline", () => {
  it("blocks publication on statistics contradiction before repair", () => {
    const stats = buildReviewStatistics({
      manuscriptId: "m1",
      extractedText: "",
      sentChars: 1,
      storedWordCount: CANONICAL,
    });
    const content = rubricJson(fullRubricPayload(CRAFT_CATEGORIES.map(() => 5), ACQUISITION_CATEGORIES.map(() => 3)));
    const bad = `${content}\n\nThis 150k-ish draft needs tightening.`;
    const outcome = validateCommercialReviewContent({
      content: bad,
      statistics: stats,
      reviewMeta: null,
    });
    assert.equal(outcome.ok, false);
    assert.match(outcome.error ?? "", new RegExp(REVIEW_BLOCKED_STATISTICS_MESSAGE));
  });

  it("second failure after repair blocks publication", () => {
    const stats = buildReviewStatistics({
      manuscriptId: "m1",
      extractedText: "",
      sentChars: 1,
      storedWordCount: CANONICAL,
    });
    const bad = `${EXACT_OPENING}\n\nStill a 150k-ish manuscript.\n\n<!-- STORYDNA_RUBRIC_JSON -->\n{}`;
    const outcome = validateCommercialReviewContent({
      content: bad,
      statistics: stats,
      reviewMeta: null,
      repairAttempted: true,
      repairSucceeded: false,
    });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.repairable, undefined);
  });

  it("offers repair only once before blocking", () => {
    const stats = buildReviewStatistics({
      manuscriptId: "m1",
      extractedText: "",
      sentChars: 1,
      storedWordCount: CANONICAL,
    });
    const content = rubricJson(fullRubricPayload(CRAFT_CATEGORIES.map(() => 5), ACQUISITION_CATEGORIES.map(() => 3)));
    const bad = `${content}\n\nThis 150k-ish draft needs tightening.`;
    const first = validateCommercialReviewContent({ content: bad, statistics: stats, reviewMeta: null });
    const second = validateCommercialReviewContent({
      content: bad,
      statistics: stats,
      reviewMeta: null,
      repairAttempted: true,
    });
    assert.equal(first.repairable, true);
    assert.equal(second.repairable, undefined);
  });

  it("detects first contradiction for repair pass", () => {
    const c = firstWordCountContradiction(`${EXACT_OPENING} The 150k-ish book needs work.`, CANONICAL);
    assert.ok(c);
    assert.match(c!.quotation, /150k/i);
  });
});

describe("rubric category keys", () => {
  function rawKeys(craft: string[], acq: string[]) {
    return {
      craftRaw: craft.map((category_key) => ({ category_key })),
      acqRaw: acq.map((category_key) => ({ category_key })),
    };
  }

  it("accepts the exact 14 required keys", () => {
    const errors = validateRubricCategoryKeys(
      REQUIRED_CRAFT_KEYS.map((k) => ({ category_key: k })),
      REQUIRED_ACQUISITION_KEYS.map((k) => ({ category_key: k })),
    );
    assert.equal(errors.length, 0);
  });

  it("rejects missing keys", () => {
    const { craftRaw, acqRaw } = rawKeys(REQUIRED_CRAFT_KEYS.slice(1), REQUIRED_ACQUISITION_KEYS);
    const errors = validateRubricCategoryKeys(craftRaw, acqRaw);
    assert.ok(errors.some((e) => e.includes("Missing required craft")));
  });

  it("rejects duplicate keys", () => {
    const craft = [...REQUIRED_CRAFT_KEYS];
    craft[1] = craft[0];
    const errors = validateRubricCategoryKeys(
      craft.map((k) => ({ category_key: k })),
      REQUIRED_ACQUISITION_KEYS.map((k) => ({ category_key: k })),
    );
    assert.ok(errors.some((e) => e.includes("Duplicate")));
  });

  it("rejects unknown keys", () => {
    const errors = validateRubricCategoryKeys(
      [{ category_key: "not_a_real_key" }, ...REQUIRED_CRAFT_KEYS.slice(1).map((k) => ({ category_key: k }))],
      REQUIRED_ACQUISITION_KEYS.map((k) => ({ category_key: k })),
    );
    assert.ok(errors.some((e) => e.includes("Unknown craft")));
  });

  it("rejects craft key in acquisition group", () => {
    const errors = validateRubricCategoryKeys(
      REQUIRED_CRAFT_KEYS.slice(1).map((k) => ({ category_key: k })),
      [{ category_key: REQUIRED_CRAFT_KEYS[0] }, ...REQUIRED_ACQUISITION_KEYS.slice(1).map((k) => ({ category_key: k }))],
    );
    assert.ok(errors.some((e) => e.includes("appears in acquisition_categories")));
  });

  it("rejects wrong total count", () => {
    const errors = validateRubricCategoryKeys(
      REQUIRED_CRAFT_KEYS.map((k) => ({ category_key: k })),
      REQUIRED_ACQUISITION_KEYS.slice(0, 5).map((k) => ({ category_key: k })),
    );
    assert.ok(errors.some((e) => e.includes("Expected 14 total")));
  });

  it("validateCommercialRubric rejects missing keys via extractRubricPayload", () => {
    const partial = {
      craft_categories: REQUIRED_CRAFT_KEYS.slice(1).map((k) => sampleCategory(k, k, 5, 3)),
      acquisition_categories: REQUIRED_ACQUISITION_KEYS.map((k) => sampleCategory(k, k, 3, 2)),
      length_recommendations: [],
    };
    const { categoryKeyErrors } = extractRubricPayload(rubricJson(partial as CommercialRubricPayload));
    const result = validateCommercialRubric({
      payload: partial as CommercialRubricPayload,
      parseError: null,
      categoryKeyErrors,
      canonicalWordCount: CANONICAL,
      fullTextSupplied: true,
      statisticsValid: true,
    });
    assert.equal(result.valid, false);
    assert.ok(result.validationErrors.some((e) => e.includes("Missing required craft")));
  });
});

describe("prose letter grade validation", () => {
  const craft = [6, 7, 7, 7, 6, 6, 5, 8];
  const acq = [5, 5, 4, 4, 4, 3];
  const payload = fullRubricPayload(craft, acq);
  const grading = validateCommercialRubric({
    payload,
    parseError: null,
    canonicalWordCount: CANONICAL,
    fullTextSupplied: true,
    statisticsValid: true,
  });

  it("matching prose grade passes", () => {
    const memo = `Analysis memo.\n\n**Grade: ${grading.letterGrade}**`;
    const v = validateProseLetterGrade(memo, grading.letterGrade);
    assert.equal(v.valid, true);
  });

  it("conflicting prose grade fails", () => {
    const memo = "Memo.\n\n**Grade: A+**";
    const v = validateProseLetterGrade(memo, grading.letterGrade);
    assert.equal(v.valid, false);
    assert.ok(v.conflicts.length > 0);
  });

  it("normalize replaces prose grade with calculated line", () => {
    const memo = "Memo.\n\n**Grade: A+**";
    const out = normalizeProseGradeLine(memo, grading.letterGrade, grading.manuscriptScore);
    assert.match(out, /Commercial acquisition grade \(calculated\)/);
    assert.match(out, new RegExp(grading.letterGrade));
    assert.ok(!out.includes("Grade: A+"));
  });

  it("blocks publication when prose grade conflicts before repair", () => {
    const stats = buildReviewStatistics({
      manuscriptId: "m1",
      extractedText: "",
      sentChars: 100,
      storedWordCount: CANONICAL,
    });
    const content = `${EXACT_OPENING}\n\nMemo with wrong grade.\n\n**Grade: A+**\n\n${rubricJson(payload).split("\n\n").slice(2).join("\n\n")}`;
    const outcome = validateCommercialReviewContent({ content, statistics: stats, reviewMeta: null });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.repairable, true);
    assert.equal(outcome.repairKind, "prose_grade");
    assert.match(outcome.error ?? "", new RegExp(REVIEW_BLOCKED_PROSE_GRADE_MESSAGE));
  });

  it("second prose failure after repair blocks publication", () => {
    const stats = buildReviewStatistics({
      manuscriptId: "m1",
      extractedText: "",
      sentChars: 100,
      storedWordCount: CANONICAL,
    });
    const content = `${EXACT_OPENING}\n\nStill wrong.\n\n**Grade: A+**\n\n${rubricJson(payload).split("\n\n").slice(2).join("\n\n")}`;
    const outcome = validateCommercialReviewContent({
      content,
      statistics: stats,
      reviewMeta: null,
      repairAttempted: true,
    });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.repairable, undefined);
    assert.match(outcome.error ?? "", /Repair did not resolve prose grade/);
  });

  it("offers prose repair only once", () => {
    const stats = buildReviewStatistics({
      manuscriptId: "m1",
      extractedText: "",
      sentChars: 100,
      storedWordCount: CANONICAL,
    });
    const content = `${EXACT_OPENING}\n\nMemo.\n\n**Grade: A+**\n\n${rubricJson(payload).split("\n\n").slice(2).join("\n\n")}`;
    const first = validateCommercialReviewContent({ content, statistics: stats, reviewMeta: null });
    const second = validateCommercialReviewContent({
      content,
      statistics: stats,
      reviewMeta: null,
      repairAttempted: true,
    });
    assert.equal(first.repairable, true);
    assert.equal(second.repairable, undefined);
  });
});

describe("grading record for RPC", () => {
  it("emits VERIFIED statuses expected by RPC", () => {
    const craft = [6, 7, 7, 7, 6, 6, 5, 8];
    const acq = [5, 5, 4, 4, 4, 3];
    const payload = fullRubricPayload(craft, acq);
    const stats = buildReviewStatistics({
      manuscriptId: "m1",
      extractedText: "",
      sentChars: 100,
      storedWordCount: CANONICAL,
    });
    const content = rubricJson(payload);
    const outcome = validateCommercialReviewContent({ content, statistics: stats, reviewMeta: null });
    assert.equal(outcome.ok, true);
    const record = buildReviewGradingRecord(outcome.result!);
    assert.equal(record.statistics_validation_status, "VERIFIED");
    assert.equal(record.evidence_completeness_status, "COMPLETE");
    assert.equal(record.arithmetic_validation_status, "VERIFIED");
    assert.equal(record.grading_formula_version, "STORYDNA_COMMERCIAL_FICTION_RUBRIC_V1");
  });
});

describe("legacy safety", () => {
  it("extract rubric returns memo without JSON block", () => {
    const payload = fullRubricPayload(CRAFT_CATEGORIES.map(() => 5), ACQUISITION_CATEGORIES.map(() => 3));
    const content = rubricJson(payload);
    const { memoContent, payload: parsed } = extractRubricPayload(content);
    assert.ok(!memoContent.includes("STORYDNA_RUBRIC_JSON"));
    assert.ok(parsed);
  });
});

const HOLD_FAST_CANONICAL = 111_491;

function holdFastContradictionFixture(): string {
  const payload = fullRubricPayload(CRAFT_CATEGORIES.map(() => 5), ACQUISITION_CATEGORIES.map(() => 3));
  return `This is a 150k-ish draft.

There is a 105–115k book inside this.

Cut 20–25% to reach 105–115k.

**Grade: C+**

Memo analysis continues here.

<!-- STORYDNA_RUBRIC_JSON -->
${JSON.stringify(payload)}`;
}

describe("Hold Fast statistics repair fixture", () => {
  it("fails validation on simultaneous contradictions at canonical 111,491", () => {
    const content = holdFastContradictionFixture();
    const r = validateWordCountClaims(content, HOLD_FAST_CANONICAL);
    assert.equal(r.valid, false);
    assert.ok(r.contradictions.some((c) => /150k/i.test(c.quotation)));
    assert.ok(r.contradictions.some((c) => /105/.test(c.quotation) && /115/.test(c.quotation)));
    assert.ok(r.errors.some((e) => e.includes("exactly one current-total")));
  });

  it("repair prompt includes canonical count and every contradiction", () => {
    const content = holdFastContradictionFixture();
    const wordVal = validateWordCountClaims(content, HOLD_FAST_CANONICAL);
    const prompt = buildCommercialReviewRepairPrompt({
      canonicalWordCount: HOLD_FAST_CANONICAL,
      reviewContent: content,
      wordCountContradictions: wordVal.contradictions,
      wordCountErrors: wordVal.errors,
    });
    assert.match(prompt, /The manuscript is 111,491 words/);
    assert.match(prompt, /EVERY LENGTH CONTRADICTION TO FIX/);
    assert.match(prompt, /150k/i);
    assert.match(prompt, /105/);
    assert.match(prompt, /Recalculate EVERY percentage-cut/);
    assert.match(prompt, /89,193/);
    assert.match(prompt, /83,618/);
    assert.match(prompt, /Do NOT assign an independent prose letter grade/);
    assert.match(prompt, /STORYDNA_RUBRIC_JSON/);
  });

  it("deterministic normalization clears contradictions and preserves rubric JSON", () => {
    const content = holdFastContradictionFixture();
    const normalized = normalizeCommercialReviewStatisticsText({
      content,
      canonicalWordCount: HOLD_FAST_CANONICAL,
      calculatedLetterGrade: "C+",
      manuscriptScore: 78,
    });
    const r = validateWordCountClaims(normalized, HOLD_FAST_CANONICAL);
    assert.equal(r.errors.length, 0, r.errors.join("; "));
    assert.ok(
      r.contradictions.every((c) => !/150\s*k|105\s*[–—-]\s*115\s*k/i.test(c.quotation)),
      r.contradictions.map((c) => c.reason).join("; "),
    );
    assert.ok(!/150k/i.test(normalized));
    assert.ok(!/\*\*Grade: C\+\*\*/.test(normalized.split("<!-- STORYDNA_RUBRIC_JSON -->")[0] ?? ""));
    assert.ok(normalized.includes("<!-- STORYDNA_RUBRIC_JSON -->"));
    assert.match(normalized, /The manuscript is 111,491 words/);
    assert.match(normalized, /89,193/);
    assert.match(normalized, /83,618/);
    const prose = validateProseLetterGrade(
      normalized.split("<!-- STORYDNA_RUBRIC_JSON -->")[0] ?? normalized,
      "C+",
    );
    assert.equal(prose.valid, true);
  });

  it("buildReviewStatistics prefers recomputed count over stale stored 111,441", () => {
    const text = "word ".repeat(HOLD_FAST_CANONICAL);
    const stats = buildReviewStatistics({
      manuscriptId: "9f482ca2-a0f6-4709-8364-18a0ef950eb0",
      manuscriptVersionId: "4ba2909f-cdd6-40cb-9dbf-934df71246cd",
      extractedText: text,
      sentChars: text.length,
      storedWordCount: 111_441,
    });
    assert.equal(stats.canonical_word_count, HOLD_FAST_CANONICAL);
  });
});

describe("pipeline hardening regressions", () => {
  const HF = 111_491;
  const OPEN = storyDnaAnalyticalOpening(HF);

  it('rejects "reads well past 150k" for a 111,491-word manuscript', () => {
    const r = validateWordCountClaims(`${OPEN} This reads well past 150k words.`, HF);
    assert.equal(r.valid, false);
    assert.ok(r.contradictions.some((c) => /well past/i.test(c.reason)));
  });

  it('accepts "approximately 111,500 words" within tolerance', () => {
    const r = validateWordCountClaims(`${OPEN} At approximately 111,500 words, pacing is tight.`, HF);
    assert.equal(r.valid, true);
  });

  it("allows genre target ranges without treating them as current totals", () => {
    const r = validateWordCountClaims(
      `${OPEN} Genre target range for commercial fiction is 80,000–100,000 words.`,
      HF,
    );
    assert.equal(r.valid, true);
  });

  it("rejects memo containing Grade: C+ before Call B", () => {
    const gate = validateCommercialMemoOnly({
      memoContent: `${OPEN}\n\n**Grade: C+**\n\nAnalysis.`,
      canonicalWordCount: HF,
    });
    assert.equal(gate.ok, false);
    assert.match(gate.error ?? "", /PROHIBITED LETTER GRADE/);
  });

  it("blocks contradictory current totals from proceeding to rubric", () => {
    const gate = validateCommercialMemoOnly({
      memoContent: `${OPEN} Also totals 150,000 words throughout.`,
      canonicalWordCount: HF,
    });
    assert.equal(gate.ok, false);
  });
});
