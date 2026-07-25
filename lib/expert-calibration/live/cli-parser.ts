import type { LiveCalibrationCliArgs, LiveCalibrationMode, LiveCalibrationSubsetId } from "./contracts.ts";
import { LiveCalibrationError } from "./errors.ts";
import {
  LIVE_CALIBRATION_ACK_TOKEN,
  LIVE_CALIBRATION_ALLOWED_EXPERTS,
  LIVE_CALIBRATION_ALLOWED_MODES,
  LIVE_CALIBRATION_ALLOWED_PROVIDERS,
  LIVE_CALIBRATION_DEFAULTS,
} from "./constants.ts";
import { isLiveCalibrationSubsetId } from "./subsets.ts";

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  throw new LiveCalibrationError("invalid_configuration", `Invalid boolean: ${value}`);
}

function parsePositiveInt(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new LiveCalibrationError("invalid_configuration", `Invalid ${name}: ${value}`);
  }
  return parsed;
}

function parsePositiveFloat(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new LiveCalibrationError("invalid_configuration", `Invalid ${name}: ${value}`);
  }
  return parsed;
}

function parseRequiredString(name: string, value: string | undefined): string {
  if (value === undefined || value.trim().length === 0) {
    throw new LiveCalibrationError("invalid_configuration", `Missing required flag: ${name}`);
  }
  return value.trim();
}

function parseMode(value: string | undefined): LiveCalibrationMode {
  const mode = parseRequiredString("--mode", value);
  if (!(LIVE_CALIBRATION_ALLOWED_MODES as readonly string[]).includes(mode)) {
    throw new LiveCalibrationError("invalid_configuration", `Invalid mode: ${mode}`);
  }
  return mode as LiveCalibrationMode;
}

function parseExpert(value: string | undefined): LiveCalibrationCliArgs["expert"] {
  const expert = parseRequiredString("--expert", value);
  if (!(LIVE_CALIBRATION_ALLOWED_EXPERTS as readonly string[]).includes(expert)) {
    throw new LiveCalibrationError("invalid_configuration", `Invalid expert: ${expert}`);
  }
  return expert as LiveCalibrationCliArgs["expert"];
}

function parseProvider(value: string | undefined): LiveCalibrationCliArgs["provider"] {
  const provider = parseRequiredString("--provider", value);
  if (!(LIVE_CALIBRATION_ALLOWED_PROVIDERS as readonly string[]).includes(provider)) {
    throw new LiveCalibrationError("invalid_configuration", `Invalid provider: ${provider}`);
  }
  return provider as LiveCalibrationCliArgs["provider"];
}

function parseSubset(value: string | undefined): LiveCalibrationSubsetId {
  const subset = parseRequiredString("--subset", value);
  if (!isLiveCalibrationSubsetId(subset)) {
    throw new LiveCalibrationError("invalid_configuration", `Invalid subset: ${subset}`);
  }
  return subset;
}

export function parseLiveCalibrationCliArgs(argv: readonly string[]): LiveCalibrationCliArgs {
  const flags = new Map<string, string>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags.set(key, next);
      i++;
    } else {
      flags.set(key, "true");
    }
  }

  const mode = parseMode(flags.get("mode"));

  const args: LiveCalibrationCliArgs = Object.freeze({
    mode,
    expert: parseExpert(flags.get("expert")),
    suite: parseRequiredString("--suite", flags.get("suite")),
    subset: parseSubset(flags.get("subset")),
    provider: parseProvider(flags.get("provider")),
    model: parseRequiredString("--model", flags.get("model")),
    runs: parsePositiveInt("--runs", flags.get("runs"), LIVE_CALIBRATION_DEFAULTS.runs),
    maxCalls: parsePositiveInt("--max-calls", flags.get("max-calls"), LIVE_CALIBRATION_DEFAULTS.maxCalls),
    maxTotalCostUsd: parsePositiveFloat(
      "--max-total-cost",
      flags.get("max-total-cost"),
      LIVE_CALIBRATION_DEFAULTS.maxTotalCostUsd,
    ),
    maxCostPerCallUsd: parsePositiveFloat(
      "--max-cost-per-call",
      flags.get("max-cost-per-call"),
      LIVE_CALIBRATION_DEFAULTS.maxCostPerCallUsd,
    ),
    maxInputTokens: parsePositiveInt(
      "--max-input-tokens",
      flags.get("max-input-tokens"),
      LIVE_CALIBRATION_DEFAULTS.maxInputTokens,
    ),
    maxOutputTokens: parsePositiveInt(
      "--max-output-tokens",
      flags.get("max-output-tokens"),
      LIVE_CALIBRATION_DEFAULTS.maxOutputTokens,
    ),
    timeoutMs: parsePositiveInt("--timeout-ms", flags.get("timeout-ms"), LIVE_CALIBRATION_DEFAULTS.timeoutMs),
    maxRuntimeMs: parsePositiveInt(
      "--max-runtime-ms",
      flags.get("max-runtime-ms"),
      LIVE_CALIBRATION_DEFAULTS.maxRuntimeMs,
    ),
    outputDir: flags.get("output-dir")?.trim() || ".calibration-results",
    overwrite: parseBoolean(flags.get("overwrite"), LIVE_CALIBRATION_DEFAULTS.overwrite),
    ackToken: flags.get("ack-token")?.trim(),
    syntheticScenario: flags.get("synthetic-scenario")?.trim() as LiveCalibrationCliArgs["syntheticScenario"],
    correlationId: flags.get("correlation-id")?.trim(),
  });

  if (mode === "live") {
    if (!args.ackToken) {
      throw new LiveCalibrationError(
        "authorization_failure",
        "Live mode requires --ack-token",
      );
    }
    if (args.ackToken !== LIVE_CALIBRATION_ACK_TOKEN) {
      throw new LiveCalibrationError(
        "authorization_failure",
        "Invalid ack token for live mode",
      );
    }
  }

  if (mode === "synthetic" && args.syntheticScenario === undefined) {
    // Default synthetic scenario is success when not specified
  }

  if (args.runs < 1) {
    throw new LiveCalibrationError("invalid_configuration", "--runs must be >= 1");
  }

  if (args.maxCalls < 1) {
    throw new LiveCalibrationError("invalid_configuration", "--max-calls must be >= 1");
  }

  return args;
}

export function formatCliArgsForManifest(args: LiveCalibrationCliArgs): Record<string, string | number | boolean> {
  return {
    mode: args.mode,
    expert: args.expert,
    suite: args.suite,
    subset: args.subset,
    provider: args.provider,
    model: args.model,
    runs: args.runs,
    maxCalls: args.maxCalls,
    maxTotalCostUsd: args.maxTotalCostUsd,
    maxCostPerCallUsd: args.maxCostPerCallUsd,
    maxInputTokens: args.maxInputTokens,
    maxOutputTokens: args.maxOutputTokens,
    timeoutMs: args.timeoutMs,
    maxRuntimeMs: args.maxRuntimeMs,
    outputDir: args.outputDir,
    overwrite: args.overwrite,
  };
}
