/**
 * Archivist dry-run scenarios — existing certification fixtures only.
 * Workflow/UI fixtures. Not live manuscript findings.
 */

import {
  FIXTURE_01_WITHIN_BOOK_EXACT,
  FIXTURE_02_EXPLAINED_APPEARANCE,
  FIXTURE_11_AMBIGUOUS_ALIAS,
  FIXTURE_12_UNCERTAIN,
  FIXTURE_13_CLEAN_CONTROL,
  type ArchivistCertificationFixture,
} from "./fixtures.ts";

export const ARCHIVIST_DRY_RUN_SCENARIOS = [
  "confirmed_within_book",
  "explained_temporal_non_conflict",
  "author_verification_needed",
  "ambiguous_alias",
  "candidate_canon_delta",
  "clean_no_conflict",
] as const;

export type ArchivistDryRunScenario = (typeof ARCHIVIST_DRY_RUN_SCENARIOS)[number];

const SCENARIO_FIXTURES: Record<ArchivistDryRunScenario, ArchivistCertificationFixture> = {
  confirmed_within_book: FIXTURE_01_WITHIN_BOOK_EXACT,
  explained_temporal_non_conflict: FIXTURE_02_EXPLAINED_APPEARANCE,
  author_verification_needed: FIXTURE_12_UNCERTAIN,
  ambiguous_alias: FIXTURE_11_AMBIGUOUS_ALIAS,
  candidate_canon_delta: FIXTURE_13_CLEAN_CONTROL,
  clean_no_conflict: FIXTURE_13_CLEAN_CONTROL,
};

export function isArchivistDryRunScenario(value: string | undefined): value is ArchivistDryRunScenario {
  return (
    value != null &&
    (ARCHIVIST_DRY_RUN_SCENARIOS as readonly string[]).includes(value)
  );
}

export function fixtureForArchivistDryRun(
  scenario: string | undefined,
): ArchivistCertificationFixture {
  const key: ArchivistDryRunScenario = isArchivistDryRunScenario(scenario)
    ? scenario
    : "confirmed_within_book";
  return SCENARIO_FIXTURES[key];
}
