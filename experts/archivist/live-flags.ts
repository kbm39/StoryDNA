/**
 * Live Archivist enablement gates. All remain closed in this phase.
 * Do not flip these without a separately approved live-model certification.
 */

import { ARCHIVIST_CONSTITUTION } from "./constitution.ts";
import { archivistRuntimeDefinition } from "./runtime-definition.ts";
import { archivistRegistryDefinitionV1 } from "./registry-definition.ts";

/** Explicit live-model certification bit. Remains false until a paid live cert is approved. */
export const ARCHIVIST_LIVE_MODEL_CERTIFIED = false as const;

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
  live_model_certified: false;
  registry_execution_wired: false;
} {
  return {
    execution_wired: false,
    runtime_enabled: false,
    studio_selectable: false,
    live_model_certified: false,
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
