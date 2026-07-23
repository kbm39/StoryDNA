/**
 * Collect advertised module/export references from ExpertRuntimeDefinition (P2-03).
 */

import type {
  ExpertRuntimeDefinition,
  ExpertRuntimeModuleReferenceFields,
} from "./types.ts";
import type { ModuleExportKind, RuntimeModuleRefExportSection } from "./module-ref-inventory.ts";

export interface AdvertisedModuleRef {
  expertKey: string;
  fieldPath: string;
  logicalId: string;
  moduleId: string;
  exportName: string;
  expectedExportKind: ModuleExportKind;
  sectionId: RuntimeModuleRefExportSection;
}

interface CollectContext {
  expertKey: string;
  refs: AdvertisedModuleRef[];
}

type RootModuleRefCollector<K extends keyof ExpertRuntimeModuleReferenceFields> = (
  value: ExpertRuntimeModuleReferenceFields[K],
  ctx: CollectContext,
) => void;

function pushRef(ctx: CollectContext, ref: Omit<AdvertisedModuleRef, "expertKey">): void {
  ctx.refs.push({ ...ref, expertKey: ctx.expertKey });
}

function compareRefs(a: AdvertisedModuleRef, b: AdvertisedModuleRef): number {
  return (
    a.fieldPath.localeCompare(b.fieldPath) ||
    a.logicalId.localeCompare(b.logicalId) ||
    a.exportName.localeCompare(b.exportName)
  );
}

/** One handler per ExpertRuntimeModuleReferenceFields root — compile-time exhaustive. */
const runtimeModuleRefRootCollectors: {
  [K in keyof ExpertRuntimeModuleReferenceFields]: RootModuleRefCollector<K>;
} = {
  prompt_builder: (pb, ctx) => {
    pushRef(ctx, {
      fieldPath: "prompt_builder.reviewerDefinitionExport",
      logicalId: "prompt_builder.reviewer_definition",
      moduleId: pb.reviewerDefinitionModuleId,
      exportName: pb.reviewerDefinitionExport,
      expectedExportKind: "object",
      sectionId: "prompt_builder.reviewerDefinitionExport",
    });
    pushRef(ctx, {
      fieldPath: "prompt_builder.systemPromptExport",
      logicalId: "prompt_builder.system_prompt",
      moduleId: pb.reviewerDefinitionModuleId,
      exportName: pb.systemPromptExport,
      expectedExportKind: "function",
      sectionId: "prompt_builder.systemPromptExport",
    });
    pushRef(ctx, {
      fieldPath: "prompt_builder.reviewPromptExport",
      logicalId: "prompt_builder.review_prompt",
      moduleId: pb.reviewerDefinitionModuleId,
      exportName: pb.reviewPromptExport,
      expectedExportKind: "function",
      sectionId: "prompt_builder.reviewPromptExport",
    });
    pushRef(ctx, {
      fieldPath: "prompt_builder.revisionCandidatesPromptExport",
      logicalId: "prompt_builder.revision_candidates_prompt",
      moduleId: pb.reviewerDefinitionModuleId,
      exportName: pb.revisionCandidatesPromptExport,
      expectedExportKind: "function",
      sectionId: "prompt_builder.revisionCandidatesPromptExport",
    });
  },

  rubric_definition: (rubric, ctx) => {
    if (rubric.moduleId && rubric.exportName) {
      pushRef(ctx, {
        fieldPath: "rubric_definition.exportName",
        logicalId: "rubric_definition",
        moduleId: rubric.moduleId,
        exportName: rubric.exportName,
        expectedExportKind: "function",
        sectionId: "rubric_definition.export",
      });
    }
  },

  validation_plugins: (plugins, ctx) => {
    for (const plugin of plugins) {
      pushRef(ctx, {
        fieldPath: `validation_plugins[${plugin.id}].exportName`,
        logicalId: `validation:${plugin.id}`,
        moduleId: plugin.moduleId,
        exportName: plugin.exportName,
        expectedExportKind: "function",
        sectionId: "validation_plugins",
      });
    }
  },

  repair_plugins: (plugins, ctx) => {
    for (const plugin of plugins) {
      pushRef(ctx, {
        fieldPath: `repair_plugins[${plugin.id}].exportName`,
        logicalId: `repair:${plugin.id}`,
        moduleId: plugin.moduleId,
        exportName: plugin.exportName,
        expectedExportKind: "function",
        sectionId: "repair_plugins",
      });
    }
  },

  normalization_plugins: (plugins, ctx) => {
    for (const plugin of plugins) {
      pushRef(ctx, {
        fieldPath: `normalization_plugins[${plugin.id}].exportName`,
        logicalId: `normalization:${plugin.id}`,
        moduleId: plugin.moduleId,
        exportName: plugin.exportName,
        expectedExportKind: "function",
        sectionId: "normalization_plugins",
      });
    }
  },

  /** Module-only root — contrary_evidence_policy.moduleId has no named export in schema. */
  contrary_evidence_policy: () => {},

  /** Module-only root — revision_candidate_policy.commentExportTypesModuleId. */
  revision_candidate_policy: () => {},

  passage_verification_policy: (policy, ctx) => {
    pushRef(ctx, {
      fieldPath: "passage_verification_policy.payloadBuilderExport",
      logicalId: "passage_verification_policy",
      moduleId: policy.payloadBuilderModuleId,
      exportName: policy.payloadBuilderExport,
      expectedExportKind: "function",
      sectionId: "passage_verification_policy.payloadBuilder",
    });
  },

  /** Module-only root — publishing_policy.rpcModuleId (rpcName is not a JS export). */
  publishing_policy: () => {},

  export_policy: (policy, ctx) => {
    if (policy.docxModuleId && policy.docxExportName) {
      pushRef(ctx, {
        fieldPath: "export_policy.docxExportName",
        logicalId: "export_policy.docx",
        moduleId: policy.docxModuleId,
        exportName: policy.docxExportName,
        expectedExportKind: "function",
        sectionId: "export_policy.docx",
      });
    }
  },
};

export const RUNTIME_MODULE_REF_ROOT_COLLECTORS = runtimeModuleRefRootCollectors;

/** Collect every export-verified module reference advertised by a runtime definition. */
export function collectAdvertisedModuleRefs(def: ExpertRuntimeDefinition): AdvertisedModuleRef[] {
  const ctx: CollectContext = { expertKey: def.expert_key, refs: [] };

  type ModuleRefRoot = keyof ExpertRuntimeModuleReferenceFields;
  const roots = Object.keys(RUNTIME_MODULE_REF_ROOT_COLLECTORS) as ModuleRefRoot[];

  for (const root of roots) {
    collectModuleRefRoot(root, def, ctx);
  }

  ctx.refs.sort(compareRefs);
  return ctx.refs;
}

function collectModuleRefRoot<R extends keyof ExpertRuntimeModuleReferenceFields>(
  root: R,
  def: ExpertRuntimeDefinition,
  ctx: CollectContext,
): void {
  RUNTIME_MODULE_REF_ROOT_COLLECTORS[root](def[root], ctx);
}

/** Export-verified section IDs present in collected refs. */
export function collectedModuleRefExportSections(
  refs: readonly AdvertisedModuleRef[],
): RuntimeModuleRefExportSection[] {
  return [...new Set(refs.map((r) => r.sectionId))].sort() as RuntimeModuleRefExportSection[];
}
