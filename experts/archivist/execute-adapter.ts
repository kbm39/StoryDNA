/**
 * Disabled Archivist Execute Expert adapter — dry-run harness only.
 * execution_wired remains false. Runtime remains disabled. Not Studio-selectable.
 * Does not import live model SDKs or persist accepted canon.
 */

import { ARCHIVIST_WORKFLOW_PHASES, ARCHIVIST_WORKFLOW_TYPE } from "@/lib/execute-expert/types.ts";
import { DryRunCanonWriteForbiddenError } from "@/lib/execute-expert/dry-run-guard.ts";
import type { ExpertExecuteAdapter } from "@/lib/execute-expert/types.ts";
import {
  ARCHIVIST_DEFINITION_VERSION,
  ARCHIVIST_DISPLAY_NAME,
  ARCHIVIST_EXPERT_KEY,
  ARCHIVIST_VERSION,
  type ArchivistFinding,
  type ArchivistReview,
} from "./contracts.ts";
import { fixtureForArchivistDryRun } from "./dry-run-scenarios.ts";
import { normalizeArchivistReview } from "./normalization.ts";
import { parseArchivistReview } from "./parsing.ts";
import { validateArchivistReview } from "./validation.ts";
import { ARCHIVIST_CONSTITUTION } from "./constitution.ts";
import { archivistRuntimeDefinition } from "./runtime-definition.ts";
import { archivistRegistryDefinitionV1 } from "./registry-definition.ts";

export function assertArchivistRemainsUnwired(): void {
  if (ARCHIVIST_CONSTITUTION.execution_wired) {
    throw new Error("Archivist execution_wired must remain false");
  }
  if (ARCHIVIST_CONSTITUTION.studio_selectable) {
    throw new Error("Archivist studio_selectable must remain false");
  }
  if (archivistRuntimeDefinition().enabled) {
    throw new Error("Archivist runtime.enabled must remain false");
  }
  if (archivistRegistryDefinitionV1().registry_metadata?.execution_wired) {
    throw new Error("Archivist registry execution_wired must remain false");
  }
}

export function persistAcceptedCanonFromDryRun(): never {
  throw new DryRunCanonWriteForbiddenError("dry_run cannot persist accepted canon");
}

export function persistAcceptedBibleRevisionFromDryRun(): never {
  throw new DryRunCanonWriteForbiddenError("dry_run cannot create an accepted Series Bible revision");
}

function findingReadModel(finding: ArchivistFinding) {
  return {
    id: finding.id,
    issue_type: finding.issue_type,
    classification: finding.classification,
    severity: finding.severity,
    confidence: finding.confidence,
    explanation: finding.explanation,
    suggested_resolution: finding.suggested_resolution,
    current_evidence: finding.current_evidence,
    conflicting_evidence: finding.conflicting_evidence,
  };
}

function bindReviewIdentity(review: ArchivistReview, manuscript: {
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  series_id?: string | null;
}): ArchivistReview {
  return {
    ...review,
    manuscript_id: manuscript.manuscript_id,
    manuscript_version_id: manuscript.manuscript_version_id,
    content_hash: manuscript.content_hash,
    series_id: manuscript.series_id ?? review.series_id ?? null,
    generation: {
      ...review.generation,
      provider: "none",
      model: "none",
    },
  };
}

export function createArchivistExecuteAdapter(): ExpertExecuteAdapter {
  assertArchivistRemainsUnwired();
  return {
    expert_key: ARCHIVIST_EXPERT_KEY,
    supports_dry_run: true,
    supports_live: false,
    phases: ARCHIVIST_WORKFLOW_PHASES,
    async runDryRun({ request }) {
      const fixture = fixtureForArchivistDryRun(request.dry_run_scenario);
      const bound = bindReviewIdentity(fixture.review, {
        manuscript_id: request.manuscript_id,
        manuscript_version_id: request.manuscript_version_id,
        content_hash: request.content_hash,
        series_id: request.series_id,
      });
      const parsed = parseArchivistReview(JSON.stringify(bound));
      if (!parsed.ok) {
        return {
          expert_version: ARCHIVIST_VERSION,
          workflow_type: ARCHIVIST_WORKFLOW_TYPE,
          workflow_definition_version: ARCHIVIST_DEFINITION_VERSION,
          findings: [],
          candidate_canon_delta: [],
          entity_ambiguities: [],
          validation: { ok: false, errors: [parsed.message] },
          read_model: {
            expert_display_name: ARCHIVIST_DISPLAY_NAME,
            expert_key: ARCHIVIST_EXPERT_KEY,
            execution_mode: "dry_run",
            status: "failed",
            cost_usd: 0,
            cost_status: "exact",
            findings: [],
            canon_candidates: [],
            entity_ambiguities: [],
            validation_ok: false,
          },
        };
      }

      const normalized = normalizeArchivistReview(parsed.review);
      const validation = validateArchivistReview(normalized, {
        manuscriptText: fixture.manuscript_text,
      });

      return {
        expert_version: ARCHIVIST_VERSION,
        workflow_type: ARCHIVIST_WORKFLOW_TYPE,
        workflow_definition_version: ARCHIVIST_DEFINITION_VERSION,
        findings: normalized.findings,
        candidate_canon_delta: normalized.canon_delta,
        entity_ambiguities: normalized.entity_ambiguities,
        validation,
        read_model: {
          expert_display_name: ARCHIVIST_DISPLAY_NAME,
          expert_key: ARCHIVIST_EXPERT_KEY,
          execution_mode: "dry_run",
          status: validation.ok ? "completed" : "failed",
          cost_usd: 0,
          cost_status: "exact",
          findings: normalized.findings.map(findingReadModel),
          canon_candidates: normalized.canon_delta,
          entity_ambiguities: normalized.entity_ambiguities,
          validation_ok: validation.ok,
        },
      };
    },
  };
}
