import {
  MANUSCRIPT_BRIEF_CONTRACT_VERSION,
  MANUSCRIPT_BRIEF_IS_EVIDENCE,
  MANUSCRIPT_BRIEF_STATUSES,
  MARKET_POSITION_UNSURE,
} from "./contract.ts";
import type {
  ManuscriptBriefDraftInput,
  ManuscriptBriefValidationError,
  ManuscriptBriefValidationResult,
} from "./types.ts";

const MIN_ELEVATOR_PITCH_LENGTH = 10;

function err(code: string, message: string): ManuscriptBriefValidationError {
  return { code, message };
}

export function normalizeMarketPosition(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return MARKET_POSITION_UNSURE;
  if (/^i'?m not sure$/i.test(trimmed) || /^unsure$/i.test(trimmed)) {
    return MARKET_POSITION_UNSURE;
  }
  return trimmed;
}

export function validateManuscriptBriefDraft(
  input: ManuscriptBriefDraftInput,
): ManuscriptBriefValidationResult {
  const errors: ManuscriptBriefValidationError[] = [];

  if (!input.manuscript_id?.trim()) errors.push(err("missing_manuscript_id", "Manuscript ID is required"));
  if (!input.manuscript_version_id?.trim()) {
    errors.push(err("missing_version_id", "Manuscript version ID is required"));
  }
  if (!input.book_id?.trim()) errors.push(err("missing_book_id", "Book ID is required"));
  if (!input.created_by?.trim()) errors.push(err("missing_creator", "Creator is required"));

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export function validateManuscriptBriefSubmit(input: {
  elevator_pitch: string;
  author_motivation?: string;
  desired_reader_experience?: string | null;
  market_position?: string;
  comparison_titles?: string | null;
  success_definition?: string | null;
}): ManuscriptBriefValidationResult {
  const errors: ManuscriptBriefValidationError[] = [];
  const pitch = input.elevator_pitch?.trim() ?? "";

  if (pitch.length < MIN_ELEVATOR_PITCH_LENGTH) {
    errors.push(
      err(
        "elevator_pitch_required",
        "Please describe your manuscript in a few sentences before submitting.",
      ),
    );
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export function isValidBriefStatus(value: string): boolean {
  return (MANUSCRIPT_BRIEF_STATUSES as readonly string[]).includes(value);
}

export function assertBriefContractVersion(version: string): boolean {
  return version === MANUSCRIPT_BRIEF_CONTRACT_VERSION;
}

export function briefIsManuscriptEvidence(): boolean {
  return MANUSCRIPT_BRIEF_IS_EVIDENCE;
}
