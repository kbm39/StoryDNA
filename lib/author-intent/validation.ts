import {
  AUTHOR_INTENT_CONTRACT_VERSION,
  AUTHOR_INTENT_STATUSES,
  AUTHOR_INTENT_TYPES,
  PRIORITY_DOMAINS,
  type AuthorIntentType,
  type PriorityDomain,
} from "./contract.ts";
import { rejectUnknownExpertKeys } from "./expert-keys.ts";
import type {
  AuthorIntentDraftInput,
  AuthorIntentValidationError,
  AuthorIntentValidationResult,
} from "./types.ts";

function err(code: string, message: string): AuthorIntentValidationError {
  return { code, message };
}

function overlap(a: readonly string[], b: readonly string[]): string[] {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

export function validateAuthorIntentDraft(
  input: AuthorIntentDraftInput,
): AuthorIntentValidationResult {
  const errors: AuthorIntentValidationError[] = [];

  if (!input.manuscript_id?.trim()) {
    errors.push(err("missing_manuscript_id", "Manuscript ID is required"));
  }
  if (!input.manuscript_version_id?.trim()) {
    errors.push(err("missing_version_id", "Manuscript version ID is required"));
  }
  if (!input.created_by?.trim()) {
    errors.push(err("missing_creator", "Creator is required"));
  }
  if (!input.author_success_definition?.trim()) {
    errors.push(err("missing_success_definition", "Author success definition is required"));
  }

  if (!AUTHOR_INTENT_TYPES.includes(input.intent_type)) {
    errors.push(err("invalid_intent_type", `Unknown intent type: ${input.intent_type}`));
  }

  if (input.intent_type === "custom") {
    if (!input.custom_objective_text?.trim()) {
      errors.push(err("custom_text_required", "Custom intent requires custom objective text"));
    }
  } else if (input.custom_objective_text?.trim()) {
    errors.push(
      err("custom_text_unexpected", "Custom objective text is only allowed for custom intent"),
    );
  }

  const requested = input.requested_experts ?? [];
  const declined = input.declined_experts ?? [];
  const unknownRequested = rejectUnknownExpertKeys(requested);
  const unknownDeclined = rejectUnknownExpertKeys(declined);
  if (unknownRequested.length > 0) {
    errors.push(
      err("unknown_requested_expert", `Unknown requested expert keys: ${unknownRequested.join(", ")}`),
    );
  }
  if (unknownDeclined.length > 0) {
    errors.push(
      err("unknown_declined_expert", `Unknown declined expert keys: ${unknownDeclined.join(", ")}`),
    );
  }

  const conflicts = overlap(requested, declined);
  if (conflicts.length > 0) {
    errors.push(
      err(
        "requested_declined_overlap",
        `Expert keys cannot be both requested and declined: ${conflicts.join(", ")}`,
      ),
    );
  }

  for (const domain of input.priority_domains ?? []) {
    if (!PRIORITY_DOMAINS.includes(domain as PriorityDomain)) {
      errors.push(err("invalid_priority_domain", `Unknown priority domain: ${domain}`));
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export function isValidIntentType(value: string): value is AuthorIntentType {
  return (AUTHOR_INTENT_TYPES as readonly string[]).includes(value);
}

export function isValidIntentStatus(value: string): boolean {
  return (AUTHOR_INTENT_STATUSES as readonly string[]).includes(value);
}

export function assertContractVersion(version: string): boolean {
  return version === AUTHOR_INTENT_CONTRACT_VERSION;
}
