import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server.ts";
import { evaluateFollowUpDecision } from "@/lib/conversational-intelligence/decision.ts";
import { emitConversationalResponse } from "@/lib/conversational-intelligence/response-emitter.ts";
import { CONVERSATIONAL_INTELLIGENCE_PROVIDER_MODEL } from "@/lib/conversational-intelligence/contract.ts";
import { isStudioProgressiveEditorialUnderstandingEnabled } from "@/lib/conversational-intelligence/peu/feature-flag.ts";
import {
  buildConfirmationSummary,
  buildSynthesisArtifact,
  validateConfirmationGate,
} from "@/lib/conversational-intelligence/peu/confirmation.ts";
import { hashCandidate, logPeuEvent } from "@/lib/conversational-intelligence/peu/observability.ts";
import {
  boostDimensionOnGatePass,
  computeUnderstandingQuality,
} from "@/lib/conversational-intelligence/peu/understanding-confidence.ts";
import { stageByPromptKey } from "@/lib/conversational-intelligence/stages.ts";
import {
  EDITORIAL_UNDERSTANDING_CONTRACT_VERSION,
  EDITORIAL_UNDERSTANDING_IS_AUTHOR_INTENT,
  EDITORIAL_UNDERSTANDING_IS_CANON,
  EDITORIAL_UNDERSTANDING_IS_EVIDENCE,
} from "./contract.ts";
import type {
  ConversationTurn,
  EditorialUnderstandingDraftInput,
  EditorialUnderstandingRecord,
  OpenQuestion,
  ResolvedClarification,
  StageTurnRecord,
  SynthesisArtifact,
  UnderstandingQualityRecord,
} from "./types.ts";
import {
  buildUnderstandingConfidence,
  buildUnderstandingSummary,
  validateConfirmationEligibility,
  validateEditorialUnderstandingDraft,
} from "./validation.ts";

type DbRow = {
  id: string;
  book_id: string;
  manuscript_id: string;
  manuscript_version_id: string;
  contract_version: string;
  interview_type: string;
  conducted_by: string;
  primary_vision: string | null;
  target_reader: string | null;
  desired_reader_experience: string | null;
  market_position: string | null;
  creative_motivation: string | null;
  success_definition: string | null;
  comparison_titles: string | null;
  open_questions: OpenQuestion[] | null;
  confidence: EditorialUnderstandingRecord["confidence"] | null;
  resolved_clarifications: ResolvedClarification[] | null;
  conversation_history: ConversationTurn[] | null;
  stage_turns: StageTurnRecord[] | null;
  understanding_summary: string | null;
  version: number;
  status: string;
  created_by: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
  supersedes_understanding_id: string | null;
  superseded_at: string | null;
  provider_model: string | null;
  provider_cost_usd: number | null;
  understanding_quality: UnderstandingQualityRecord | null;
  synthesis_artifacts: SynthesisArtifact[] | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: DbRow): EditorialUnderstandingRecord {
  const stageTurns = row.stage_turns ?? [];
  const confidence =
    row.confidence ?? buildUnderstandingConfidence(stageTurns, row.confirmed_at, row.confirmed_by);

  return Object.freeze({
    understanding_id: row.id,
    book_id: row.book_id,
    manuscript_id: row.manuscript_id,
    manuscript_version_id: row.manuscript_version_id,
    contract_version: EDITORIAL_UNDERSTANDING_CONTRACT_VERSION,
    interview_type: "eic_author_intake",
    conducted_by: "editor_in_chief",
    primary_vision: row.primary_vision,
    target_reader: row.target_reader,
    desired_reader_experience: row.desired_reader_experience,
    market_position: row.market_position,
    creative_motivation: row.creative_motivation,
    success_definition: row.success_definition,
    comparison_titles: row.comparison_titles,
    open_questions: Object.freeze(row.open_questions ?? []),
    confidence,
    resolved_clarifications: Object.freeze(row.resolved_clarifications ?? []),
    conversation_history: Object.freeze(row.conversation_history ?? []),
    stage_turns: Object.freeze(stageTurns),
    understanding_summary: row.understanding_summary,
    version: row.version,
    status: row.status as EditorialUnderstandingRecord["status"],
    is_manuscript_evidence: EDITORIAL_UNDERSTANDING_IS_EVIDENCE,
    is_author_intent: EDITORIAL_UNDERSTANDING_IS_AUTHOR_INTENT,
    is_canon: EDITORIAL_UNDERSTANDING_IS_CANON,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    confirmed_at: row.confirmed_at,
    confirmed_by: row.confirmed_by,
    supersedes_understanding_id: row.supersedes_understanding_id,
    superseded_at: row.superseded_at,
    provider_model: row.provider_model,
    provider_cost_usd: row.provider_cost_usd,
    understanding_quality: row.understanding_quality ?? null,
    synthesis_artifacts: Object.freeze(row.synthesis_artifacts ?? []),
  });
}

async function tableExists(): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("editorial_understandings").select("id").limit(1);
  if (!error) return true;
  const message = error.message.toLowerCase();
  return !message.includes("does not exist") && !message.includes("could not find");
}

function fieldValueFromPrompt(
  promptKey: string,
  answer: string | null,
): Partial<EditorialUnderstandingRecord> {
  const trimmed = answer?.trim() || null;
  switch (promptKey) {
    case "elevator_pitch":
      return { primary_vision: trimmed };
    case "author_motivation":
      return { creative_motivation: trimmed };
    case "desired_reader_experience":
      return { desired_reader_experience: trimmed };
    case "market_position":
      return {
        market_position: trimmed === "" || trimmed === null ? "unsure" : trimmed,
        target_reader: trimmed === "" || trimmed === null ? "unsure" : trimmed,
      };
    case "comparison_titles":
      return { comparison_titles: trimmed };
    case "success_definition":
      return { success_definition: trimmed };
    default:
      return {};
  }
}

function stageTurnIsComplete(turn: StageTurnRecord | undefined): boolean {
  if (!turn) return false;
  if (turn.skipped) return true;
  if (!turn.author_answer?.trim()) return false;
  if (turn.clarification_used && !turn.clarification_answer?.trim()) return false;
  return Boolean(turn.eic_response_content) || turn.decision_outcome === "author_skipped_optional";
}

function requiredStagesComplete(stageTurns: readonly StageTurnRecord[]): boolean {
  const requiredStageIds = [
    "eic_intake.primary_vision",
    "eic_intake.creative_motivation",
    "eic_intake.market_position",
    "eic_intake.success_definition",
  ];
  return requiredStageIds.every((stageId) =>
    stageTurnIsComplete(stageTurns.find((turn) => turn.stage_id === stageId)),
  );
}

export async function createEditorialUnderstandingDraft(
  input: EditorialUnderstandingDraftInput,
): Promise<{ ok: true; record: EditorialUnderstandingRecord } | { ok: false; error: string }> {
  const validation = validateEditorialUnderstandingDraft(input);
  if (!validation.ok) {
    return { ok: false, error: validation.errors.map((e) => e.message).join("; ") };
  }
  if (!(await tableExists())) {
    return {
      ok: false,
      error: "Editorial understanding persistence is not available (migration not applied)",
    };
  }

  const supabase = getSupabaseAdmin();
  const { data: existingDraft } = await supabase
    .from("editorial_understandings")
    .select("*")
    .eq("manuscript_id", input.manuscript_id)
    .eq("manuscript_version_id", input.manuscript_version_id)
    .eq("created_by", input.created_by)
    .eq("status", "draft")
    .maybeSingle();

  if (existingDraft) {
    return { ok: true, record: mapRow(existingDraft as DbRow) };
  }

  const { data, error } = await supabase
    .from("editorial_understandings")
    .insert({
      book_id: input.book_id,
      manuscript_id: input.manuscript_id,
      manuscript_version_id: input.manuscript_version_id,
      contract_version: EDITORIAL_UNDERSTANDING_CONTRACT_VERSION,
      interview_type: "eic_author_intake",
      conducted_by: "editor_in_chief",
      status: "draft",
      created_by: input.created_by,
      supersedes_understanding_id: input.supersedes_understanding_id ?? null,
      stage_turns: [],
      open_questions: [],
      resolved_clarifications: [],
      conversation_history: [],
      provider_model: CONVERSATIONAL_INTELLIGENCE_PROVIDER_MODEL,
      provider_cost_usd: 0,
      understanding_quality: {},
      synthesis_artifacts: [],
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create editorial understanding draft." };
  }

  return { ok: true, record: mapRow(data as DbRow) };
}

export async function getCurrentEditorialUnderstanding(input: {
  manuscriptId: string;
  manuscriptVersionId: string;
  createdBy: string;
}): Promise<EditorialUnderstandingRecord | null> {
  if (!(await tableExists())) return null;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("editorial_understandings")
    .select("*")
    .eq("manuscript_id", input.manuscriptId)
    .eq("manuscript_version_id", input.manuscriptVersionId)
    .eq("created_by", input.createdBy)
    .in("status", ["draft", "awaiting_author_confirmation", "correction_requested"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapRow(data as DbRow) : null;
}

export async function getConfirmedEditorialUnderstanding(input: {
  manuscriptId: string;
  manuscriptVersionId: string;
}): Promise<EditorialUnderstandingRecord | null> {
  if (!(await tableExists())) return null;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("editorial_understandings")
    .select("*")
    .eq("manuscript_id", input.manuscriptId)
    .eq("manuscript_version_id", input.manuscriptVersionId)
    .eq("status", "confirmed")
    .maybeSingle();

  return data ? mapRow(data as DbRow) : null;
}

export async function processStageAnswer(input: {
  understandingId: string;
  manuscriptId: string;
  manuscriptVersionId: string;
  createdBy: string;
  promptKey: string;
  authorAnswer: string | null;
  skipped: boolean;
  isClarificationFollowUp?: boolean;
  clarificationAnswer?: string | null;
}): Promise<
  | {
      ok: true;
      record: EditorialUnderstandingRecord;
      eicResponse: { response_type: string; content: string };
      advanceStage: boolean;
      awaitingClarification: boolean;
    }
  | { ok: false; error: string }
> {
  if (!(await tableExists())) {
    return { ok: false, error: "Editorial understanding persistence is not available." };
  }

  const supabase = getSupabaseAdmin();
  const { data: row, error: fetchError } = await supabase
    .from("editorial_understandings")
    .select("*")
    .eq("id", input.understandingId)
    .eq("manuscript_id", input.manuscriptId)
    .eq("created_by", input.createdBy)
    .maybeSingle();

  if (fetchError || !row) {
    return { ok: false, error: fetchError?.message ?? "Editorial understanding not found." };
  }

  const record = mapRow(row as DbRow);
  if (record.status === "confirmed") {
    return { ok: false, error: "Confirmed editorial understanding is immutable." };
  }

  const stage = stageByPromptKey(input.promptKey);
  if (!stage) return { ok: false, error: "Unknown intake stage." };

  const existingTurn = record.stage_turns.find((turn) => turn.stage_id === stage.stage_id);
  const clarificationAlreadyUsed = Boolean(existingTurn?.clarification_used);

  const decision = evaluateFollowUpDecision({
    stage_id: stage.stage_id,
    understanding_field: stage.understanding_field,
    author_answer: input.isClarificationFollowUp
      ? input.clarificationAnswer ?? input.authorAnswer
      : input.authorAnswer,
    skipped: input.skipped,
    required: stage.required,
    clarification_already_used: clarificationAlreadyUsed,
    is_clarification_follow_up: Boolean(input.isClarificationFollowUp),
  });

  if (decision.outcome === "blocked_unsafe_or_invalid") {
    return { ok: false, error: "Please answer in your own words before continuing." };
  }

  const now = new Date().toISOString();
  const stageTurns = [...record.stage_turns];
  const turnIndex = stageTurns.findIndex((turn) => turn.stage_id === stage.stage_id);
  const baseTurn: StageTurnRecord =
    turnIndex >= 0
      ? { ...stageTurns[turnIndex]! }
      : {
          stage_id: stage.stage_id,
          understanding_field: stage.understanding_field,
          author_answer: null,
          skipped: false,
          eic_response_type: null,
          eic_response_content: null,
          clarification_question: null,
          clarification_answer: null,
          clarification_used: false,
          decision_outcome: null,
          confidence_score: null,
          recorded_at: now,
        };

  if (input.isClarificationFollowUp) {
    baseTurn.clarification_answer = input.clarificationAnswer?.trim() ?? input.authorAnswer?.trim() ?? null;
    baseTurn.confidence_score = decision.confidence_score;
    baseTurn.decision_outcome = decision.outcome;
  } else {
    baseTurn.author_answer = input.skipped ? null : input.authorAnswer?.trim() ?? null;
    baseTurn.skipped = input.skipped;
    baseTurn.confidence_score = decision.confidence_score;
    baseTurn.decision_outcome = decision.outcome;
  }

  let eicResponseContent = "";
  let eicResponseType: StageTurnRecord["eic_response_type"] = null;
  let awaitingClarification = false;

  if (decision.response_type) {
    const priorAuthorTurns = record.stage_turns
      .map((t) => t.author_answer)
      .filter((a): a is string => Boolean(a?.trim()));

    const emitted = emitConversationalResponse({
      stage_id: stage.stage_id,
      response_type: decision.response_type,
      author_answer: input.authorAnswer,
      prior_author_turns: priorAuthorTurns,
    });
    eicResponseContent = emitted.content;
    eicResponseType = emitted.response_type as StageTurnRecord["eic_response_type"];

    if (isStudioProgressiveEditorialUnderstandingEnabled()) {
      baseTurn.gate_result = emitted.gate_result ?? "pass";
      baseTurn.quality_level = emitted.quality_level ?? null;

      if (emitted.gate_result === "pass") {
        logPeuEvent("peu.gate_pass", {
          stage_id: stage.stage_id,
          quality_level: emitted.quality_level,
        });
      } else if (emitted.fail_reason) {
        logPeuEvent("peu.gate_fail", {
          stage_id: stage.stage_id,
          fail_reason: emitted.fail_reason,
          candidate_hash: hashCandidate(emitted.content),
        });
      }
      if (emitted.fallback_used) {
        logPeuEvent("peu.fallback_used", {
          stage_id: stage.stage_id,
          reason: emitted.fail_reason ?? "gate_repair",
        });
      }
    }

    if (decision.outcome === "clarify_once") {
      baseTurn.clarification_used = true;
      baseTurn.clarification_question = emitted.content;
      awaitingClarification = true;
      if (isStudioProgressiveEditorialUnderstandingEnabled()) {
        logPeuEvent("peu.clarification_emitted", {
          stage_id: stage.stage_id,
          materiality_reason: stage.stage_id,
        });
      }
    } else {
      baseTurn.eic_response_type = eicResponseType;
      baseTurn.eic_response_content = emitted.content;
    }
  }

  if (turnIndex >= 0) stageTurns[turnIndex] = baseTurn;
  else stageTurns.push(baseTurn);

  const openQuestions = [...record.open_questions];
  if (decision.record_open_question && stage.understanding_field) {
    openQuestions.push({
      stage_id: stage.stage_id,
      question: `Open question on ${stage.understanding_field}`,
      recorded_at: now,
    });
  }

  const resolvedClarifications = [...record.resolved_clarifications];
  if (input.isClarificationFollowUp && baseTurn.clarification_question) {
    resolvedClarifications.push({
      stage_id: stage.stage_id,
      clarification_question: baseTurn.clarification_question,
      author_response: baseTurn.clarification_answer ?? "",
      resolved_at: now,
    });
  }

  const conversationHistory = [...record.conversation_history];
  const authorTurnId = crypto.randomUUID();
  if (!input.isClarificationFollowUp && !input.skipped) {
    conversationHistory.push({
      turn_id: authorTurnId,
      stage_id: stage.stage_id,
      role: "author",
      response_type: "author_answer",
      content: input.authorAnswer?.trim() ?? "",
      timestamp: now,
    });
  }
  if (input.isClarificationFollowUp) {
    conversationHistory.push({
      turn_id: authorTurnId,
      stage_id: stage.stage_id,
      role: "author",
      response_type: "author_answer",
      content: input.clarificationAnswer?.trim() ?? input.authorAnswer?.trim() ?? "",
      timestamp: now,
    });
  }
  if (eicResponseContent) {
    conversationHistory.push({
      turn_id: crypto.randomUUID(),
      stage_id: stage.stage_id,
      role: "eic",
      response_type: eicResponseType ?? "acknowledgment",
      content: eicResponseContent,
      timestamp: now,
      gate_result: baseTurn.gate_result ?? null,
      quality_level: baseTurn.quality_level ?? null,
    });
  }

  const fieldUpdates = input.isClarificationFollowUp
    ? {}
    : fieldValueFromPrompt(input.promptKey, input.skipped ? null : input.authorAnswer);

  const confidence = buildUnderstandingConfidence(stageTurns);

  let understandingQuality: UnderstandingQualityRecord | null = record.understanding_quality;
  let synthesisArtifacts: SynthesisArtifact[] = [...(record.synthesis_artifacts ?? [])];

  if (isStudioProgressiveEditorialUnderstandingEnabled()) {
    understandingQuality = computeUnderstandingQuality({
      stageTurns,
      lastGateResult: (baseTurn.gate_result as "pass") ?? "pass",
      lastResponseQualityLevel: baseTurn.quality_level ?? null,
    });

    if (
      eicResponseContent &&
      (eicResponseType === "reflection" || eicResponseType === "type_b_synthesis") &&
      baseTurn.gate_result === "pass"
    ) {
      const qualityLevel = (baseTurn.quality_level ?? 2) as 2 | 3;
      if (qualityLevel >= 2) {
        synthesisArtifacts = [
          ...synthesisArtifacts,
          buildSynthesisArtifact({
            stageId: stage.stage_id,
            qualityLevel: qualityLevel >= 3 ? 3 : 2,
            synthesisText: eicResponseContent,
            turnId: authorTurnId,
          }),
        ];
      }

      understandingQuality = boostDimensionOnGatePass(
        understandingQuality,
        eicResponseType === "type_b_synthesis" ? "editorial_synthesis" : "grounded_reflection",
        stage.understanding_field,
      ) as UnderstandingQualityRecord;
    }
  }

  const allStagesComplete = requiredStagesComplete(stageTurns) && !awaitingClarification;
  const nextStatus = allStagesComplete ? "awaiting_author_confirmation" : record.status;

  let understandingSummary = record.understanding_summary;
  if (allStagesComplete) {
    const draftRecord = {
      ...record,
      ...fieldUpdates,
      stage_turns: stageTurns,
      confidence,
      understanding_quality: understandingQuality,
      synthesis_artifacts: synthesisArtifacts,
    };
    understandingSummary = isStudioProgressiveEditorialUnderstandingEnabled()
      ? buildConfirmationSummary(draftRecord)
      : buildUnderstandingSummary(draftRecord);
    conversationHistory.push({
      turn_id: crypto.randomUUID(),
      stage_id: "eic_intake.confirmation",
      role: "eic",
      response_type: "confirmation_summary",
      content: understandingSummary,
      timestamp: now,
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from("editorial_understandings")
    .update({
      ...fieldUpdates,
      stage_turns: stageTurns,
      open_questions: openQuestions,
      resolved_clarifications: resolvedClarifications,
      conversation_history: conversationHistory,
      confidence,
      understanding_summary: understandingSummary,
      understanding_quality: understandingQuality,
      synthesis_artifacts: synthesisArtifacts,
      status: nextStatus,
      provider_model: CONVERSATIONAL_INTELLIGENCE_PROVIDER_MODEL,
    })
    .eq("id", input.understandingId)
    .select("*")
    .single();

  if (updateError || !updated) {
    return { ok: false, error: updateError?.message ?? "Failed to save stage response." };
  }

  return {
    ok: true,
    record: mapRow(updated as DbRow),
    eicResponse: {
      response_type: eicResponseType ?? "acknowledgment",
      content: eicResponseContent,
    },
    advanceStage: decision.advance_stage && !awaitingClarification,
    awaitingClarification,
  };
}

export async function confirmEditorialUnderstanding(input: {
  understandingId: string;
  manuscriptId: string;
  createdBy: string;
}): Promise<{ ok: true; record: EditorialUnderstandingRecord } | { ok: false; error: string }> {
  if (!(await tableExists())) {
    return { ok: false, error: "Editorial understanding persistence is not available." };
  }

  const supabase = getSupabaseAdmin();
  const { data: row } = await supabase
    .from("editorial_understandings")
    .select("*")
    .eq("id", input.understandingId)
    .eq("manuscript_id", input.manuscriptId)
    .eq("created_by", input.createdBy)
    .maybeSingle();

  if (!row) return { ok: false, error: "Editorial understanding not found." };
  const record = mapRow(row as DbRow);

  const eligibility = isStudioProgressiveEditorialUnderstandingEnabled()
    ? validateConfirmationGate(record)
    : validateConfirmationEligibility(record);
  if (!eligibility.ok) return { ok: false, error: eligibility.error ?? "Cannot confirm." };

  const now = new Date().toISOString();
  const conversationHistory = [
    ...record.conversation_history,
    {
      turn_id: crypto.randomUUID(),
      stage_id: "eic_intake.confirmation",
      role: "author" as const,
      response_type: "author_confirmation" as const,
      content: "Yes",
      timestamp: now,
    },
  ];

  const confidence = {
    ...record.confidence,
    confirmed_at: now,
    confirmed_by: input.createdBy,
  };

  const understandingQuality = isStudioProgressiveEditorialUnderstandingEnabled()
    ? computeUnderstandingQuality({
        stageTurns: record.stage_turns,
        lastGateResult: "pass",
        lastResponseQualityLevel: record.understanding_quality?.last_response_quality_level ?? null,
        confirmed: true,
      })
    : record.understanding_quality;

  if (isStudioProgressiveEditorialUnderstandingEnabled()) {
    logPeuEvent("peu.confirmation_completed", {
      understanding_id: input.understandingId,
      aggregate_level: understandingQuality?.aggregate_level,
    });
  }

  const { data: updated, error } = await supabase
    .from("editorial_understandings")
    .update({
      status: "confirmed",
      confirmed_at: now,
      confirmed_by: input.createdBy,
      confidence,
      understanding_quality: understandingQuality,
      conversation_history: conversationHistory,
    })
    .eq("id", input.understandingId)
    .select("*")
    .single();

  if (error || !updated) {
    return { ok: false, error: error?.message ?? "Failed to confirm editorial understanding." };
  }

  return { ok: true, record: mapRow(updated as DbRow) };
}

export async function requestUnderstandingCorrection(input: {
  understandingId: string;
  manuscriptId: string;
  createdBy: string;
}): Promise<{ ok: true; record: EditorialUnderstandingRecord } | { ok: false; error: string }> {
  if (!(await tableExists())) {
    return { ok: false, error: "Editorial understanding persistence is not available." };
  }

  const supabase = getSupabaseAdmin();
  const { data: updated, error } = await supabase
    .from("editorial_understandings")
    .update({ status: "correction_requested" })
    .eq("id", input.understandingId)
    .eq("manuscript_id", input.manuscriptId)
    .eq("created_by", input.createdBy)
    .neq("status", "confirmed")
    .select("*")
    .single();

  if (error || !updated) {
    return { ok: false, error: error?.message ?? "Failed to request correction." };
  }

  return { ok: true, record: mapRow(updated as DbRow) };
}

export async function reopenEditorialUnderstandingForEdit(input: {
  understandingId: string;
  manuscriptId: string;
  manuscriptVersionId: string;
  createdBy: string;
}): Promise<{ ok: true; record: EditorialUnderstandingRecord } | { ok: false; error: string }> {
  if (!(await tableExists())) {
    return { ok: false, error: "Editorial understanding persistence is not available." };
  }

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("editorial_understandings")
    .select("*")
    .eq("id", input.understandingId)
    .maybeSingle();

  if (!existing) return { ok: false, error: "Editorial understanding not found." };

  if ((existing as DbRow).status === "confirmed") {
    const now = new Date().toISOString();
    await supabase
      .from("editorial_understandings")
      .update({ status: "superseded", superseded_at: now })
      .eq("id", input.understandingId);

    return createEditorialUnderstandingDraft({
      book_id: input.manuscriptId,
      manuscript_id: input.manuscriptId,
      manuscript_version_id: input.manuscriptVersionId,
      created_by: input.createdBy,
      supersedes_understanding_id: input.understandingId,
    });
  }

  const { data: updated, error } = await supabase
    .from("editorial_understandings")
    .update({ status: "draft" })
    .eq("id", input.understandingId)
    .select("*")
    .single();

  if (error || !updated) {
    return { ok: false, error: error?.message ?? "Failed to reopen for edit." };
  }

  return { ok: true, record: mapRow(updated as DbRow) };
}
