/**
 * Future segmented live execution must use the certified Haiku pin.
 * Do not fall back to Opus. Fail before any provider construction.
 */

import {
  CERTIFIED_ARCHIVIST_MODEL,
  CERTIFIED_ARCHIVIST_PROVIDER,
} from "./constants.ts";
import { CertifiedModelMismatchError } from "./errors.ts";

export function resolveConfiguredArchivistProvider(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (env.ARCHIVIST_PROVIDER ?? CERTIFIED_ARCHIVIST_PROVIDER).trim().toLowerCase();
}

export function resolveConfiguredArchivistModel(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    env.ARCHIVIST_MODEL?.trim() ||
    env.ANTHROPIC_MODEL?.trim() ||
    ""
  );
}

export function assertCertifiedSegmentedModel(
  actual?: { provider?: string; model?: string },
  env: NodeJS.ProcessEnv = process.env,
): { provider: typeof CERTIFIED_ARCHIVIST_PROVIDER; model: typeof CERTIFIED_ARCHIVIST_MODEL } {
  const provider = (actual?.provider ?? resolveConfiguredArchivistProvider(env)).toLowerCase();
  const model = actual?.model ?? resolveConfiguredArchivistModel(env);
  if (provider !== CERTIFIED_ARCHIVIST_PROVIDER) {
    throw new CertifiedModelMismatchError(
      `segmented Archivist requires ${CERTIFIED_ARCHIVIST_PROVIDER}, got ${provider || "(unset)"}`,
    );
  }
  if (model !== CERTIFIED_ARCHIVIST_MODEL) {
    throw new CertifiedModelMismatchError(
      `segmented Archivist requires ${CERTIFIED_ARCHIVIST_MODEL} before any provider call; got ${model || "(unset, would default to Opus)"}`,
    );
  }
  return {
    provider: CERTIFIED_ARCHIVIST_PROVIDER,
    model: CERTIFIED_ARCHIVIST_MODEL,
  };
}
