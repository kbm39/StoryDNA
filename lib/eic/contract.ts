/** Versioned contract: storydna_eic_editorial_plan@v1 */

export const EIC_PLAN_CONTRACT_VERSION = "storydna_eic_editorial_plan@v1" as const;

export const EIC_PLAN_STATUSES = [
  "blocked_missing_intent",
  "draft",
  "awaiting_author_confirmation",
  "confirmed",
  "superseded",
  "cancelled",
] as const;

export type EicPlanStatus = (typeof EIC_PLAN_STATUSES)[number];

export type ExpertPlanTier =
  | "required"
  | "recommended"
  | "optional"
  | "declined"
  | "unavailable"
  | "experimental"
  | "blocked";

export type ExpertPlanEntry = {
  readonly expert_key: string;
  readonly display_name: string;
  readonly tier: ExpertPlanTier;
  readonly reason: string;
  readonly launchable: boolean;
  readonly estimated_runtime: string | null;
  readonly estimated_cost: string | null;
};

export type EicEditorialPlanV1 = {
  readonly contract_version: typeof EIC_PLAN_CONTRACT_VERSION;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly author_intent_id: string;
  readonly intent_type: string;
  readonly required_experts: readonly ExpertPlanEntry[];
  readonly recommended_experts: readonly ExpertPlanEntry[];
  readonly optional_experts: readonly ExpertPlanEntry[];
  readonly declined_experts: readonly ExpertPlanEntry[];
  readonly unavailable_experts: readonly ExpertPlanEntry[];
  readonly experimental_experts: readonly ExpertPlanEntry[];
  readonly blocked_experts: readonly ExpertPlanEntry[];
  readonly recommendation_reasons: Readonly<Record<string, string>>;
  readonly estimated_cost_range: string | null;
  readonly estimated_runtime_range: string | null;
  readonly domain_coverage: readonly string[];
  readonly series_context: string | null;
  readonly publication_context: string | null;
};

export type EicEditorialPlanRecord = {
  readonly id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly author_intent_id: string;
  readonly contract_version: typeof EIC_PLAN_CONTRACT_VERSION;
  readonly plan: EicEditorialPlanV1;
  readonly status: EicPlanStatus;
  readonly created_by: string;
  readonly superseded_by_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

export type EicPlanGateResult =
  | { readonly allowed: true; readonly plan: EicEditorialPlanV1; readonly planId: string }
  | {
      readonly allowed: false;
      readonly reason:
        | "gate_disabled"
        | "missing_intent"
        | "invalid_intent"
        | "version_mismatch"
        | "unknown_expert"
        | "requested_unavailable"
        | "conflicting_plan";
      readonly message: string;
    };

export type EicGateBlockReason = Extract<
  EicPlanGateResult,
  { allowed: false }
>["reason"];
