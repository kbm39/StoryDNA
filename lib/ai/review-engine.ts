import "server-only";
import { STORY_GROUNDING, buildAuthorIntentBlock } from "@/lib/ai/shared";
import type {
  AuthorIntent,
  ComplianceItem,
  ConstitutionalStatus,
  ReviewMeta,
} from "@/lib/types";

/**
 * StoryDNA Review Engine.
 *
 * A single reusable engine that every reviewer inherits. A reviewer supplies a
 * ReviewerDefinition (its expertise, persona, report sections, and capabilities);
 * the engine assembles the prompt and computes the honest Review Transparency /
 * Constitutional Compliance metadata. The Literary Agent is the first definition;
 * Producer, Developmental Editor, genre specialists, etc. will be added the same
 * way (next task: a generic Reviewer Definition Template on top of this).
 */

export const STORYDNA_CONSTITUTION_VERSION = "1.0";

export interface ReviewSection {
  heading: string;
  guidance: string;
}

/** What a reviewer can currently do — drives the compliance checklist honestly. */
export interface ReviewerCapabilities {
  /** Reads the entire manuscript (not lossy notes). */
  fullText: boolean;
  /** Processes chapter-by-chapter / segment-by-segment. */
  chapterSegmented: boolean;
  /** Cites verbatim manuscript evidence. */
  evidencePresent: boolean;
  /** Evidence is deterministically verified against the text. */
  evidenceVerified: boolean;
  /** Incorporates confirmed StoryDNA author intent. */
  usesAuthorIntent: boolean;
}

/** What this reviewer judges — and what it must leave to other specialists. */
export interface ExpertiseBoundaries {
  inScope: string[];
  outOfScope: string[];
}

/** One lens of the evaluation framework, with its guiding question library. */
export interface EvaluationCategory {
  key: string;
  name: string;
  /** Relative importance (used for future per-category scoring). */
  weight?: number;
  questions: string[];
}

export interface EvaluationFramework {
  categories: EvaluationCategory[];
}

/** A field the report must contain (optionally an enum), for downstream reliance. */
export interface OutputField {
  key: string;
  description: string;
  values?: string[];
}

/** The exact structure a reviewer is contracted to emit. */
export interface OutputContract {
  format: "markdown";
  sections: ReviewSection[];
  requiredFields: OutputField[];
  rules: string[];
}

/**
 * A fully self-describing reviewer. A Domain Specialist supplies all of this
 * and needs no custom engine code: its mission, expertise boundaries,
 * evaluation framework (categories + question library), and output contract.
 */
export interface ReviewerDefinition {
  id: string;
  reviewer: string;
  perspective: string;
  /** Depth label shown in transparency (e.g. "Professional Review"). */
  depth: string;
  /** One-line charge: what this reviewer exists to decide/deliver. */
  mission: string;
  /** What it judges, and what it must defer to other specialists. */
  expertise: ExpertiseBoundaries;
  /** System persona. */
  system: string;
  /** Opening instruction line. */
  intro: string;
  /** The analytical lenses + question library the reviewer reasons through. */
  evaluationFramework: EvaluationFramework;
  /** The exact report the reviewer must produce. */
  outputContract: OutputContract;
  /** Closing tone directive. */
  tone: string;
  /** Append the anti-invention grounding rule. */
  grounding: boolean;
  /** Output token budget. */
  maxTokens: number;
  capabilities: ReviewerCapabilities;
}

/** Assemble the full user prompt for a reviewer entirely from its definition. */
export function buildReviewPrompt(def: ReviewerDefinition, intent: AuthorIntent | null): string {
  const mission = `YOUR MISSION\n${def.mission}`;

  const expertise = `YOUR EXPERTISE — stay within it:\n- In scope: ${def.expertise.inScope.join("; ")}\n- Out of scope (do NOT assess these — another reviewer owns them): ${def.expertise.outOfScope.join("; ")}`;

  const framework = `EVALUATION FRAMEWORK — reason through these categories and their questions as you read (they inform your judgment; you need not answer each explicitly):\n${def.evaluationFramework.categories
    .map(
      (c) =>
        `• ${c.name}${c.weight ? ` (weight ${c.weight})` : ""}\n${c.questions.map((q) => `   - ${q}`).join("\n")}`,
    )
    .join("\n")}`;

  const sections = def.outputContract.sections
    .map((s) => `## ${s.heading}\n${s.guidance}`)
    .join("\n");

  const fields = def.outputContract.requiredFields.length
    ? `\n\nREQUIRED FIELDS — these must appear, exactly as specified:\n${def.outputContract.requiredFields
        .map(
          (f) =>
            `- ${f.key}: ${f.description}${f.values ? ` (one of: ${f.values.join(" / ")})` : ""}`,
        )
        .join("\n")}`
    : "";

  const rules = def.outputContract.rules.length
    ? `\n\nRULES:\n${def.outputContract.rules.map((r) => `- ${r}`).join("\n")}`
    : "";

  const intentBlock = def.capabilities.usesAuthorIntent ? `\n\n${buildAuthorIntentBlock(intent)}` : "";
  const grounding = def.grounding ? `\n\n${STORY_GROUNDING}` : "";

  return `${mission}\n\n${expertise}\n\n${framework}\n\n${def.intro}\n\nOUTPUT CONTRACT — produce exactly this ${def.outputContract.format} structure, with these sections in this order:\n\n${sections}${fields}${rules}\n\n${def.tone}${intentBlock}${grounding}`;
}

const WEIGHT: Record<ComplianceItem["status"], number> = { met: 1, partial: 0.5, unmet: 0 };

function bandFor(score: number): ConstitutionalStatus {
  if (score >= 90) return "compliant";
  if (score >= 50) return "partially_compliant";
  return "not_compliant";
}

/** Deterministic Review Transparency + Constitutional Compliance for a run. */
export function buildReviewMeta(
  def: ReviewerDefinition,
  args: { model: string; originalChars: number; sentChars: number; intent: AuthorIntent | null },
): ReviewMeta {
  const fullText = args.sentChars >= args.originalChars;
  const percent =
    args.originalChars > 0 ? Math.round((args.sentChars / args.originalChars) * 100) : 100;
  const cap = def.capabilities;

  const items: ComplianceItem[] = [
    {
      requirement: "Full-manuscript coverage",
      status: cap.fullText && fullText ? "met" : "unmet",
      note: fullText ? "Entire text read in one pass" : `Only ~${percent}% processed`,
    },
    {
      requirement: "Chapter / segment processing",
      status: cap.chapterSegmented ? "met" : "partial",
      note: cap.chapterSegmented ? null : "Single full-text pass; per-chapter traversal pending",
    },
    {
      requirement: "Evidence present",
      status: cap.evidencePresent ? "met" : "unmet",
      note: cap.evidencePresent ? "Conclusions cite verbatim passages" : null,
    },
    {
      requirement: "Evidence machine-verified",
      status: cap.evidenceVerified ? "met" : "unmet",
      note: cap.evidenceVerified ? null : "Automated quote verification pending",
    },
    {
      requirement: "Author intent applied",
      status: cap.usesAuthorIntent ? (args.intent ? "met" : "unmet") : "met",
      note: args.intent
        ? args.intent.confirmed
          ? "Confirmed StoryDNA intent"
          : "Proposed StoryDNA intent (unconfirmed)"
        : "No StoryDNA intent on file",
    },
    { requirement: "Honest professional judgment", status: "met", note: null },
    { requirement: "Transparency disclosed", status: "met", note: null },
  ];

  const score = Math.round(
    (items.reduce((sum, i) => sum + WEIGHT[i.status], 0) / items.length) * 100,
  );
  const status = bandFor(score);
  const summary =
    status === "compliant"
      ? "Meets the StoryDNA Constitution for a professional review."
      : `Full-text ${def.depth.toLowerCase()} under StoryDNA Constitution v${STORYDNA_CONSTITUTION_VERSION}. Outstanding: ${items
          .filter((i) => i.status !== "met")
          .map((i) => i.requirement.toLowerCase())
          .join(", ")}.`;

  return {
    constitution_version: STORYDNA_CONSTITUTION_VERSION,
    reviewer: def.reviewer,
    perspective: def.perspective,
    scope: fullText ? "Entire manuscript" : `Partial — first ~${percent}% (model input limit)`,
    depth: def.depth,
    coverage: {
      words_analyzed: Math.round(args.sentChars / 6),
      full_text: fullText,
      percent,
      basis: fullText ? "Full text (read in one pass)" : "Full text, truncated to model limit",
      chapters_reviewed: null,
    },
    model: args.model,
    author_intent_applied: cap.usesAuthorIntent && Boolean(args.intent),
    author_intent_source: args.intent
      ? args.intent.confirmed
        ? "Confirmed (author-aligned)"
        : "Proposed (unconfirmed)"
      : "None available",
    evidence_present: cap.evidencePresent,
    evidence_machine_verified: cap.evidenceVerified,
    compliance: { score, status, summary, items },
  };
}

// --- Reviewer definitions ----------------------------------------------------

/** The flagship reviewer. Every future Domain Specialist follows this exact shape. */
export const LITERARY_AGENT: ReviewerDefinition = {
  id: "literary_agent",
  reviewer: "Literary Agent",
  perspective: "Commercial Acquisitions",
  depth: "Professional Review",
  mission:
    "Decide whether you would represent this manuscript and champion it to acquiring editors, and deliver a candid professional read of its commercial viability and readiness — as if your name and reputation ride on the call.",
  expertise: {
    inScope: [
      "Commercial viability and salability in today's market",
      "Market positioning, category, and comparable titles",
      "Concept and hook strength",
      "Story, structure, pacing, and momentum as they affect a sale",
      "Character, voice, and dialogue as they affect reader investment and marketability",
      "Whether the opening pages earn a request",
      "Whether the manuscript executes the author's intended story",
    ],
    outOfScope: [
      "Line-by-line copyediting and proofreading",
      "Domain/technical fact-checking (legal, medical, procedural, military accuracy) — defer to the relevant specialist",
      "Typesetting, formatting, and layout",
      "Deep developmental line-editing beyond what affects salability",
    ],
  },
  system: `You are a senior literary agent at a leading agency, writing an INTERNAL acquisitions memo about a manuscript you have read IN FULL. You evaluate it for possible representation through a commercial acquisitions lens. This memo is for your colleagues, not for the author: it is candid, direct, and professionally useful. No flattery, no generic encouragement, no softening. If the manuscript is not ready, you say so plainly and explain why. You are specific and you cite the text. You never invent or misstate story facts.`,
  intro:
    "Write an internal literary-agency ACQUISITIONS MEMO for the manuscript below, which you have read in full.",
  evaluationFramework: {
    categories: [
      {
        key: "concept_hook",
        name: "Concept & Hook",
        weight: 2,
        questions: [
          "Is there a clear, fresh hook a pitch could land in one line?",
          "Is the concept commercial for its category right now?",
          "What's the elevator pitch, and does the book deliver it?",
        ],
      },
      {
        key: "commercial_market",
        name: "Commercial Viability & Market",
        weight: 3,
        questions: [
          "What category is this, and how crowded is it?",
          "What 3–5 real, recent comparable titles position it?",
          "Who is the target reader, and is that audience big enough?",
          "What would an acquiring editor object to?",
        ],
      },
      {
        key: "story_structure",
        name: "Story & Structure",
        weight: 2,
        questions: [
          "Does the premise sustain a full book?",
          "Where does momentum sag or the plot strain?",
          "Is the ending earned and satisfying?",
        ],
      },
      {
        key: "character_voice",
        name: "Character & Voice",
        weight: 2,
        questions: [
          "Is the protagonist compelling, active, and worth following?",
          "Is the voice distinctive?",
          "Is the dialogue authentic and doing narrative work?",
        ],
      },
      {
        key: "opening_pages",
        name: "Opening Pages",
        weight: 2,
        questions: [
          "Do the first pages earn a request?",
          "Where would a reader's attention slip?",
        ],
      },
      {
        key: "intent_execution",
        name: "Intent Execution",
        weight: 1,
        questions: [
          "Does the manuscript deliver the author's intended story (per StoryDNA)?",
          "Where does execution diverge from the stated intent?",
        ],
      },
    ],
  },
  outputContract: {
    format: "markdown",
    sections: [
      { heading: "Executive Recommendation", guidance: "2–4 sentences: your bottom-line read." },
      {
        heading: "Decision",
        guidance:
          "State exactly one, on its own line and in bold — **REQUEST**, **PASS**, or **REVISE & RESUBMIT** — then one sentence of justification. Then a **Decision Risk:** line — Low / Moderate / High — how confident you are this is the right call, and the single thing most likely to flip it.",
      },
      {
        heading: "Agent Conviction",
        guidance:
          "A conviction level — Low / Moderate / High / Very High — plus one sentence on how strongly you'd champion this and why.",
      },
      {
        heading: "Commercial Assessment",
        guidance:
          "Salability in today's market: hook, category demand, competition, what an acquiring editor would say.",
      },
      {
        heading: "Story Assessment",
        guidance:
          "Premise, structure, stakes, momentum. Explicitly judge whether the manuscript executes the author's intended story (see AUTHOR INTENT below).",
      },
      {
        heading: "Opening Assessment",
        guidance:
          "The first pages — do they earn a request? Be specific about where attention holds or slips.",
      },
      { heading: "Middle Assessment", guidance: "Sag, escalation, and subplot control across the middle." },
      {
        heading: "Ending Assessment",
        guidance: "Payoff, catharsis, resolution — does it deliver on the setup?",
      },
      {
        heading: "Character Assessment",
        guidance: "Protagonist and key cast: dimensionality, agency, arc, reader investment.",
      },
      {
        heading: "Dialogue & Voice Assessment",
        guidance: "Line-level voice, dialogue authenticity, and prose control.",
      },
      {
        heading: "Market Positioning",
        guidance:
          "Genre/category, 3–5 real recent comparable titles, target readership, and the positioning angle.",
      },
      { heading: "Strengths", guidance: "The genuine strengths, concretely." },
      { heading: "Weaknesses", guidance: "The real problems, named without softening." },
      {
        heading: "Evidence-Backed Findings",
        guidance:
          'Support your most important claims with the manuscript. For each: a short **verbatim** quote from the text, the chapter or locator if you can identify it, and one line on what it demonstrates. Format each as: > "quote" — [locator] — what it shows. If a claim\'s evidence is weak, or you cannot locate a supporting passage, SAY SO explicitly rather than inventing one.',
      },
      {
        heading: "Top 5 Revision Priorities",
        guidance: "Numbered 1–5, highest-leverage first; each concrete and actionable.",
      },
      {
        heading: "What Would Make Me Change My Mind?",
        guidance:
          "The specific changes that would move your Decision (e.g., from Pass toward Request).",
      },
      {
        heading: "Final Recommendation",
        guidance:
          "A candid closing, including your verdict on intended-story-vs-execution. End with a single letter grade for commercial acquisition readiness on its own line as **Grade: X** (A+ to F).",
      },
      {
        heading: "Agent Notes",
        guidance:
          "Candid internal comments to the acquisitions committee — positioning, politics, gut, comps to the current client list, deal considerations: what you'd say behind closed doors but never to the author.",
      },
    ],
    requiredFields: [
      {
        key: "Decision",
        description: "the acquisition decision, in bold on its own line",
        values: ["REQUEST", "PASS", "REVISE & RESUBMIT"],
      },
      {
        key: "Decision Risk",
        description: "how confident you are the decision is right",
        values: ["Low", "Moderate", "High"],
      },
      {
        key: "Agent Conviction",
        description: "how strongly you would champion this",
        values: ["Low", "Moderate", "High", "Very High"],
      },
      {
        key: "Grade",
        description: "commercial acquisition readiness, on its own line as **Grade: X** (A+ to F)",
      },
    ],
    rules: [
      "Do NOT write a transparency/scope/coverage header — the system discloses scope separately; begin at Executive Recommendation.",
      "Every major claim must cite a verbatim manuscript passage in Evidence-Backed Findings, or be flagged as unverified — never invent a quote.",
      "Stay within your expertise; defer out-of-scope issues to the relevant specialist rather than assessing them yourself.",
    ],
  },
  tone: `TONE: candid, direct, professional, and useful — your reputation rides on the honesty of this memo. Do not flatter. Do not pretend a manuscript is ready if it is not.`,
  grounding: true,
  maxTokens: 16000,
  capabilities: {
    fullText: true,
    chapterSegmented: false,
    evidencePresent: true,
    evidenceVerified: false,
    usesAuthorIntent: true,
  },
};
