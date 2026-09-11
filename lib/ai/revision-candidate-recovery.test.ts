import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractRevisionCandidateJson,
  parseRevisionCandidates,
  resolveRevisionCandidates,
} from "./revision-candidate-recovery.ts";
import {
  completeRevisionCandidatesStage,
  type RevisionCandidateLedgerRecord,
} from "@/lib/editorial-generation/revision-candidate-stage.ts";
import {
  aggregateLiteraryAgentCost,
  createLiteraryAgentCostLedger,
} from "@/lib/editorial-generation/literary-agent-cost.ts";
import type { GenerationMeta } from "@/lib/ai/shared.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const VALID_JSON = `{
  "issues": [
    {
      "key": "pacing-middle",
      "text": "The middle sags after the inciting incident.",
      "area": "pacing",
      "severity": "high",
      "source_section": "Pacing",
      "success_criterion": "A midpoint turn is on the page.",
      "candidates": [
        {
          "type": "tighten",
          "original": "She walked down the hall and thought about yesterday.",
          "revised": "She walked down the hall.",
          "locator": "Ch. 8",
          "word_savings": 4,
          "reason": "Interiority stalls momentum.",
          "confidence": 80,
          "confidence_reason": "Direct match to the memo.",
          "difficulty": "easy",
          "story_risk": "low",
          "voice_risk": "low",
          "commercial_impact": "medium",
          "reader_impact": "medium",
          "grade_delta": 1,
          "consequence_if_unchanged": "Readers skim.",
          "dependencies": "",
          "impacts": {
            "pacing": 2,
            "clarity": 1,
            "commercial_readiness": 1,
            "emotional_impact": 0,
            "voice_preservation": 0,
            "submission_readiness": 1
          }
        }
      ]
    }
  ]
}`;

const META: GenerationMeta = {
  finishReason: "end_turn",
  inputTokens: 12_000,
  outputTokens: 6_000,
  maxTokens: 16_000,
  outputTruncated: false,
  cachedTokens: 0,
  cacheCreationTokens: 0,
};

function recordedCalls(): {
  calls: RevisionCandidateLedgerRecord[];
  record: (entry: RevisionCandidateLedgerRecord) => RevisionCandidateLedgerRecord;
} {
  const calls: RevisionCandidateLedgerRecord[] = [];
  return {
    calls,
    record: (entry) => {
      calls.push(entry);
      return entry;
    },
  };
}

describe("revision-candidate deterministic parse", () => {
  it("parses valid revision-candidate JSON normally", () => {
    const parsed = parseRevisionCandidates(VALID_JSON);
    assert.equal(parsed.issues.length, 1);
    assert.equal(parsed.issues[0]?.text, "The middle sags after the inciting incident.");
    assert.equal(parsed.issues[0]?.candidates[0]?.original, "She walked down the hall and thought about yesterday.");
  });

  it("extracts JSON from markdown fences without a repair model", () => {
    const raw = "```json\n" + VALID_JSON + "\n```";
    const extracted = extractRevisionCandidateJson(raw);
    assert.equal(extracted.method, "fenced");
    assert.equal(extracted.deterministicSucceeded, true);
    const parsed = parseRevisionCandidates(raw);
    assert.equal(parsed.issues.length, 1);
  });

  it("isolates valid JSON followed by trailing prose", () => {
    const raw = VALID_JSON + "\n\nLet me know if you want more candidates.";
    const extracted = extractRevisionCandidateJson(raw);
    assert.equal(extracted.identityParseOk, false);
    assert.equal(extracted.method, "isolated");
    assert.equal(parseRevisionCandidates(raw).issues.length, 1);
  });

  it("normalizes a recoverable wrapper without inventing content", () => {
    const raw = "Here is the JSON you requested:\n" + VALID_JSON;
    const extracted = extractRevisionCandidateJson(raw);
    assert.equal(extracted.method, "isolated");
    assert.equal(parseRevisionCandidates(raw).issues[0]?.key, "pacing-middle");
  });

  it("does not invent issues when required fields are missing", () => {
    const raw = `{"issues":[{"key":"x","candidates":[{"type":"tighten","revised":"new"}]}]}`;
    const resolved = resolveRevisionCandidates(raw);
    assert.equal(resolved.structuralOk, true);
    assert.equal(resolved.issues.length, 0);
    assert.ok(resolved.warnings.some((w) => w.includes("missing required text")));
  });
});

describe("revision-candidate stage cost-first and repair", () => {
  it("records provider usage before parsing", async () => {
    const { calls, record } = recordedCalls();
    const order: string[] = [];
    await completeRevisionCandidatesStage({
      primary: {
        content: "NOT JSON AT ALL",
        model: "claude-opus-4-8",
        generationMeta: META,
        durationMs: 180_000,
      },
      record: (entry) => {
        order.push(`record:${entry.role}`);
        return record(entry);
      },
    });
    assert.deepEqual(order, ["record:revision_candidates"]);
    assert.equal(calls[0]?.usage.inputTokens, 12_000);
    assert.equal(calls[0]?.usage.outputTokens, 6_000);
    assert.equal(calls[0]?.status, "parse_failed");
  });

  it("retains primary tokens when parse fails", async () => {
    const ledger = createLiteraryAgentCostLedger();
    await completeRevisionCandidatesStage({
      primary: {
        content: "{",
        model: "claude-opus-4-8",
        generationMeta: META,
        durationMs: 200_000,
      },
      record: (entry) =>
        ledger.record({
          role: entry.role,
          model: entry.model,
          usage: entry.usage,
          durationMs: entry.durationMs,
          status: entry.status,
        }),
    });
    const record = ledger.finalize(200_000);
    assert.equal(record.revisionCandidateCallTokens.callCount, 1);
    assert.equal(record.revisionCandidateCallTokens.inputTokens, 12_000);
    assert.equal(record.revisionCandidateCallTokens.outputTokens, 6_000);
    assert.ok((record.revisionCandidateCallTokens.costUsd ?? 0) > 0);
    assert.equal(record.tokenCounts, "exact");
    assert.equal(record.calls[0]?.status, "parse_failed");
  });

  it("permits exactly one repair call after deterministic recovery fails", async () => {
    const { calls, record } = recordedCalls();
    let repairCalls = 0;
    const stage = await completeRevisionCandidatesStage({
      primary: {
        content: "definitely not json",
        model: "claude-opus-4-8",
        generationMeta: META,
        durationMs: 10,
      },
      record,
      repairOnce: async () => {
        repairCalls += 1;
        return {
          content: "still not json",
          model: "claude-opus-4-8",
          generationMeta: { ...META, inputTokens: 400, outputTokens: 200 },
          durationMs: 5,
        };
      },
    });
    assert.equal(repairCalls, 1);
    assert.equal(stage.ok, false);
    assert.equal(stage.publishAllowed, false);
    assert.equal(stage.diagnostics.repair_invoked, true);
    assert.equal(stage.diagnostics.repair_parse_ok, false);
    assert.equal(calls.filter((c) => c.role === "revision_candidates_repair").length, 1);
  });

  it("continues when repair returns valid schema", async () => {
    const { record } = recordedCalls();
    const stage = await completeRevisionCandidatesStage({
      primary: {
        content: "not json",
        model: "claude-opus-4-8",
        generationMeta: META,
        durationMs: 10,
      },
      record,
      repairOnce: async () => ({
        content: VALID_JSON,
        model: "claude-opus-4-8",
        generationMeta: { ...META, inputTokens: 800, outputTokens: 400 },
        durationMs: 8,
      }),
    });
    assert.equal(stage.ok, true);
    assert.equal(stage.publishAllowed, true);
    assert.equal(stage.issues.length, 1);
    assert.equal(stage.diagnostics.repair_invoked, true);
    assert.equal(stage.diagnostics.repair_parse_ok, true);
  });

  it("fails closed when repair remains invalid and does not retry", async () => {
    let repairCalls = 0;
    const stage = await completeRevisionCandidatesStage({
      primary: {
        content: "not json",
        model: "claude-opus-4-8",
        generationMeta: META,
        durationMs: 10,
      },
      record: recordedCalls().record,
      repairOnce: async () => {
        repairCalls += 1;
        return {
          content: "{",
          model: "claude-opus-4-8",
          generationMeta: { ...META, inputTokens: 100, outputTokens: 20 },
          durationMs: 4,
        };
      },
    });
    assert.equal(repairCalls, 1);
    assert.equal(stage.ok, false);
    assert.equal(stage.publishAllowed, false);
  });

  it("does not invoke repair when JSON is valid but required fields are missing", async () => {
    let repairCalls = 0;
    const stage = await completeRevisionCandidatesStage({
      primary: {
        content: `{"issues":[{"key":"x"}]}`,
        model: "claude-opus-4-8",
        generationMeta: META,
        durationMs: 10,
      },
      record: recordedCalls().record,
      repairOnce: async () => {
        repairCalls += 1;
        return { content: VALID_JSON, model: "claude-opus-4-8", generationMeta: META, durationMs: 1 };
      },
    });
    assert.equal(repairCalls, 0);
    assert.equal(stage.ok, false);
    assert.equal(stage.publishAllowed, false);
  });

  it("records repair cost separately", async () => {
    const ledger = createLiteraryAgentCostLedger();
    await completeRevisionCandidatesStage({
      primary: {
        content: "not json",
        model: "claude-opus-4-8",
        generationMeta: META,
        durationMs: 10,
      },
      record: (entry) =>
        ledger.record({
          role: entry.role,
          model: entry.model,
          usage: entry.usage,
          durationMs: entry.durationMs,
          status: entry.status,
        }),
      repairOnce: async () => ({
        content: VALID_JSON,
        model: "claude-opus-4-8",
        generationMeta: { ...META, inputTokens: 500, outputTokens: 250 },
        durationMs: 7,
      }),
    });
    const record = ledger.finalize(20);
    assert.equal(record.revisionCandidateCallTokens.callCount, 1);
    assert.equal(record.revisionCandidateRepairCallTokens.callCount, 1);
    assert.equal(record.revisionCandidateRepairCallTokens.inputTokens, 500);
    assert.equal(record.revisionCandidateRepairCallTokens.outputTokens, 250);
    assert.ok(record.revisionCandidateRepairCallTokens.costUsd > 0);
    assert.equal(record.tokenCounts, "exact");
  });

  it("marks tokenCounts partial when a known paid call lacks usage", () => {
    const record = aggregateLiteraryAgentCost(
      [
        {
          role: "memo_generation",
          provider: "anthropic",
          model: "claude-opus-4-8",
          inputTokens: 1000,
          outputTokens: 100,
          cachedTokens: 0,
          cacheCreationTokens: 0,
          costUsd: 0.01,
          costKind: "estimated",
          durationMs: 10,
        },
        {
          role: "revision_candidates",
          provider: "anthropic",
          model: "claude-opus-4-8",
          inputTokens: null,
          outputTokens: null,
          cachedTokens: null,
          cacheCreationTokens: null,
          costUsd: null,
          costKind: "unknown",
          durationMs: 10,
          status: "parse_failed",
        },
      ],
      20,
    );
    assert.equal(record.tokenCounts, "partial");
    assert.equal(record.costUsdKind, "unknown");
    assert.equal(record.totalRunCostUsd, null);
  });

  it("never treats known-understated USD as exact/complete", () => {
    const record = aggregateLiteraryAgentCost(
      [
        {
          role: "revision_candidates",
          provider: "anthropic",
          model: "claude-opus-4-8",
          inputTokens: null,
          outputTokens: null,
          cachedTokens: null,
          cacheCreationTokens: null,
          costUsd: null,
          costKind: "unknown",
          durationMs: 180_000,
        },
      ],
      180_000,
    );
    assert.notEqual(record.tokenCounts, "exact");
    assert.equal(record.costUsdKind, "unknown");
    assert.equal(record.totalRunCostUsd, null);
  });
});

describe("revision-candidate pipeline contracts", () => {
  const generation = readFileSync(
    join(ROOT, "lib/editorial-generation/run-fresh-editorial-generation.ts"),
    "utf8",
  );

  it("records usage through completeRevisionCandidatesStage before parse", () => {
    assert.match(generation, /generateRevisionCandidatesRaw/);
    assert.match(generation, /completeRevisionCandidatesStage/);
    assert.match(generation, /repairRevisionCandidatesJson/);
    assert.match(generation, /assertPublishAllowed\(hooks\?\.shouldCancel\)/);
  });

  it("does not publish when revision candidates are invalid", () => {
    const stageIdx = generation.indexOf("completeRevisionCandidatesStage");
    const publishIdx = generation.indexOf("assertPublishAllowed");
    assert.ok(stageIdx > 0 && publishIdx > stageIdx);
    assert.match(generation, /if \(!stage\.ok \|\| !stage\.publishAllowed\)/);
  });
});
