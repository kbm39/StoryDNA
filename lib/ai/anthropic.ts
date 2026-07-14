import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Agent } from "@/lib/agentfinder";
import type { StoryDnaData, AuthorIntent } from "@/lib/types";
import {
  buildReviewPrompt,
  buildSystemPrompt,
  buildReviewMeta,
  buildRevisionCandidatesPrompt,
  parseRevisionCandidates,
  LITERARY_AGENT,
  type ReviewerDefinition,
  type ParsedIssue,
} from "@/lib/ai/review-engine";
import {
  clampManuscript,
  truncationNote,
  authoritativeWordCountBlock,
  STORY_GROUNDING,
  QUERY_LETTER_SYSTEM,
  buildQueryLetterPrompt,
  MARKETABILITY_SYSTEM,
  buildMarketabilityPrompt,
  marketabilityBlock,
  PITCH_DECK_SYSTEM,
  buildPitchDeckPrompt,
  buildSeriesPitchDeckPrompt,
  type PitchDeckInput,
  DOC_SPECS,
  OPENING_CHARS,
  type DocType,
  SCREEN_SYSTEM,
  SCREEN_INSTRUCTIONS,
  TREATMENT_SYSTEM,
  buildTreatmentInstructions,
  type TreatmentFormat,
  EXTRACT_INSTRUCTIONS,
  parseExtractedIssues,
  STORYDNA_SYSTEM,
  buildStoryDnaPrompt,
  parseStoryDna,
  EXTRACT_COMMENTS_INSTRUCTIONS,
  parseEditorialComments,
  buildAssessPrompt,
  parseAssessments,
  type EditorialCommentParsed,
  type AssessInput,
  type AssessmentParsed,
  buildSuggestPrompt,
  buildRecheckPrompt,
  parseRecheck,
  buildEditPrompt,
  parseEdits,
  buildBrainstormPrompt,
  type ReviewResult,
  type ExtractedIssue,
  type SuggestionResult,
  type RecheckIssueInput,
  type RecheckParsed,
  type EditsParsed,
} from "@/lib/ai/shared";
import { countManuscriptWords, manuscriptWordsInCharSlice } from "@/lib/word-count";
import { buildReviewStatistics, type ReviewStatistics } from "@/lib/review-statistics";
import { buildWordCountRepairPrompt } from "@/lib/word-count-validation";
import { buildProseGradeRepairPrompt, type ProseGradeMatch } from "@/lib/prose-grade-validation";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
// Claude Opus 4.8 has a 1M-token context window, so a whole novel fits. The
// cap is just a sanity bound; raise it if you ever need to.
const MAX_INPUT_CHARS = Number(process.env.ANTHROPIC_MAX_INPUT_CHARS || 3_000_000);

const SYSTEM = `You are a seasoned developmental editor giving craft-focused feedback on a novel manuscript. You read closely and respond to the actual writing — its structure, rhythm, and characters — not to generic checklists. You are honest and specific, and you point to concrete moments in the text.`;

const INSTRUCTIONS = `Give a craft-focused developmental edit of the manuscript below. Use Markdown with these sections, in this order:

## Plot & Structure
## Pacing
## Character Development
## Prose & Voice
## Theme
## What's Working / What to Prioritize
List the few highest-leverage revisions you'd make first.
## Grade
End with a single letter grade (A+ to F) for the book's craft, on its own line as **Grade: X**, followed by one sentence explaining it.

Reference specific scenes, lines, or characters. Be candid and useful, not flattering.

${STORY_GROUNDING}`;

export async function generateCraftReview(text: string): Promise<ReviewResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  const { text: clamped, truncated } = clampManuscript(text, MAX_INPUT_CHARS);
  const wordCountTotal = countManuscriptWords(text);
  const sentWordCount = manuscriptWordsInCharSlice(text, clamped.length, wordCountTotal);
  const fullText = !truncated;
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `${INSTRUCTIONS}${authoritativeWordCountBlock(wordCountTotal, sentWordCount, fullText)}${truncationNote(truncated, sentWordCount)}\n\n---\nMANUSCRIPT:\n\n${clamped}`,
      },
    ],
  });

  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty response.");

  return { content, model: response.model || MODEL, truncated, charsSent: clamped.length };
}

/** Producer's read (TV/film adaptation). */
export async function generateScreenReview(text: string): Promise<ReviewResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");

  const { text: clamped, truncated } = clampManuscript(text, MAX_INPUT_CHARS);
  const wordCountTotal = countManuscriptWords(text);
  const sentWordCount = manuscriptWordsInCharSlice(text, clamped.length, wordCountTotal);
  const fullText = !truncated;
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: SCREEN_SYSTEM,
    messages: [
      {
        role: "user",
        content: `${SCREEN_INSTRUCTIONS}${authoritativeWordCountBlock(wordCountTotal, sentWordCount, fullText)}${truncationNote(truncated, sentWordCount)}\n\n---\nMANUSCRIPT:\n\n${clamped}`,
      },
    ],
  });

  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty response.");
  return { content, model: response.model || MODEL, truncated, charsSent: clamped.length };
}

/**
 * StoryDNA Review Engine runner (Claude). Every reviewer flows through this:
 * it reads the WHOLE manuscript in one pass (no lossy summarization), assembles
 * the reviewer's prompt from its definition, and returns the report plus the
 * honest transparency/compliance metadata. Streamed (long output).
 */
export async function generateReview(
  def: ReviewerDefinition,
  text: string,
  intent: AuthorIntent | null,
  statistics?: ReviewStatistics | null,
): Promise<ReviewResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic();
  const { text: clamped, truncated } = clampManuscript(text, MAX_INPUT_CHARS);
  const wordCountTotal = countManuscriptWords(text);
  const sentWordCount = manuscriptWordsInCharSlice(text, clamped.length, wordCountTotal);
  const stats =
    statistics ??
    buildReviewStatistics({
      manuscriptId: "",
      extractedText: text,
      sentChars: clamped.length,
      storedWordCount: wordCountTotal,
    });

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: def.maxTokens,
    thinking: { type: "adaptive" },
    system: buildSystemPrompt(def),
    messages: [
      {
        role: "user",
        content: `${buildReviewPrompt(def, intent, { statistics: stats })}${truncationNote(truncated, sentWordCount)}\n\n---\nMANUSCRIPT:\n\n${clamped}`,
      },
    ],
  });
  const response = await stream.finalMessage();

  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty response.");

  const model = response.model || MODEL;
  const reviewMeta = buildReviewMeta(def, {
    model,
    originalChars: text.length,
    sentChars: clamped.length,
    intent,
    manuscriptText: text,
  });
  return { content, model, truncated, charsSent: clamped.length, reviewMeta };
}

/** Literary Agent Review V2 — the flagship reviewer on the shared engine. */
export function generateAgentReview(
  text: string,
  intent: AuthorIntent | null,
  statistics?: ReviewStatistics | null,
): Promise<ReviewResult> {
  return generateReview(LITERARY_AGENT, text, intent, statistics);
}

/** One automatic repair pass for statistics or prose-grade validation failures. */
export async function repairCommercialReviewValidation(args: {
  reviewContent: string;
  canonicalWordCount: number;
  calculatedLetterGrade: string;
  manuscriptScore: number;
  wordCountContradiction?: string;
  proseGradeConflict?: ProseGradeMatch;
}): Promise<ReviewResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic();

  const sections: string[] = [
    "The acquisitions memo below failed StoryDNA validation. Apply ALL corrections below in one pass.",
  ];

  if (args.wordCountContradiction) {
    sections.push(
      buildWordCountRepairPrompt({
        canonicalWordCount: args.canonicalWordCount,
        contradiction: {
          quotation: args.wordCountContradiction,
          claimedWords: 0,
          approximate: false,
          shorthand: false,
          reason: "",
        },
        reviewContent: "",
      }).replace(/\n---\nMEMO TO CORRECT:\n\n$/, ""),
    );
  }

  if (args.proseGradeConflict) {
    sections.push(
      buildProseGradeRepairPrompt({
        calculatedLetterGrade: args.calculatedLetterGrade,
        manuscriptScore: args.manuscriptScore,
        conflict: args.proseGradeConflict,
        reviewContent: "",
      }).replace(/\n---\nMEMO TO CORRECT:\n\n$/, ""),
    );
  }

  const prompt = `${sections.join("\n\n")}\n\n---\nMEMO TO CORRECT:\n\n${args.reviewContent}`;

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: LITERARY_AGENT.maxTokens,
    thinking: { type: "adaptive" },
    system: buildSystemPrompt(LITERARY_AGENT),
    messages: [{ role: "user", content: prompt }],
  });
  const response = await stream.finalMessage();
  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty repair response.");
  const model = response.model || MODEL;
  return { content, model, truncated: false, charsSent: content.length };
}

/** @deprecated Use repairCommercialReviewValidation */
export async function repairCommercialReviewWordCount(args: {
  reviewContent: string;
  canonicalWordCount: number;
  contradictionQuotation: string;
}): Promise<ReviewResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic();
  const prompt = buildWordCountRepairPrompt({
    canonicalWordCount: args.canonicalWordCount,
    contradiction: {
      quotation: args.contradictionQuotation,
      claimedWords: 0,
      approximate: false,
      shorthand: false,
      reason: "",
    },
    reviewContent: args.reviewContent,
  });

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: LITERARY_AGENT.maxTokens,
    thinking: { type: "adaptive" },
    system: buildSystemPrompt(LITERARY_AGENT),
    messages: [{ role: "user", content: prompt }],
  });
  const response = await stream.finalMessage();
  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty repair response.");
  const model = response.model || MODEL;
  return { content, model, truncated: false, charsSent: content.length };
}

/**
 * Revision Engine (Phase 2): turn a reviewer's memo criticisms into linked,
 * grounded Editorial Issues + Revision Candidates. Claude reads the whole
 * manuscript so every candidate's `original` can be a verbatim passage.
 */
export async function generateRevisionCandidates(
  def: ReviewerDefinition,
  reviewMemo: string,
  text: string,
  intent: AuthorIntent | null,
  statistics?: ReviewStatistics | null,
): Promise<{ issues: ParsedIssue[]; model: string; warnings: string[] }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic();
  const { text: clamped } = clampManuscript(text, MAX_INPUT_CHARS);
  const wordCountTotal = countManuscriptWords(text);
  const stats =
    statistics ??
    buildReviewStatistics({
      manuscriptId: "",
      extractedText: text,
      sentChars: clamped.length,
      storedWordCount: wordCountTotal,
    });

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system:
      "You convert your own editorial review into structured, grounded revision candidates. Output only the JSON object requested.",
    messages: [
      {
        role: "user",
        content: `${buildRevisionCandidatesPrompt(def, reviewMemo, intent, { statistics: stats })}\n\n---\nMANUSCRIPT:\n\n${clamped}`,
      },
    ],
  });
  const response = await stream.finalMessage();

  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty response.");
  const { issues, warnings } = parseRevisionCandidates(content);
  return { issues, model: response.model || MODEL, warnings };
}

/** Write a personalized query letter to an agent. */
export async function generateQueryLetter(
  agent: Agent,
  book: { title: string; wordCount: number | null; source: string; marketability?: string | null },
): Promise<SuggestionResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic();
  const { text } = clampManuscript(book.source, MAX_INPUT_CHARS);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: QUERY_LETTER_SYSTEM,
    messages: [
      {
        role: "user",
        content: buildQueryLetterPrompt({
          agentName: agent.name,
          agency: agent.agency,
          genres: agent.genres,
          requirements: agent.submission_requirements,
          queryMethod: agent.query_method,
          bio: agent.bio,
          title: book.title,
          wordCount: book.wordCount,
          source: text,
          marketability: book.marketability,
        }),
      },
    ],
  });

  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty response.");
  return { content, model: response.model || MODEL };
}

/** Summarize an author-provided marketability report into key components + key issues. */
export async function summarizeMarketability(reportText: string): Promise<SuggestionResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic();
  const { text } = clampManuscript(reportText, MAX_INPUT_CHARS);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: MARKETABILITY_SYSTEM,
    messages: [{ role: "user", content: buildMarketabilityPrompt(text) }],
  });

  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty response.");
  return { content, model: response.model || MODEL };
}

/** Generate a slide-based pitch deck, grounded in the full source (Claude reads it whole). */
export async function generatePitchDeck(input: PitchDeckInput): Promise<SuggestionResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic();
  const { text } = clampManuscript(input.source, MAX_INPUT_CHARS);
  const prompt =
    input.kind === "series"
      ? buildSeriesPitchDeckPrompt(input.seriesTitle, input.bookCount, text)
      : buildPitchDeckPrompt(text, input.marketability);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 12000,
    thinking: { type: "adaptive" },
    system: PITCH_DECK_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty response.");
  return { content, model: response.model || MODEL };
}

/** Generate a grounded manuscript document (synopsis, opening critique, line edit, etc.). */
export async function generateDocument(
  docType: DocType,
  text: string,
  marketability: string | null = null,
): Promise<SuggestionResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  const spec = DOC_SPECS[docType];
  const client = new Anthropic();
  const context =
    spec.scope === "opening"
      ? text.slice(0, OPENING_CHARS)
      : clampManuscript(text, MAX_INPUT_CHARS).text;
  const extra = docType === "marketing" ? marketabilityBlock(marketability) : "";

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: spec.system,
    messages: [
      { role: "user", content: `${spec.instructions}\n\nMANUSCRIPT MATERIAL:\n---\n${context}\n---${extra}` },
    ],
  });
  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty response.");
  return { content, model: response.model || MODEL };
}

/** Generate a cohesive multi-book series treatment from a prebuilt prompt. */
export async function generateSeriesTreatmentDoc(userPrompt: string): Promise<SuggestionResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic();
  // Long document — stream with a generous budget (shared with adaptive thinking).
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    system: TREATMENT_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });
  const response = await stream.finalMessage();
  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty response.");
  return { content, model: response.model || MODEL };
}

/** Build a pitch-ready screen treatment from the manuscript. */
export async function generateTreatment(
  text: string,
  format: TreatmentFormat,
): Promise<SuggestionResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");

  const { text: clamped, truncated } = clampManuscript(text, MAX_INPUT_CHARS);
  const sentWordCount = manuscriptWordsInCharSlice(text, clamped.length);
  const client = new Anthropic();

  // Comprehensive series-bible treatments are long. Adaptive thinking shares the
  // max_tokens budget, so give it a generous ceiling (and stream, which the SDK
  // requires at this size) to avoid the document being cut off mid-episode.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    system: TREATMENT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `${buildTreatmentInstructions(format)}${truncationNote(truncated, sentWordCount)}\n\n---\nMANUSCRIPT:\n\n${clamped}`,
      },
    ],
  });
  const response = await stream.finalMessage();

  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty response.");
  return { content, model: response.model || MODEL };
}

/** Turn a Claude review into discrete checklist issues. */
export async function extractIssuesFromReview(
  reviewMarkdown: string,
): Promise<ExtractedIssue[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic();

  // Thinking off + "JSON only" keeps the output a clean, parseable object.
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: "You convert editorial feedback into a clean list of discrete, actionable issues. Output only the JSON object requested.",
    messages: [
      { role: "user", content: `${EXTRACT_INSTRUCTIONS}\n\n---\nREVIEW:\n\n${reviewMarkdown}` },
    ],
  });

  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty response.");
  return parseExtractedIssues(content);
}

/** StoryDNA: read the whole manuscript and extract its structural DNA + protagonist. */
export async function discoverStoryDNA(
  text: string,
): Promise<{ data: StoryDnaData; model: string }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: STORYDNA_SYSTEM,
    messages: [{ role: "user", content: buildStoryDnaPrompt(text, MAX_INPUT_CHARS) }],
  });

  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty response.");
  return { data: parseStoryDna(content), model: response.model || MODEL };
}

/** Split an uploaded editorial analysis into discrete comments. */
export async function extractEditorialComments(
  analysisText: string,
): Promise<EditorialCommentParsed[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic();
  const { text } = clampManuscript(analysisText, MAX_INPUT_CHARS);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: "You split an editorial analysis into discrete, individual comments. Output only the JSON object requested.",
    messages: [
      { role: "user", content: `${EXTRACT_COMMENTS_INSTRUCTIONS}\n\n---\nEDITORIAL ANALYSIS:\n\n${text}` },
    ],
  });

  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty response.");
  return parseEditorialComments(content);
}

/** Judge each editorial comment against the manuscript (agree/disagree/partial). */
export async function assessEditorialComments(
  comments: AssessInput[],
  manuscriptText: string,
): Promise<{ assessments: AssessmentParsed[]; model: string }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: "You are a developmental editor judging another editor's comments against the manuscript. Output only the JSON object requested.",
    messages: [
      { role: "user", content: buildAssessPrompt(comments, manuscriptText, MAX_INPUT_CHARS) },
    ],
  });

  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty response.");
  return { assessments: parseAssessments(content), model: response.model || MODEL };
}

/** Propose concrete fixes for a single issue, grounded in the manuscript. */
export async function suggestFix(
  issueTitle: string,
  issueDescription: string | null,
  manuscriptText: string,
): Promise<SuggestionResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    thinking: { type: "adaptive" },
    system: "You are a seasoned developmental editor who proposes concrete, specific fixes grounded in the actual text.",
    messages: [
      {
        role: "user",
        content: buildSuggestPrompt(issueTitle, issueDescription, manuscriptText, MAX_INPUT_CHARS),
      },
    ],
  });

  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty response.");
  return { content, model: response.model || MODEL };
}

/** Re-check outstanding issues against a revised draft + give a craft grade. */
export async function recheckIssues(
  issues: RecheckIssueInput[],
  manuscriptText: string,
): Promise<RecheckParsed & { model: string }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    system: "You are a developmental editor re-assessing a revised manuscript. Judge issues strictly against the new text. Output only the JSON object requested.",
    messages: [
      {
        role: "user",
        content: buildRecheckPrompt(issues, manuscriptText, "craft", MAX_INPUT_CHARS),
      },
    ],
  });

  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty response.");
  return { ...parseRecheck(content), model: response.model || MODEL };
}

/** Turn an approved suggestion into concrete find/replace edits. */
export async function proposeEdits(
  issueTitle: string,
  suggestionContent: string,
  manuscriptText: string,
): Promise<EditsParsed & { model: string }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    system: "You convert editorial fixes into precise, verbatim find-and-replace edits. Output only the JSON object requested.",
    messages: [
      {
        role: "user",
        content: buildEditPrompt(issueTitle, suggestionContent, manuscriptText, MAX_INPUT_CHARS),
      },
    ],
  });

  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty response.");
  return { ...parseEdits(content), model: response.model || MODEL };
}

/** Brainstorm scene ideas (character- and theme-forward, literary angle). */
export async function brainstormScene(
  scene: string,
  manuscriptText: string | null,
): Promise<SuggestionResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: "You are a literary brainstorming partner who thinks in character, subtext, and theme. Favor emotionally truthful, character-driven options that deepen meaning, not just plot mechanics.",
    messages: [
      { role: "user", content: buildBrainstormPrompt(scene, manuscriptText, MAX_INPUT_CHARS) },
    ],
  });

  const content = textOf(response);
  if (!content) throw new Error("Claude returned an empty response.");
  return { content, model: response.model || MODEL };
}

function textOf(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}
