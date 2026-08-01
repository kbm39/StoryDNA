import type { ManuscriptBriefStatus } from "./contract.ts";
import { MANUSCRIPT_BRIEF_CONTRACT_VERSION } from "./contract.ts";

export type ManuscriptBriefRecord = {
  readonly brief_id: string;
  readonly book_id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly contract_version: typeof MANUSCRIPT_BRIEF_CONTRACT_VERSION;
  readonly elevator_pitch: string;
  readonly author_motivation: string;
  readonly desired_reader_experience: string | null;
  readonly market_position: string;
  readonly comparison_titles: string | null;
  readonly success_definition: string | null;
  readonly status: ManuscriptBriefStatus;
  readonly created_by: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly submitted_at: string | null;
  readonly supersedes_brief_id: string | null;
  readonly superseded_at: string | null;
};

export type ManuscriptBriefDraftInput = {
  readonly book_id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly elevator_pitch?: string;
  readonly author_motivation?: string;
  readonly desired_reader_experience?: string | null;
  readonly market_position?: string;
  readonly comparison_titles?: string | null;
  readonly success_definition?: string | null;
  readonly created_by: string;
  readonly supersedes_brief_id?: string | null;
};

export type ManuscriptBriefValidationError = {
  readonly code: string;
  readonly message: string;
};

export type ManuscriptBriefValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly ManuscriptBriefValidationError[] };
