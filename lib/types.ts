// Database row types. Kept in sync by hand with supabase/migrations.

export type Provider = "openai" | "anthropic";
export type Perspective = "commercial" | "craft" | "screen";
export type IssueStatus = "outstanding" | "resolved";

export interface Manuscript {
  id: string;
  title: string;
  original_filename: string;
  storage_path: string;
  file_size: number | null;
  word_count: number | null;
  extracted_text: string | null;
  status: string;
  archived: boolean;
  series_id: string | null;
  series_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface Series {
  id: string;
  title: string;
  logline: string | null;
  created_at: string;
  updated_at: string;
}

export type DocType = "synopsis" | "opening_critique" | "line_edit" | "continuity" | "marketing";

export interface ManuscriptDocument {
  id: string;
  manuscript_id: string;
  doc_type: DocType;
  provider: Provider;
  model: string | null;
  content: string;
  created_at: string;
}

export type SubmissionStatus =
  | "querying"
  | "no_response"
  | "rejected"
  | "partial_request"
  | "full_request"
  | "offer"
  | "withdrawn";

export interface AgentSubmission {
  id: string;
  manuscript_id: string;
  agent_id: string | null;
  agent_name: string | null;
  agency: string | null;
  status: SubmissionStatus;
  queried_on: string | null;
  responded_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type DeckScope = "manuscript" | "series";

export interface PitchDeck {
  id: string;
  manuscript_id: string | null;
  series_id: string | null;
  scope: DeckScope;
  provider: Provider;
  model: string | null;
  title: string | null;
  content: string;
  created_at: string;
}

export interface Review {
  id: string;
  manuscript_id: string;
  provider: Provider;
  perspective: Perspective;
  model: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// --- Literary Agent Review V2: transparency + author intent ------------------

export type ConstitutionalStatus = "compliant" | "partially_compliant" | "not_compliant";

export interface ReviewCoverage {
  words_analyzed: number;
  full_text: boolean;
  /** percent of the manuscript actually processed */
  percent: number;
  /** full text / chapter-segmented / notes-based / summary-based */
  basis: string;
  /** null until we do explicit chapter/segment traversal */
  chapters_reviewed: string | null;
}

export type ComplianceItemStatus = "met" | "partial" | "unmet";

export interface ComplianceItem {
  requirement: string;
  status: ComplianceItemStatus;
  note: string | null;
}

/** Overall Constitutional Compliance score + its supporting checklist. */
export interface ComplianceReport {
  /** 0..100 */
  score: number;
  status: ConstitutionalStatus;
  summary: string;
  items: ComplianceItem[];
}

/** Honest disclosure of what kind of review was performed. */
export interface ReviewMeta {
  constitution_version: string;
  reviewer: string;
  perspective: string;
  scope: string;
  depth: string;
  coverage: ReviewCoverage;
  model: string;
  author_intent_applied: boolean;
  author_intent_source: string;
  /** Evidence is cited in the report. */
  evidence_present: boolean;
  /** Evidence has been deterministically checked against the manuscript. */
  evidence_machine_verified: boolean;
  compliance: ComplianceReport;
}

/** Confirmed (or proposed) StoryDNA understanding fed into a review as intent. */
export interface AuthorIntent {
  confirmed: boolean;
  summary: string;
  about: string;
  themes: string[];
  emotionalPromise: string;
}

export interface Issue {
  id: string;
  manuscript_id: string;
  review_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  source_provider: Provider | null;
  status: IssueStatus;
  created_at: string;
  updated_at: string;
}

export interface Suggestion {
  id: string;
  /** A suggestion hangs off EITHER an issue or an editorial comment. */
  issue_id: string | null;
  comment_id: string | null;
  provider: Provider;
  model: string | null;
  content: string;
  applied: boolean;
  created_at: string;
}

export type CommentStance = "agree" | "disagree" | "partial";

/** An uploaded editorial analysis (one per manuscript). */
export interface EditorialAnalysis {
  id: string;
  manuscript_id: string;
  file_name: string | null;
  raw_text: string;
  created_at: string;
  updated_at: string;
}

/** A discrete comment parsed out of an editorial analysis. */
export interface EditorialComment {
  id: string;
  analysis_id: string;
  manuscript_id: string;
  ordinal: number;
  quote: string | null;
  comment: string;
  category: string | null;
  created_at: string;
}

/** One model's stance on a single editorial comment. */
export interface CommentAssessment {
  id: string;
  comment_id: string;
  provider: Provider;
  model: string | null;
  stance: CommentStance;
  reasoning: string | null;
  created_at: string;
}

export interface IssueVerdict {
  id: string;
  title?: string;
  status: IssueStatus;
  note: string;
}

export interface RevisionCheck {
  id: string;
  manuscript_id: string;
  provider: Provider;
  model: string | null;
  grade: string | null;
  summary: string | null;
  resolved_count: number;
  outstanding_count: number;
  issue_verdicts: IssueVerdict[] | null;
  created_at: string;
}

export interface QueryLetter {
  id: string;
  manuscript_id: string;
  agent_id: string | null;
  agent_name: string | null;
  agency: string | null;
  provider: Provider;
  model: string | null;
  content: string;
  created_at: string;
}

export interface MarketabilityReport {
  id: string;
  manuscript_id: string;
  file_name: string | null;
  raw_text: string;
  summary: string | null;
  provider: Provider | null;
  model: string | null;
  created_at: string;
  updated_at: string;
}

export interface Treatment {
  id: string;
  manuscript_id: string | null;
  series_id: string | null;
  provider: Provider;
  model: string | null;
  format: string;
  content: string;
  created_at: string;
}

// --- StoryDNA (V2) -----------------------------------------------------------

export interface StoryDnaEntity {
  name: string;
  role?: string;
  note?: string;
}

export interface StoryDnaTimelineAnchor {
  label: string;
  note?: string;
}

export interface StoryDnaProtagonist {
  name: string;
  role: string;
  /** 0..1 */
  confidence: number;
  reasoning: string;
  evidence?: Evidence[];
}

/** A verbatim manuscript passage supporting a conclusion (traceability). */
export interface Evidence {
  quote: string;
  locator: string | null;
  /** Set by deterministic verification against the manuscript text. */
  verified: boolean;
}

/** The author's intent response to an interpretive conclusion. */
export type AlignmentResponse = "confirmed" | "refined" | "augmented" | "realigned";

/** An interpretive text conclusion held for Author Alignment. */
export interface AlignedText {
  proposed: string;
  response: AlignmentResponse | null;
  final: string | null;
  note: string | null;
  evidence: Evidence[];
  updated_at: string | null;
}

export interface ThemeProposal {
  name: string;
  evidence: Evidence[];
}

export interface AlignedThemes {
  proposed: ThemeProposal[];
  response: AlignmentResponse | null;
  /** Author's theme list if refined / augmented / realigned. */
  final: string[] | null;
  note: string | null;
  updated_at: string | null;
}

export interface EmotionalPromise {
  beginning: string;
  middle: string;
  ending: string;
  after_finishing: string;
}

export interface AlignedEmotional {
  proposed: EmotionalPromise;
  response: AlignmentResponse | null;
  final: EmotionalPromise | null;
  note: string | null;
  evidence: Evidence[];
  updated_at: string | null;
}

export interface ConfidenceScore {
  /** 0..100 */
  value: number;
  rationale: string;
}

export interface StoryConfidence {
  story: ConfidenceScore;
  theme: ConfidenceScore;
  character: ConfidenceScore;
  message: ConfidenceScore;
}

export interface StoryDnaQuestion {
  key: string;
  trait?: string;
  text: string;
}

export interface StoryDnaData {
  // Objective facts — canonical on discovery.
  chapters_count: number;
  major_characters: StoryDnaEntity[];
  supporting_characters: StoryDnaEntity[];
  locations: StoryDnaEntity[];
  organizations: StoryDnaEntity[];
  timeline_anchors: StoryDnaTimelineAnchor[];
  protagonist: StoryDnaProtagonist;
  first_question: StoryDnaQuestion;
  // Interpretive conclusions — proposed until Author Alignment.
  summary: AlignedText;
  themes: AlignedThemes;
  about: AlignedText;
  emotional_promise: AlignedEmotional;
  confidence: StoryConfidence;
}

export interface StoryDna {
  id: string;
  manuscript_id: string;
  provider: Provider | null;
  model: string | null;
  status: string;
  chapters_count: number | null;
  protagonist_name: string | null;
  data: StoryDnaData;
  understanding_feedback: "yes" | "mostly" | "no" | null;
  understanding_feedback_note: string | null;
  alignment_status: "pending" | "aligned";
  created_at: string;
  updated_at: string;
}

export type InterviewAnswer = "yes" | "no" | "not_sure";

export interface StoryDnaInterviewAnswer {
  id: string;
  manuscript_id: string;
  character_name: string | null;
  question_key: string;
  question: string;
  answer: InterviewAnswer;
  created_at: string;
  updated_at: string;
}

export interface Brainstorm {
  id: string;
  manuscript_id: string;
  prompt: string;
  provider: Provider;
  model: string | null;
  content: string;
  selected: boolean;
  created_at: string;
}
