import type { EditorialUnderstandingRecord, SynthesisArtifact } from "@/lib/editorial-understanding/types.ts";
import { authorFacingConfidencePhrase, computeUnderstandingQuality } from "./understanding-confidence.ts";
import type { ConfidenceLevel } from "./types.ts";

export function buildConfirmationSummary(record: EditorialUnderstandingRecord): string {
  const quality = record.understanding_quality;
  const phrase = quality
    ? authorFacingConfidencePhrase(quality.aggregate_level as ConfidenceLevel)
    : "Editorial Understanding is ready for your confirmation.";

  const synthesisBlocks =
    record.synthesis_artifacts?.map((a) => a.synthesis_text).filter(Boolean) ?? [];

  const sections = [
    phrase ? `${phrase}` : "",
    "",
    "Here's what I understand about your project:",
    "",
    `Your story: ${record.primary_vision ?? ""}`,
  ];

  if (synthesisBlocks.length > 0) {
    sections.push("", synthesisBlocks[0]!);
  }

  sections.push(
    "",
    `Your reader: ${record.target_reader ?? record.market_position ?? ""}`,
    "",
    `The experience you want: ${
      record.desired_reader_experience?.trim() || "You skipped this — that's fine."
    }`,
    "",
    `Market position: ${record.market_position ?? ""}`,
    "",
    `Why you wrote it: ${record.creative_motivation ?? ""}`,
    "",
    `Success for you: ${record.success_definition ?? ""}`,
    "",
    "Did I understand you correctly?",
  );

  return sections.filter((line, i) => i > 0 || line.length > 0).join("\n");
}

export function validateConfirmationGate(record: EditorialUnderstandingRecord): {
  ok: boolean;
  error?: string;
} {
  const quality =
    record.understanding_quality ??
    computeUnderstandingQuality({ stageTurns: record.stage_turns });

  if (quality.aggregate_level === "insufficient") {
    return {
      ok: false,
      error: "Editorial understanding is insufficient for confirmation.",
    };
  }

  const requiredFields: Array<keyof Pick<
    EditorialUnderstandingRecord,
    "primary_vision" | "creative_motivation" | "market_position" | "success_definition"
  >> = ["primary_vision", "creative_motivation", "market_position", "success_definition"];

  for (const field of requiredFields) {
    if (!record[field]?.trim()) {
      return { ok: false, error: `Required field missing: ${field}` };
    }
  }

  return { ok: true };
}

export function buildSynthesisArtifact(input: {
  stageId: string;
  qualityLevel: 2 | 3;
  synthesisText: string;
  turnId: string;
}): SynthesisArtifact {
  return {
    stage_id: input.stageId,
    quality_level: input.qualityLevel,
    synthesis_text: input.synthesisText,
    grounded_in: [input.turnId],
    created_at: new Date().toISOString(),
  };
}

export function applyAuthorConfirmation(
  quality: ReturnType<typeof computeUnderstandingQuality>,
): ReturnType<typeof computeUnderstandingQuality> {
  return computeUnderstandingQuality({
    stageTurns: [],
    lastGateResult: "pass",
    lastResponseQualityLevel: quality.last_response_quality_level,
    confirmed: true,
  });
}
