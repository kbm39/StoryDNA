import type {
  ConversationalResponseType,
  FollowUpDecisionOutcome,
} from "./contract.ts";
import { CONVERSATIONAL_RESPONSE_CONTRACT_VERSION } from "./contract.ts";

export type ConversationalResponse = {
  readonly contract_version: typeof CONVERSATIONAL_RESPONSE_CONTRACT_VERSION;
  readonly response_type: ConversationalResponseType;
  readonly content: string;
  readonly stage_id: string;
  readonly grounded_in_author_text: boolean;
  readonly asks_question: boolean;
  readonly quality_level?: 1 | 2 | 3 | 4;
  readonly gate_result?: "pass" | string;
  readonly fail_reason?: string | null;
  readonly fallback_used?: boolean;
  readonly repair_attempted?: boolean;
};

export type FollowUpDecisionInput = {
  readonly stage_id: string;
  readonly understanding_field: string | null;
  readonly author_answer: string | null;
  readonly skipped: boolean;
  readonly required: boolean;
  readonly clarification_already_used: boolean;
  readonly is_clarification_follow_up: boolean;
};

export type FollowUpDecisionResult = {
  readonly outcome: FollowUpDecisionOutcome;
  readonly response_type: ConversationalResponseType | null;
  readonly confidence_score: number;
  readonly record_open_question: boolean;
  readonly advance_stage: boolean;
};
