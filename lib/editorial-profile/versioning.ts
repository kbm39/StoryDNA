import {
  EDITORIAL_PROFILE_CONTRACT_VERSION,
  EDITORIAL_PROFILE_IS_AUTHOR_INTENT,
  EDITORIAL_PROFILE_IS_EXPERT_FINDING,
  EDITORIAL_PROFILE_IS_MANUSCRIPT_EVIDENCE,
} from "./contract.ts";
import type { EditorialProfileV1, ProfileVersionChainEntry } from "./types.ts";

export function profileMetadataFlags() {
  return {
    is_expert_finding: EDITORIAL_PROFILE_IS_EXPERT_FINDING,
    is_manuscript_evidence: EDITORIAL_PROFILE_IS_MANUSCRIPT_EVIDENCE,
    is_author_intent: EDITORIAL_PROFILE_IS_AUTHOR_INTENT,
  };
}

export function assertProfileContractVersion(version: string): boolean {
  return version === EDITORIAL_PROFILE_CONTRACT_VERSION;
}

/** Immutable statuses — pre-expert profile entries cannot mutate once active. */
export const IMMUTABLE_PROFILE_STATUSES = ["active", "updated", "superseded"] as const;

export function isImmutableProfileStatus(
  status: EditorialProfileV1["status"],
): boolean {
  return (IMMUTABLE_PROFILE_STATUSES as readonly string[]).includes(status);
}

export function assertProfileMutable(profile: EditorialProfileV1): {
  ok: boolean;
  error?: string;
} {
  if (isImmutableProfileStatus(profile.status)) {
    return {
      ok: false,
      error: `Profile ${profile.profile_id} is ${profile.status} and cannot be mutated — create a superseding version.`,
    };
  }
  return { ok: true };
}

export type SupersedeProfileInput = {
  readonly prior: EditorialProfileV1;
  readonly newProfileId: string;
  readonly triggerEvent: EditorialProfileV1["trigger_event"];
  readonly generatedAt: string;
  readonly updates: Partial<
    Pick<
      EditorialProfileV1,
      | "story_identity"
      | "story_engines"
      | "editorial_characteristics"
      | "technical_characteristics"
      | "emotional_characteristics"
      | "protected_assets"
      | "editorial_risks"
      | "specialist_requirements"
      | "commercial_characteristics"
      | "roadmap_inputs"
      | "synthesis_confidence"
      | "status"
      | "manuscript_version_id"
      | "independent_read_id"
      | "provenance"
    >
  >;
};

/**
 * Create a superseding profile from a prior version — append-only history.
 * Prior profile should transition to superseded separately via lifecycle.
 */
export function createSupersedingProfile(input: SupersedeProfileInput): EditorialProfileV1 {
  const { prior, newProfileId, triggerEvent, generatedAt, updates } = input;

  return Object.freeze({
    ...prior,
    ...updates,
    profile_id: newProfileId,
    contract_version: EDITORIAL_PROFILE_CONTRACT_VERSION,
    supersedes_profile_id: prior.profile_id,
    superseded_by_profile_id: null,
    generated_at: generatedAt,
    activated_at: null,
    trigger_event: triggerEvent,
    status: updates.status ?? "draft",
    is_expert_finding: false,
    is_manuscript_evidence: false,
    is_author_intent: false,
  });
}

/** Link successor on prior profile (in-memory — persistence deferred to EP-3). */
export function linkSupersededProfile(
  prior: EditorialProfileV1,
  successorProfileId: string,
): EditorialProfileV1 {
  return Object.freeze({
    ...prior,
    status: "superseded",
    superseded_by_profile_id: successorProfileId,
  });
}

/** Build append-only version chain from profile history. */
export function buildProfileVersionChain(
  profiles: readonly EditorialProfileV1[],
): readonly ProfileVersionChainEntry[] {
  return Object.freeze(
    [...profiles]
      .sort((a, b) => a.generated_at.localeCompare(b.generated_at))
      .map((p) =>
        Object.freeze({
          profile_id: p.profile_id,
          status: p.status,
          supersedes_profile_id: p.supersedes_profile_id ?? null,
          superseded_by_profile_id: p.superseded_by_profile_id ?? null,
          generated_at: p.generated_at,
        }),
      ),
  );
}

/** Trace provenance from profile to source artifact IDs. */
export function extractProvenanceSources(profile: EditorialProfileV1): Readonly<{
  author_intent_id: string;
  independent_read_id: string;
  editorial_understanding_id: string | null;
  manuscript_brief_id: string | null;
  specialist_manuscript_access_count: number;
}> {
  return Object.freeze({
    author_intent_id: profile.provenance.author_intent_id,
    independent_read_id: profile.provenance.independent_read_id,
    editorial_understanding_id: profile.provenance.editorial_understanding_id ?? null,
    manuscript_brief_id: profile.provenance.manuscript_brief_id ?? null,
    specialist_manuscript_access_count: profile.provenance.specialist_manuscript_access_count,
  });
}

/** Alignment-only patch for PEU reconfirmation — no classification mutation. */
export type AlignmentPatchInput = {
  readonly profile: EditorialProfileV1;
  readonly destination_alignment: EditorialProfileV1["roadmap_inputs"]["destination_alignment"];
  readonly author_framing_alignment?: EditorialProfileV1["story_identity"]["author_framing_alignment"];
  readonly alignment_note?: string | null;
};

export function applyAlignmentPatch(input: AlignmentPatchInput): EditorialProfileV1 {
  const mutableCheck = assertProfileMutable(input.profile);
  if (!mutableCheck.ok && input.profile.status !== "active") {
    throw new Error(mutableCheck.error);
  }

  return Object.freeze({
    ...input.profile,
    status: input.profile.status === "active" ? "updated" : input.profile.status,
    story_identity: Object.freeze({
      ...input.profile.story_identity,
      ...(input.author_framing_alignment != null
        ? { author_framing_alignment: input.author_framing_alignment }
        : {}),
      ...(input.alignment_note !== undefined ? { alignment_note: input.alignment_note } : {}),
    }),
    roadmap_inputs: Object.freeze({
      ...input.profile.roadmap_inputs,
      destination_alignment: input.destination_alignment,
      alignment_source: "vision_alignment",
    }),
    trigger_event: "alignment_patch",
  });
}

export function freezeProfileSections<T extends EditorialProfileV1>(profile: T): T {
  return Object.freeze({
    ...profile,
    story_identity: Object.freeze({ ...profile.story_identity }),
    story_engines: Object.freeze(profile.story_engines.map((e) => Object.freeze({ ...e }))),
    editorial_characteristics: Object.freeze(
      profile.editorial_characteristics.map((e) => Object.freeze({ ...e })),
    ),
    technical_characteristics: Object.freeze(
      profile.technical_characteristics.map((e) => Object.freeze({ ...e })),
    ),
    emotional_characteristics: Object.freeze(
      profile.emotional_characteristics.map((e) => Object.freeze({ ...e })),
    ),
    protected_assets: Object.freeze(profile.protected_assets.map((e) => Object.freeze({ ...e }))),
    editorial_risks: Object.freeze(profile.editorial_risks.map((e) => Object.freeze({ ...e }))),
    specialist_requirements: Object.freeze(
      profile.specialist_requirements.map((e) => Object.freeze({ ...e })),
    ),
    commercial_characteristics: Object.freeze({ ...profile.commercial_characteristics }),
    roadmap_inputs: Object.freeze({ ...profile.roadmap_inputs }),
    provenance: Object.freeze({ ...profile.provenance }),
    synthesis_confidence: Object.freeze({ ...profile.synthesis_confidence }),
  }) as T;
}
