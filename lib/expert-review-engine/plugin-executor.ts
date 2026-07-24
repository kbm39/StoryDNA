/**
 * Typed expert plugin executor (P2-22).
 *
 * Invokes explicitly allowlisted, resolver-produced export handles under a narrow
 * deterministic contract. Does not wire into the planning orchestrator or production callers.
 */

import {
  EXPERT_MODULE_EXPORT_HANDLE,
  type ExpertModuleExportDescriptor,
} from "./module-resolver.ts";
import {
  EXPERT_PLUGIN_EXECUTOR_FLAG_NAME,
  readExpertPluginExecutorEnabled,
} from "./feature-flags.ts";
import {
  FORBIDDEN_INPUT_KEYS,
  INVOCATION_KIND_INPUT_CONTRACTS,
  isExpertPluginInvocationKind,
  lookupAllowedPluginExport,
  MAX_PLUGIN_OUTPUT_BYTES,
  type ExpertPluginInvocationKind,
} from "./plugin-invocation-contracts.ts";

export type ExpertPluginExecutionErrorCode =
  | "executor_disabled"
  | "invalid_execution_request"
  | "unresolved_export"
  | "invocation_kind_not_allowed"
  | "export_not_callable"
  | "input_contract_invalid"
  | "invocation_failed"
  | "timeout"
  | "aborted"
  | "unsafe_export_category"
  | "unexpected_executor_failure";

export interface ExpertPluginExecutionProvenance {
  expertKey: string;
  fieldPath: string;
  logicalId: string;
  moduleId: string;
  exportName: string;
}

export interface ExpertPluginExecutionContext {
  correlationId?: string;
  auditId?: string;
}

export interface ExpertPluginExecutionRequest {
  /** Opaque descriptor from resolveExpertModuleReference — not a raw function. */
  descriptor: ExpertModuleExportDescriptor;
  invocationKind: ExpertPluginInvocationKind;
  /** Immutable input payload validated against invocation kind contract. */
  input: Readonly<Record<string, unknown>>;
  context?: ExpertPluginExecutionContext;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export type ExpertPluginResultKind =
  | "string"
  | "boolean"
  | "number"
  | "null"
  | "object"
  | "array";

export interface ExpertPluginExecutionSuccess {
  ok: true;
  provenance: ExpertPluginExecutionProvenance;
  invocationKind: ExpertPluginInvocationKind;
  resultKind: ExpertPluginResultKind;
  output: unknown;
  executionOccurred: true;
  durationMs: number;
  correlationId?: string;
  auditId?: string;
}

export interface ExpertPluginExecutionFailure {
  ok: false;
  code: ExpertPluginExecutionErrorCode;
  message: string;
  provenance?: ExpertPluginExecutionProvenance;
  context?: Readonly<Record<string, string>>;
}

export type ExpertPluginExecutionResult =
  | ExpertPluginExecutionSuccess
  | ExpertPluginExecutionFailure;

export interface ExpertPluginExecutorDependencies {
  featureFlagReader?: () => boolean;
  /** Test-only: bypass EXPERT_PLUGIN_EXECUTOR_ENABLED when true. */
  bypassFeatureFlag?: boolean;
  now?: () => number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

function provenanceFromDescriptor(
  descriptor: ExpertModuleExportDescriptor,
): ExpertPluginExecutionProvenance {
  return {
    expertKey: descriptor.expertKey,
    fieldPath: descriptor.fieldPath,
    logicalId: descriptor.logicalId,
    moduleId: descriptor.moduleId,
    exportName: descriptor.exportName,
  };
}

function failure(
  code: ExpertPluginExecutionErrorCode,
  message: string,
  provenance?: ExpertPluginExecutionProvenance,
  context?: Readonly<Record<string, string>>,
): ExpertPluginExecutionFailure {
  return {
    ok: false,
    code,
    message,
    ...(provenance ? { provenance } : {}),
    ...(context ? { context } : {}),
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hasForbiddenInputKey(value: unknown, path = ""): string | null {
  if (!isPlainRecord(value)) return null;
  for (const [key, nested] of Object.entries(value)) {
    const fullPath = path ? `${path}.${key}` : key;
    if ((FORBIDDEN_INPUT_KEYS as readonly string[]).includes(key)) {
      return fullPath;
    }
    const nestedHit = hasForbiddenInputKey(nested, fullPath);
    if (nestedHit) return nestedHit;
  }
  return null;
}

function validateExecutionRequest(
  request: unknown,
): ExpertPluginExecutionFailure | ExpertPluginExecutionRequest {
  if (!isPlainRecord(request)) {
    return failure("invalid_execution_request", "Execution request must be a plain object");
  }

  const descriptor = request.descriptor;
  if (!isPlainRecord(descriptor)) {
    return failure("invalid_execution_request", "descriptor must be a resolver-produced object");
  }

  const requiredDescriptorFields = [
    "expertKey",
    "fieldPath",
    "logicalId",
    "moduleId",
    "exportName",
    "exportKind",
  ] as const;
  for (const field of requiredDescriptorFields) {
    if (typeof descriptor[field] !== "string") {
      return failure(
        "invalid_execution_request",
        `descriptor.${field} must be a string`,
      );
    }
  }

  if (!(EXPERT_MODULE_EXPORT_HANDLE in descriptor)) {
    return failure(
      "unresolved_export",
      "descriptor must include resolver opaque handle (EXPERT_MODULE_EXPORT_HANDLE)",
    );
  }

  const invocationKind = request.invocationKind;
  if (typeof invocationKind !== "string" || !isExpertPluginInvocationKind(invocationKind)) {
    return failure(
      "invalid_execution_request",
      `Unsupported invocation kind: ${String(invocationKind)}`,
    );
  }

  const input = request.input;
  if (!isPlainRecord(input)) {
    return failure("input_contract_invalid", "input must be a plain object");
  }

  const contract = INVOCATION_KIND_INPUT_CONTRACTS[invocationKind];
  for (const field of contract.requiredFields) {
    if (!(field in input)) {
      return failure(
        "input_contract_invalid",
        `Missing required input field: ${field}`,
        provenanceFromDescriptor(descriptor as unknown as ExpertModuleExportDescriptor),
        { field },
      );
    }
  }

  for (const field of contract.forbiddenFields) {
    if (field in input) {
      return failure(
        "input_contract_invalid",
        `Forbidden input field present: ${field}`,
        provenanceFromDescriptor(descriptor as unknown as ExpertModuleExportDescriptor),
        { field },
      );
    }
  }

  const forbiddenNested = hasForbiddenInputKey(input);
  if (forbiddenNested) {
    return failure(
      "input_contract_invalid",
      `Forbidden nested input field: ${forbiddenNested}`,
      provenanceFromDescriptor(descriptor as unknown as ExpertModuleExportDescriptor),
      { field: forbiddenNested },
    );
  }

  if (!("args" in input) || !isPlainRecord(input.args)) {
    return failure(
      "input_contract_invalid",
      "input.args must be a plain object",
      provenanceFromDescriptor(descriptor as unknown as ExpertModuleExportDescriptor),
    );
  }

  if (request.timeoutMs !== undefined) {
    if (typeof request.timeoutMs !== "number" || !Number.isFinite(request.timeoutMs) || request.timeoutMs <= 0) {
      return failure("invalid_execution_request", "timeoutMs must be a positive finite number");
    }
  }

  if (request.signal !== undefined && !(request.signal instanceof AbortSignal)) {
    return failure("invalid_execution_request", "signal must be an AbortSignal when provided");
  }

  const context = request.context;
  if (context !== undefined && !isPlainRecord(context)) {
    return failure("invalid_execution_request", "context must be a plain object when provided");
  }

  return {
    descriptor: descriptor as unknown as ExpertModuleExportDescriptor,
    invocationKind,
    input: Object.freeze(structuredClone(input)),
    ...(context
      ? {
          context: {
            ...(typeof context.correlationId === "string"
              ? { correlationId: context.correlationId }
              : {}),
            ...(typeof context.auditId === "string" ? { auditId: context.auditId } : {}),
          },
        }
      : {}),
    ...(typeof request.timeoutMs === "number" ? { timeoutMs: request.timeoutMs } : {}),
    ...(request.signal instanceof AbortSignal ? { signal: request.signal } : {}),
  };
}

function classifyResultKind(value: unknown): ExpertPluginResultKind {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "object":
      return "object";
    default:
      return "object";
  }
}

type SanitizeFailureReason =
  | "function"
  | "symbol"
  | "class_instance"
  | "cycle"
  | "error_object"
  | "buffer"
  | "unknown_type";

function sanitizePluginOutput(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): { ok: true; value: unknown } | { ok: false; reason: SanitizeFailureReason } {
  if (value === null || value === undefined) {
    return { ok: true, value: value ?? null };
  }

  const valueType = typeof value;
  if (valueType === "function" || valueType === "symbol") {
    return { ok: false, reason: valueType === "function" ? "function" : "symbol" };
  }
  if (valueType === "boolean" || valueType === "number" || valueType === "string") {
    return { ok: true, value };
  }
  if (valueType === "bigint") {
    return { ok: true, value: value.toString() };
  }

  if (value instanceof Error) {
    return { ok: false, reason: "error_object" };
  }

  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return { ok: false, reason: "buffer" };
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) return { ok: false, reason: "cycle" };
    seen.add(value);
    const sanitized: unknown[] = [];
    for (const item of value) {
      const result = sanitizePluginOutput(item, seen);
      if (!result.ok) return result;
      sanitized.push(result.value);
    }
    return { ok: true, value: sanitized };
  }

  if (valueType === "object") {
    if (seen.has(value)) return { ok: false, reason: "cycle" };
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return { ok: false, reason: "class_instance" };
    }
    seen.add(value);
    const sanitized: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const result = sanitizePluginOutput(nested, seen);
      if (!result.ok) return result;
      sanitized[key] = result.value;
    }
    return { ok: true, value: sanitized };
  }

  return { ok: false, reason: "unknown_type" };
}

function outputSizeBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const err = new Error("aborted");
    err.name = "AbortError";
    throw err;
  }
}

async function invokeWithBoundary<T>(
  fn: () => T | Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  throwIfAborted(signal);

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (handler: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      handler();
    };

    const onAbort = () => {
      finish(() => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
    };

    const timer = setTimeout(() => {
      finish(() => {
        const err = new Error("timeout");
        err.name = "TimeoutError";
        reject(err);
      });
    }, timeoutMs);

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    const cleanup = () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    };

    Promise.resolve()
      .then(() => {
        throwIfAborted(signal);
        return fn();
      })
      .then((value) => finish(() => resolve(value)))
      .catch((error) => finish(() => reject(error)));
  });
}

/**
 * Execute an explicitly allowlisted expert plugin export via resolver opaque handle.
 *
 * Does not accept raw functions from callers. Does not retry or run in background.
 */
export async function executeResolvedExpertPlugin(
  request: ExpertPluginExecutionRequest,
  dependencies: ExpertPluginExecutorDependencies = {},
): Promise<ExpertPluginExecutionResult> {
  const featureFlagReader = dependencies.featureFlagReader ?? readExpertPluginExecutorEnabled;
  if (!dependencies.bypassFeatureFlag && !featureFlagReader()) {
    return failure(
      "executor_disabled",
      `Expert plugin executor is disabled (${EXPERT_PLUGIN_EXECUTOR_FLAG_NAME} is off)`,
    );
  }

  const validated = validateExecutionRequest(request);
  if (!("descriptor" in validated) || !("invocationKind" in validated)) {
    return validated;
  }

  const { descriptor, invocationKind, input, context, timeoutMs, signal } = validated;
  const provenance = provenanceFromDescriptor(descriptor);
  const now = dependencies.now ?? (() => Date.now());
  const startedAt = now();

  try {
    if (descriptor.exportKind !== "function") {
      return failure(
        "export_not_callable",
        "Only function exports may be invoked",
        provenance,
        { export_kind: descriptor.exportKind },
      );
    }

    const allowlistEntry = lookupAllowedPluginExport(descriptor.moduleId, descriptor.exportName);
    if (!allowlistEntry) {
      return failure(
        "unsafe_export_category",
        "Export is not on the P2-22 invocation allowlist",
        provenance,
        { module_id: descriptor.moduleId, export_name: descriptor.exportName },
      );
    }

    if (allowlistEntry.invocationKind !== invocationKind) {
      return failure(
        "invocation_kind_not_allowed",
        `Export requires invocation kind "${allowlistEntry.invocationKind}", got "${invocationKind}"`,
        provenance,
        {
          expected_invocation_kind: allowlistEntry.invocationKind,
          requested_invocation_kind: invocationKind,
        },
      );
    }

    const handle = descriptor[EXPERT_MODULE_EXPORT_HANDLE];
    if (typeof handle !== "function") {
      return failure(
        "unresolved_export",
        "Resolver opaque handle is not a callable function",
        provenance,
      );
    }

    const argsSnapshot = structuredClone(input.args);
    const frozenArgs = Object.freeze(structuredClone(input.args));

    const rawResult = await invokeWithBoundary(
      () => {
        throwIfAborted(signal);
        return (handle as (args: unknown) => unknown)(frozenArgs);
      },
      timeoutMs ?? DEFAULT_TIMEOUT_MS,
      signal,
    );

    if (JSON.stringify(frozenArgs) !== JSON.stringify(argsSnapshot)) {
      return failure(
        "unexpected_executor_failure",
        "Plugin input args were mutated during invocation",
        provenance,
      );
    }

    const sanitized = sanitizePluginOutput(rawResult);
    if (!sanitized.ok) {
      return failure(
        "invocation_failed",
        `Plugin output failed sanitization: ${sanitized.reason}`,
        provenance,
        { sanitize_reason: sanitized.reason },
      );
    }

    if (outputSizeBytes(sanitized.value) > MAX_PLUGIN_OUTPUT_BYTES) {
      return failure(
        "invocation_failed",
        "Plugin output exceeds maximum allowed size",
        provenance,
      );
    }

    return {
      ok: true,
      provenance,
      invocationKind,
      resultKind: classifyResultKind(sanitized.value),
      output: sanitized.value,
      executionOccurred: true,
      durationMs: Math.max(0, now() - startedAt),
      ...(context?.correlationId ? { correlationId: context.correlationId } : {}),
      ...(context?.auditId ? { auditId: context.auditId } : {}),
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return failure("aborted", "Plugin invocation was aborted", provenance);
      }
      if (error.name === "TimeoutError") {
        return failure("timeout", "Plugin invocation timed out", provenance);
      }
      return failure(
        "invocation_failed",
        error.message.split("\n")[0] ?? "Plugin invocation failed",
        provenance,
      );
    }
    return failure(
      "unexpected_executor_failure",
      "Unexpected executor failure",
      provenance,
    );
  }
}

export {
  EXPERT_PLUGIN_EXECUTOR_FLAG_NAME,
  readExpertPluginExecutorEnabled,
} from "./feature-flags.ts";

export {
  ALLOWED_PLUGIN_EXPORTS,
  DISALLOWED_EXPORT_CATEGORIES,
  EXPERT_PLUGIN_INVOCATION_KINDS,
  INVOCATION_KIND_INPUT_CONTRACTS,
  type ExpertPluginInvocationKind,
} from "./plugin-invocation-contracts.ts";

export { EXPERT_MODULE_EXPORT_HANDLE } from "./module-resolver.ts";
