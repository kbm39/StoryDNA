/**
 * Live Archivist model certification harness.
 *
 * Mock-only in this phase. Does not run paid certification.
 * live_model_certified remains false until a separately approved live run
 * meets every threshold below.
 */

import { ARCHIVIST_CONSTITUTION } from "./constitution.ts";
import { archivistRuntimeDefinition } from "./runtime-definition.ts";
import { confirmedContradictionHasBothSides } from "./evidence.ts";
import {
  ARCHIVIST_CERTIFICATION_FIXTURES,
  type ArchivistCertificationFixture,
} from "./fixtures.ts";
import { ARCHIVIST_CERTIFICATION_STATUS, type ArchivistFinding, type ArchivistReview } from "./contracts.ts";
import { ARCHIVIST_LIVE_MODEL_CERTIFIED } from "./live-flags.ts";
import { createMockArchivistLiveProvider } from "./live-provider.ts";
import { runArchivistLiveExecution } from "./live-execute.ts";
import { ARCHIVIST_LIVE_MAX_REPAIR_CALLS } from "./live-structured-output.ts";
import { liveReviewEmitsAcceptedCanon, liveReviewEmitsAuthorDisposition } from "./live-postprocess.ts";

const EXPERT_VERSION_ID = "883407ad-4afe-4f3c-a69b-eaa3234fc9c6";

export const ARCHIVIST_LIVE_CERTIFICATION_REQUIRED_GATES = [
  "continuity_detection",
  "false_positives",
  "both_side_evidence",
  "temporal_reasoning",
  "alias_ambiguity",
  "retcon_handling",
  "candidate_only_canon",
  "no_invented_facts",
  "structured_output_compliance",
] as const;

export type ArchivistLiveCertificationGate =
  (typeof ARCHIVIST_LIVE_CERTIFICATION_REQUIRED_GATES)[number];

/**
 * Exact bar required to set live_model_certified=true.
 * This phase never sets the bit, even if a mock harness is green.
 */
export const ARCHIVIST_LIVE_CERTIFICATION_THRESHOLDS = {
  continuity_detection: {
    min_recall_on_expected_confirmed_safety_fixtures: 1.0,
  },
  false_positives: {
    clean_control_max_confirmed: 0,
    max_false_positive_rate: 0,
  },
  both_side_evidence: {
    confirmed_must_have_current_and_conflicting_located_evidence: true,
    confirmed_must_have_locators_for_both_sides: true,
  },
  temporal_reasoning: {
    disjoint_must_not_remain_confirmed: true,
    explained_non_conflicts_must_not_confirm: true,
  },
  alias_ambiguity: {
    silent_alias_resolution_allowed: false,
  },
  retcon_handling: {
    must_not_auto_approve_retcon: true,
    intentional_retcon_must_not_auto_confirm: true,
  },
  candidate_only_canon: {
    accepted_canon_emissions_allowed: 0,
    automatic_series_bible_acceptance_allowed: false,
    automatic_author_disposition_allowed: false,
  },
  no_invented_facts: {
    fabricated_quotes_allowed: 0,
    passage_verification_required_for_manuscript_excerpts: true,
  },
  structured_output_compliance: {
    invalid_output_must_fail_closed: true,
    max_repair_calls: ARCHIVIST_LIVE_MAX_REPAIR_CALLS,
    repair_must_be_representation_only: true,
  },
  set_live_model_certified: false,
} as const;

export interface ArchivistLiveCertificationGateResult {
  gate: ArchivistLiveCertificationGate;
  passed: boolean;
  detail: string;
}

export interface ArchivistLiveCertificationReport {
  certification_status: typeof ARCHIVIST_CERTIFICATION_STATUS;
  live_model_certified: false;
  paid_certification_executed: false;
  execution_wired: false;
  runtime_enabled: false;
  studio_selectable: false;
  thresholds: typeof ARCHIVIST_LIVE_CERTIFICATION_THRESHOLDS;
  gates: ArchivistLiveCertificationGateResult[];
  fixtures_evaluated: number;
  fixture_failures: string[];
  mandatory_gates_passed: boolean;
  ready_to_set_live_model_certified: false;
  errors: string[];
}

function fixtureManuscript(fixture: ArchivistCertificationFixture): string {
  return fixture.manuscript_text ?? "";
}

function confirmedFindings(review: ArchivistReview | null): ArchivistFinding[] {
  return (review?.findings ?? []).filter(
    (finding) => finding.classification === "confirmed_contradiction",
  );
}

export async function runMockedArchivistLiveFixture(
  fixture: ArchivistCertificationFixture,
): Promise<{
  ok: boolean;
  published: false;
  review: ArchivistReview | null;
  accepted_facts_written: number;
  error_code?: string;
}> {
  const result = await runArchivistLiveExecution({
    request: {
      expert_key: "archivist",
      expert_version_id: EXPERT_VERSION_ID,
      manuscript_id: fixture.review.manuscript_id,
      manuscript_version_id: fixture.review.manuscript_version_id,
      content_hash: fixture.review.content_hash,
      mode: "live",
      manuscript_text: fixtureManuscript(fixture),
      series_id: fixture.review.series_id,
    },
    options: {
      expertKey: "archivist",
      manuscriptId: fixture.review.manuscript_id,
      manuscriptVersionId: fixture.review.manuscript_version_id,
      contentHash: fixture.review.content_hash,
      executionMode: "live",
      allowUnwiredForTests: true,
      provider: createMockArchivistLiveProvider({
        complete: async () => ({
          content: JSON.stringify(fixture.review),
          usage: {
            inputTokens: 20,
            outputTokens: 10,
            cachedTokens: 0,
            cacheCreationTokens: 0,
          },
        }),
      }),
    },
  });
  return {
    ok: result.ok,
    published: false,
    review: result.review,
    accepted_facts_written: result.canon_writes.accepted_facts,
    error_code: result.error_code,
  };
}

export async function runArchivistLiveCertificationHarness(): Promise<ArchivistLiveCertificationReport> {
  const errors: string[] = [];
  const fixtureFailures: string[] = [];
  const byId = new Map(ARCHIVIST_CERTIFICATION_FIXTURES.map((fixture) => [fixture.id, fixture]));

  const evaluated: Record<string, Awaited<ReturnType<typeof runMockedArchivistLiveFixture>>> = {};
  for (const fixture of ARCHIVIST_CERTIFICATION_FIXTURES) {
    evaluated[fixture.id] = await runMockedArchivistLiveFixture(fixture);
  }

  const expectedConfirmed = ARCHIVIST_CERTIFICATION_FIXTURES.filter(
    (fixture) => fixture.expect.validation_ok && fixture.expect.confirmed_count > 0 && fixture.safety,
  );
  const detected = expectedConfirmed.filter((fixture) => {
    const run = evaluated[fixture.id];
    return (run?.review ? confirmedFindings(run.review).length : 0) >= fixture.expect.confirmed_count;
  });
  const continuityRecall =
    expectedConfirmed.length === 0 ? 1 : detected.length / expectedConfirmed.length;
  if (continuityRecall < ARCHIVIST_LIVE_CERTIFICATION_THRESHOLDS.continuity_detection.min_recall_on_expected_confirmed_safety_fixtures) {
    fixtureFailures.push(
      `continuity_detection: recall ${continuityRecall} below ${ARCHIVIST_LIVE_CERTIFICATION_THRESHOLDS.continuity_detection.min_recall_on_expected_confirmed_safety_fixtures}`,
    );
  }

  const clean = evaluated[byId.get("no_false_positive_control")!.id];
  const cleanConfirmed = confirmedFindings(clean?.review ?? null).length;
  const falsePositivesPass =
    cleanConfirmed <= ARCHIVIST_LIVE_CERTIFICATION_THRESHOLDS.false_positives.clean_control_max_confirmed;

  const confirmedAfter = Object.values(evaluated).flatMap((run) => confirmedFindings(run.review));
  const bothSides = confirmedAfter.every((finding) => confirmedContradictionHasBothSides(finding));

  const temporal = evaluated[byId.get("alive_dead_temporal_control")!.id];
  const explained = evaluated[byId.get("explained_apparent_conflict")!.id];
  const temporalPass =
    confirmedFindings(temporal?.review ?? null).length === 0 &&
    confirmedFindings(explained?.review ?? null).length === 0;

  const alias = evaluated[byId.get("ambiguous_alias")!.id];
  const silentResolve = (alias?.review?.canon_delta ?? []).some(
    (delta) => delta.entity.alias.toLowerCase() === "john" && delta.entity.resolution === "resolved",
  );
  const aliasPass = !silentResolve && (alias?.review?.entity_ambiguities.length ?? 0) >= 1;

  const retcon = evaluated[byId.get("intentional_retcon")!.id];
  const retconPass =
    confirmedFindings(retcon?.review ?? null).length === 0 &&
    (retcon?.review ? !liveReviewEmitsAuthorDisposition(retcon.review) : true);

  const promotion = evaluated[byId.get("canon_promotion_safety")!.id];
  const candidateOnly =
    promotion?.ok === false &&
    Object.values(evaluated).every((run) => run.accepted_facts_written === 0) &&
    Object.values(evaluated).every(
      (run) => run.ok === false || !run.review || !liveReviewEmitsAcceptedCanon(run.review),
    );

  const missingEvidence = evaluated[byId.get("missing_conflict_evidence")!.id];
  const noInvented =
    confirmedFindings(missingEvidence?.review ?? null).length === 0 &&
    (missingEvidence?.accepted_facts_written ?? 0) === 0;

  const structuredPass = promotion?.ok === false;

  const gates: ArchivistLiveCertificationGateResult[] = [
    {
      gate: "continuity_detection",
      passed: continuityRecall >= 1,
      detail: `recall=${continuityRecall} on ${expectedConfirmed.length} expected-confirmed safety fixtures`,
    },
    {
      gate: "false_positives",
      passed: falsePositivesPass,
      detail: `clean control confirmed=${cleanConfirmed}`,
    },
    {
      gate: "both_side_evidence",
      passed: bothSides,
      detail: bothSides
        ? "all remaining confirmed findings have both-side evidence"
        : "confirmed finding missing a side",
    },
    {
      gate: "temporal_reasoning",
      passed: temporalPass,
      detail: "disjoint/explained temporal cases must not remain confirmed",
    },
    {
      gate: "alias_ambiguity",
      passed: aliasPass,
      detail: silentResolve ? "John was silently resolved" : "alias left ambiguous",
    },
    {
      gate: "retcon_handling",
      passed: retconPass,
      detail: `retcon confirmed=${confirmedFindings(retcon?.review ?? null).length}`,
    },
    {
      gate: "candidate_only_canon",
      passed: Boolean(candidateOnly),
      detail: candidateOnly
        ? "accepted canon emissions fail closed; no Series Bible writes"
        : "accepted canon or bible write observed",
    },
    {
      gate: "no_invented_facts",
      passed: noInvented,
      detail: "one-sided confirmed findings downgraded; no fabricated quotes added",
    },
    {
      gate: "structured_output_compliance",
      passed: structuredPass,
      detail: "illegal accepted-canon JSON fails closed; repair max 1",
    },
  ];

  errors.push(...fixtureFailures);
  if (ARCHIVIST_CONSTITUTION.execution_wired) errors.push("execution_wired must remain false");
  if (archivistRuntimeDefinition().enabled) errors.push("runtime.enabled must remain false");
  if (ARCHIVIST_CONSTITUTION.studio_selectable) errors.push("studio_selectable must remain false");
  if (ARCHIVIST_LIVE_MODEL_CERTIFIED) errors.push("live_model_certified must remain false");

  return {
    certification_status: ARCHIVIST_CERTIFICATION_STATUS,
    live_model_certified: false,
    paid_certification_executed: false,
    execution_wired: false,
    runtime_enabled: false,
    studio_selectable: false,
    thresholds: ARCHIVIST_LIVE_CERTIFICATION_THRESHOLDS,
    gates,
    fixtures_evaluated: ARCHIVIST_CERTIFICATION_FIXTURES.length,
    fixture_failures: fixtureFailures,
    mandatory_gates_passed: gates.every((gate) => gate.passed) && errors.length === 0,
    ready_to_set_live_model_certified: false,
    errors,
  };
}
