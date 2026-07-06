import "server-only";
import type {
  StoryDnaData,
  StoryDnaEntity,
  StoryDnaTimelineAnchor,
  StoryDnaProtagonist,
  StoryDnaQuestion,
  Evidence,
  AlignedText,
  AlignedThemes,
  AlignedEmotional,
  ThemeProposal,
} from "@/lib/types";

export interface ReviewResult {
  content: string;
  model: string;
  truncated: boolean;
  charsSent: number;
}

/**
 * Rough char cap so we don't blow past a model's context window. We truncate
 * *explicitly* (the model is told, and the UI shows a note) rather than silently.
 * ~4 chars/token, leaving headroom for the prompt + the model's output.
 */
export function clampManuscript(
  text: string,
  maxChars: number,
): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars), truncated: true };
}

export function truncationNote(truncated: boolean, charsSent: number): string {
  if (!truncated) return "";
  const approxWords = Math.round(charsSent / 6).toLocaleString();
  return `\n\nNOTE: The manuscript was longer than the context limit, so you are seeing only the first ~${approxWords} words. Assess what you can and say so where the cutoff limits your read.`;
}

/**
 * Anti-invention rule for anything that makes claims ABOUT the story. Story
 * facts (plot, characters, names, events, settings) must be grounded in the
 * material; real-world positioning (comps, market, casting) is the only
 * exception. Appended to the review + editorial prompts.
 */
export const STORY_GROUNDING = `GROUNDING — this overrides every other instruction: Base every statement about the STORY — plot events, characters, names, settings, relationships, and what actually happens — strictly on the manuscript material provided. Do NOT invent, rename, or misattribute characters, scenes, plot points, or events, and do NOT assume anything that is not in the material. When you cite a specific (a scene, a line, a character, a moment), it must actually appear in the material. If you are working from section-by-section notes rather than the full prose, reference ONLY what those notes state, and keep a point general rather than inventing a specific to support it. The ONLY things you may bring from outside the text are comparable titles, market/positioning claims, and casting suggestions. If you are unsure whether a story detail is really in the text, leave it out or say you can't confirm it — never fill the gap with a plausible guess.`;

// Producer's-read (screen adaptation) review — shared by both providers.
export const SCREEN_SYSTEM = `You are a television and streaming development executive (think Netflix, Max, Apple TV+, Hulu, Amazon Prime Video). You read this manuscript primarily as potential source material for a STREAMING series — a limited series or an ongoing/returning series — with a feature film only as a secondary option if the story genuinely demands it. You assess it the way you'd brief a streamer's content team: candid, commercially sharp, and specific to the text.`;

export const SCREEN_INSTRUCTIONS = `Assess the manuscript below as source material for a streaming adaptation. Use Markdown with these sections, in this order:

## Adaptation Potential
A short overview — is this worth optioning for streaming, and why.
## Logline
One or two sentences: the pitch.
## Best Format
Lead with the strongest STREAMING format — limited series or ongoing/returning series — and say how many seasons/episodes it sustains. Mention a feature film only if it's genuinely the better fit.
## Comparable Series
Name 3–5 real, recent streaming shows (and the platforms they're on) as comps, and what each signals about audience and positioning.
## Platform & Audience
Which specific streamer(s) this fits (Netflix, Max, Apple TV+, Hulu, Prime, etc.) and the streaming audience it targets.
## What Adapts Well
Streaming strengths — bingeable hooks, episodic engine, cliffhangers, serialized arcs, visual world, castable characters.
## Adaptation Challenges
What's hard to translate to a series — interiority, structure, pacing across episodes, scope, budget, rights.
## Castability
A brief note on the marquee roles and the kind of talent they'd attract.
## Dream Casting
For each main character (use their real name from the manuscript), suggest specific real, working actors who could play them. Give TWO options per character:
- **A-list:** a marquee, award-caliber or globally bankable star.
- **B-list:** a strong, more attainable working actor (rising, character, or mid-tier talent) who fits the role.
Format each as a bullet: **Character Name** — A-list: [Actor] · B-list: [Actor] — then a short clause on why the casting fits (age, presence, range, what they'd bring). Cover the protagonist and the key supporting characters. Suggest only real actors plausibly castable today; note where a role calls for specific casting (age, ethnicity, physicality) drawn from the text.
## Verdict & Grade
End with a single letter grade (A+ to F) for streaming-adaptation potential, on its own line as **Grade: X**, followed by one sentence explaining it.

Be concrete and reference specifics from the text. Keep it sharp, not padded.

${STORY_GROUNDING}`;

// --- Query letter generation -------------------------------------------------
export const QUERY_LETTER_SYSTEM = `You are an author writing a professional, personalized query letter to a literary agent. You write tight, compelling queries in standard industry format — a hook, a concise pitch, the book's metadata, and a brief bio. You are specific and never generic, you tailor the letter to the agent, and you follow their submission requirements.

ABSOLUTE RULE: Every factual claim about the book — the premise, characters, names, setting, plot, conflict, stakes, themes, and tone — must come directly from the manuscript material you are given. Never invent, embellish, or assume anything that is not in the manuscript. Do not fabricate plot points, character names, twists, comparable titles, awards, sales figures, publication history, or author credentials. If a standard query element (comps, bio) is not supported by the material, use a clearly marked [BRACKETED PLACEHOLDER] for the author to fill in rather than making something up.`;

export interface QueryLetterInputs {
  agentName: string;
  agency: string | null;
  genres: string[];
  requirements: string[];
  queryMethod: string | null;
  bio: string | null;
  title: string;
  wordCount: number | null;
  source: string;
  /** Optional author-provided marketability report summary (trusted material). */
  marketability?: string | null;
}

/** Section-notes task for query letters when the manuscript is too long for one OpenAI request. */
export const QUERY_SECTION_TASK =
  "Summarize this section faithfully for writing a query letter: the actual plot events in order, the protagonist and antagonist and what they want, the central conflict and stakes, the setting, and the tone — using the real character and place names. Capture the real ending if it appears here. Do not invent anything or add genre conventions not present. These notes are the only source for the letter.";

export function buildQueryLetterPrompt(q: QueryLetterInputs): string {
  return `Write a complete, ready-to-send query letter.

AGENT
- Name: ${q.agentName}
- Agency: ${q.agency ?? "—"}
- Represents: ${q.genres.length ? q.genres.join(", ") : "—"}
- Query method: ${q.queryMethod ?? "—"}
- Submission requirements: ${q.requirements.length ? q.requirements.join("; ") : "—"}
- About the agent: ${q.bio ?? "—"}

BOOK
- Title: ${q.title}
- Word count: ${q.wordCount ?? "—"}

MANUSCRIPT MATERIAL — the ONLY source of truth about this book. Build the hook and pitch strictly from what is below. Do not state anything about the story that is not grounded here. (This material may be the manuscript prose, or section-by-section notes covering the whole book — either way, treat it as your complete and only knowledge of the story.):
---
${q.source}
---
${
  q.marketability
    ? `
MARKETABILITY REPORT — a professional, author-provided assessment of this exact book. This is TRUSTED material: you MAY use its positioning, target audience, genre/category, comparable titles, and selling points, and you should subtly steer the pitch to address the key issues/concerns it raises (frame the book's strengths so those concerns are pre-empted — never list weaknesses in the letter). Comparable titles named here are real and approved to use:
---
${q.marketability}
---
`
    : ""
}
HARD RULES — these override everything else:
- Use ONLY characters, names, places, and events that appear in the material above. Do not invent or rename anything.
- Do NOT infer, guess, or invent the ending, plot twists, character fates, motivations, or any event that is not explicitly in the material. If the material doesn't make something clear, keep the pitch general rather than filling the gap.
- Do NOT add genre conventions, tropes, or "typical" beats just because they fit the category. Only what is in THIS book.
- Every concrete claim must trace to a specific thing in the material.

Write the letter so that it:
1. Opens with a personalized sentence on why this agent specifically (tie to their genres / the "about the agent" note).
2. Delivers a strong hook and a tight pitch — premise, protagonist, central conflict, and stakes — drawn entirely from the manuscript material. Use the real character names, places, and events from the material; do not invent any. 1–2 paragraphs.
3. States the metadata in one line: title, genre, and word count. ${
    q.marketability
      ? "For genre, use what the marketability report or material states. For comparable titles, use 2 named in the marketability report if it names any; otherwise write \"[COMPARABLE TITLES — the author adds 2 they choose]\" — never invent a comp."
      : 'For comparable titles, only name a book if it actually appears in the material; otherwise write "[COMPARABLE TITLES — the author adds 2 they choose]" rather than inventing comps.'
  }
4. Includes a short author-bio paragraph using ONLY the placeholder "[YOUR BIO — credits, relevant background]" — never invent credentials, publications, or biography.
5. Closes professionally and notes you've followed their submission guidelines.

Do not add details for color or polish that are not in the manuscript material or the marketability report. If you are unsure whether something is grounded, leave it out. Begin with "Dear ${q.agentName}," (do not add an address block or the agent's email). Keep it about 250–350 words, standard query format.

Before you output, silently re-read your draft and check every character name, place, plot point, and comp against the material — delete or generalize anything not grounded there. Output only the final letter (light Markdown is fine).`;
}

// --- Marketability report summary --------------------------------------------
export const MARKETABILITY_SYSTEM = `You are a publishing-market analyst. You read a marketability / market-positioning report for a novel and distill it faithfully. You summarize ONLY what the report actually says — you never add market opinions, comps, or claims of your own. If the report doesn't cover something, you say so rather than inventing it.`;

export function buildMarketabilityPrompt(reportText: string): string {
  return `Summarize the marketability report below. Use Markdown with exactly these two sections, in this order:

## Key Components
The report's positioning of the book — pull out (only what the report states): target audience/readership, genre & category, comparable titles, the commercial hook(s) and selling points, market trends or timing, and any positioning angle. Use tight bullet points. If the report names comparable titles, list them under a clear "Comps:" bullet so they can be reused.

## Key Issues
The concerns, risks, weaknesses, or obstacles the report flags about the book's marketability (e.g. crowded category, length, soft hook, unclear audience, market saturation). Each as a bullet: the issue, and — if the report suggests one — how to address it. If the report flags no concerns, write "No significant concerns flagged in the report."

Rules: Summarize only what is in the report. Do not invent comps, audiences, or concerns. Do not add your own market commentary. Keep it concise and scannable.

MARKETABILITY REPORT:
---
${reportText}
---`;
}

/**
 * Trusted-material block appended to outputs that should be shaped by the
 * author's marketability report (query letters, pitch deck, marketing copy).
 * It licenses positioning/comps/audience use but never overrides story grounding.
 */
export function marketabilityBlock(marketability: string | null | undefined): string {
  if (!marketability || !marketability.trim()) return "";
  return `

MARKETABILITY REPORT — a professional, author-provided assessment of THIS book. This is TRUSTED positioning material: you MAY use its target audience/readership, genre & category, comparable titles (any comps it names are real and approved to reuse), commercial hooks, and selling points, and you should let it shape how you POSITION the book (audience, comps, "why now", the pitch angle). Where it flags concerns or weaknesses, frame the book's strengths so those concerns are pre-empted — never state a weakness as fact in the output.
IMPORTANT: this does NOT relax the grounding rule. It informs POSITIONING only. Do not use it to introduce plot, characters, names, settings, or story events that are not in the manuscript material provided.
---
${marketability}
---`;
}

// --- Treatment generation ----------------------------------------------------
export type TreatmentFormat = "limited_series" | "ongoing_series" | "feature";

export const TREATMENT_FORMAT_LABEL: Record<TreatmentFormat, string> = {
  limited_series: "Limited series",
  ongoing_series: "Ongoing series",
  feature: "Feature film",
};

export const TREATMENT_SYSTEM = `You are a professional showrunner and development executive. You turn novels into comprehensive, producer-ready treatments and series bibles that streamers and production companies can circulate. You stay faithful to the source — its real characters, plot, places, and tone — while shaping it for the screen, and you may extrapolate plausible season/episode structure and future-season direction so long as it stays true to the book's world and characters. You write with confidence, depth, and specificity, never generic.`;

/** Section-notes task used when the manuscript is too long for one OpenAI request. */
export const TREATMENT_SECTION_TASK =
  "Summarize this section for a screen-treatment writer: plot events in order; each character's introductions, relationships, internal/external conflict, and any change they undergo; the setting/world details (places, institutions, politics, culture); recurring conflicts and tensions; themes; and the strongest visual or cliffhanger moments. Keep the real character and place names. Terse but complete.";

export function buildTreatmentInstructions(format: TreatmentFormat): string {
  const label = TREATMENT_FORMAT_LABEL[format];
  const isSeries = format !== "feature";
  const compType = isSeries ? "streaming series" : "films";
  const overviewHeading = isSeries ? "Series Overview" : "Overview";

  const episodeSection = isSeries
    ? `## Season One Overview
Summarize Season One end to end in present tense: the opening situation, the engine that drives the season, the midpoint shift, the major twists and reveals, the characters' transformations, and the finale's resolution plus the hook into Season Two.
## Episode Guide
${
  format === "limited_series"
    ? "Break Season One into a 6–8 episode limited series."
    : "Break out the pilot plus the rest of an 8–10 episode first season."
} For EACH episode provide:
- **Episode N — [Title]**
- **A-Story:** the primary plot.
- **B-Story:** the secondary / character plot.
- **Beats:** opening situation → escalation → midpoint complication → turning point.
- **Reveals & character beats:** what the audience learns and who changes.
- **Cliffhanger:** the end-of-episode hook.
## Future Seasons
High-level roadmaps for Season Two and beyond — where the mythology, recurring conflicts, villains, and character growth head over the life of the series.`
    : `## Story
Tell the full narrative in present-tense prose across three movements — setup, confrontation, resolution. Hit the inciting incident, the major turns, the midpoint, the crisis, the climax, and the ending. Emphasize visual storytelling and momentum.
## Sequel / Franchise Potential
If the story supports it, sketch where a sequel or franchise could go; otherwise explain why it stands alone.`;

  return `Write a comprehensive, producer-ready ${label} treatment adapting the manuscript below for ${
    isSeries ? "streaming" : "the screen"
  }. This is a full development document at series-bible depth — thorough, specific, and ready to circulate to producers and streamers. Use ONLY the actual characters, names, places, and events from the manuscript; do not invent a different story (you may extrapolate plausible ${
    isSeries ? "season/episode structure and future-season direction" : "act structure"
  } from the material, staying true to its world and characters).

WRITING RULES: present tense; focus on conflict and character; emphasize visual storytelling; avoid screenplay formatting (no scene headings or sluglines); avoid excessive backstory; maintain professional development language.

Use Markdown, with these sections in THIS exact order:

# [Working Title] — ${label} Treatment

## Producer Summary
A one-page executive overview at the very top, for a quick read: the logline, genre and format, the hook, the world in brief, each lead character in a line, the Season-One arc${
    isSeries ? " and franchise upside" : ""
  }, the comps, and why it's commercially viable. This is a standalone snapshot — a busy executive should grasp the entire project from this section alone. Keep it to roughly one page.

## Title & Format
Title, genre, format (${label}), suggested episode length${
    isSeries ? ", and season length (episode count)" : ""
  }, and 3–5 comparable ${compType}.

## Logline
One or two sentences: protagonist, inciting incident, antagonist, central conflict, and stakes.

## ${overviewHeading}
Premise, the emotional experience for the audience, target audience, what makes it unique, and why ${
    isSeries ? "television / streaming" : "the screen"
  } is the right format.

## Tone & Style
Visual language, pacing, level of realism, violence and humor levels, production style, and comparable shows.

## World Building
Locations, institutions, organizations, politics, history, culture, recurring conflicts, and the story engines that generate ongoing drama.

## Themes
Identify 3–5 themes and explain how each surfaces through the narrative.

## Character Bible
For EACH principal character: **Name** — strengths, weaknesses, key relationships, internal conflict, external conflict, ${
    isSeries ? "season arc, and series arc" : "and arc"
  }. Trace each major character through: beginning state → transformational pressure → crisis point → decision point → ending state.

${episodeSection}

## Why This Show Now
Relevance, market timing, audience demand, and cultural significance.

## Comparables
3–5 comparable ${compType} — for each, the similarities and the key difference that makes this project distinct.

## Commercial Viability
A short scorecard rating originality, market fit, ${
    isSeries ? "franchise potential, " : ""
  }character strength, concept clarity, and audience appeal (rate each High / Medium / Low with a one-line justification), then a one-sentence bottom line.

Be concrete and faithful to the manuscript throughout. Write it as a document a producer could circulate.`;
}

// --- Series (cohesive, multi-book) treatment ---------------------------------
/** A cohesive treatment across a whole series — each book maps to a season. */
export function buildSeriesTreatmentInstructions(seriesTitle: string, bookCount: number): string {
  return `Write a comprehensive, producer-ready treatment for an ongoing streaming SERIES adapted from the multi-book source below. The franchise has ${bookCount} book${
    bookCount === 1 ? "" : "s"
  } — treat EACH book as one season of television (Book 1 → Season 1, Book 2 → Season 2, and so on). Produce one cohesive document that ties the whole series together, not separate per-book treatments. Use ONLY the actual characters, names, places, and events from the source material; do not invent a different story (you may extrapolate plausible season/episode structure that stays true to the material).

WRITING RULES: present tense; focus on conflict and character; emphasize visual storytelling; avoid screenplay formatting; avoid excessive backstory; maintain professional development language.

Use Markdown, with these sections in THIS exact order:

# ${seriesTitle} — Series Treatment

## Producer Summary
A one-page executive overview at the very top: the franchise logline, genre and format, the hook, the world, the core characters in a line each, the season-by-season throughline (${bookCount} season${
    bookCount === 1 ? "" : "s"
  }), the endgame, the comps, and why it's commercially viable. A busy executive should grasp the whole franchise from this section alone.

## The Franchise
The overarching premise and the engine that sustains the series across all seasons; the central question the whole series answers, and the endgame.

## Tone & Style
Visual language, pacing, realism, violence/humor levels, production style, and comparable shows.

## World Building
The world that holds across the series — locations, institutions, politics, history, culture, recurring conflicts, and the story engines.

## Themes
3–5 themes that run through the whole series and how they deepen season to season.

## Character Bible
For EACH principal character (across the series): **Name** — strengths, weaknesses, key relationships, internal and external conflict, and their multi-season arc across the franchise (beginning state → transformational pressure → crisis → decision → ending state over the life of the series).

## Season-by-Season Breakdown
For EACH season (one per book), a subsection:
### Season N — [Book Title] : [Season Title]
- **Arc:** the season's central engine and where it lands.
- **Key turns:** the major escalations, midpoint, and finale.
- **Transformations:** how the principals change this season.
- **Hook into next season:** the cliffhanger / propulsion forward (omit for the final season; instead give the series' resolution).

## Franchise Roadmap
The long arc: the mythology, recurring antagonists, and how the series builds and pays off across all seasons; where it could go beyond the books if extended.

## Why This Show Now
Relevance, market timing, audience demand, and cultural significance.

## Comparables
3–5 comparable streaming series — for each, the similarities and the key difference that makes this franchise distinct.

## Commercial Viability
A scorecard rating originality, market fit, franchise potential, character strength, concept clarity, and audience appeal (each High / Medium / Low with a one-line justification), then a one-sentence bottom line.

Be concrete and faithful to the source throughout. Write it as a document a producer could circulate.`;
}

// --- Pitch deck (slide-based) ------------------------------------------------
export const PITCH_DECK_SYSTEM = `You are a film and television development executive who builds crisp, investor-ready pitch decks. You write in punchy, confident pitch language — short, vivid bullets, not paragraphs.

ABSOLUTE RULE: Every claim about the STORY — premise, characters, names, world, setting, plot, conflict, season arc, ending — must come directly from the source material you are given. Never invent, rename, or embellish story facts. Do not infer the ending, twists, character fates, or events that aren't explicitly in the source, and do not add genre conventions just because they fit the category. Comparable titles, audience, and "why now" are positioning (you may speak to the real book's genre and tone), but never fabricate in-story facts to support them.`;

export type PitchDeckInput =
  | { kind: "manuscript"; source: string; marketability?: string | null }
  | { kind: "series"; seriesTitle: string; bookCount: number; source: string };

/** Section-notes task for decks when the manuscript is too long for one OpenAI request. */
export const PITCH_DECK_SECTION_TASK =
  "Summarize this section faithfully for a TV pitch deck: the real plot events in order, the principal characters and their arcs, the world/setting, the central conflict and stakes, and the tone — using the real character and place names. Capture the real ending if it appears here. Invent nothing and add no genre conventions not present. These notes are the only source for the deck.";

const DECK_FORMAT_RULES = `Output the deck as Markdown, ONE SLIDE PER \`##\` heading. The \`##\` line is the slide title; under it put 3–6 tight bullet points (\`- \`) in pitch language — short, punchy, vivid, no long paragraphs. Do not use \`#\` (h1) or deeper-than-\`##\` headings. Keep the whole deck scannable, as if each slide were a single screen a producer sees.`;

const DECK_GROUNDING = `HARD RULES — these override the pitch tone:
- Use ONLY characters, names, places, and events that appear in the source. Do not invent or rename anything.
- Do NOT infer or invent the ending, twists, character fates, motivations, or events not explicitly in the source. If the source doesn't make something clear, keep that slide general rather than filling the gap.
- Do NOT add "typical" genre beats or tropes that aren't in THIS book.
- The source may be the prose itself or section-by-section notes covering the whole book — either way it is your complete and only knowledge of the story.
Before you output, silently re-read your slides and check every character name, place, plot point, and arc against the source — delete or generalize anything not grounded there.`;

/** Pitch deck for a single book. `source` is its treatment (preferred) or manuscript context. */
export function buildPitchDeckPrompt(source: string, marketability?: string | null): string {
  return `Build a professional pitch deck for a streaming/TV adaptation of the book below. ${DECK_FORMAT_RULES}

Use these slides, in order (use the book's real title and the real character/place names from the source — do not invent):
## [Show Title]
- A single-line logline, the format (e.g. limited series / ongoing series), and a one-line comp positioning ("X meets Y").
## Logline
## The Hook
- Why this show, why now, why it grabs an audience.
## The Premise
- The world and the engine of the show.
## The World
## Main Characters
- One bullet per principal: **Name** — who they are and their arc in a line.
## Season Arc
- The shape of Season One: beginning, turn, finale.
## Tone & Comparables
- The tone, plus 3–5 real comparable series.
## Themes
## Future Seasons
- Where it goes beyond Season One.
## Audience & Why Now
## The Ask
- A closing slide: what's being sought (option/development), and a contact placeholder "[Your name · contact]".

${DECK_GROUNDING}

SOURCE:
---
${source}
---${marketabilityBlock(marketability)}`;
}

/** Pitch deck for a whole series — each book is a season. */
export function buildSeriesPitchDeckPrompt(seriesTitle: string, bookCount: number, source: string): string {
  return `Build a professional FRANCHISE pitch deck for an ongoing streaming series adapted from the ${bookCount}-book source below. Treat each book as one season (Book 1 → Season 1, etc.). ${DECK_FORMAT_RULES}

Use these slides, in order (use the real series/book titles and real character/place names from the source — do not invent):
## ${seriesTitle}
- A single-line franchise logline, the format (ongoing series, ${bookCount} seasons), and a one-line comp positioning.
## The Franchise
- The overarching premise and the engine that sustains it across seasons.
## The Series at a Glance
- One bullet per season: **Season N — [Book Title]** — the season's arc in a line.
## The World
## Core Characters
- One bullet per principal: **Name** — who they are and their multi-season arc in a line.
## Character Arcs Across the Series
## Tone & Comparables
- The tone, plus 3–5 real comparable series.
## Themes
## Franchise Roadmap
- The long arc and the endgame across all seasons.
## Audience & Why Now
## The Ask
- A closing slide: what's being sought, and a contact placeholder "[Your name · contact]".

${DECK_GROUNDING}

SOURCE (each book's treatment/synopsis, in series order):
---
${source}
---`;
}

// --- Manuscript documents (synopsis, opening critique, line edit, etc.) ------
export type DocType = "synopsis" | "opening_critique" | "line_edit" | "continuity" | "marketing";

export interface DocSpec {
  label: string;
  blurb: string;
  system: string;
  instructions: string;
  sectionTask: string;
  /** "full" → whole book (map-reduce for OpenAI); "opening" → just the first pages. */
  scope: "full" | "opening";
}

/** How many characters of the opening to send for opening-pages critique (~6k words). */
export const OPENING_CHARS = 32_000;

const GROUND = `Use ONLY what is in the manuscript material — real character names, places, and events. Never invent, rename, infer the ending/twists/fates, or add genre conventions that aren't present. If something isn't in the text, leave it out. Before finishing, re-check every concrete claim against the material and remove anything not grounded there.`;

export const DOC_SPECS: Record<DocType, DocSpec> = {
  synopsis: {
    label: "Synopsis",
    blurb: "A professional submission synopsis — the full plot including the ending, in present tense.",
    system: `You write tight, professional novel synopses for literary-agent submissions. You cover the ENTIRE plot including the ending, in present tense, third person, following the main throughline. ${GROUND}`,
    instructions: `Write a professional submission synopsis of the novel below, in Markdown with these two sections:

## One-Page Synopsis
500–700 words. Present tense, third person. Tell the whole story start to finish INCLUDING the ending and resolution — a synopsis is not a teaser. Put each major character's name in CAPS at first mention. Cover the setup, inciting incident, the major turns and midpoint, the climax, and how it resolves. Stick to the main plotline; fold in only the subplots that matter.

## One-Paragraph Synopsis
150–200 words distilling the same arc (protagonist, conflict, stakes, and the ending) into a single tight paragraph.

${GROUND}`,
    sectionTask:
      "Summarize this section's plot faithfully for a synopsis: the real events in order, who does what and why, the central conflict and stakes, and — if present here — the ending. Use real names. Invent nothing.",
    scope: "full",
  },
  opening_critique: {
    label: "Opening-pages critique",
    blurb: "How an agent's first reader judges your opening pages — the part that decides requests.",
    system: `You are a literary agent's first reader. You judge opening pages the way an agent does in a slush pile — fast, decisive, and honest about whether you'd read on. ${GROUND}`,
    instructions: `You are reading ONLY the opening pages of a novel below (this is where an agent decides whether to keep reading). Assess them in Markdown with these sections:

## Hook
Does the opening grab? What's the question or tension that pulls a reader in — or what's missing?
## Voice & Prose
The quality and distinctiveness of the writing at the line level.
## What's Working
## What's Holding It Back
## Where Attention Drops
Point to the specific moment(s) a reader's attention would slip.
## Verdict
Would you request more pages? End with a single letter grade on its own line as **Grade: X** (A+ to F) and one sentence explaining it.

Be specific and quote briefly from the text. ${GROUND}`,
    sectionTask: "",
    scope: "opening",
  },
  line_edit: {
    label: "Line & copy edit",
    blurb: "A prose-level pass — filter words, repetition, weak tags, passive voice — with concrete before/after fixes.",
    system: `You are a meticulous line and copy editor for fiction. You find prose-level patterns and show concrete fixes, quoting the text. You do not rewrite the whole book or comment on plot/structure (that's a developmental edit). ${GROUND}`,
    instructions: `Do a line/copy-edit pass on the manuscript below. Find the prose-level PATTERNS that weaken the writing and show concrete fixes. Use Markdown with these sections:

## Filter & Crutch Words
Overused words (e.g. just, really, very, that, felt, began to), with counts/examples.
## Repetition
Repeated words, phrasings, or sentence openings — quote examples.
## Adverbs & Dialogue Tags
Weak -ly adverbs and fancy dialogue tags ("he expostulated"); suggest plainer choices.
## Passive Voice & Hedging
## Sentence Rhythm
Run-ons, monotony, or choppiness — with examples.
## Other Line Notes

For each issue, quote a short **Before:** from the text and give an **After:** rewrite. Focus on representative examples and patterns, not an exhaustive rewrite. ${GROUND}`,
    sectionTask:
      "Note prose-level issues in this section for a line edit: overused/filter words, repeated phrasings, weak adverbs and dialogue tags, passive voice, and awkward sentences. Quote short examples verbatim. Do not address plot or structure.",
    scope: "full",
  },
  continuity: {
    label: "Continuity & character bible",
    blurb: "A character bible plus flagged inconsistencies — name/age/appearance drift, timeline conflicts.",
    system: `You are a continuity editor and story-bible compiler. You catalog what the text actually establishes and flag where it contradicts itself. ${GROUND}`,
    instructions: `Compile a character & continuity bible for the manuscript below AND flag inconsistencies. Use Markdown with these sections:

## Character Bible
For each named character: their role, the physical/character traits the text actually states, and key relationships. Note where details are given.
## Timeline
The story's chronology and sequence as far as the text specifies it (ages, dates, time spans, "X years later", etc.).
## Continuity Flags
Contradictions in the text — a character's name/age/eye-color/appearance changing, timeline conflicts, a character knowing something before they could, geography that doesn't add up. Quote the conflicting spots. If you find none, say "No clear continuity contradictions found."

Only use what is in the text. ${GROUND}`,
    sectionTask:
      "For a continuity bible: record each named character and the exact traits/descriptions the text states (appearance, age, relationships), all timeline/chronology markers, and any internal contradictions you notice — quote the specifics. Use real names.",
    scope: "full",
  },
  marketing: {
    label: "Marketing copy",
    blurb: "Logline, elevator pitch, back-cover blurb, and taglines — reusable everywhere.",
    system: `You are a marketing copywriter for fiction. You write enticing, professional cover and pitch copy. ${GROUND}`,
    instructions: `Write marketing copy for the novel below, in Markdown with these sections:

## Logline
One vivid sentence.
## Elevator Pitch
2–3 sentences — the hook, the stakes, the why-care.
## Back-Cover Blurb
150–200 words of enticing back-cover copy that raises the central question and the stakes WITHOUT spoiling the ending.
## Taglines
3–5 short tagline options.

Ground every detail in the actual book — real characters, premise, and tone. Do not invent plot. ${GROUND}`,
    sectionTask:
      "Capture for marketing copy: the premise, the hook, the main characters and what's at stake, the setting, and the tone — all from the text, no invention. The ending need not be included.",
    scope: "full",
  },
};

export const DOC_TYPE_ORDER: DocType[] = [
  "synopsis",
  "opening_critique",
  "line_edit",
  "continuity",
  "marketing",
];

export interface ExtractedIssue {
  title: string;
  description: string;
  category: string;
}

export interface SuggestionResult {
  content: string;
  model: string;
}

/** Build the prompt for brainstorming a stuck scene, optionally grounded in the book. */
export function buildBrainstormPrompt(
  scene: string,
  manuscriptText: string | null,
  maxChars: number,
): string {
  let prompt = `Give 3–4 genuinely distinct options for the scene or sticking point below — different in approach, not variations of one idea. For each option: a short **bold label**, then 2–4 sentences sketching it, then one line on why it works. Use Markdown.

SCENE / STUCK SPOT:
${scene}`;

  if (manuscriptText && manuscriptText.trim()) {
    const { text, truncated } = clampManuscript(manuscriptText, maxChars);
    prompt += `\n\nFor reference, here is the manuscript so your ideas fit its world, characters, and voice:${truncationNote(
      truncated,
      text.length,
    )}\n\n---\nMANUSCRIPT:\n\n${text}`;
  }
  return prompt;
}

export interface EditPair {
  find: string;
  replace: string;
}

export interface EditsParsed {
  edits: EditPair[];
  note: string;
}

/** Build the prompt that turns an approved suggestion into find/replace edits. */
export function buildEditPrompt(
  issueTitle: string,
  suggestionContent: string,
  manuscriptText: string,
  maxChars: number,
): string {
  const { text, truncated } = clampManuscript(manuscriptText, maxChars);
  return `You are turning an approved editorial fix into precise text edits for the manuscript below.

THE FIX (for the issue "${issueTitle}"):
${suggestionContent}

Produce concrete find-and-replace edits that implement this fix. Rules:
- "find" MUST be text copied VERBATIM from the manuscript — an exact sentence or short passage that appears in it, contained within a SINGLE paragraph. Do not paraphrase the "find".
- "replace" is the revised version of that passage.
- If the fix quotes "Before"/"After" text (or any specific passage), turn each one into an edit: "find" = the Before/quoted passage verbatim from the manuscript, "replace" = the After/revised version.
- For an INSERTION (adding new text at a spot), set "find" = the exact existing sentence at that spot and "replace" = that same sentence followed by the new text.
- Be GENEROUS: produce an edit for every part of the fix that can be expressed as an in-place text change, even if some other parts can't. Prefer several small, surgical edits.
- Return an empty "edits" array ONLY when there is genuinely no in-place text change possible at all (e.g. "reorder these chapters" with no specific wording given). If only SOME parts are structural, still return edits for the parts that aren't, and mention the rest in "note".

Respond with ONLY a JSON object, no surrounding prose:
{"edits":[{"find":"<verbatim original passage>","replace":"<revised passage>"}],"note":"optional caveat or empty string"}${truncationNote(truncated, text.length)}

---
MANUSCRIPT:

${text}`;
}

/** Defensively parse the edits JSON. */
export function parseEdits(raw: string): EditsParsed {
  let jsonStr = raw.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();
  if (!jsonStr.startsWith("{")) {
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    if (start !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1);
  }

  const parsed = JSON.parse(jsonStr);
  const edits: EditPair[] = Array.isArray(parsed.edits)
    ? parsed.edits
        .filter(
          (e: unknown): e is Record<string, unknown> =>
            !!e && typeof e === "object",
        )
        .filter(
          (e: Record<string, unknown>) =>
            typeof e.find === "string" &&
            e.find.trim() !== "" &&
            typeof e.replace === "string",
        )
        .map((e: Record<string, unknown>) => ({
          find: String(e.find),
          replace: String(e.replace),
        }))
    : [];

  return { edits, note: typeof parsed.note === "string" ? parsed.note.trim() : "" };
}

export interface RecheckVerdict {
  id: string;
  status: "resolved" | "outstanding";
  note: string;
}

export interface RecheckParsed {
  verdicts: RecheckVerdict[];
  grade: string;
  summary: string;
}

export interface RecheckIssueInput {
  id: string;
  title: string;
  description: string | null;
}

/** Build the prompt for re-checking outstanding issues against a revised draft. */
export function buildRecheckPrompt(
  issues: RecheckIssueInput[],
  manuscriptText: string,
  lens: string,
  maxChars: number,
): string {
  const { text, truncated } = clampManuscript(manuscriptText, maxChars);
  const issueList = issues.length
    ? issues
        .map(
          (i) =>
            `- id: ${i.id}\n  title: ${i.title}${i.description ? `\n  detail: ${i.description}` : ""}`,
        )
        .join("\n")
    : "(no outstanding issues remain)";

  return `A revised version of a manuscript is below. For each OUTSTANDING issue listed, judge whether this revision has RESOLVED it or it is STILL OUTSTANDING, with a one-sentence note grounded in the text. Then give the revised manuscript an updated letter grade (A+ to F) for its ${lens}.

Respond with ONLY a JSON object, no surrounding prose:
{"verdicts":[{"id":"<the exact issue id>","status":"resolved"|"outstanding","note":"one sentence"}],"grade":"<A+ to F>","summary":"2-4 sentences on what improved and what still needs work"}

Use the exact id strings provided. Only include verdicts for the issues listed.${truncationNote(truncated, text.length)}

OUTSTANDING ISSUES:
${issueList}

---
REVISED MANUSCRIPT:

${text}`;
}

/** Defensively parse the re-check JSON (tolerates fences / stray prose). */
export function parseRecheck(raw: string): RecheckParsed {
  let jsonStr = raw.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();
  if (!jsonStr.startsWith("{")) {
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    if (start !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1);
  }

  const parsed = JSON.parse(jsonStr);
  const verdicts: RecheckVerdict[] = Array.isArray(parsed.verdicts)
    ? parsed.verdicts
        .filter((v: unknown): v is Record<string, unknown> => !!v && typeof v === "object")
        .filter((v: Record<string, unknown>) => typeof v.id === "string")
        .map((v: Record<string, unknown>) => ({
          id: String(v.id),
          status: v.status === "resolved" ? "resolved" : "outstanding",
          note: typeof v.note === "string" ? v.note.trim() : "",
        }))
    : [];

  return {
    verdicts,
    grade: typeof parsed.grade === "string" ? parsed.grade.trim().slice(0, 5) : "",
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
  };
}

/** Build the user prompt for a single-issue fix suggestion, grounded in the text. */
export function buildSuggestPrompt(
  issueTitle: string,
  issueDescription: string | null,
  manuscriptText: string,
  maxChars: number,
): string {
  const { text: clamped, truncated } = clampManuscript(manuscriptText, maxChars);
  const issue = issueDescription ? `${issueTitle}\n${issueDescription}` : issueTitle;
  return `ISSUE TO FIX:
${issue}

Propose 2–4 concrete, specific ways to address this single issue in the manuscript below. Be actionable, not vague. Where a fix means changing particular wording, show a short before → after example — and the "before" MUST be text copied verbatim from the manuscript, not an invented or paraphrased line. Use Markdown with a brief intro and a list.

${STORY_GROUNDING}
Only reference characters, scenes, and events that actually appear in the material. If the manuscript text you were given doesn't contain the passage an idea would touch (e.g. you're working from section notes), describe the fix in general terms instead of quoting a line you can't see.${truncationNote(truncated, clamped.length)}

---
MANUSCRIPT:

${clamped}`;
}

const ISSUE_CATEGORIES =
  "Plot, Structure, Pacing, Character, Prose, Voice, Theme, Marketability, Positioning, Audience, Other";

export const EXTRACT_INSTRUCTIONS = `Break the editorial review below into discrete, individually-actionable issues — one per distinct piece of feedback. Do not invent issues that aren't in the review, and don't merge unrelated points.

Respond with ONLY a JSON object, no surrounding prose, in this exact shape:
{"issues":[{"title":"short imperative summary","description":"the specific feedback, in a sentence or two","category":"one of: ${ISSUE_CATEGORIES}"}]}`;

// --- Editorial analysis: parse comments + dual agree/disagree verdicts -------

export interface EditorialCommentParsed {
  quote: string;
  comment: string;
  category: string;
}

export const EXTRACT_COMMENTS_INSTRUCTIONS = `Below is an editorial analysis of a novel (an edit letter, reader report, or a document of margin notes). Break it into the discrete, individual comments the editor is making — one entry per distinct note or critique. Do not invent comments that aren't there, and don't merge unrelated points into one.

For each comment capture:
- "quote": ONLY if the analysis itself quotes or reproduces a manuscript passage for this comment, copy that passage verbatim. You are reading the ANALYSIS, not the manuscript — you do not have the manuscript, so never reconstruct, guess, paraphrase, or infer a passage. If the analysis doesn't quote one, use an empty string.
- "comment": the editor's actual note or critique, faithful to their meaning, a sentence or two. Do not add points the editor didn't make.
- "category": one of: ${ISSUE_CATEGORIES}.

Respond with ONLY a JSON object, no surrounding prose, in this exact shape:
{"comments":[{"quote":"passage the analysis quotes, or empty string","comment":"the editor's note","category":"one of the categories"}]}`;

/** Defensively parse an LLM's JSON editorial-comment list. */
export function parseEditorialComments(raw: string): EditorialCommentParsed[] {
  let jsonStr = raw.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();
  if (!jsonStr.startsWith("{") && !jsonStr.startsWith("[")) {
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    if (start !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1);
  }

  const parsed = JSON.parse(jsonStr);
  const arr = Array.isArray(parsed) ? parsed : parsed.comments;
  if (!Array.isArray(arr)) return [];

  return arr
    .filter((x) => x && typeof x.comment === "string" && x.comment.trim())
    .map((x) => ({
      quote: typeof x.quote === "string" ? x.quote.trim() : "",
      comment: String(x.comment).trim(),
      category: typeof x.category === "string" && x.category.trim() ? x.category.trim() : "Other",
    }));
}

export interface AssessInput {
  id: string;
  quote: string | null;
  comment: string;
}

export interface AssessmentParsed {
  id: string;
  stance: "agree" | "disagree" | "partial";
  reasoning: string;
}

/** Prompt: have a model judge each editorial comment against the actual manuscript. */
export function buildAssessPrompt(
  comments: AssessInput[],
  manuscriptText: string,
  maxChars: number,
): string {
  const { text, truncated } = clampManuscript(manuscriptText, maxChars);
  const list = comments
    .map(
      (c) =>
        `- id: ${c.id}\n  ${c.quote ? `passage: ${JSON.stringify(c.quote)}\n  ` : ""}comment: ${JSON.stringify(c.comment)}`,
    )
    .join("\n");

  return `You are a developmental editor reviewing ANOTHER editor's analysis of the manuscript below. For EACH numbered comment, decide whether you AGREE with it, DISAGREE with it, or PARTIALLY agree — judged against what the manuscript actually does. Give a one- to two-sentence reason grounded in the text.

Use "agree" when the comment identifies a real issue worth acting on; "disagree" when it's off-base, already handled by the text, or a matter of taste you'd push back on; "partial" when there's a valid kernel but you'd qualify or narrow it.

${STORY_GROUNDING}
Extra rule for this task: your reasoning must not fabricate textual evidence. Do NOT claim the manuscript "already does" something, or that a scene/line/character exists, unless it verifiably appears in the material above. If you cannot verify a comment against the text you were given (including when it's section notes that may not cover the relevant spot), choose "partial" and say plainly what you could not confirm — never invent a passage or event to justify a verdict.

Respond with ONLY a JSON object, no surrounding prose:
{"assessments":[{"id":"<the exact id>","stance":"agree"|"disagree"|"partial","reasoning":"one or two sentences"}]}

Use the exact id strings provided, one assessment per comment.${truncationNote(truncated, text.length)}

EDITORIAL COMMENTS TO JUDGE:
${list}

---
MANUSCRIPT:

${text}`;
}

/** Defensively parse the assessment JSON. */
export function parseAssessments(raw: string): AssessmentParsed[] {
  let jsonStr = raw.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();
  if (!jsonStr.startsWith("{") && !jsonStr.startsWith("[")) {
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    if (start !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1);
  }

  const parsed = JSON.parse(jsonStr);
  const arr = Array.isArray(parsed) ? parsed : parsed.assessments;
  if (!Array.isArray(arr)) return [];

  return arr
    .filter((x) => x && typeof x.id === "string" && x.id.trim())
    .map((x) => {
      const s = typeof x.stance === "string" ? x.stance.trim().toLowerCase() : "";
      const stance = s === "agree" || s === "disagree" ? s : "partial";
      return {
        id: String(x.id).trim(),
        stance: stance as AssessmentParsed["stance"],
        reasoning: typeof x.reasoning === "string" ? x.reasoning.trim() : "",
      };
    });
}

// --- StoryDNA (V2): structural discovery + protagonist ID --------------------

export const STORYDNA_SYSTEM = `You are StoryDNA, a story-intelligence engine. You read a novel manuscript and extract its structural DNA — chapters, characters, locations, organizations, and timeline — and you identify the single primary protagonist with grounded reasoning. You rely ONLY on the manuscript: never invent people, places, events, or names that are not in the text. Output ONLY the JSON object requested, with no surrounding prose.`;

export function buildStoryDnaPrompt(manuscriptText: string, maxChars: number): string {
  const { text, truncated } = clampManuscript(manuscriptText, maxChars);
  return `Analyze the manuscript below and extract its Story DNA. Respond with ONLY a JSON object in EXACTLY this shape:

{
  "chapters_count": <integer — number of chapters/numbered sections; 0 if it isn't clearly chaptered>,
  "major_characters": [{"name":"Real Name","role":"protagonist|antagonist|deuteragonist|major","note":"one short line"}],
  "supporting_characters": [{"name":"Real Name","role":"short role","note":"one short line"}],
  "locations": [{"name":"Real place from the text","note":"one short line"}],
  "organizations": [{"name":"Real org/institution from the text","note":"one short line"}],
  "timeline_anchors": [{"label":"a concrete time marker or key dated event","note":"one short line"}],
  "protagonist": {"name":"Real Name","role":"Protagonist","confidence":<number 0..1>,"reasoning":"2-3 sentences on why THIS character is the primary protagonist — grounded in the text: POV, page presence, whose choices drive the plot, whose arc the story follows","evidence":[{"quote":"<verbatim passage>","locator":"<where, optional>"}]},
  "first_question": {"key":"protagonist_trait_intentional","trait":"the single most salient personality trait of the protagonist (e.g. 'emotionally restrained', 'fiercely loyal', 'quick to anger')","text":"<Protagonist name> appears <trait> throughout much of the manuscript. Is this an intentional personality trait?"},
  "summary": {"text":"a 2-3 sentence plot summary of the story","evidence":[{"quote":"<verbatim passage>","locator":"<where, optional>"}]},
  "themes": [{"name":"Theme (one or two words)","evidence":[{"quote":"<verbatim passage that expresses this theme>","locator":"<where, optional>"}]}],
  "about": {"text":"what the story is REALLY about beneath the plot — its central message or preoccupation","evidence":[{"quote":"<verbatim passage>","locator":"<where, optional>"}]},
  "emotional_promise": {"beginning":"the emotional experience the opening promises the reader","middle":"the emotional experience through the middle","ending":"the emotional experience at the climax/ending","after_finishing":"the lasting feeling the reader is left with","evidence":[{"quote":"<verbatim passage>","locator":"<where, optional>"}]}
}

Rules:
- Use ONLY real names, places, and events from the manuscript. Invent nothing.
- Keep lists tight and de-duplicated: major_characters ≤ 8, supporting_characters ≤ 15, locations ≤ 15, organizations ≤ 12, timeline_anchors ≤ 12, themes 3–6.
- "protagonist" is the SINGLE character the story most centers on — the one whose journey the book follows.
- "first_question.text" MUST follow this template verbatim, substituting the real protagonist name and the salient trait: "<Name> appears <trait> throughout much of the manuscript. Is this an intentional personality trait?"
- confidence reflects how clearly the text points to that protagonist (1 = unmistakable).
- EVIDENCE IS REQUIRED for protagonist, summary, each theme, about, and emotional_promise. Every "quote" MUST be copied VERBATIM from the manuscript (an exact short passage, ≤ 25 words) — do NOT paraphrase, and never invent a quote. Give 1–3 pieces of evidence each. "locator" is a brief pointer (e.g. a chapter or scene) or an empty string. If you cannot find a real supporting quote for a conclusion, give fewer or none rather than fabricating.${truncationNote(truncated, text.length)}

---
MANUSCRIPT:

${text}`;
}

function asEntities(v: unknown, max: number): StoryDnaEntity[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      name: typeof x.name === "string" ? x.name.trim() : "",
      role: typeof x.role === "string" ? x.role.trim() : undefined,
      note: typeof x.note === "string" ? x.note.trim() : undefined,
    }))
    .filter((e) => e.name)
    .slice(0, max);
}

function asAnchors(v: unknown, max: number): StoryDnaTimelineAnchor[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      label:
        typeof x.label === "string"
          ? x.label.trim()
          : typeof x.name === "string"
            ? x.name.trim()
            : "",
      note: typeof x.note === "string" ? x.note.trim() : undefined,
    }))
    .filter((a) => a.label)
    .slice(0, max);
}

function asEvidence(v: unknown): Evidence[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      quote: typeof x.quote === "string" ? x.quote.trim() : "",
      locator: typeof x.locator === "string" && x.locator.trim() ? x.locator.trim() : null,
      verified: false,
    }))
    .filter((e) => e.quote)
    .slice(0, 3);
}

function asText(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function alignedText(v: unknown): AlignedText {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    proposed: asText(o.text),
    response: null,
    final: null,
    note: null,
    evidence: asEvidence(o.evidence),
    updated_at: null,
  };
}

function parseThemes(v: unknown): AlignedThemes {
  const arr = Array.isArray(v) ? v : [];
  const proposed: ThemeProposal[] = arr
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({ name: asText(x.name).slice(0, 60), evidence: asEvidence(x.evidence) }))
    .filter((t) => t.name)
    .slice(0, 6);
  return { proposed, response: null, final: null, note: null, updated_at: null };
}

function parseEmotional(v: unknown): AlignedEmotional {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    proposed: {
      beginning: asText(o.beginning),
      middle: asText(o.middle),
      ending: asText(o.ending),
      after_finishing: asText(o.after_finishing),
    },
    response: null,
    final: null,
    note: null,
    evidence: asEvidence(o.evidence),
    updated_at: null,
  };
}

function normConfidence(v: unknown): number {
  let n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : 0.8;
  if (!isFinite(n)) n = 0.8;
  if (n > 1) n = n / 100; // tolerate a 0..100 scale
  return Math.max(0, Math.min(1, n));
}

/** Defensively parse the StoryDNA JSON into a fully-populated, safe shape. */
export function parseStoryDna(raw: string): StoryDnaData {
  let jsonStr = raw.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();
  if (!jsonStr.startsWith("{")) {
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    if (start !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1);
  }

  const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

  const major = asEntities(parsed.major_characters, 8);
  const supporting = asEntities(parsed.supporting_characters, 15);

  const p = (parsed.protagonist ?? {}) as Record<string, unknown>;
  const protagonist: StoryDnaProtagonist = {
    name:
      (typeof p.name === "string" && p.name.trim()) ||
      major[0]?.name ||
      "Unknown",
    role: typeof p.role === "string" && p.role.trim() ? p.role.trim() : "Protagonist",
    confidence: normConfidence(p.confidence),
    reasoning:
      typeof p.reasoning === "string" && p.reasoning.trim()
        ? p.reasoning.trim()
        : "Identified as the character the narrative most closely follows.",
    evidence: asEvidence(p.evidence),
  };

  const zeroScore = { value: 0, rationale: "" };

  const q = (parsed.first_question ?? {}) as Record<string, unknown>;
  const trait =
    typeof q.trait === "string" && q.trait.trim() ? q.trait.trim() : "reserved";
  const questionText =
    typeof q.text === "string" && q.text.trim()
      ? q.text.trim()
      : `${protagonist.name} appears ${trait} throughout much of the manuscript. Is this an intentional personality trait?`;
  const first_question: StoryDnaQuestion = {
    key: typeof q.key === "string" && q.key.trim() ? q.key.trim() : "protagonist_trait_intentional",
    trait,
    text: questionText,
  };

  const chapters =
    typeof parsed.chapters_count === "number"
      ? Math.max(0, Math.round(parsed.chapters_count))
      : 0;

  return {
    chapters_count: chapters,
    major_characters: major,
    supporting_characters: supporting,
    locations: asEntities(parsed.locations, 15),
    organizations: asEntities(parsed.organizations, 12),
    timeline_anchors: asAnchors(parsed.timeline_anchors, 12),
    protagonist,
    first_question,
    summary: alignedText(parsed.summary),
    themes: parseThemes(parsed.themes),
    about: alignedText(parsed.about),
    emotional_promise: parseEmotional(parsed.emotional_promise),
    confidence: {
      story: { ...zeroScore },
      theme: { ...zeroScore },
      character: { ...zeroScore },
      message: { ...zeroScore },
    },
  };
}

/** Defensively parse an LLM's JSON issue list (tolerates code fences / stray prose). */
export function parseExtractedIssues(raw: string): ExtractedIssue[] {
  let jsonStr = raw.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();
  if (!jsonStr.startsWith("{") && !jsonStr.startsWith("[")) {
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    if (start !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1);
  }

  const parsed = JSON.parse(jsonStr);
  const arr = Array.isArray(parsed) ? parsed : parsed.issues;
  if (!Array.isArray(arr)) return [];

  return arr
    .filter((x) => x && typeof x.title === "string" && x.title.trim())
    .map((x) => ({
      title: String(x.title).trim().slice(0, 300),
      description: typeof x.description === "string" ? x.description.trim() : "",
      category: typeof x.category === "string" && x.category.trim() ? x.category.trim() : "Other",
    }));
}
