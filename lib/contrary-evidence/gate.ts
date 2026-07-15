import {
  assessConcernDeterministic,
  buildSemanticAssessorInput,
  composeConcernAssessment,
} from "./assess.ts";
import { extractPriorConcerns } from "./extract-prior-concerns.ts";
import { enforceScoringGate } from "./scoring-gate.ts";
import { executeSearch } from "./search-execute.ts";
import { buildSearchPlans } from "./search-plan.ts";
import type {
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
}

export interface GateRunResult {
  extraction: ReturnType<typeof extractPriorConcerns>;
  assessments: ConcernAssessment[];
  scoring_gate: ScoringGateResult;
}

export function runContraryEvidenceGate(input: GateRunInput): GateRunResult {
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
    const semantic = assessor.assess(semanticInput);
    assessments.push(composeConcernAssessment(concern, search, semantic));
  }

  const scoring_gate = enforceScoringGate({ assessments });

  return { extraction, assessments, scoring_gate };
}
