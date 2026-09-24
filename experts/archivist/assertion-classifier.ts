/**
 * Deterministic assertion polarity for transition and transfer phrases.
 *
 * Distinguishes an asserted event from a mentioned, negated, hypothetical,
 * or speculative mention. Clause and sentence structure are used instead of
 * a fixed character window. No model call.
 */

export const ASSERTION_POLARITIES = [
  "asserted",
  "negated",
  "hypothetical",
  "speculative",
] as const;
export type AssertionPolarity = (typeof ASSERTION_POLARITIES)[number];

export interface PhraseAssertion {
  phrase: string;
  polarity: AssertionPolarity;
  sentence: string;
  asserted: boolean;
}

interface SentenceSpan {
  start: number;
  end: number;
  text: string;
}

const HYPOTHETICAL =
  /\b(?:if|unless|whether)\b|\bshould\s+(?:she|he|they|it|there|another)\b|\bwere\s+(?:she|he|they|it|there)\s+to\b/i;
const SPECULATIVE =
  /\b(?:perhaps|maybe|possibly|presumably|apparently|for example|such as)\b|e\.g\.|i\.e\.|\b(?:might|could|may)(?:\s+not)?\s+have\b/i;
const SENTENCE_NEGATION =
  /^(?:there\s+(?:is|was|were)\s+)?(?:no|not|never)\b|\b(?:no|not|without|lacking)\s+(?:evidence|proof|indication|narrative|intervening|sign)\b|\b(?:is|was|were|are)\s+not\s+(?:provided|established|shown|evidenced|present|documented)\b|\b(?:did|does|do)\s+not\b|\bnever\b|\bwithout\s+evidence\b/i;
const CLAUSE_NEGATION =
  /\b(?:no|not|never|without|neither|nor|lacking)\b|\bno\s+evidence\b|\bwithout\s+evidence\b/i;
const CONTRAST = /\b(?:but|however|instead)\b/i;

function isSentenceBoundary(text: string, index: number): boolean {
  const ch = text[index];
  if (ch === "!" || ch === "?" || ch === ";") return true;
  if (ch !== ".") return false;
  const prev = text[index - 1] ?? "";
  const prev2 = text[index - 2] ?? "";
  if (prev2 === "." && /[a-z]/i.test(prev)) return false;
  if (/[a-z]/i.test(prev) && /[a-z]/i.test(text[index + 1] ?? "")) return false;
  return true;
}

function splitSentences(text: string): SentenceSpan[] {
  const sentences: SentenceSpan[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (isSentenceBoundary(text, i)) {
      const raw = text.slice(start, i + 1);
      if (raw.trim()) sentences.push({ start, end: i + 1, text: raw });
      start = i + 1;
    }
  }
  if (start < text.length && text.slice(start).trim()) {
    sentences.push({ start, end: text.length, text: text.slice(start) });
  }
  if (sentences.length === 0 && text.trim()) {
    sentences.push({ start: 0, end: text.length, text });
  }
  return sentences;
}

function sentenceAt(text: string, index: number): SentenceSpan {
  const sentences = splitSentences(text);
  return (
    sentences.find((sentence) => index >= sentence.start && index < sentence.end) ??
    sentences[sentences.length - 1] ?? {
      start: 0,
      end: text.length,
      text,
    }
  );
}

function localClause(sentence: string, localIndex: number): string {
  const parts = sentence.split(/[:]/);
  let cursor = 0;
  for (const part of parts) {
    const end = cursor + part.length;
    if (localIndex <= end || cursor + part.length >= sentence.length) {
      const contrastSplit = part.split(CONTRAST);
      if (contrastSplit.length > 1) {
        let inner = 0;
        const relative = localIndex - cursor;
        for (const clause of contrastSplit) {
          if (relative <= inner + clause.length) return clause;
          inner += clause.length;
        }
      }
      return part;
    }
    cursor = end + 1;
  }
  return sentence;
}

function classifyClause(clause: string, sentence: string): AssertionPolarity {
  if (HYPOTHETICAL.test(clause) || HYPOTHETICAL.test(sentence)) return "hypothetical";
  if (SPECULATIVE.test(clause) || SPECULATIVE.test(sentence)) return "speculative";
  if (CLAUSE_NEGATION.test(clause) || SENTENCE_NEGATION.test(sentence)) return "negated";
  return "asserted";
}

function findOccurrences(haystack: string, phrase: string): number[] {
  const indexes: number[] = [];
  if (!phrase) return indexes;
  let from = 0;
  while (from < haystack.length) {
    const idx = haystack.indexOf(phrase, from);
    if (idx < 0) return indexes;
    indexes.push(idx);
    from = idx + Math.max(phrase.length, 1);
  }
  return indexes;
}

export function classifyPhraseAssertion(text: string, phrase: string): PhraseAssertion | null {
  const haystack = text.toLowerCase();
  const needle = phrase.toLowerCase();
  const occurrences = findOccurrences(haystack, needle);
  if (occurrences.length === 0) return null;

  let first: PhraseAssertion | null = null;
  for (const idx of occurrences) {
    const sentence = sentenceAt(text, idx);
    const localIndex = idx - sentence.start;
    const clause = localClause(sentence.text, localIndex);
    const polarity = classifyClause(clause, sentence.text);
    const result: PhraseAssertion = {
      phrase,
      polarity,
      sentence: sentence.text.trim(),
      asserted: polarity === "asserted",
    };
    if (!first) first = result;
    if (result.asserted) return result;
  }
  return first;
}

export function phraseIsAsserted(text: string, phrase: string): boolean {
  return classifyPhraseAssertion(text, phrase)?.asserted === true;
}

export function textHasAssertedPhrase(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => phraseIsAsserted(text, phrase));
}
