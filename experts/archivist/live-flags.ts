/**
 * Live Archivist enablement gates.
 *
 * live_model_certified may be true after the formal pipeline checkpoint.
 * execution_wired, runtime enabled, studio_selectable, and Production remain closed
 * until separately approved. Certification and execution are different gates.
 */

import { ARCHIVIST_CONSTITUTION } from "./constitution.ts";
import { archivistRuntimeDefinition } from "./runtime-definition.ts";
import { archivistRegistryDefinitionV1 } from "./registry-definition.ts";

/**
 * Meaning of live_model_certified:
 * the complete configured live Archivist pipeline using the pinned model
 * passed the official synthetic certification bar (final_classification).
 *
 * This is NOT raw Haiku accuracy. v4 raw detection was 5/7.
 * Do not read this flag as "Haiku is 100% accurate."
 */
export const ARCHIVIST_LIVE_MODEL_CERTIFIED_SEMANTICS =
  "complete_configured_live_expert_pipeline_using_certified_model" as const;

/** Formal checkpoint after archivist-cert-20260924-v4. Does not enable execution. */
export const ARCHIVIST_LIVE_MODEL_CERTIFIED = true as const;

export class ArchivistLiveDisabledError extends Error {
  readonly code = "archivist_live_disabled" as const;
  constructor(message = "Live Archivist execution is not enabled") {
    super(message);
    this.name = "ArchivistLiveDisabledError";
  }
}

export class LiveCanonWriteForbiddenError extends Error {
  readonly code = "canon_write_forbidden" as const;
  constructor(message = "live Archivist cannot write accepted canon") {
    super(message);
    this.name = "LiveCanonWriteForbiddenError";
  }
}

export function archivistLiveGateSnapshot(): {
  execution_wired: false;
  runtime_enabled: false;
  studio_selectable: false;
  live_model_certified: true;
  registry_execution_wired: false;
} {
  return {
    execution_wired: false,
    runtime_enabled: false,
    studio_selectable: false,
    live_model_certified: true,
    registry_execution_wired: false,
  };
}

export function archivistLiveDisableReasons(): string[] {
  const reasons: string[] = [];
  if (!ARCHIVIST_CONSTITUTION.execution_wired) reasons.push("execution_wired=false");
  if (!archivistRuntimeDefinition().enabled) reasons.push("runtime enabled=false");
  if (!ARCHIVIST_CONSTITUTION.studio_selectable) {
    reasons.push("studio_selectable=false");
  }
  if (!ARCHIVIST_LIVE_MODEL_CERTIFIED) reasons.push("live_model_certified=false");
  if (!archivistRegistryDefinitionV1().registry_metadata?.execution_wired) {
    reasons.push("registry execution_wired=false");
  }
  return reasons;
}

export function isArchivistLiveExecutionAllowed(): false {
  return false;
}

export function assertArchivistLiveExecutionAllowed(args?: {
  allowUnwiredForTests?: boolean;
  /** CLI-only paid certification smoke. Does not enable UI, Trigger, or Studio. */
  allowPaidCertificationRun?: boolean;
}): void {
  if (args?.allowUnwiredForTests || args?.allowPaidCertificationRun) return;
  throw new ArchivistLiveDisabledError(
    `Live Archivist is disabled (${archivistLiveDisableReasons().join("; ")})`,
  );
}

export function persistAcceptedCanonFromLive(): never {
  throw new LiveCanonWriteForbiddenError("live Archivist cannot persist accepted canon");
}

export function persistAcceptedBibleRevisionFromLive(): never {
  throw new LiveCanonWriteForbiddenError(
    "live Archivist cannot create or accept a Series Bible revision",
  );
}

export function persistAuthorDispositionFromLive(): never {
  throw new LiveCanonWriteForbiddenError(
    "live Archivist cannot accept, dismiss, retcon, or otherwise dispose findings",
  );
}
