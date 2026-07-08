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

// --- Milestone 3: full self-describing reviewer ------------------------------

export type ReviewDepth = "quick_insight" | "professional" | "exhaustive";
export type ReviewScope =
  | "book"
  | "chapter"
  | "scene"
  | "dialogue"
  | "character"
  | "series";

/** The human character behind the perspective — makes each reviewer distinct. */
export interface ReviewerPersonality {
  archetype: string;
  traits: string[];
  directness: "low" | "moderate" | "high" | "very_high";
  warmth: "low" | "moderate" | "high";
  humor: "none" | "dry" | "warm";
  voiceNotes: string;
}

/** A body of professional knowledge the reviewer commands. */
export interface KnowledgeDomain {
  name: string;
  /** Referenceable standards / sources (e.g. "ATLS", "Publishers Marketplace"). */
  authorities: string[];
  keyConcepts: string[];
  /** Mistakes lay writers make in this domain — what to watch for. */
  commonErrors: string[];
}

export interface EvidenceRules {
  required: boolean;
  quoteMaxWords: number;
  requireLocator: boolean;
  /** Deterministic verification against the manuscript (future capability). */
  requireVerification: boolean;
  evidenceTypes: string[];
  unverifiedHandling: "flag" | "drop" | "downgrade_confidence";
}

/** Global constitution the engine enforces, plus reviewer-specific rules. */
export interface ConstitutionSpec {
  inherits: string;
  additionalRules: string[];
}

export interface RecommendationValue {
  value: string;
  meaning: string;
}

/** The reviewer's own verdict vocabulary (generalizes Decision/Risk). */
export interface RecommendationSpec {
  field: string;
  values: RecommendationValue[];
  risk?: { field: string; values: string[] };
}

export type ConfidenceScale = "letter_grade" | "score_0_100" | "credibility_bands";

export interface ConfidenceModel {
  scale: ConfidenceScale;
  method: "weighted_categories";
  /** Partial coverage caps confidence. */
  coverageWeighted: boolean;
  /** 0..1 — how much unverified evidence lowers confidence. */
  evidencePenalty: number;
}

export interface RevisionType {
  key: string;
  label: string;
  description: string;
}

export interface ReviewerAuthorQuestion {
  key: string;
  question: string;
  whenToAsk: string;
  answerType: "yes_no" | "text" | "choice";
}

export type DependencyKey =
  | "story_understanding"
  | "character_dna"
  | "canon"
  | "marketability"
  | "prior_reviews";

export interface ReviewerDependency {
  key: DependencyKey;
  required: boolean;
  usage: string;
}

/**
 * Signals the Board Assembler combines when recommending a reviewer. Per the
 * frozen design, selection is HYBRID — no single signal decides; genre, entities,
 * terminology, content, Story Understanding, and author preferences all weigh in.
 */
export type TriggerSignal =
  | "genre"
  | "theme"
  | "entity_type"
  | "terminology"
  | "content"
  | "story_understanding"
  | "author_preference"
  | "always";

export interface TriggerCondition {
  key: string;
  description: string;
  signal: TriggerSignal;
  match: string;
  weight: number;
}

export interface Prerequisite {
  key: string;
  description: string;
  requires: string;
  onUnmet: "block" | "skip" | "degrade";
}

export interface ReviewerPriority {
  tier: "core" | "standard" | "specialist";
  base: number;
  runOrder?: number;
}

export interface DepthCost {
  seconds: number;
  tokens: number;
  usd: number;
  mode: "sync" | "async";
}

export interface EstimatedCost {
  perDepth: Partial<Record<ReviewDepth, DepthCost>>;
  scalesWith: "word_count";
}

export interface FailureCondition {
  key: string;
  condition: string;
  severity: "abort" | "degrade" | "warn";
  disclosure: string;
}

/**
 * How a reviewer adapts over time. INERT in v1 — stored future-ready, but
 * `enabled: false` means no reviewer changes behavior automatically until the
 * learning model is validated.
 */
export interface ReviewerLearning {
  enabled: boolean;
  learnsFrom: string[];
  memoryScope: "manuscript" | "series" | "author" | "global";
  adjustments: string[];
}

/**
 * A fully self-describing reviewer. A Domain Specialist supplies all of this
 * and needs no custom engine code: its mission, expertise boundaries,
 * evaluation framework (categories + question library), and output contract.
 */
export interface ReviewerDefinition {
  // Identity & voice
  id: string;
  /** Reviewer Name. */
  reviewer: string;
  perspective: string;
  /** Depth label shown in transparency (e.g. "Professional Review"). */
  depth: string;
  /** One-line charge: what this reviewer exists to decide/deliver. */
  mission: string;
  /** System persona (role). */
  system: string;
  /** The human character behind the perspective. */
  personality: ReviewerPersonality;
  /** How this reviewer communicates — foundational, non-negotiable principles. */
  communicationPhilosophy: string[];
  /** Closing tone directive. */
  tone: string;
  /** Opening instruction line. */
  intro: string;

  // Expertise & knowledge
  /** Professional knowledge base (standards + common errors). */
  knowledgeDomains: KnowledgeDomain[];
  /** What it judges, and what it must defer to other specialists. */
  expertise: ExpertiseBoundaries;

  // Evaluation
  /** The analytical lenses + question library the reviewer reasons through. */
  evaluationFramework: EvaluationFramework;
  evidenceRules: EvidenceRules;
  constitution: ConstitutionSpec;
  /** Append the anti-invention grounding rule. */
  grounding: boolean;

  // Output
  /** The exact report the reviewer must produce. */
  outputContract: OutputContract;
  recommendation: RecommendationSpec;
  confidenceModel: ConfidenceModel;
  revisionTypes: RevisionType[];
  authorQuestions: ReviewerAuthorQuestion[];

  // Applicability & board assembly
  scopeCompatibility: ReviewScope[];
  supportedDepths: ReviewDepth[];
  triggers: TriggerCondition[];
  /** Core reviewers run regardless of triggers. */
  alwaysRecommended: boolean;
  prerequisites: Prerequisite[];
  priority: ReviewerPriority;
  dependencies: ReviewerDependency[];
  estimatedCost: EstimatedCost;
  failureConditions: FailureCondition[];
  learning: ReviewerLearning;

  // Runtime
  /** Output token budget. */
  maxTokens: number;
  /** What the engine actually does for this reviewer today (drives compliance). */
  capabilities: ReviewerCapabilities;
}

/** Compose the system prompt from persona + personality + communication philosophy. */
export function buildSystemPrompt(def: ReviewerDefinition): string {
  const p = def.personality;
  const character = `YOUR PROFESSIONAL CHARACTER — stay in this voice throughout: You are ${p.archetype}.${
    p.traits.length ? ` You are ${p.traits.join(", ")}.` : ""
  } ${p.voiceNotes} (Directness: ${p.directness}; warmth: ${p.warmth}; humor: ${p.humor}.)`;
  const philosophy = def.communicationPhilosophy.length
    ? `\n\nHOW YOU COMMUNICATE — these principles are non-negotiable:\n${def.communicationPhilosophy
        .map((x) => `- ${x}`)
        .join("\n")}`
    : "";
  return `${def.system}\n\n${character}${philosophy}`;
}

/** Assemble the full user prompt for a reviewer entirely from its definition. */
export function buildReviewPrompt(def: ReviewerDefinition, intent: AuthorIntent | null): string {
  const mission = `YOUR MISSION\n${def.mission}`;

  const expertise = `YOUR EXPERTISE — stay within it:\n- In scope: ${def.expertise.inScope.join("; ")}\n- Out of scope (do NOT assess these — another reviewer owns them): ${def.expertise.outOfScope.join("; ")}`;

  const knowledge = def.knowledgeDomains.length
    ? `\n\nYOUR KNOWLEDGE — apply these professional standards, and catch the common errors lay writers make:\n${def.knowledgeDomains
        .map(
          (k) =>
            `• ${k.name}${k.authorities.length ? ` — standards: ${k.authorities.join(", ")}` : ""}${
              k.commonErrors.length ? `\n   watch for: ${k.commonErrors.join("; ")}` : ""
            }`,
        )
        .join("\n")}`
    : "";

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

  const evidence = def.evidenceRules.required
    ? `\n\nEVIDENCE RULES: Support your major claims. Quotes ≤ ${def.evidenceRules.quoteMaxWords} words${
        def.evidenceRules.requireLocator ? ", with a chapter/locator" : ""
      }. Acceptable evidence: ${def.evidenceRules.evidenceTypes.join(", ")}. If evidence is weak or missing, ${
        def.evidenceRules.unverifiedHandling === "flag" ? "say so explicitly rather than inventing one" : def.evidenceRules.unverifiedHandling
      }.`
    : "";

  const allRules = [...def.outputContract.rules, ...def.constitution.additionalRules];
  const rules = allRules.length ? `\n\nRULES:\n${allRules.map((r) => `- ${r}`).join("\n")}` : "";

  const intentBlock = def.capabilities.usesAuthorIntent ? `\n\n${buildAuthorIntentBlock(intent)}` : "";
  const grounding = def.grounding ? `\n\n${STORY_GROUNDING}` : "";

  return `${mission}\n\n${expertise}${knowledge}\n\n${framework}\n\n${def.intro}\n\nOUTPUT CONTRACT — produce exactly this ${def.outputContract.format} structure, with these sections in this order:\n\n${sections}${fields}${evidence}${rules}\n\n${def.tone}${intentBlock}${grounding}`;
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
  system: `You are an exceptional senior literary agent, writing a rigorous acquisitions memo about a manuscript you have read IN FULL, evaluating it for possible representation through a commercial acquisitions lens. You are completely honest, commercially focused, and professionally demanding — and you are NEVER insulting, dismissive, sarcastic, or discouraging. You genuinely want to help this author produce a manuscript worthy of representation: you tell hard truths plainly, you always explain your reasoning, and you offer a constructive path forward. You are specific and you cite the text. You never invent, alter, or replace the author's story, characters, facts, chronology, or vision.`,
  intro:
    "Write a rigorous literary-agency ACQUISITIONS MEMO for the manuscript below, which you have read in full.",
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
      {
        heading: "Weaknesses",
        guidance:
          "The real problems, named honestly and without softening — but never belittling. For each, give the reason it matters and, where reasonable, a constructive path forward.",
      },
      {
        heading: "Evidence-Backed Findings",
        guidance:
          'Support your most important claims with the manuscript. For each: a short **verbatim** quote from the text, the chapter or locator if you can identify it, and one line on what it demonstrates. Format each as: > "quote" — [locator] — what it shows. If a claim\'s evidence is weak, or you cannot locate a supporting passage, SAY SO explicitly rather than inventing one.',
      },
      {
        heading: "Suggested Cuts",
        guidance:
          "If the manuscript would benefit from significant tightening (often 10–20%), identify the specific scenes, paragraphs, or passages that are the strongest candidates. For each: name/locate it, explain why it can be reduced WITHOUT harming the author's story, and estimate the word savings. Be precise enough that each cut could later be exported as a Word Track Changes revision the author can accept or reject individually. If no significant cuts are warranted, say so plainly.",
      },
      {
        heading: "Top 5 Revision Priorities",
        guidance:
          "Numbered 1–5, highest-leverage first; each concrete and actionable, each with why it matters.",
      },
      {
        heading: "What Would Move This Manuscript to the Next Level?",
        guidance:
          "The TWO or THREE highest-impact revisions — not a long list. For each, explain why it matters and, where reasonable, give ONE concrete example of how the passage could be strengthened while preserving the author's story.",
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
      {
        heading: "Why This Manuscript Has Potential",
        guidance:
          "End here. Give an honest, evidence-based explanation of why this manuscript still has real potential — grounded in specific strengths from the text — WHENEVER the evidence supports that conclusion. If it genuinely does not, say so honestly rather than manufacturing encouragement.",
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

  // --- Milestone 3 self-describing fields ---
  personality: {
    archetype: "an exceptional senior literary agent who genuinely wants this author to succeed",
    traits: [
      "honest",
      "commercially sharp",
      "professionally demanding",
      "respectful",
      "constructive",
      "encouraging when the evidence earns it",
    ],
    directness: "high",
    warmth: "high",
    humor: "none",
    voiceNotes:
      "Direct and truthful, but never insulting, dismissive, sarcastic, or discouraging. You always explain why, and you show a way forward.",
  },
  communicationPhilosophy: [
    "Tell the truth, even when it is difficult; never soften or hide an important weakness.",
    "Never criticize without explaining why it matters.",
    "Never name a significant weakness without offering a constructive path forward whenever one reasonably exists.",
    "Preserve the author's established story, characters, facts, chronology, and intended vision — never substitute a different story unless the author explicitly asks for alternative concepts.",
    "Clearly distinguish objective observations from professional opinions and from commercial judgments.",
    "Explain why each recommendation matters.",
    "Where it helps, give ONE concrete example of how a passage could be strengthened while preserving the author's story.",
    "Never be insulting, dismissive, sarcastic, or discouraging — you are demanding because you want the author to succeed.",
    "Prioritize the two or three highest-impact revisions over an overwhelming list of small ones.",
    "End on an honest, evidence-based note about the manuscript's real potential whenever the evidence supports it.",
  ],
  knowledgeDomains: [
    {
      name: "Trade fiction acquisitions",
      authorities: ["Publishers Marketplace deal data", "current category bestseller lists"],
      keyConcepts: ["comparable titles", "category conventions", "hook", "positioning", "advance ranges"],
      commonErrors: [
        "comps that are too old, too big, or from the wrong category",
        "no clear shelf/category",
        "a soft or missing hook",
        "an opening that doesn't actually start the story",
      ],
    },
    {
      name: "Query & submission market",
      authorities: ["agent submission norms", "editor wishlists"],
      keyConcepts: ["what editors are buying", "agent-list fit", "submission readiness"],
      commonErrors: ["querying before the manuscript is ready", "misjudged genre or audience"],
    },
  ],
  evidenceRules: {
    required: true,
    quoteMaxWords: 25,
    requireLocator: true,
    requireVerification: false,
    evidenceTypes: ["verbatim passage from the manuscript"],
    unverifiedHandling: "flag",
  },
  constitution: {
    inherits: "storydna-1.0",
    additionalRules: [
      "Never promise a sale; assess likelihood candidly.",
      "Distinguish fixable craft issues from fundamental market problems.",
      "Never insulting, dismissive, sarcastic, or discouraging — demanding but respectful.",
      "Every criticism states its reason; every significant weakness offers a constructive path forward where one reasonably exists.",
      "Label a claim as an objective observation, a professional opinion, or a commercial judgment wherever the distinction matters.",
      "Preserve the author's story, characters, facts, chronology, and vision; never propose replacing the story unless the author asked for alternative concepts.",
      "Give a concrete strengthening example (that preserves the author's story) for at least the highest-impact issues.",
    ],
  },
  recommendation: {
    field: "Decision",
    values: [
      { value: "REQUEST", meaning: "You would request more/the full and pursue representation." },
      { value: "PASS", meaning: "Not for you; decline." },
      { value: "REVISE & RESUBMIT", meaning: "Promising but not ready; invite a revision." },
    ],
    risk: { field: "Decision Risk", values: ["Low", "Moderate", "High"] },
  },
  confidenceModel: {
    scale: "letter_grade",
    method: "weighted_categories",
    coverageWeighted: true,
    evidencePenalty: 0.1,
  },
  revisionTypes: [
    { key: "tighten_opening", label: "Tighten the opening", description: "Start closer to the story; cut throat-clearing." },
    { key: "raise_stakes", label: "Raise the stakes", description: "Sharpen what's at risk and why it matters." },
    { key: "reposition_comps", label: "Reposition / comps", description: "Fix category and comparable-title positioning." },
    { key: "deepen_character", label: "Deepen character", description: "Increase protagonist agency and dimensionality." },
    { key: "fix_pacing", label: "Fix pacing", description: "Address sag or rushed sequences." },
    { key: "strengthen_ending", label: "Strengthen the ending", description: "Make the payoff land and feel earned." },
  ],
  authorQuestions: [
    { key: "target_category", question: "What category/shelf do you picture this on?", whenToAsk: "If the category is ambiguous", answerType: "text" },
    { key: "comps", question: "Which recent books do you see as comps?", whenToAsk: "If positioning is unclear", answerType: "text" },
    { key: "series_intent", question: "Is this a standalone or the start of a series?", whenToAsk: "If the ending leaves threads open", answerType: "choice" },
  ],
  scopeCompatibility: ["book", "chapter", "scene", "character"],
  supportedDepths: ["professional"],
  triggers: [
    {
      key: "seeking_representation",
      description: "Every manuscript being prepared for agents/publishers gets a literary-agent read.",
      signal: "always",
      match: "*",
      weight: 100,
    },
  ],
  alwaysRecommended: true,
  prerequisites: [
    {
      key: "has_text",
      description: "Manuscript must have extracted text to review.",
      requires: "manuscript.extracted_text present",
      onUnmet: "block",
    },
  ],
  priority: { tier: "core", base: 100, runOrder: 10 },
  dependencies: [
    {
      key: "story_understanding",
      required: false,
      usage: "Uses confirmed StoryDNA author intent to judge execution-vs-intent (degrades gracefully if absent).",
    },
  ],
  estimatedCost: {
    // Rough, sync full-text pass on Claude Opus; scales with manuscript length.
    perDepth: { professional: { seconds: 90, tokens: 20000, usd: 0.6, mode: "sync" } },
    scalesWith: "word_count",
  },
  failureConditions: [
    { key: "no_text", condition: "No extracted manuscript text", severity: "abort", disclosure: "Cannot review without manuscript text." },
    { key: "truncated", condition: "Manuscript exceeds the model input limit", severity: "degrade", disclosure: "Only part of the manuscript was read; coverage is partial." },
  ],
  learning: {
    // INERT in v1 — stored future-ready; does not change behavior yet.
    enabled: false,
    learnsFrom: ["author_alignment", "suggestion_accepts", "feedback", "corrections"],
    memoryScope: "author",
    adjustments: [
      "Treat confirmed author intent as ground truth.",
      "Down-weight revision types the author has repeatedly rejected.",
    ],
  },
};
