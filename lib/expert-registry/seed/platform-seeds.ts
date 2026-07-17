import type { ExpertCategory, ExpertDefinitionV1 } from "../types.ts";
import { editorInChiefDefinitionV1 } from "./editor-in-chief.v1.ts";
import { developmentalEditorDefinitionV1 } from "./developmental-editor.v1.ts";

export interface PlatformExpertSeedSpec {
  expertKey: string;
  displayName: string;
  category: ExpertCategory;
  department: string;
  definition: () => ExpertDefinitionV1;
}

/** Code-defined platform seeds safe to import in unit tests (no review-engine). */
export const PLATFORM_EXPERT_SEED_DEFINITIONS: PlatformExpertSeedSpec[] = [
  {
    expertKey: "editor_in_chief",
    displayName: "Editor-in-Chief",
    category: "editor_in_chief",
    department: "Editorial",
    definition: editorInChiefDefinitionV1,
  },
  {
    expertKey: "developmental_editor",
    displayName: "Developmental Editor",
    category: "developmental_editor",
    department: "Editorial",
    definition: developmentalEditorDefinitionV1,
  },
];
