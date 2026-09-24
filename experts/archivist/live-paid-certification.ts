/**
 * Founder-approved paid Archivist certification smoke.
 *
 * Short synthetic manuscripts only. No Hold Fast upload, no canon writes,
 * no Studio/UI enablement. After formal certification this harness refuses
 * another paid smoke so historical sessions stay frozen.
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ARCHIVIST_CERTIFICATION_ENTITY_CATALOG } from "./entity-catalog.ts";
import { ARCHIVIST_LIVE_MODEL_CERTIFIED } from "./live-flags.ts";
import { createAnthropicArchivistLiveProvider } from "./live-provider.ts";
import { runArchivistLiveExecution } from "./live-execute.ts";
import { liveReviewEmitsAcceptedCanon, liveReviewEmitsAuthorDisposition } from "./live-postprocess.ts";
import { summarizeClassificationAdjustments } from "./confirmation-eligibility.ts";
import { confirmedContradictionHasBothSides } from "./evidence.ts";
import type { ArchivistFinding, ArchivistReview } from "./contracts.ts";
import type { LiveArchivistExecutionResult } from "./live-types.ts";
import { extractArchivistJson } from "./model-output.ts";
import type { ArchivistLiveProvider } from "./live-provider.ts";

export const ARCHIVIST_PAID_CERT_ACK =
  "I-ACKNOWLEDGE-ARCHIVIST-PAID-CERTIFICATION-SPEND" as const;

export const ARCHIVIST_PAID_SMOKE_SCOPE = "smoke_v1" as const;
export const ARCHIVIST_PAID_SMOKE_MODEL = "claude-haiku-4-5-20251001" as const;
export const ARCHIVIST_PAID_SMOKE_MAX_COST_USD = 1 as const;
export const ARCHIVIST_PAID_SMOKE_MAX_TOKENS = 4_096 as const;
export const ARCHIVIST_PAID_CERT_EXPERT_VERSION_ID =
  "883407ad-4afe-4f3c-a69b-eaa3234fc9c6" as const;
export const ARCHIVIST_PAID_CERT_RESULTS_DIR = ".archivist-cert-results" as const;

export interface ArchivistPaidScopeCase {
  id: string;
  title: string;
  gate: "continuity_detection" | "temporal_reasoning" | "false_positives";
  manuscript_text: string;
  expect: {
    min_confirmed?: number;
    max_confirmed: number;
    max_author_verification?: number;
  };
}

export const ARCHIVIST_PAID_SCOPE_CASES: readonly ArchivistPaidScopeCase[] = [
  {
    id: "within_book_exact_contradiction",
    title: "Blue vs green eyes with no intervening change",
    gate: "continuity_detection",
    manuscript_text: [
      "Chapter 3. Mara had blue eyes that caught the lantern light.",
      "Chapter 22. Mara's green eyes narrowed at the map.",
    ].join("\n"),
    expect: { min_confirmed: 1, max_confirmed: 99 },
  },
  {
    id: "explained_apparent_conflict",
    title: "Eye-color change explained by dye",
    gate: "temporal_reasoning",
    manuscript_text: [
      "Chapter 3. Mara had blue eyes that caught the lantern light.",
      "Chapter 22. After the dye, Mara's green eyes suited the cover identity.",
    ].join("\n"),
    expect: { max_confirmed: 0 },
  },
  {
    id: "no_false_positive_control",
    title: "Consistent blue-eyed description",
    gate: "false_positives",
    manuscript_text:
      "Chapter 1. Mara kept the blue-eyed description consistent through the Harbor chapters.",
    expect: { max_confirmed: 0, max_author_verification: 0 },
  },
];

export interface ArchivistPaidCaseScore {
  id: string;
  gate: ArchivistPaidScopeCase["gate"];
  passed: boolean;
  detail: string;
  confirmed_count: number;
  model_confirmed_count?: number;
  final_confirmed_count?: number;
  deterministic_promotions?: number;
  deterministic_downgrades?: number;
  accepted_canon: boolean;
  author_disposition: boolean;
  both_sides: boolean;
  cost_usd: number | null;
  error_code?: string;
}

export interface ArchivistPaidCertificationReport {
  ok: boolean;
  scope: typeof ARCHIVIST_PAID_SMOKE_SCOPE;
  session_id: string;
  model: string;
  paid_certification_executed: boolean;
  live_model_certified: false;
  ready_to_set_live_model_certified: false;
  execution_wired: false;
  studio_selectable: false;
  hold_fast_run: false;
  canon_writes: 0;
  cases: ArchivistPaidCaseScore[];
  total_cost_usd: number;
  stopped_reason?: string;
  artifact_path?: string;
  cost_calls: LiveArchivistExecutionResult["cost_calls"];
  forensics: Array<{
    id: string;
    cost: LiveArchivistExecutionResult["cost"];
    cost_calls: LiveArchivistExecutionResult["cost_calls"];
    captures: Array<{
      role: string;
      call_kind: "primary" | "repair";
      provider: string;
      model: string;
      finish_reason: string | null;
      input_tokens: number | null;
      output_tokens: number | null;
      cached_tokens: number | null;
      cache_creation_tokens: number | null;
      runtime_ms: number;
      cost_usd: number | null;
      extract_method: string;
      failure_class: string | null;
      parse_message: string | null;
      raw_char_length: number;
      raw_output: string;
    }>;
  }>;
}

function confirmedFindings(review: ArchivistReview | null): ArchivistFinding[] {
  return (review?.findings ?? []).filter(
    (finding) =>
      (finding.final_classification ?? finding.classification) === "confirmed_contradiction",
  );
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function assertPaidCertificationAcknowledged(ack: string | undefined): void {
  if (ack !== ARCHIVIST_PAID_CERT_ACK) {
    throw new Error(
      `Paid Archivist certification requires --acknowledge ${ARCHIVIST_PAID_CERT_ACK}`,
    );
  }
}

export function scorePaidScopeCase(
  fixture: ArchivistPaidScopeCase,
  result: Pick<
    LiveArchivistExecutionResult,
    "review" | "canon_writes" | "cost" | "error_code"
  >,
): ArchivistPaidCaseScore {
  const confirmed = confirmedFindings(result.review);
  const adjustments = summarizeClassificationAdjustments(result.review?.findings ?? []);
  const accepted =
    result.canon_writes.accepted_facts > 0 ||
    Boolean(result.review && liveReviewEmitsAcceptedCanon(result.review));
  const disposition = Boolean(result.review && liveReviewEmitsAuthorDisposition(result.review));
  const bothSides = confirmed.every((finding) => confirmedContradictionHasBothSides(finding));
  const count = confirmed.length;
  const min = fixture.expect.min_confirmed ?? 0;
  const countOk = count >= min && count <= fixture.expect.max_confirmed;
  const verificationCount = (result.review?.findings ?? []).filter(
    (finding) =>
      (finding.final_classification ?? finding.classification) === "author_verification_needed",
  ).length;
  const verificationOk =
    fixture.expect.max_author_verification == null ||
    verificationCount <= fixture.expect.max_author_verification;
  const structuredOk = !result.error_code;
  const passed = structuredOk && countOk && verificationOk && !accepted && !disposition && bothSides;
  return {
    id: fixture.id,
    gate: fixture.gate,
    passed,
    detail: `final_confirmed=${count} model_confirmed=${adjustments.model_confirmed_count} expected ${min}-${fixture.expect.max_confirmed}; promotions=${adjustments.deterministic_promotions}; downgrades=${adjustments.deterministic_downgrades}; accepted=${accepted}; disposition=${disposition}; both_sides=${bothSides}; error=${result.error_code ?? "none"}`,
    confirmed_count: count,
    model_confirmed_count: adjustments.model_confirmed_count,
    final_confirmed_count: adjustments.final_confirmed_count,
    deterministic_promotions: adjustments.deterministic_promotions,
    deterministic_downgrades: adjustments.deterministic_downgrades,
    accepted_canon: accepted,
    author_disposition: disposition,
    both_sides: bothSides,
    cost_usd: result.cost.total_cost_usd,
    error_code: result.error_code,
  };
}

export async function runPaidArchivistScopeCertification(args: {
  acknowledge: string;
  sessionId: string;
  maxCostUsd?: number;
  writeArtifacts?: boolean;
  resultsDir?: string;
  providerFactory?: () => ReturnType<typeof createAnthropicArchivistLiveProvider>;
}): Promise<ArchivistPaidCertificationReport> {
  assertPaidCertificationAcknowledged(args.acknowledge);
  if (ARCHIVIST_LIVE_MODEL_CERTIFIED) {
    throw new Error("paid Archivist smoke is closed after formal pipeline certification");
  }

  const maxCost = args.maxCostUsd ?? ARCHIVIST_PAID_SMOKE_MAX_COST_USD;
  const inner =
    args.providerFactory?.() ??
    createAnthropicArchivistLiveProvider({
      allowPaidCertificationRun: true,
      model: ARCHIVIST_PAID_SMOKE_MODEL,
      maxTokens: ARCHIVIST_PAID_SMOKE_MAX_TOKENS,
      thinking: false,
    });
  const captures: ArchivistPaidCertificationReport["forensics"][number]["captures"] = [];
  const provider: ArchivistLiveProvider = {
    ...inner,
    async complete(request, hooks) {
      const response = await inner.complete(request, hooks);
      const extracted = extractArchivistJson(response.content);
      captures.push({
        role: request.role,
        call_kind: request.role === "archivist_review_repair" ? "repair" : "primary",
        provider: response.provider,
        model: response.model,
        finish_reason: response.finishReason ?? null,
        input_tokens: response.usage.inputTokens,
        output_tokens: response.usage.outputTokens,
        cached_tokens: response.usage.cachedTokens,
        cache_creation_tokens: response.usage.cacheCreationTokens,
        runtime_ms: response.durationMs,
        cost_usd: response.costUsd,
        extract_method: extracted.method,
        failure_class: extracted.ok ? null : extracted.failure_class,
        parse_message: extracted.ok ? null : extracted.message,
        raw_char_length: response.content.length,
        raw_output: response.content,
      });
      return response;
    },
  };

  const cases: ArchivistPaidCaseScore[] = [];
  const forensics: ArchivistPaidCertificationReport["forensics"] = [];
  const allCostCalls: Array<ArchivistPaidCertificationReport["cost_calls"][number]> = [];
  let totalCost = 0;
  let stoppedReason: string | undefined;

  for (const fixture of ARCHIVIST_PAID_SCOPE_CASES) {
    if (totalCost >= maxCost) {
      stoppedReason = `budget cap reached before ${fixture.id} ($${totalCost.toFixed(4)} / $${maxCost})`;
      break;
    }

    const result = await runArchivistLiveExecution({
      request: {
        expert_key: "archivist",
        expert_version_id: ARCHIVIST_PAID_CERT_EXPERT_VERSION_ID,
        manuscript_id: `ms-archivist-paid-${fixture.id}`,
        manuscript_version_id: `mv-archivist-paid-${fixture.id}`,
        content_hash: sha256Hex(fixture.manuscript_text),
        mode: "live",
        manuscript_text: fixture.manuscript_text,
      },
      options: {
        expertKey: "archivist",
        manuscriptId: `ms-archivist-paid-${fixture.id}`,
        manuscriptVersionId: `mv-archivist-paid-${fixture.id}`,
        contentHash: sha256Hex(fixture.manuscript_text),
        executionMode: "live",
        allowPaidCertificationRun: true,
        allowRepair: true,
        provider,
        entityCatalog: [...ARCHIVIST_CERTIFICATION_ENTITY_CATALOG],
      },
    });

    const score = scorePaidScopeCase(fixture, result);
    cases.push(score);
    const caseCaptures = captures.splice(0, captures.length);
    forensics.push({
      id: fixture.id,
      cost: result.cost,
      cost_calls: result.cost_calls,
      captures: caseCaptures,
    });
    allCostCalls.push(...result.cost_calls);
    totalCost += result.cost.total_cost_usd ?? 0;
    if ((result.cost.total_cost_usd ?? 0) === 0 && result.error_code) {
      stoppedReason = result.error_code;
      break;
    }
  }

  const report: ArchivistPaidCertificationReport = {
    ok: cases.length === ARCHIVIST_PAID_SCOPE_CASES.length && cases.every((item) => item.passed),
    scope: ARCHIVIST_PAID_SMOKE_SCOPE,
    session_id: args.sessionId,
    model: ARCHIVIST_PAID_SMOKE_MODEL,
    paid_certification_executed: cases.length > 0,
    live_model_certified: false,
    ready_to_set_live_model_certified: false,
    execution_wired: false,
    studio_selectable: false,
    hold_fast_run: false,
    canon_writes: 0,
    cases,
    total_cost_usd: totalCost,
    stopped_reason: stoppedReason,
    cost_calls: allCostCalls,
    forensics,
  };

  if (args.writeArtifacts !== false) {
    const dir = args.resultsDir ?? join(process.cwd(), ARCHIVIST_PAID_CERT_RESULTS_DIR);
    await mkdir(dir, { recursive: true });
    const artifactPath = join(dir, `${args.sessionId}.json`);
    await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
    report.artifact_path = artifactPath;
  }

  return report;
}

export function parsePaidCertificationArgv(argv: string[]): {
  acknowledge?: string;
  sessionId: string;
  maxCostUsd: number;
} {
  const args: { sessionId: string; maxCostUsd: number; acknowledge?: string } = {
    sessionId: "",
    maxCostUsd: ARCHIVIST_PAID_SMOKE_MAX_COST_USD,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--acknowledge" && value) {
      args.acknowledge = value;
      i += 1;
    } else if (flag === "--session-id" && value) {
      args.sessionId = value;
      i += 1;
    } else if (flag === "--max-cost-usd" && value) {
      args.maxCostUsd = Number(value);
      i += 1;
    }
  }
  if (!args.sessionId.trim()) {
    throw new Error("--session-id is required");
  }
  return args;
}
