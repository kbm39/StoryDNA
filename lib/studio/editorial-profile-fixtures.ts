/**
 * Dev-only Editorial Profile fixtures for Studio presentation (EP-6).
 * No database persistence — inject via STUDIO_EDITORIAL_PROFILE_DEV_FIXTURE.
 */

import {
  buildFixtureActiveEditorialProfile,
  buildFixtureEditorialProfileWithStatus,
} from "@/lib/editorial-profile/fixtures/active-profile-fixture.ts";
import type { EditorialProfileStatus } from "@/lib/editorial-profile/contract.ts";
import type { EditorialProfileV1 } from "@/lib/editorial-profile/types.ts";

export const STUDIO_EDITORIAL_PROFILE_DEV_FIXTURE_ENV =
  "STUDIO_EDITORIAL_PROFILE_DEV_FIXTURE" as const;

export type StudioEditorialProfileDevFixtureMode =
  | "active"
  | "awaiting_eic_confirmation"
  | "incomplete_evidence"
  | "generating"
  | "blocked"
  | "failed"
  | "validation_failed"
  | "none";

export function parseStudioEditorialProfileDevFixtureMode(): StudioEditorialProfileDevFixtureMode | null {
  const raw = process.env[STUDIO_EDITORIAL_PROFILE_DEV_FIXTURE_ENV]?.trim().toLowerCase();
  if (!raw || raw === "0" || raw === "false" || raw === "off") return null;
  if (raw === "none" || raw === "no_active_profile") return "none";
  if (
    raw === "active" ||
    raw === "awaiting_eic_confirmation" ||
    raw === "incomplete_evidence" ||
    raw === "generating" ||
    raw === "blocked" ||
    raw === "failed" ||
    raw === "validation_failed"
  ) {
    return raw;
  }
  return null;
}

function remapProfileScope(
  profile: EditorialProfileV1,
  manuscriptId: string,
  manuscriptVersionId: string,
): EditorialProfileV1 {
  return Object.freeze({
    ...profile,
    manuscript_id: manuscriptId,
    manuscript_version_id: manuscriptVersionId,
  });
}

/** Deterministic invalid active profile for read-model validation failure tests. */
export function buildInvalidActiveFixtureProfile(
  manuscriptId: string,
  manuscriptVersionId: string,
): EditorialProfileV1 {
  const base = buildFixtureActiveEditorialProfile();
  const profile = buildFixtureActiveEditorialProfile({
    specialist_requirements: base.specialist_requirements.map((req, index) =>
      index === 0
        ? {
            ...req,
            justification: "Run military_expert now for tactical review",
            evidence_summary: "military_expert recommended immediately",
          }
        : req,
    ),
  });
  return remapProfileScope(profile, manuscriptId, manuscriptVersionId);
}

/**
 * Resolve authoritative profile for Studio loader.
 * Returns null when no dev fixture is configured or mode is `none`.
 */
export function resolveStudioEditorialProfileFixture(input: {
  readonly manuscriptId: string;
  readonly manuscriptVersionId: string;
}): EditorialProfileV1 | null {
  const mode = parseStudioEditorialProfileDevFixtureMode();
  if (!mode || mode === "none") return null;

  if (mode === "validation_failed") {
    return buildInvalidActiveFixtureProfile(input.manuscriptId, input.manuscriptVersionId);
  }

  const statusMap: Record<
    Exclude<StudioEditorialProfileDevFixtureMode, "none" | "validation_failed">,
    EditorialProfileStatus
  > = {
    active: "active",
    awaiting_eic_confirmation: "awaiting_eic_confirmation",
    incomplete_evidence: "incomplete_evidence",
    generating: "generating",
    blocked: "blocked",
    failed: "failed",
  };

  const profile = buildFixtureEditorialProfileWithStatus(statusMap[mode]);
  return remapProfileScope(profile, input.manuscriptId, input.manuscriptVersionId);
}
