import type {
  AuthorIntentStatus,
  AuthorIntentType,
  PriorityDomain,
} from "./contract.ts";
import { AUTHOR_INTENT_CONTRACT_VERSION } from "./contract.ts";

export type AuthorIntentRecord = {
  readonly id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly contract_version: typeof AUTHOR_INTENT_CONTRACT_VERSION;
  readonly intent_type: AuthorIntentType;
  readonly custom_objective_text: string | null;
  readonly author_success_definition: string;
  readonly requested_experts: readonly string[];
  readonly declined_experts: readonly string[];
  readonly priority_domains: readonly PriorityDomain[];
  readonly budget_preference: string | null;
  readonly time_preference: string | null;
  readonly status: AuthorIntentStatus;
  readonly created_by: string;
  readonly superseded_by_id: string | null;
  readonly supersedes_intent_id: string | null;
  readonly activated_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

export type AuthorIntentDraftInput = {
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly intent_type: AuthorIntentType;
  readonly custom_objective_text?: string | null;
  readonly author_success_definition: string;
  readonly requested_experts?: readonly string[];
  readonly declined_experts?: readonly string[];
  readonly priority_domains?: readonly PriorityDomain[];
  readonly budget_preference?: string | null;
  readonly time_preference?: string | null;
  readonly created_by: string;
  readonly supersedes_intent_id?: string | null;
};

export type AuthorIntentValidationError = {
  readonly code: string;
  readonly message: string;
};

export type AuthorIntentValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly AuthorIntentValidationError[] };

export type ResolvedAuthorIntent = {
  readonly record: AuthorIntentRecord;
  readonly isValidForPlanning: boolean;
};
