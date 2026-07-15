import {
  assessConcernDeterministic,
  buildSemanticAssessorInput,
  composeConcernAssessment,
} from "./assess.ts";
import { extractPriorConcerns } from "./extract-prior-concerns.ts";
import { enforceScoringGate } from "./scoring-gate.ts";
import { executeSearch } from "./search-execute.ts";
import { buildSearchPlans } from "./search-plan.ts";
import {
  assessSameVersionConcern,
  composeSameVersionAssessment,
  markSameVersionDuplicates,
} from "./same-version-assess.ts";
import { resolveComparisonMode } from "./comparison-mode.ts";
import type {
  ComparisonMode,
  ConcernAssessment,
  GenreProfile,
  PriorReviewBundle,
  RevisionCandidateRecord,
  ScoringGateResult,
  SemanticAssessor,
} from "./types.ts";

export interface GateRunInput {
  priorReview: PriorReviewBundle;
  priorText: string;
  currentText: string;
  genre: GenreProfile;
  revisionCandidates?: RevisionCandidateRecord[];
  semanticAssessor?: SemanticAssessor;
  comparison_mode?: ComparisonMode;
  prior_version_id?: string | null;
  current_version_id?: string | null;
  prior_content_hash?: string | null;
  current_content_hash?: string | null;
}

export interface GateRunResult {
  comparison_mode: ComparisonMode;
  extraction: ReturnType<typeof extractPriorConcerns>;
  assessments: ConcernAssessment[];
  scoring_gate: ScoringGateResult;
}

export async function runContraryEvidenceGate(input: GateRunInput): Promise<GateRunResult> {
  const comparison_mode =
    input.comparison_mode ??
    resolveComparisonMode({
      priorVersionId: input.prior_version_id ?? input.priorReview.manuscript_version_id,
      currentVersionId: input.current_version_id ?? null,
      priorContentHash: input.prior_content_hash,
      currentContentHash: input.current_content_hash,
    });

  const extraction = extractPriorConcerns(input.priorReview);
  const plans = buildSearchPlans(extraction.concerns, input.genre);
  const assessor = input.semanticAssessor ?? { assess: assessConcernDeterministic };

  const assessments: ConcernAssessment[] = [];

  for (const concern of extraction.concerns) {
    const plan = plans.find((p) => p.concern_id === concern.concern_id);
    if (!plan) continue;

    const search = executeSearch({
      plan,
      currentText: input.currentText,
      priorText: input.priorText,
      revisionCandidates: input.revisionCandidates ?? input.priorReview.revision_candidates,
    });

    const semanticInput = buildSemanticAssessorInput(concern, search, input.genre);

    if (comparison_mode === "SAME_VERSION_REASSESSMENT") {
      const sameVersion = assessSameVersionConcern(semanticInput);
      assessments.push(composeSameVersionAssessment(concern, search, sameVersion));
    } else {
      const semantic = await Promise.resolve(assessor.assess(semanticInput));
      assessments.push(composeConcernAssessment(concern, search, semantic));
    }
  }

  const finalized =
    comparison_mode === "SAME_VERSION_REASSESSMENT"
      ? markSameVersionDuplicates(assessments)
      : assessments;

  const scoring_gate = enforceScoringGate({ assessments: finalized, comparison_mode });

  return { comparison_mode, extraction, assessments: finalized, scoring_gate };
}
