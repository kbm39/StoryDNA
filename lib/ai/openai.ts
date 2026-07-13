import "server-only";
import OpenAI from "openai";
import type { Agent } from "@/lib/agentfinder";
import type { StoryDnaData } from "@/lib/types";
import {
  clampManuscript,
  authoritativeWordCountBlock,
  STORY_GROUNDING,
  QUERY_LETTER_SYSTEM,
  buildQueryLetterPrompt,
  QUERY_SECTION_TASK,
  MARKETABILITY_SYSTEM,
  buildMarketabilityPrompt,
  marketabilityBlock,
  PITCH_DECK_SYSTEM,
  PITCH_DECK_SECTION_TASK,
  buildPitchDeckPrompt,
  buildSeriesPitchDeckPrompt,
  type PitchDeckInput,
  DOC_SPECS,
  OPENING_CHARS,
  type DocType,
  SCREEN_SYSTEM,
  SCREEN_INSTRUCTIONS,
  TREATMENT_SYSTEM,
  TREATMENT_SECTION_TASK,
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
import { countManuscriptWords } from "@/lib/word-count";

// Configurable so you can point at whatever model your account has access to.
// gpt-4o is a safe, widely-available default; bump OPENAI_MODEL for a stronger
// or larger-context model (e.g. a GPT-5 / o-series model).
const MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const MAX_INPUT_CHARS = Number(process.env.OPENAI_MAX_INPUT_CHARS || 360_000);

// Auto-retry transient rate spikes / 5xx with backoff so momentary limits self-heal.
function openaiClient(): OpenAI {
  return new OpenAI({ maxRetries: 4 });
}

// OpenAI models cap at a 128k-token context, so a full novel won't fit in one
// request. Below this size we send it whole; above it we read in sections and
// synthesize (map-reduce) so the WHOLE manuscript is covered, no truncation.
const SINGLE_PASS_CHARS = Number(process.env.OPENAI_SINGLE_PASS_CHARS || 340_000);
const CHUNK_CHARS = Number(process.env.OPENAI_CHUNK_CHARS || 120_000);

/** Split text into chunks of ~size chars, preferring paragraph boundaries. */
export function chunkByChars(text: string, size: number): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + size, text.length);
    if (end < text.length) {
      const nl = text.lastIndexOf("\n", end);
      if (nl > i + size * 0.5) end = nl;
    }
    chunks.push(text.slice(i, end));
    i = end;
  }
  return chunks;
}

const NO_CLAMP = Number.MAX_SAFE_INTEGER;
const SECTION_SYSTEM =
  "You are an editor skimming one section of a manuscript and taking focused, terse notes for a downstream task.";

/** Map step: gather focused notes across every section of a long manuscript. */
async function gatherNotes(
  client: OpenAI,
  text: string,
  sectionTask: string,
): Promise<string> {
  const chunks = chunkByChars(text, CHUNK_CHARS);
  const notes: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const r = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SECTION_SYSTEM },
        {
          role: "user",
          content: `${sectionTask}\n\nThis is section ${i + 1} of ${chunks.length}. Notes only — no preamble.\n\n---\n${chunks[i]}`,
        },
      ],
    });
    notes.push(`SECTION ${i + 1}/${chunks.length}:\n${r.choices[0]?.message?.content?.trim() ?? ""}`);
  }
  return notes.join("\n\n");
}

/**
 * Manuscript context for a synthesis prompt: the full text when it fits one
 * request, otherwise section-by-section notes covering the WHOLE book. This is
 * how OpenAI (128k-token cap) handles a full-length novel without truncating.
 */
async function openAiContext(
  client: OpenAI,
  text: string,
  sectionTask: string,
): Promise<string> {
  if (text.length <= SINGLE_PASS_CHARS) return text;
  const notes = await gatherNotes(client, text, sectionTask);
  return `The manuscript is long, so the following are section-by-section notes covering the ENTIRE book (not raw prose). Treat them as your complete and ONLY knowledge of the story: do NOT add characters, names, plot points, or events that are not in these notes, and where the notes are silent keep your claims general rather than inventing a specific to fill the gap.\n\n${notes}`;
}

const SYSTEM = `You are an experienced literary agent evaluating a novel manuscript for possible representation. You assess work through a commercial lens: what it would take to sell this in today's market. You are candid, specific, and grounded in the actual text — never generic.`;

const INSTRUCTIONS = `Write a commercial assessment of the manuscript below. Use Markdown with these sections, in this order:

## Marketability
## Comparable Titles
Name 3–5 real, reasonably recent comps and say why each fits.
## Genre & Positioning
## Target Audience
## Strengths
## Weaknesses
## Query-Ready?
State clearly whether it is ready to query agents (yes / not yet), and the specific things that would change that verdict.
## Grade
End with a single letter grade (A+ to F) for the book's commercial prospects, on its own line as **Grade: X**, followed by one sentence explaining it.

Be concrete and reference specifics from the text. Keep it sharp and useful, not padded.

${STORY_GROUNDING}`;

export async function generateCommercialReview(text: string): Promise<ReviewResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  const client = openaiClient();
  const wordCountLine = authoritativeWordCountBlock(countManuscriptWords(text));
  const context = await openAiContext(
    client,
    text,
    "In 6–10 terse bullets, capture this section FAITHFULLY (invent nothing; use only what's on the page): the real characters by name and the concrete events that actually happen, then the commercial signals — hook/tension, voice, marketability, comp vibes, standout strengths, weaknesses, pacing.",
  );

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `${INSTRUCTIONS}${wordCountLine}\n\n---\nMANUSCRIPT:\n\n${context}` },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned an empty response.");
  return { content, model: response.model || MODEL, truncated: false, charsSent: text.length };
}

/** Producer's read (TV/film adaptation), full-manuscript via map-reduce. */
export async function generateScreenReview(text: string): Promise<ReviewResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
  const client = openaiClient();
  const wordCountLine = authoritativeWordCountBlock(countManuscriptWords(text));
  const context = await openAiContext(
    client,
    text,
    "In 6–10 terse bullets, capture this section FAITHFULLY (invent nothing; use only what's on the page): the real characters by name and the concrete events that actually happen, then the streaming-series signals — episodic hooks/cliffhangers, serialized arcs, bingeable tension, visual world, castable characters, scope/budget flags.",
  );

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SCREEN_SYSTEM },
      { role: "user", content: `${SCREEN_INSTRUCTIONS}${wordCountLine}\n\n---\nMANUSCRIPT:\n\n${context}` },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned an empty response.");
  return { content, model: response.model || MODEL, truncated: false, charsSent: text.length };
}

/** Write a personalized query letter to an agent, grounded in the FULL manuscript.
 *  `book.source` is the full manuscript text; long novels are covered via map-reduce
 *  so the letter never has to invent the parts an excerpt would miss. */
export async function generateQueryLetter(
  agent: Agent,
  book: { title: string; wordCount: number | null; source: string; marketability?: string | null },
): Promise<SuggestionResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
  const client = openaiClient();
  const context = await openAiContext(client, book.source, QUERY_SECTION_TASK);

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    messages: [
      { role: "system", content: QUERY_LETTER_SYSTEM },
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
          source: context,
          marketability: book.marketability,
        }),
      },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned an empty response.");
  return { content, model: response.model || MODEL };
}

/** Summarize an author-provided marketability report into key components + key issues. */
export async function summarizeMarketability(reportText: string): Promise<SuggestionResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
  const client = openaiClient();
  const { text } = clampManuscript(reportText, MAX_INPUT_CHARS);

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: MARKETABILITY_SYSTEM },
      { role: "user", content: buildMarketabilityPrompt(text) },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned an empty response.");
  return { content, model: response.model || MODEL };
}

/** Generate a slide-based pitch deck, grounded in the FULL source (map-reduce for long books). */
export async function generatePitchDeck(input: PitchDeckInput): Promise<SuggestionResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
  const client = openaiClient();
  // Covers the whole book even when it's a long manuscript; short treatments pass through unchanged.
  const context = await openAiContext(client, input.source, PITCH_DECK_SECTION_TASK);
  const prompt =
    input.kind === "series"
      ? buildSeriesPitchDeckPrompt(input.seriesTitle, input.bookCount, context)
      : buildPitchDeckPrompt(context, input.marketability);

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 8000,
    temperature: 0.3,
    messages: [
      { role: "system", content: PITCH_DECK_SYSTEM },
      { role: "user", content: prompt },
    ],
  });
  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned an empty response.");
  return { content, model: response.model || MODEL };
}

/** Generate a grounded manuscript document (synopsis, opening critique, line edit, etc.). */
export async function generateDocument(
  docType: DocType,
  text: string,
  marketability: string | null = null,
): Promise<SuggestionResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
  const spec = DOC_SPECS[docType];
  const client = openaiClient();
  const context =
    spec.scope === "opening"
      ? text.slice(0, OPENING_CHARS)
      : await openAiContext(client, text, spec.sectionTask);
  const extra = docType === "marketing" ? marketabilityBlock(marketability) : "";

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 12000,
    temperature: 0.4,
    messages: [
      { role: "system", content: spec.system },
      { role: "user", content: `${spec.instructions}\n\nMANUSCRIPT MATERIAL:\n---\n${context}\n---${extra}` },
    ],
  });
  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned an empty response.");
  return { content, model: response.model || MODEL };
}

/** Generate a cohesive multi-book series treatment from a prebuilt prompt. */
export async function generateSeriesTreatmentDoc(userPrompt: string): Promise<SuggestionResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
  const client = openaiClient();
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 16000,
    messages: [
      { role: "system", content: TREATMENT_SYSTEM },
      { role: "user", content: userPrompt },
    ],
  });
  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned an empty response.");
  return { content, model: response.model || MODEL };
}

/** Build a pitch-ready screen treatment from the manuscript. */
export async function generateTreatment(
  text: string,
  format: TreatmentFormat,
): Promise<SuggestionResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
  const client = openaiClient();
  const context = await openAiContext(client, text, TREATMENT_SECTION_TASK);

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 16000,
    messages: [
      { role: "system", content: TREATMENT_SYSTEM },
      {
        role: "user",
        content: `${buildTreatmentInstructions(format)}\n\n---\nMANUSCRIPT:\n\n${context}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned an empty response.");
  return { content, model: response.model || MODEL };
}

/** Turn an OpenAI review into discrete checklist issues. */
export async function extractIssuesFromReview(
  reviewMarkdown: string,
): Promise<ExtractedIssue[]> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
  const client = openaiClient();

  const response = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You convert editorial feedback into a clean list of discrete, actionable issues.",
      },
      { role: "user", content: `${EXTRACT_INSTRUCTIONS}\n\n---\nREVIEW:\n\n${reviewMarkdown}` },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");
  return parseExtractedIssues(content);
}

/** StoryDNA: extract structural DNA + protagonist (map-reduce for long novels). */
export async function discoverStoryDNA(
  text: string,
): Promise<{ data: StoryDnaData; model: string }> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
  const client = openaiClient();
  const context = await openAiContext(
    client,
    text,
    "List this section FAITHFULLY (invent nothing): every real character by name (note who is central / the POV), real locations, organizations/institutions, any chapter or numbered-section markers, and concrete time/date anchors.",
  );

  const response = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: STORYDNA_SYSTEM },
      { role: "user", content: buildStoryDnaPrompt(context, NO_CLAMP) },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");
  return { data: parseStoryDna(content), model: response.model || MODEL };
}

/** Split an uploaded editorial analysis into discrete comments. */
export async function extractEditorialComments(
  analysisText: string,
): Promise<EditorialCommentParsed[]> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
  const client = openaiClient();
  const { text } = clampManuscript(analysisText, MAX_INPUT_CHARS);

  const response = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You split an editorial analysis into discrete, individual comments. Output only the JSON object requested.",
      },
      { role: "user", content: `${EXTRACT_COMMENTS_INSTRUCTIONS}\n\n---\nEDITORIAL ANALYSIS:\n\n${text}` },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");
  return parseEditorialComments(content);
}

/** Judge each editorial comment against the manuscript (agree/disagree/partial). */
export async function assessEditorialComments(
  comments: AssessInput[],
  manuscriptText: string,
): Promise<{ assessments: AssessmentParsed[]; model: string }> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
  const client = openaiClient();
  const context = await openAiContext(
    client,
    manuscriptText,
    "Note passages and craft details in this section relevant to judging editorial comments about plot, character, pacing, prose, structure, and theme.",
  );

  const response = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are a developmental editor judging another editor's comments against the manuscript. Output only the JSON object requested.",
      },
      { role: "user", content: buildAssessPrompt(comments, context, NO_CLAMP) },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");
  return { assessments: parseAssessments(content), model: response.model || MODEL };
}

/** Propose concrete fixes for a single issue, grounded in the manuscript. */
export async function suggestFix(
  issueTitle: string,
  issueDescription: string | null,
  manuscriptText: string,
): Promise<SuggestionResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
  const client = openaiClient();
  const context = await openAiContext(
    client,
    manuscriptText,
    `For the issue "${issueTitle}"${issueDescription ? `: ${issueDescription}` : ""} — note passages in this section relevant to the issue (quote briefly) and concrete fix ideas.`,
  );

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: "You are a sharp developmental editor who proposes concrete, specific fixes grounded in the actual text.",
      },
      { role: "user", content: buildSuggestPrompt(issueTitle, issueDescription, context, NO_CLAMP) },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned an empty response.");
  return { content, model: response.model || MODEL };
}

/** Re-check outstanding issues against a revised draft + give a commercial grade. */
export async function recheckIssues(
  issues: RecheckIssueInput[],
  manuscriptText: string,
): Promise<RecheckParsed & { model: string }> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
  const client = openaiClient();
  const context = await openAiContext(
    client,
    manuscriptText,
    `Re-checking a revised manuscript. For these issues, note evidence in this section that each is resolved or still present:\n${issues.map((i) => `- ${i.title}`).join("\n")}`,
  );

  const response = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are a literary agent re-assessing a revised manuscript. Judge issues strictly against the new text.",
      },
      {
        role: "user",
        content: buildRecheckPrompt(issues, context, "commercial prospects", NO_CLAMP),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");
  return { ...parseRecheck(content), model: response.model || MODEL };
}

/** Turn an approved suggestion into concrete find/replace edits. */
export async function proposeEdits(
  issueTitle: string,
  suggestionContent: string,
  manuscriptText: string,
): Promise<EditsParsed & { model: string }> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
  const client = openaiClient();

  const response = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You convert editorial fixes into precise, verbatim find-and-replace edits.",
      },
      {
        role: "user",
        content: buildEditPrompt(issueTitle, suggestionContent, manuscriptText, MAX_INPUT_CHARS),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");
  return { ...parseEdits(content), model: response.model || MODEL };
}

/** Brainstorm scene ideas (plot-forward, hooky angle). */
export async function brainstormScene(
  scene: string,
  manuscriptText: string | null,
): Promise<SuggestionResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
  const client = openaiClient();

  let context: string | null = null;
  if (manuscriptText && manuscriptText.trim()) {
    context = await openAiContext(
      client,
      manuscriptText,
      `For brainstorming this scene/spot: "${scene}" — note relevant world, characters, voice, and continuity in this section.`,
    );
  }

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: "You are an inventive story brainstorming partner with sharp plot and commercial instincts. Favor strong hooks, momentum, and surprising-but-earned turns.",
      },
      { role: "user", content: buildBrainstormPrompt(scene, context, NO_CLAMP) },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned an empty response.");
  return { content, model: response.model || MODEL };
}
