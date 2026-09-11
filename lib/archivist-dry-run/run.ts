import { ARCHIVIST_EXPERT_KEY } from "@/experts/archivist/contracts.ts";
import { executeExpert } from "@/lib/execute-expert/execute.ts";
import {
  getLiveProviderInvocationCount,
  resetLiveProviderInvocationCountForTests,
} from "@/lib/execute-expert/dry-run-guard.ts";
import type { ExpertExecutionOptions } from "@/lib/execute-expert/types.ts";
import { isArchivistDryRunUiAllowed } from "./allow.ts";
import { failArchivistDryRun, pinChanged } from "./fail.ts";
import {
  futureAuthorActionsPreview,
  presentCanonCandidates,
  presentEntityAmbiguities,
  presentFindings,
  resolveArchivistDryRunScenario,
} from "./present.ts";
import {
  ARCHIVIST_DRAFT_EXPERT_VERSION_ID,
  ARCHIVIST_DRY_RUN_BANNERS,
  type ArchivistDryRunSnapshot,
  type ArchivistDryRunUiFailure,
  type ArchivistDryRunUiResult,
} from "./types.ts";

const HARD_CODED_DRY_RUN_MODE = "dry_run" as const;

export interface RunArchivistDryRunArgs {
  manuscriptId: unknown;
  scenario?: unknown;
  mode?: unknown;
  loadSnapshot?: (
    manuscriptId: string,
  ) => Promise<ArchivistDryRunSnapshot | ArchivistDryRunUiFailure>;
  reloadSnapshot?: (
    manuscriptId: string,
  ) => Promise<ArchivistDryRunSnapshot | ArchivistDryRunUiFailure>;
  executionOptions?: Partial<ExpertExecutionOptions>;
}

function isSnapshot(
  value: ArchivistDryRunSnapshot | ArchivistDryRunUiFailure,
): value is ArchivistDryRunSnapshot {
  return !("ok" in value);
}

async function defaultLoadSnapshot(
  manuscriptId: string,
): Promise<ArchivistDryRunSnapshot | ArchivistDryRunUiFailure> {
  const { loadArchivistDryRunSnapshot } = await import("./load.ts");
  return loadArchivistDryRunSnapshot(manuscriptId);
}

export async function runArchivistDryRunForManuscript(
  args: RunArchivistDryRunArgs,
): Promise<ArchivistDryRunUiResult> {
  if (!isArchivistDryRunUiAllowed()) {
    return failArchivistDryRun(
      "dry_run_ui_not_allowed",
      "Archivist dry-run is available only in local development. It is not a Production execution path.",
    );
  }

  if (args.mode !== undefined && args.mode !== HARD_CODED_DRY_RUN_MODE) {
    return failArchivistDryRun(
      "live_mode_forbidden",
      "Archivist live mode is not available. Dry-run is the only permitted mode.",
    );
  }

  if (typeof args.manuscriptId !== "string" || !args.manuscriptId.trim()) {
    return failArchivistDryRun("malformed_request", "A manuscript id is required.");
  }
  const manuscriptId = args.manuscriptId.trim();

  const scenarioResult = resolveArchivistDryRunScenario(args.scenario);
  if (!scenarioResult.ok) {
    return failArchivistDryRun(
      "unsupported_scenario",
      "That dry-run scenario is not in the approved fixture set.",
      { scenario: typeof args.scenario === "string" ? args.scenario : undefined },
    );
  }
  const scenario = scenarioResult.scenario;

  const loader = args.loadSnapshot ?? defaultLoadSnapshot;
  const reloader = args.reloadSnapshot ?? args.loadSnapshot ?? defaultLoadSnapshot;

  const loaded = await loader(manuscriptId);
  if (!isSnapshot(loaded)) return loaded;
  const pin = loaded;

  resetLiveProviderInvocationCountForTests();

  const result = await executeExpert(
    {
      expert_key: ARCHIVIST_EXPERT_KEY,
      expert_version_id: ARCHIVIST_DRAFT_EXPERT_VERSION_ID,
      manuscript_id: pin.manuscript_id,
      manuscript_version_id: pin.manuscript_version_id,
      content_hash: pin.content_hash,
      mode: HARD_CODED_DRY_RUN_MODE,
      series_id: pin.series_id,
      series_order: pin.series_order,
      prior_authoritative_manuscript_versions: [],
      dry_run_scenario: scenario,
    },
    {
      ...args.executionOptions,
      executionMode: HARD_CODED_DRY_RUN_MODE,
      pinned: {
        manuscript_id: pin.manuscript_id,
        manuscript_version_id: pin.manuscript_version_id,
        content_hash: pin.content_hash,
      },
    },
  );

  const reloaded = await reloader(manuscriptId);
  if (!isSnapshot(reloaded)) return reloaded;
  if (pinChanged(pin, reloaded)) {
    return failArchivistDryRun(
      "version_pin_mismatch",
      "The manuscript version or content hash changed while the dry run was executing.",
      { pin, scenario },
    );
  }

  if (result.error_code === "archivist_live_disabled" || result.execution_mode === "live") {
    return failArchivistDryRun(
      result.error_code === "archivist_live_disabled"
        ? "archivist_live_disabled"
        : "live_mode_forbidden",
      "Archivist live execution is disabled.",
      { pin, scenario },
    );
  }

  if (!result.ok) {
    const message =
      result.error_code === "cancelled"
        ? "The dry run was cancelled before results could be shown."
        : result.error_code === "aborted"
          ? "The dry run was aborted before results could be shown."
          : result.error_code === "validation_failed"
            ? "The dry-run fixture failed validation."
            : (result.diagnostics?.[0] ?? "Archivist dry-run failed closed.");
    return failArchivistDryRun(result.error_code ?? "invalid_request", message, { pin, scenario });
  }

  if (getLiveProviderInvocationCount() !== 0) {
    return failArchivistDryRun(
      "dry_run_provider_forbidden",
      "Dry-run attempted a live provider call and was blocked.",
      { pin, scenario },
    );
  }

  return {
    ok: true,
    banners: ARCHIVIST_DRY_RUN_BANNERS,
    pin,
    scenario,
    summary: {
      execution_mode: "dry_run",
      status: result.status,
      runtime_ms: result.runtime_ms,
      provider: "none",
      model: "none",
      cost_usd: 0,
      cost_status: "exact",
      published: false,
      call_count: 0,
      input_tokens: 0,
      output_tokens: 0,
    },
    findings: presentFindings(result.findings),
    candidates: presentCanonCandidates(result.candidate_canon_delta),
    ambiguities: presentEntityAmbiguities(result.entity_ambiguities),
    future_actions: futureAuthorActionsPreview(),
    canon_writes: {
      accepted_facts: 0,
      accepted_bible_revisions: 0,
      persisted: false,
    },
  };
}
