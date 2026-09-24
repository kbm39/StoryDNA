import {
  ARCHIVIST_EXPERT_KEY,
  ARCHIVIST_REVIEW_SCHEMA,
  ARCHIVIST_VERSION,
  type ArchivistFinding,
  type ArchivistReview,
} from "../contracts.ts";
import { applyArchivistLivePostprocess } from "../live-postprocess.ts";
import { validateArchivistReview } from "../validation.ts";
import { ARCHIVIST_CONSTITUTION_DEFINITION_HASH } from "../constitution-hash.ts";
import {
  ARCHIVIST_NORMALIZATION_VERSION,
  ARCHIVIST_PROMPT_VERSION,
  ARCHIVIST_VALIDATOR_VERSION,
} from "../runtime-definition.ts";
import { assertCandidateOnlyCanon, candidateCanonFromBookGraph } from "./candidate-canon.ts";
import { assertCompleteCoverage } from "./coverage.ts";
import { CoverageIncompleteError, SegmentedPublicationBlockedError } from "./errors.ts";
import {
  downgradeUnrehydratedConfirmed,
  rehydrateFindingEvidence,
} from "./evidence-rehydration.ts";
import type {
  ArchivistBookGraph,
  ContradictionPair,
  FullNovelCoverageReport,
} from "./types.ts";

export function findingsFromContradictionPairs(
  pairs: readonly ContradictionPair[],
  identity: {
    manuscript_id: string;
    manuscript_version_id: string;
    content_hash: string;
  },
): ArchivistFinding[] {
  return pairs.map((pair, index) => {
    const leftExcerpt = pair.left.evidence[0]?.excerpt ?? "";
    const rightExcerpt = pair.right.evidence[0]?.excerpt ?? "";
    const leftLocator = pair.left.locators[0]?.locator ?? pair.left.id;
    const rightLocator = pair.right.locators[0]?.locator ?? pair.right.id;
    return {
      id: `seg-finding-${index + 1}`,
      issue_type: pair.issue_type,
      classification: "confirmed_contradiction",
      model_classification: "confirmed_contradiction",
      severity: "major",
      confidence: "high",
      current_location: pair.right.locators[0] ?? { locator: rightLocator },
      current_evidence: [
        {
          excerpt: rightExcerpt,
          locator: rightLocator,
          evidence_role: "current_observation",
          verification_status: "located",
          source_kind: "manuscript",
          ...identity,
        },
      ],
      conflicting_location: pair.left.locators[0] ?? { locator: leftLocator },
      conflicting_evidence: [
        {
          excerpt: leftExcerpt,
          locator: leftLocator,
          evidence_role: "contrary",
          verification_status: "located",
          source_kind: "manuscript",
          ...identity,
        },
      ],
      temporal_analysis: {
        relation: "earlier_later",
        continuity_compatibility: "incompatible",
        explanation: pair.explanation,
        current_scope: pair.right.temporal_scope,
        conflicting_scope: pair.left.temporal_scope,
      },
      explanation: pair.explanation,
      suggested_resolution: "Author should reconcile the two observations.",
      author_action: "pending",
      author_challenge_supported: true,
    };
  });
}

export function assembleSegmentedArchivistReview(args: {
  coverage: FullNovelCoverageReport;
  graph: ArchivistBookGraph;
  pairs: readonly ContradictionPair[];
  manuscriptText: string;
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
}): ArchivistReview {
  if (!args.coverage.complete) {
    throw new CoverageIncompleteError("final publication requires 100% unique coverage");
  }
  assertCompleteCoverage(args.coverage);

  const identity = {
    manuscript_id: args.manuscript_id,
    manuscript_version_id: args.manuscript_version_id,
    content_hash: args.content_hash,
  };
  const rawFindings = findingsFromContradictionPairs(args.pairs, identity).map((finding) =>
    downgradeUnrehydratedConfirmed(
      rehydrateFindingEvidence({
        finding,
        manuscriptText: args.manuscriptText,
        ...identity,
      }),
    ),
  );
  const canon_delta = candidateCanonFromBookGraph(args.graph);
  assertCandidateOnlyCanon(canon_delta);

  const draft: ArchivistReview = {
    schema: ARCHIVIST_REVIEW_SCHEMA,
    expert_key: ARCHIVIST_EXPERT_KEY,
    expert_version: ARCHIVIST_VERSION,
    manuscript_id: args.manuscript_id,
    manuscript_version_id: args.manuscript_version_id,
    content_hash: args.content_hash,
    summary: {
      confirmed_contradiction_count: rawFindings.filter((item) => item.classification === "confirmed_contradiction").length,
      possible_conflict_count: rawFindings.filter((item) => item.classification === "possible_continuity_conflict").length,
      author_verification_count: rawFindings.filter((item) => item.classification === "author_verification_needed").length,
      narrative: "Segmented full-manuscript Archivist assembly. Candidate-only. No accepted canon.",
    },
    findings: rawFindings,
    canon_delta,
    entity_ambiguities: args.graph.unresolved_ambiguities,
    metrics: {
      finding_count: rawFindings.length,
      confirmed_contradiction_count: 0,
      possible_conflict_count: 0,
      author_verification_count: 0,
      canon_delta_count: canon_delta.length,
      entity_ambiguity_count: args.graph.unresolved_ambiguities.length,
      evidence_record_count: 0,
    },
    generation: {
      provider: "none",
      model: "none",
      prompt_version: ARCHIVIST_PROMPT_VERSION,
      validator_version: ARCHIVIST_VALIDATOR_VERSION,
      normalization_version: ARCHIVIST_NORMALIZATION_VERSION,
      definition_hash: ARCHIVIST_CONSTITUTION_DEFINITION_HASH,
    },
    author_challenge_supported: true,
  };

  const processed = applyArchivistLivePostprocess(draft, {
    manuscriptText: args.manuscriptText,
    useCertificationEntityCatalog: true,
  });
  if (processed.canon_delta.some((delta) => delta.status !== "candidate")) {
    throw new SegmentedPublicationBlockedError("accepted canon blocked");
  }
  const validation = validateArchivistReview(processed, {
    manuscriptText: args.manuscriptText,
  });
  if (!validation.ok) {
    throw new SegmentedPublicationBlockedError(validation.errors.join("; "));
  }
  return processed;
}

export function executionScopeForCoverage(
  coverage: FullNovelCoverageReport,
): "full_manuscript" | "incomplete" {
  return coverage.complete && coverage.coverage_percentage === 100
    ? "full_manuscript"
    : "incomplete";
}
