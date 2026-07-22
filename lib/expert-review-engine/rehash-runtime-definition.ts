/**
 * Recompute definition_hash after mutating a runtime definition (tests / admin tooling).
 */
import {
  hashExpertRuntimeDefinition,
  type ExpertRuntimeDefinition,
} from "./types.ts";

export function withRuntimeDefinitionHash(
  def: ExpertRuntimeDefinition,
): ExpertRuntimeDefinition {
  const hash = hashExpertRuntimeDefinition({
    ...def,
    runtime_versions: { ...def.runtime_versions, definition_hash: "" },
  });
  return {
    ...def,
    runtime_versions: { ...def.runtime_versions, definition_hash: hash },
  };
}
