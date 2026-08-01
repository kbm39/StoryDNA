import type { StageTurnRecord } from "@/lib/editorial-understanding/types.ts";
import type {
  ConfidenceDimension,
  ConfidenceLevel,
  ResponseQualityLevel,
  UnderstandingQuality,
  UnderstandingQualityDimensions,
} from "./types.ts";

const DIMENSION_ORDER: ConfidenceDimension[] = [
  "story_understanding",
  "author_goal_understanding",
  "reader_experience_understanding",
  "market_position_understanding",
  "success_definition_understanding",
  "unresolved_ambiguity",
  "grounding_confidence",
];

const FIELD_TO_DIMENSION: Record<string, ConfidenceDimension> = {
  primary_vision: "story_understanding",
  creative_motivation: "author_goal_understanding",
  target_reader: "reader_experience_understanding",
  desired_reader_experience: "reader_experience_understanding",
  market_position: "market_position_understanding",
  success_definition: "success_definition_understanding",
};

const LEVEL_RANK: Record<ConfidenceLevel, number> = {
  insufficient: 0,
  emerging: 1,
  adequate: 2,
  strong: 3,
  author_confirmed: 4,
};

function minLevel(...levels: ConfidenceLevel[]): ConfidenceLevel {
  return levels.reduce((min, level) =>
    LEVEL_RANK[level] < LEVEL_RANK[min] ? level : min,
  );
}

function maxLevel(...levels: ConfidenceLevel[]): ConfidenceLevel {
  return levels.reduce((max, level) =>
    LEVEL_RANK[level] > LEVEL_RANK[max] ? level : max,
  );
}

function levelFromStageTurn(turn: StageTurnRecord): ConfidenceLevel {
  if (turn.skipped) return "emerging";
  const answer = turn.clarification_answer?.trim() || turn.author_answer?.trim() || "";
  if (!answer) return "insufficient";
  if (answer.length <= 5) return "insufficient";
  if (answer.length < 10) return "emerging";

  const responseType = turn.eic_response_type;
  if (responseType === "reflection") return "adequate";
  if (responseType === "clarification" && turn.clarification_answer?.trim()) {
    return "adequate";
  }
  if (answer.length >= 20) return "emerging";
  return "emerging";
}

function dimensionFromTurns(
  dimension: ConfidenceDimension,
  stageTurns: readonly StageTurnRecord[],
): ConfidenceLevel {
  const relevantTurns = stageTurns.filter((turn) => {
    if (!turn.understanding_field) return false;
    return FIELD_TO_DIMENSION[turn.understanding_field] === dimension;
  });

  if (relevantTurns.length === 0) {
    if (dimension === "unresolved_ambiguity") return "adequate";
    if (dimension === "grounding_confidence") return "insufficient";
    return "insufficient";
  }

  const levels = relevantTurns.map(levelFromStageTurn);
  if (dimension === "unresolved_ambiguity") {
    const hasOpen = relevantTurns.some(
      (t) => t.clarification_used && !t.clarification_answer?.trim(),
    );
    if (hasOpen) return "insufficient";
    const minField = minLevel(...levels);
    return minField === "insufficient" ? "emerging" : "adequate";
  }

  return maxLevel(...levels);
}

export function computeUnderstandingQuality(input: {
  stageTurns: readonly StageTurnRecord[];
  lastGateResult?: UnderstandingQuality["last_gate_result"];
  lastResponseQualityLevel?: 1 | 2 | 3 | 4 | null;
  confirmed?: boolean;
}): UnderstandingQuality {
  const dimensions = {} as UnderstandingQualityDimensions;

  for (const dim of DIMENSION_ORDER) {
    dimensions[dim] = input.confirmed ? "author_confirmed" : dimensionFromTurns(dim, input.stageTurns);
  }

  if (input.confirmed) {
    for (const dim of DIMENSION_ORDER) {
      if (dim !== "unresolved_ambiguity") {
        dimensions[dim] = "author_confirmed";
      } else {
        dimensions[dim] = "adequate";
      }
    }
  }

  const requiredDims = DIMENSION_ORDER.filter((d) => d !== "unresolved_ambiguity");
  const aggregate_level = input.confirmed
    ? "author_confirmed"
    : minLevel(...requiredDims.map((d) => dimensions[d]));

  return {
    dimensions,
    aggregate_level,
    last_response_quality_level: input.lastResponseQualityLevel ?? null,
    last_gate_result: input.lastGateResult ?? "pass",
  };
}

export function authorFacingConfidencePhrase(level: ConfidenceLevel): string | null {
  switch (level) {
    case "emerging":
    case "adequate":
    case "strong":
      return "Editorial Understanding is taking shape.";
    case "author_confirmed":
      return "Editorial Understanding is ready for your confirmation.";
    default:
      return null;
  }
}

export function boostDimensionOnGatePass(
  quality: UnderstandingQuality,
  qualityLevel: ResponseQualityLevel,
  field: string | null,
): UnderstandingQuality {
  if (!field) return quality;
  const dim = FIELD_TO_DIMENSION[field];
  if (!dim) return quality;

  const current = quality.dimensions[dim];
  let next: ConfidenceLevel = current;
  if (qualityLevel === "grounded_reflection" && LEVEL_RANK[current] < LEVEL_RANK.adequate) {
    next = "adequate";
  }
  if (qualityLevel === "editorial_synthesis" && LEVEL_RANK[current] < LEVEL_RANK.strong) {
    next = "strong";
  }

  const dimensions = { ...quality.dimensions, [dim]: next };
  const requiredDims = DIMENSION_ORDER.filter((d) => d !== "unresolved_ambiguity");
  const aggregate_level = minLevel(...requiredDims.map((d) => dimensions[d]));

  return {
    ...quality,
    dimensions,
    aggregate_level,
    last_response_quality_level: quality.last_response_quality_level,
  };
}
