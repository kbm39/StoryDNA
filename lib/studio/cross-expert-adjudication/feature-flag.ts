/** Kevin Studio-only Cross-Expert Adjudication Audit feature flag. */

import { isStudioFeatureEnabled } from "../feature-flag.ts";

export const CROSS_EXPERT_ADJUDICATION_AUDIT_FLAG_NAME =
  "CROSS_EXPERT_ADJUDICATION_AUDIT" as const;

export function isCrossExpertAdjudicationAuditEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (!isStudioFeatureEnabled()) return false;
  const raw = process.env[CROSS_EXPERT_ADJUDICATION_AUDIT_FLAG_NAME]?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return raw === "1" || raw === "true" || raw === undefined;
}
