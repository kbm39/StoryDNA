import "server-only";

import {
  createDraftExpertVersion,
  createExpertIdentity,
  getExpertByKey,
  getExpertVersion,
  listExpertVersions,
  recordExpertVersionEvent,
} from "./store.ts";
import { hashExpertDefinition } from "./definition-hash.ts";
import { validateExpertDefinition } from "./schema.ts";
import type { ExpertScope } from "./types.ts";
import {
  PLATFORM_EXPERT_SEED_DEFINITIONS,
  type PlatformExpertSeedSpec,
} from "./seed/platform-seeds.ts";
import { literaryAgentRegistryDefinitionV1 } from "./seed/literary-agent-registry.v1.ts";

export type { PlatformExpertSeedSpec };

const LITERARY_AGENT_SEED: PlatformExpertSeedSpec = {
  expertKey: "literary_agent",
  displayName: "Literary Agent",
  category: "literary_agent",
  department: "Editorial",
  definition: literaryAgentRegistryDefinitionV1,
};

export const PLATFORM_EXPERT_SEEDS: PlatformExpertSeedSpec[] = [
  ...PLATFORM_EXPERT_SEED_DEFINITIONS,
  LITERARY_AGENT_SEED,
];

export interface SeedPlatformExpertsResult {
  created: string[];
  skipped: string[];
  errors: Array<{ expertKey: string; error: string }>;
}

/**
 * Idempotent platform expert seeding.
 * - Creates identity if missing.
 * - Skips if a draft/active version with the same definition hash already exists.
 * - Never silently overwrites an active version.
 */
export async function seedPlatformExperts(args?: {
  createdBy?: string;
}): Promise<SeedPlatformExpertsResult> {
  const created: string[] = [];
  const skipped: string[] = [];
  const errors: Array<{ expertKey: string; error: string }> = [];
  const createdBy = args?.createdBy ?? "seed";

  for (const spec of PLATFORM_EXPERT_SEEDS) {
    try {
      const definition = spec.definition();
      const validated = validateExpertDefinition(definition);
      if (!validated.ok) {
        errors.push({ expertKey: spec.expertKey, error: validated.errors.join("; ") });
        continue;
      }

      const def = validated.definition;
      const definitionHash = hashExpertDefinition(def);

      let expert = await getExpertByKey({ expertKey: spec.expertKey, scope: "platform" });
      if (!expert) {
        expert = await createExpertIdentity({
          expertKey: spec.expertKey,
          scope: "platform" as ExpertScope,
          displayName: spec.displayName,
          category: spec.category,
          department: spec.department,
          title: def.identity.title,
          description: def.identity.description,
          writeContext: "seed",
        });
      }

      const versions = await listExpertVersions(expert.id);
      const matching = versions.find((v) => v.definition_hash === definitionHash);
      if (matching) {
        skipped.push(spec.expertKey);
        await recordExpertVersionEvent({
          expertVersionId: matching.id,
          eventType: "seed_updated",
          details: { action: "skipped", reason: "hash_match", definition_hash: definitionHash },
          createdBy,
        });
        continue;
      }

      const active = versions.find((v) => v.lifecycle_status === "active");
      if (active) {
        skipped.push(spec.expertKey);
        await recordExpertVersionEvent({
          expertVersionId: active.id,
          eventType: "seed_updated",
          details: {
            action: "skipped",
            reason: "active_version_exists",
            active_version_id: active.id,
          },
          createdBy,
        });
        continue;
      }

      const draft = await createDraftExpertVersion({
        expertId: expert.id,
        definition: def,
        createdBy,
        writeContext: "seed",
      });
      created.push(spec.expertKey);

      const row = await getExpertVersion(draft.id);
      if (row) {
        await recordExpertVersionEvent({
          expertVersionId: row.id,
          eventType: "seed_updated",
          details: { action: "created_draft", definition_hash: definitionHash },
          createdBy,
        });
      }
    } catch (e) {
      errors.push({
        expertKey: spec.expertKey,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { created, skipped, errors };
}
