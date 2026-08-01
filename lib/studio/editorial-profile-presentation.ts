/**
 * EP-6 — Studio Editorial Profile presentation loader.
 * Server boundary: lookup → read model → validate → safe Studio payload.
 */

import "server-only";

import { createAuthorFacingEditorialProfileReadModel } from "@/lib/editorial-profile/author-facing-read-model.ts";
import type { AuthorFacingEditorialProfileReadModel } from "@/lib/editorial-profile/author-facing-types.ts";
import { isStudioEditorialProfileEnabled } from "@/lib/editorial-profile/feature-flag.ts";
import type { EditorialProfileStatus } from "@/lib/editorial-profile/contract.ts";
import type { EditorialProfileV1 } from "@/lib/editorial-profile/types.ts";
import {
  parseStudioEditorialProfileDevFixtureMode,
  resolveStudioEditorialProfileFixture,
} from "./editorial-profile-fixtures.ts";

export const EDITORIAL_PROFILE_HEADER_EXPLANATION =
  "This profile reflects the Editor-in-Chief's current understanding of your manuscript." as const;

export type EditorialProfilePresentationState =
  | "loading"
  | "feature_disabled"
  | "no_active_profile"
  | "profile_being_prepared"
  | "incomplete_evidence"
  | "awaiting_eic_confirmation"
  | "blocked"
  | "generation_failed"
  | "read_model_validation_failed"
  | "active_profile_available";

export type StudioEditorialProfilePresentation = {
  readonly manuscriptTitle: string;
  readonly versionLabel: string | null;
  readonly lastUpdatedLabel: string | null;
  readonly statusLabel: string;
  readonly headerExplanation: string;
  readonly sections: AuthorFacingEditorialProfileReadModel["sections"];
  readonly editorialUnderstanding: AuthorFacingEditorialProfileReadModel["editorial_understanding"];
  readonly whatIsWorking: AuthorFacingEditorialProfileReadModel["what_is_working"];
  readonly protectedAssets: AuthorFacingEditorialProfileReadModel["protected_assets"];
  readonly improvementOpportunities: AuthorFacingEditorialProfileReadModel["improvement_opportunities"];
  readonly editorialRisks: AuthorFacingEditorialProfileReadModel["editorial_risks"];
  readonly manuscriptCharacteristics: AuthorFacingEditorialProfileReadModel["manuscript_characteristics"];
  readonly recommendedSpecialistSupport: AuthorFacingEditorialProfileReadModel["recommended_specialist_support"];
  readonly roadmapPreparation: AuthorFacingEditorialProfileReadModel["roadmap_preparation"];
  readonly confidenceAndUncertainty: AuthorFacingEditorialProfileReadModel["confidence_and_uncertainty"];
  readonly whatHappensNext: AuthorFacingEditorialProfileReadModel["what_happens_next"];
  readonly authorControlStatement: string;
};

export type EditorialProfilePresentationResult = {
  readonly state: EditorialProfilePresentationState;
  readonly message: string;
  readonly manuscriptTitle: string;
  readonly versionLabel: string | null;
  readonly presentation: StudioEditorialProfilePresentation | null;
};

export const EDITORIAL_PROFILE_STATE_MESSAGES: Readonly<
  Record<Exclude<EditorialProfilePresentationState, "active_profile_available" | "loading">, string>
> = {
  feature_disabled:
    "Editorial Profile is not available in this environment. Enable the development feature flags to view your profile.",
  no_active_profile:
    "There is no active Editorial Profile for this manuscript version yet. After the Editor-in-Chief completes an independent read and confirms the profile, it will appear here.",
  profile_being_prepared:
    "Your Editorial Profile is being prepared. The Editor-in-Chief is synthesizing understanding from the independent read.",
  incomplete_evidence:
    "The Editor-in-Chief needs more manuscript coverage before standing behind these classifications. The profile will update when evidence is stronger.",
  awaiting_eic_confirmation:
    "The Editorial Profile draft is awaiting Editor-in-Chief confirmation before it can be shown here.",
  blocked:
    "This Editorial Profile is temporarily unavailable while an editorial review or dispute is resolved.",
  generation_failed:
    "The Editorial Profile could not be completed. The Editor-in-Chief will retry synthesis when inputs are ready.",
  read_model_validation_failed:
    "The Editorial Profile could not be displayed safely. Please contact support if this persists.",
};

const PREPARATION_STATUSES = new Set<EditorialProfileStatus>([
  "not_started",
  "awaiting_independent_read",
  "generating",
]);

const AWAITING_CONFIRMATION_STATUSES = new Set<EditorialProfileStatus>(["draft", "awaiting_eic_confirmation"]);

function authorFacingStatusLabel(status: EditorialProfileStatus | "available"): string {
  switch (status) {
    case "active":
    case "updated":
    case "available":
      return "Current understanding";
    case "awaiting_eic_confirmation":
    case "draft":
      return "Awaiting confirmation";
    case "incomplete_evidence":
      return "Incomplete evidence";
    case "generating":
    case "not_started":
    case "awaiting_independent_read":
      return "Being prepared";
    case "blocked":
      return "Under review";
    case "failed":
      return "Could not be completed";
    default:
      return "Unavailable";
  }
}

function mapProfileStatusToPresentationState(
  status: EditorialProfileStatus,
): Exclude<EditorialProfilePresentationState, "active_profile_available" | "read_model_validation_failed" | "loading" | "feature_disabled"> {
  if (PREPARATION_STATUSES.has(status)) return "profile_being_prepared";
  if (status === "incomplete_evidence") return "incomplete_evidence";
  if (AWAITING_CONFIRMATION_STATUSES.has(status)) return "awaiting_eic_confirmation";
  if (status === "blocked") return "blocked";
  if (status === "failed") return "generation_failed";
  if (status === "superseded") return "no_active_profile";
  return "no_active_profile";
}

function formatLastUpdated(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function toStudioEditorialProfilePresentation(input: {
  readonly readModel: AuthorFacingEditorialProfileReadModel;
  readonly manuscriptTitle: string;
  readonly versionLabel: string | null;
}): StudioEditorialProfilePresentation {
  const lastUpdated =
    input.readModel.source_activated_at ?? input.readModel.source_generated_at ?? null;

  return Object.freeze({
    manuscriptTitle: input.manuscriptTitle,
    versionLabel: input.versionLabel,
    lastUpdatedLabel: formatLastUpdated(lastUpdated),
    statusLabel: authorFacingStatusLabel("available"),
    headerExplanation: EDITORIAL_PROFILE_HEADER_EXPLANATION,
    sections: input.readModel.sections,
    editorialUnderstanding: input.readModel.editorial_understanding,
    whatIsWorking: input.readModel.what_is_working,
    protectedAssets: input.readModel.protected_assets,
    improvementOpportunities: input.readModel.improvement_opportunities,
    editorialRisks: input.readModel.editorial_risks,
    manuscriptCharacteristics: input.readModel.manuscript_characteristics,
    recommendedSpecialistSupport: input.readModel.recommended_specialist_support,
    roadmapPreparation: input.readModel.roadmap_preparation,
    confidenceAndUncertainty: input.readModel.confidence_and_uncertainty,
    whatHappensNext: input.readModel.what_happens_next,
    authorControlStatement: input.readModel.author_control_statement,
  });
}

async function lookupActiveEditorialProfile(input: {
  readonly manuscriptId: string;
  readonly manuscriptVersionId: string;
}): Promise<EditorialProfileV1 | null> {
  return resolveStudioEditorialProfileFixture(input);
}

export type LoadEditorialProfilePresentationInput = {
  readonly manuscriptId: string;
  readonly manuscriptVersionId: string | null;
  readonly manuscriptTitle: string;
  readonly versionLabel: string | null;
  readonly authorIntentionSummary?: string | null;
};

export async function loadEditorialProfilePresentation(
  input: LoadEditorialProfilePresentationInput,
): Promise<EditorialProfilePresentationResult> {
  const base = Object.freeze({
    manuscriptTitle: input.manuscriptTitle,
    versionLabel: input.versionLabel,
    presentation: null as StudioEditorialProfilePresentation | null,
  });

  if (!isStudioEditorialProfileEnabled()) {
    return Object.freeze({
      ...base,
      state: "feature_disabled",
      message: EDITORIAL_PROFILE_STATE_MESSAGES.feature_disabled,
    });
  }

  if (!input.manuscriptVersionId) {
    return Object.freeze({
      ...base,
      state: "no_active_profile",
      message: EDITORIAL_PROFILE_STATE_MESSAGES.no_active_profile,
    });
  }

  const profile = await lookupActiveEditorialProfile({
    manuscriptId: input.manuscriptId,
    manuscriptVersionId: input.manuscriptVersionId,
  });

  if (!profile) {
    return Object.freeze({
      ...base,
      state: "no_active_profile",
      message: EDITORIAL_PROFILE_STATE_MESSAGES.no_active_profile,
    });
  }

  if (profile.status !== "active" && profile.status !== "updated") {
    const state = mapProfileStatusToPresentationState(profile.status);
    return Object.freeze({
      ...base,
      state,
      message: EDITORIAL_PROFILE_STATE_MESSAGES[state],
    });
  }

  const readModelResult = createAuthorFacingEditorialProfileReadModel({
    profile,
    expectedManuscriptId: input.manuscriptId,
    expectedManuscriptVersionId: input.manuscriptVersionId,
    authorIntentionSummary: input.authorIntentionSummary ?? null,
  });

  if (!readModelResult.ok) {
    return Object.freeze({
      ...base,
      state: "read_model_validation_failed",
      message: EDITORIAL_PROFILE_STATE_MESSAGES.read_model_validation_failed,
    });
  }

  return Object.freeze({
    ...base,
    state: "active_profile_available",
    message: EDITORIAL_PROFILE_HEADER_EXPLANATION,
    presentation: toStudioEditorialProfilePresentation({
      readModel: readModelResult.readModel,
      manuscriptTitle: input.manuscriptTitle,
      versionLabel: input.versionLabel,
    }),
  });
}
