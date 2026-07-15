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
  /** Microsoft Word <Words> from docProps/app.xml at upload; display-only. */
  source_document_word_count?: number | null;
  extracted_text: string | null;
  status: string;
  archived: boolean;
  series_id: string | null;
  series_order: number | null;
  /** FK to the active content snapshot (Phase 1 schema; read paths unchanged until Phase 2). */
  current_version_id?: string | null;
  created_at: string;
  updated_at: string;
}

/** Immutable manuscript content snapshot (Phase 1). */
export interface ManuscriptVersion {
  id: string;
  manuscript_id: string;
  version_number: number;
  label: string | null;
  source_filename: string;
  storage_path: string;
  file_size: number | null;
  extracted_text: string | null;
  word_count: number | null;
  /** Microsoft Word <Words> from docProps/app.xml at upload; display-only. */
  source_document_word_count?: number | null;
  character_count: number | null;
  content_hash: string;
  uploaded_at: string;
  notes: string | null;
  supersedes_version_id: string | null;
  is_current: boolean;
  created_at: string;
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
  /** Content snapshot this review belongs to (Phase 1; optional until Phase 2 queries use it). */
  manuscript_version_id?: string | null;
  provider: Provider;
  perspective: Perspective;
  model: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  /** active = current review for this perspective; superseded = retained history */
  lifecycle_status?: "active" | "superseded";
  created_at: string;
  /** Validated commercial rubric total (NULL = legacy / unverified). */
  manuscript_score?: number | null;
  manuscript_letter_grade?: string | null;
  craft_score?: number | null;
  acquisition_readiness_score?: number | null;
  grading_formula_version?: string | null;
  grade_status?: string | null;
  review_reliability_status?: string | null;
  canonical_word_count?: number | null;
  words_analyzed?: number | null;
  statistics_validation_status?: string | null;
  evidence_completeness_status?: string | null;
  arithmetic_validation_status?: string | null;
  rubric_breakdown?: import("@/lib/commercial-fiction-rubric").CommercialRubricPayload | null;
  grading_metadata?: Record<string, unknown> | null;
  contrary_evidence_gate_status?: string | null;
  contrary_evidence_gate_version?: string | null;
  scoring_gate_valid?: boolean | null;
  duplicate_deduction_count?: number | null;
  restored_points_total?: number | null;
  blocked_stale_deduction_count?: number | null;
}

export interface ReviewConcernAssessment {
  id: string;
  review_id: string;
  prior_review_id: string | null;
  manuscript_id: string;
  manuscript_version_id: string | null;
  prior_manuscript_version_id: string | null;
  concern_id: string;
  root_issue: string;
  source_type: string;
  rubric_category: string | null;
  prior_criticism: string;
  prior_evidence: unknown;
  current_supporting_evidence: unknown;
  current_contrary_evidence: unknown;
  revision_change: unknown;
  original_basis_still_present: boolean;
  status: string;
  confidence: string;
  prior_deduction: number;
  points_restored: number;
  remaining_deduction: number;
  narrowed_current_finding: string | null;
  explanation: string;
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

// --- Revision Engine (Literary Agent V3) -------------------------------------

export type RevisionType =
  | "delete"
  | "tighten"
  | "rewrite"
  | "clarify"
  | "reorder"
  | "expand"
  | "combine"
  | "split"
  | "move"
  | "replace_dialogue"
  | "replace_description"
  | "replace_exposition"
  | "comment_only";
export type RiskLevel = "low" | "medium" | "high";
export type ImpactLevel = "low" | "medium" | "high";
export type RevisionDifficulty = "easy" | "medium" | "difficult" | "major_rewrite";
export type RevisionStatus =
  | "proposed"
  | "accepted"
  | "rejected"
  | "modified"
  | "skipped"
  | "deferred"
  | "implemented"
  | "re_reviewed";
export type ResolutionStatus = "open" | "in_progress" | "resolved" | "verified";
export type ExportMode = "track_change" | "comment";

export interface RevisionImpacts {
  pacing: number;
  clarity: number;
  commercial_readiness: number;
  emotional_impact: number;
  voice_preservation: number;
  submission_readiness: number;
}

export interface EditorialIssue {
  id: string;
  manuscript_id: string;
  manuscript_version_id?: string | null;
  review_id: string | null;
  text: string;
  area: string | null;
  severity: RiskLevel | null;
  source_section: string | null;
  success_criterion: string | null;
  owning_reviewer: string;
  resolution_status: ResolutionStatus;
  verified_at: string | null;
  verification_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface RevisionCandidate {
  id: string;
  manuscript_id: string;
  manuscript_version_id?: string | null;
  issue_id: string | null;
  phase_id: string | null;
  type: RevisionType;
  original: string;
  revised: string;
  locator: string | null;
  word_savings: number | null;
  reason: string | null;
  confidence: number | null;
  confidence_reason: string | null;
  difficulty: RevisionDifficulty | null;
  story_risk: RiskLevel | null;
  voice_risk: RiskLevel | null;
  commercial_impact: ImpactLevel | null;
  reader_impact: ImpactLevel | null;
  grade_delta: number | null;
  consequence_if_unchanged: string | null;
  dependencies: string | null;
  impacts: RevisionImpacts | null;
  export_mode: ExportMode;
  verified: boolean;
  status: RevisionStatus;
  created_at: string;
}

export type AuthorEditDisposition = "accepted" | "rejected" | "modified" | "skipped";

/** Author's recorded response to a revision candidate (intent only — no manuscript mutation). */
export interface AuthorEditResponse {
  id: string;
  candidate_id: string;
  manuscript_id: string;
  manuscript_version_id?: string | null;
  disposition: AuthorEditDisposition;
  author_modified_text: string | null;
  author_note: string | null;
  responded_at: string;
  updated_at: string;
}

// --- Manuscript Intake -------------------------------------------------------

export type ManuscriptRelation = "standalone" | "existing_series" | "new_series";
export type ManuscriptType =
  | "main_novel"
  | "prequel"
  | "sequel"
  | "novella"
  | "lead_magnet"
  | "short_story";
export type ManuscriptStage =
  | "first_draft"
  | "early_revision"
  | "advanced_revision"
  | "query_ready"
  | "publisher_submission"
  | "producer_submission"
  | "final_proof";
export type ReviewObjective =
  | "agent_submission"
  | "producer_review"
  | "developmental"
  | "character_consistency"
  | "dialogue"
  | "reality_check"
  | "final_proof"
  | "knowledge_only";
export type Optimization =
  | "best_book"
  | "most_commercial"
  | "most_faithful"
  | "best_adaptation"
  | "balanced";
export type FeedbackStyle =
  | "brutally_honest"
  | "protect_voice"
  | "prioritize_commercial"
  | "challenge_assumptions"
  | "real_agent";

export interface ManuscriptIntake {
  id: string;
  manuscript_id: string;
  relation: ManuscriptRelation | null;
  series_id: string | null;
  series_name: string | null;
  book_number: number | null;
  order_type: string | null;
  published_order: number | null;
  story_order: number | null;
  manuscript_type: ManuscriptType | null;
  manuscript_stage: ManuscriptStage | null;
  load_canon: boolean;
  load_characters: boolean;
  load_timeline: boolean;
  load_story_memory: boolean;
  load_author_intent: boolean;
  load_editorial_decisions: boolean;
  load_reviewer_feedback: boolean;
  objectives: string[];
  optimization: string | null;
  feedback_style: string[];
  recommend_specialists: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthorProfile {
  id: string;
  feedback_style: string[];
  optimization: string | null;
  updated_at: string;
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
