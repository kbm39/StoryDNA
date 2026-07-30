#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { readAnthropicApiKey } from "../lib/expert-calibration/live/api-key.ts";
import { resolveProviderSpec } from "../lib/expert-calibration/live/provider-allowlist.ts";
import { createAnthropicProviderInvoker } from "../lib/expert-calibration/live/providers/anthropic/invoke.ts";
import { validatePhase2BHandoff } from "../lib/studio/military-expert-v2/handoff-validation.ts";
import { loadSceneReviewsForSnapshot } from "../lib/studio/military-expert-v2/scene-review-persistence.ts";
import { computeSceneReviewCoverage } from "../lib/studio/military-expert-v2/scene-review-coverage.ts";
import { assembleMilitaryExpertV2SynthesisInput } from "../lib/studio/military-expert-v2/synthesis-input.ts";
import { buildMilitaryExpertV2SynthesisGenerationRequest } from "../lib/studio/military-expert-v2/synthesis-prompt.ts";
import {
  parseSynthesisProviderResponse,
  mergeProviderOutputIntoSynthesisDocument,
  validateSynthesisDocument,
} from "../lib/studio/military-expert-v2/synthesis-validation.ts";
import { normalizeSynthesisProviderOutput } from "../lib/studio/military-expert-v2/synthesis-provider-output.ts";
import {
  parseMilitaryExpertV2SynthesisDocument,
  diagnoseSynthesisParseFailure,
} from "../lib/studio/military-expert-v2/synthesis-contract.ts";

const snapshotId = "snap_a5c75c94-be71-4b6c-9582-3d6c0fe34fa1";
const phase2aWorkflowId = "6ffa7629-b831-4d5c-81c0-3784b470849a";

const handoff = await validatePhase2BHandoff({
  selectionSnapshotId: snapshotId,
  phase2aWorkflowId,
  requirePinnedSnapshot: true,
  allowExistingSynthesis: true,
});
if (!handoff.ok) throw new Error(handoff.errorMessage);

const reviews = await loadSceneReviewsForSnapshot(snapshotId);
const coverage = computeSceneReviewCoverage(handoff.selectedSceneIds, reviews);
const input = assembleMilitaryExpertV2SynthesisInput({
  inventory: handoff.inventory,
  selectedSceneIds: handoff.selectedSceneIds,
  reviews,
  coverage,
});

const synthesisId = `syn_debug_${Date.now().toString(36)}`;
const correlationId = randomUUID();
const req = buildMilitaryExpertV2SynthesisGenerationRequest({
  synthesisId,
  input,
  manuscriptHash: "debug",
  correlationId,
});
const spec = resolveProviderSpec("anthropic", "opus-4-8-v1");
const invoker = createAnthropicProviderInvoker(readAnthropicApiKey());
const started = Date.now();
const result = await invoker({
  request: {
    expertKey: "military_expert",
    expertVersion: "v1",
    definitionHash: "debug",
    correlationId,
    manuscriptVersionId: input.manuscript_version_id,
    reviewScope: "scene",
    canonicalWordCount: 0,
    manuscriptHash: "debug",
    systemPrompt: req.systemPrompt,
    reviewPrompt: req.userPrompt,
    responseFormat: "json_object",
    temperature: 0,
    maxOutputTokens: req.maxOutputTokens,
    safetyMetadata: {
      editorialOnly: true,
      noOperationalInstruction: true,
      noServiceHistoryClaims: true,
      noFabricatedSources: true,
    },
    provenance: {
      promptVersion: req.promptVersion,
      outputSchemaVersion: req.outputSchemaVersion,
      builderVersion: "debug",
      generationProfileId: "debug",
    },
  },
  correlationId,
  caseId: "debug",
  modelId: spec.modelId,
  timeoutMs: 300_000,
});

console.log("invoke_ok", result.ok, "ms", Date.now() - started);
if (!result.ok || !result.rawResponse) process.exit(2);

const text = result.rawResponse.responseText;
console.log(
  "response_chars",
  text.length,
  "in",
  result.rawResponse.inputTokens,
  "out",
  result.rawResponse.outputTokens,
);

const parsed = parseSynthesisProviderResponse(text);
console.log("json_parse_ok", parsed.ok, parsed.error ?? "");
if (!parsed.ok) process.exit(3);

const sceneReviewIdBySceneId = new Map(reviews.map((r) => [r.sceneId, r.sceneReviewId]));
const normalized = normalizeSynthesisProviderOutput(parsed.json, sceneReviewIdBySceneId);
const merged = mergeProviderOutputIntoSynthesisDocument(normalized, {
  expectedSnapshotId: snapshotId,
  expectedInventoryId: handoff.inventory.inventory_id,
  expectedManuscriptId: handoff.inventory.manuscript_id,
  selectedSceneIds: handoff.selectedSceneIds,
  sceneReviewIdBySceneId,
  insufficientEvidenceSceneIds: reviews
    .filter((r) => r.reviewStatus === "insufficient_evidence")
    .map((r) => r.sceneId),
  synthesisId,
  input,
  createdAt: new Date().toISOString(),
  providerMetadata: null,
});

const doc = parseMilitaryExpertV2SynthesisDocument(merged);
console.log("contract_parse_ok", Boolean(doc));
if (!doc) {
  console.log("diagnose", diagnoseSynthesisParseFailure(merged));
}

const validation = validateSynthesisDocument(
  merged,
  {
    expectedSnapshotId: snapshotId,
    expectedInventoryId: handoff.inventory.inventory_id,
    expectedManuscriptId: handoff.inventory.manuscript_id,
    selectedSceneIds: handoff.selectedSceneIds,
    sceneReviewIdBySceneId,
    insufficientEvidenceSceneIds: reviews
      .filter((r) => r.reviewStatus === "insufficient_evidence")
      .map((r) => r.sceneId),
  },
  { skipQualityScoring: true },
);
console.log("validation_ok", validation.ok);
console.log("structural_errors", validation.structuralErrors);
console.log("quality_errors", validation.qualityErrors);
