/**
 * Disabled live Archivist provider adapter.
 *
 * Reuses Literary Agent / Execute Expert provider infrastructure:
 * runWithProviderExecutionKeepAlive, ProviderCallHooks, AbortSignal,
 * shouldCancel, assertProviderCallAllowed, heartbeat, cost-first usage.
 *
 * The Anthropic adapter never runs in this phase: flags remain off and
 * tests inject a mock. No production credentials are hard-coded.
 */

import Anthropic from "@anthropic-ai/sdk";
import { clampManuscript } from "@/lib/ai/shared.ts";
import type { ProviderCallHooks } from "@/lib/ai/provider-call-hooks.ts";
import {
  ProviderExecutionAbortedError,
  runWithProviderExecutionKeepAlive,
} from "@/lib/ai/provider-execution.ts";
import { assertProviderCallAllowed } from "@/lib/editorial-workflow/provider-call-guard.ts";
import { noteLiveProviderInvocation } from "@/lib/execute-expert/dry-run-guard.ts";
import type { ExpertCostUsage } from "@/lib/execute-expert/cost.ts";
import {
  estimateCallCostUsd,
  usageFromAnthropicMessage,
} from "@/lib/editorial-generation/literary-agent-cost.ts";
import { ARCHIVIST } from "./definition.ts";
import {
  ArchivistLiveDisabledError,
  assertArchivistLiveExecutionAllowed,
} from "./live-flags.ts";
import type { LiveArchivistCallRole } from "./live-types.ts";

const DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-8";
const MAX_INPUT_CHARS = Number(process.env.ANTHROPIC_MAX_INPUT_CHARS || 3_000_000);

export function resolveArchivistLiveProviderName(
  env: NodeJS.ProcessEnv = process.env,
): "anthropic" {
  const configured = (env.ARCHIVIST_PROVIDER ?? "anthropic").trim().toLowerCase();
  if (configured && configured !== "anthropic") {
    throw new ArchivistLiveDisabledError(
      `Archivist live provider "${configured}" is not supported; use existing StoryDNA anthropic conventions`,
    );
  }
  return "anthropic";
}

export function resolveArchivistLiveModel(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.ARCHIVIST_MODEL?.trim() ||
    env.ANTHROPIC_MODEL?.trim() ||
    DEFAULT_ANTHROPIC_MODEL
  );
}

export interface ArchivistLiveProviderRequest {
  role: LiveArchivistCallRole;
  system: string;
  user: string;
}

export interface ArchivistLiveProviderResponse {
  content: string;
  provider: "anthropic";
  model: string;
  usage: ExpertCostUsage;
  durationMs: number;
  costUsd: number | null;
  finishReason?: string | null;
}

export interface ArchivistLiveProvider {
  readonly id: "disabled" | "mock" | "anthropic";
  readonly provider: "anthropic";
  readonly model: string;
  complete(
    request: ArchivistLiveProviderRequest,
    hooks?: ProviderCallHooks,
  ): Promise<ArchivistLiveProviderResponse>;
}

function textOf(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

function usageToCost(model: string, usage: ExpertCostUsage): number | null {
  return estimateCallCostUsd(model, usage);
}

export function createDisabledArchivistLiveProvider(): ArchivistLiveProvider {
  const model = resolveArchivistLiveModel();
  return {
    id: "disabled",
    provider: "anthropic",
    model,
    async complete() {
      throw new ArchivistLiveDisabledError(
        "Archivist live provider adapter is present but disabled",
      );
    },
  };
}

export function createMockArchivistLiveProvider(args: {
  model?: string;
  complete: (
    request: ArchivistLiveProviderRequest,
    ctx: { signal: AbortSignal },
  ) => Promise<{
    content: string;
    usage?: Partial<ExpertCostUsage>;
    durationMs?: number;
    model?: string;
  }>;
}): ArchivistLiveProvider {
  const model = args.model ?? "mock-archivist-model";
  return {
    id: "mock",
    provider: "anthropic",
    model,
    async complete(request, hooks) {
      await assertProviderCallAllowed(hooks?.shouldCancel);
      await hooks?.onBeforeProviderCall?.();
      noteLiveProviderInvocation("live");
      const started = Date.now();
      return runWithProviderExecutionKeepAlive(
        async ({ signal }) => {
          if (signal.aborted) throw new ProviderExecutionAbortedError();
          const result = await args.complete(request, { signal });
          if (signal.aborted) throw new ProviderExecutionAbortedError();
          const usage: ExpertCostUsage = {
            inputTokens: result.usage?.inputTokens ?? 100,
            outputTokens: result.usage?.outputTokens ?? 50,
            cachedTokens: result.usage?.cachedTokens ?? 0,
            cacheCreationTokens: result.usage?.cacheCreationTokens ?? 0,
          };
          const resolvedModel = result.model ?? model;
          return {
            content: result.content,
            provider: "anthropic" as const,
            model: resolvedModel,
            usage,
            durationMs: result.durationMs ?? Date.now() - started,
            costUsd: usageToCost(resolvedModel, usage),
          };
        },
        {
          onExecutionHeartbeat: hooks?.onExecutionHeartbeat,
          shouldCancel: hooks?.shouldCancel,
          abortSignal: hooks?.abortSignal,
        },
      );
    },
  };
}

/**
 * Real Anthropic adapter. Flags still block invocation. Do not call from UI.
 * Provider/model come from ARCHIVIST_PROVIDER / ARCHIVIST_MODEL / ANTHROPIC_MODEL.
 * API key is read from the environment only — never hard-coded.
 */
export function createAnthropicArchivistLiveProvider(args?: {
  allowUnwiredForTests?: boolean;
  allowPaidCertificationRun?: boolean;
  model?: string;
  maxTokens?: number;
  thinking?: boolean;
}): ArchivistLiveProvider {
  const model = args?.model?.trim() || resolveArchivistLiveModel();
  const maxTokens = args?.maxTokens ?? ARCHIVIST.maxTokens;
  const thinkingEnabled = args?.thinking ?? true;
  resolveArchivistLiveProviderName();
  return {
    id: "anthropic",
    provider: "anthropic",
    model,
    async complete(request, hooks) {
      assertArchivistLiveExecutionAllowed({
        allowUnwiredForTests: args?.allowUnwiredForTests,
        allowPaidCertificationRun: args?.allowPaidCertificationRun,
      });
      if (!process.env.ANTHROPIC_API_KEY?.trim()) {
        throw new ArchivistLiveDisabledError("ANTHROPIC_API_KEY is not set");
      }
      await assertProviderCallAllowed(hooks?.shouldCancel);
      await hooks?.onBeforeProviderCall?.();
      noteLiveProviderInvocation("live");
      const started = Date.now();
      const client = new Anthropic();
      const { text: clamped } = clampManuscript(request.user, MAX_INPUT_CHARS);
      return runWithProviderExecutionKeepAlive(
        async ({ signal }) => {
          const stream = client.messages.stream(
            {
              model,
              max_tokens: maxTokens,
              ...(thinkingEnabled ? { thinking: { type: "adaptive" as const } } : {}),
              system: request.system,
              messages: [{ role: "user", content: clamped }],
            },
            { signal },
          );
          const response = await stream.finalMessage();
          const usage = usageFromAnthropicMessage(response.usage);
          const resolvedModel = response.model || model;
          return {
            content: textOf(response),
            provider: "anthropic" as const,
            model: resolvedModel,
            usage,
            durationMs: Date.now() - started,
            costUsd: usageToCost(resolvedModel, usage),
            finishReason: response.stop_reason ?? null,
          };
        },
        {
          onExecutionHeartbeat: hooks?.onExecutionHeartbeat,
          shouldCancel: hooks?.shouldCancel,
          abortSignal: hooks?.abortSignal,
        },
      );
    },
  };
}

export function createArchivistLiveProvider(args?: {
  allowUnwiredForTests?: boolean;
  allowPaidCertificationRun?: boolean;
}): ArchivistLiveProvider {
  if (args?.allowUnwiredForTests || args?.allowPaidCertificationRun) {
    throw new ArchivistLiveDisabledError(
      "Test live execution must inject a mock provider; refusing to construct a paid adapter",
    );
  }
  return createDisabledArchivistLiveProvider();
}
