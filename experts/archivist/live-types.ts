/**
 * Live Archivist execution types. Public UI still cannot request live mode.
 */

import type { CanonFact, CanonStore } from "@/lib/canon/types.ts";
import type { ExpertCostCall } from "@/lib/execute-expert/cost.ts";
import type {
  ExecuteExpertRequest,
  ExecuteExpertResult,
  ExpertExecutionOptions,
} from "@/lib/execute-expert/types.ts";
import type { ArchivistReview } from "./contracts.ts";

export const LIVE_ARCHIVIST_PIPELINE_PHASES = [
  "validating",
  "preparing",
  "extract_observations",
  "within_book_check",
  "series_canon_check",
  "conflict_review",
  "validation",
  "publishing",
] as const;

export type LiveArchivistPipelinePhase = (typeof LIVE_ARCHIVIST_PIPELINE_PHASES)[number];

export const LIVE_ARCHIVIST_CALL_ROLES = [
  "archivist_review",
  "archivist_review_repair",
] as const;

export type LiveArchivistCallRole = (typeof LIVE_ARCHIVIST_CALL_ROLES)[number];

export interface LiveArchivistRequest extends ExecuteExpertRequest {
  mode: "live";
  manuscript_text: string;
}

export interface LiveArchivistExecutionOptions extends ExpertExecutionOptions {
  executionMode: "live";
  /**
   * Test-only bypass of enablement flags. Never set from UI, Trigger, or executeExpert.
   * Still requires an injected mock provider — never a paid SDK call.
   */
  allowUnwiredForTests?: boolean;
  /**
   * CLI-only paid certification smoke. Never set from UI, Trigger, or executeExpert.
   * Still requires an injected Anthropic provider. Does not enable execution or Studio.
   */
  allowPaidCertificationRun?: boolean;
  provider?: import("./live-provider.ts").ArchivistLiveProvider;
  loadPriorAcceptedCanon?: (args: {
    series_id?: string | null;
    series_order?: number | null;
    canonicalContext?: CanonStore;
    prior_authoritative_manuscript_versions?: LiveArchivistRequest["prior_authoritative_manuscript_versions"];
  }) => Promise<readonly CanonFact[]> | readonly CanonFact[];
  allowRepair?: boolean;
  /** Optional fixture-owned identities. Never invents IDs. */
  entityCatalog?: import("./entity-catalog.ts").ArchivistResolvableEntity[];
}

export interface LiveArchivistExecutionResult extends ExecuteExpertResult {
  execution_mode: "live";
  live_phases: readonly LiveArchivistPipelinePhase[];
  cost_calls: readonly ExpertCostCall[];
  repair_invoked: boolean;
  repair_call_count: number;
  series_canon_check_applied: boolean;
  prior_accepted_canon_count: number;
  review: ArchivistReview | null;
}
