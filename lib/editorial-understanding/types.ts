import type {
  EditorialUnderstandingInterviewType,
  EditorialUnderstandingStatus,
  UnderstandingFieldKey,
} from "./contract.ts";
import { EDITORIAL_UNDERSTANDING_CONTRACT_VERSION } from "./contract.ts";

export type OpenQuestion = {
  readonly stage_id: string;
  readonly question: string;
  readonly recorded_at: string;
};

export type ResolvedClarification = {
  readonly stage_id: string;
  readonly clarification_question: string;
  readonly author_response: string;
  readonly resolved_at: string;
};

export type ConversationTurn = {
  readonly turn_id: string;
  readonly stage_id: string;
  readonly role: "eic" | "author";
  readonly response_type:
    | "question"
    | "acknowledgment"
    | "reflection"
    | "clarification"
    | "author_answer"
    | "confirmation_summary"
    | "author_confirmation";
  readonly content: string;
  readonly timestamp: string;
};

export type FieldConfidenceMap = {
  readonly primary_vision: number | null;
  readonly target_reader: number | null;
  readonly desired_reader_experience: number | null;
  readonly market_position: number | null;
  readonly creative_motivation: number | null;
  readonly success_definition: number | null;
};

export type UnderstandingConfidence = {
  readonly overall: number;
  readonly by_field: FieldConfidenceMap;
  readonly confirmed_at: string | null;
  readonly confirmed_by: string | null;
};

export type StageTurnRecord = {
  readonly stage_id: string;
  readonly understanding_field: UnderstandingFieldKey | null;
  readonly author_answer: string | null;
  readonly skipped: boolean;
  readonly eic_response_type: "acknowledgment" | "reflection" | "clarification" | null;
  readonly eic_response_content: string | null;
  readonly clarification_question: string | null;
  readonly clarification_answer: string | null;
  readonly clarification_used: boolean;
  readonly decision_outcome: string | null;
  readonly confidence_score: number | null;
  readonly recorded_at: string;
};

export type EditorialUnderstandingRecord = {
  readonly understanding_id: string;
  readonly book_id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly contract_version: typeof EDITORIAL_UNDERSTANDING_CONTRACT_VERSION;
  readonly interview_type: EditorialUnderstandingInterviewType;
  readonly conducted_by: "editor_in_chief";
  readonly primary_vision: string | null;
  readonly target_reader: string | null;
  readonly desired_reader_experience: string | null;
  readonly market_position: string | null;
  readonly creative_motivation: string | null;
  readonly success_definition: string | null;
  readonly comparison_titles: string | null;
  readonly open_questions: readonly OpenQuestion[];
  readonly confidence: UnderstandingConfidence;
  readonly resolved_clarifications: readonly ResolvedClarification[];
  readonly conversation_history: readonly ConversationTurn[];
  readonly stage_turns: readonly StageTurnRecord[];
  readonly understanding_summary: string | null;
  readonly version: number;
  readonly status: EditorialUnderstandingStatus;
  readonly is_manuscript_evidence: false;
  readonly is_author_intent: false;
  readonly is_canon: false;
  readonly created_by: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly confirmed_at: string | null;
  readonly confirmed_by: string | null;
  readonly supersedes_understanding_id: string | null;
  readonly superseded_at: string | null;
  readonly provider_model: string | null;
  readonly provider_cost_usd: number | null;
};

export type EditorialUnderstandingDraftInput = {
  readonly book_id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly created_by: string;
  readonly supersedes_understanding_id?: string | null;
};

export type EditorialUnderstandingValidationError = {
  readonly code: string;
  readonly message: string;
};

export type EditorialUnderstandingValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly EditorialUnderstandingValidationError[] };
