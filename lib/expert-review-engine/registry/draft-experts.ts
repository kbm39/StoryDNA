/**
 * Draft expert runtime loaders — validated but excluded from production bootstrap.
 */

import { militaryExpertRuntimeDefinition } from "@/experts/military-expert/runtime-definition.ts";
import { validateExpertRuntimeDefinition } from "../validate-runtime-definition.ts";
import type { ExpertRuntimeDefinition } from "../types.ts";

export function loadMilitaryExpertDraftRuntimeDefinition(): ExpertRuntimeDefinition {
  const definition = militaryExpertRuntimeDefinition();
  const validation = validateExpertRuntimeDefinition(definition);
  if (!validation.ok) {
    throw new Error(
      `Invalid Military Expert draft runtime definition: ${validation.errors.join("; ")}`,
    );
  }
  return definition;
}
