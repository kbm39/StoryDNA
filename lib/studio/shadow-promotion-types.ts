/** Studio shadow promotion contract (K6). */

import type { ShadowConflictResolution } from "./shadow-types.ts";

export const STUDIO_SHADOW_PROMOTION_VERSION = "studio_shadow_promotion@v1" as const;

export const STUDIO_SHADOW_PROMOTION_LABEL_PREFIX = "Studio shadow promotion" as const;

export type ShadowPromotionGateStatus = "ready" | "blocked" | "stale";

export interface StudioShadowPromotionRequest {
  readonly manuscriptId: string;
  readonly expectedActiveVersionId: string | null;
  readonly expectedDecisionSnapshotHash: string;
  readonly expectedShadowHash: string;
  readonly selectedRevisionIds: readonly string[];
  readonly conflictResolutions: readonly ShadowConflictResolution[];
  readonly confirmation: {
    readonly acknowledgedNonActive: boolean;
    readonly acknowledgedCanonicalUnchanged: boolean;
    readonly promotionLabel?: string | null;
  };
}

export interface StudioShadowPromotionGateResult {
  readonly status: ShadowPromotionGateStatus;
  readonly blockingReasons: readonly string[];
  readonly readyForPromotion: boolean;
}

export interface StudioShadowPromotionResult {
  readonly promotionVersion: string;
  readonly promotionId: string;
  readonly promotedAt: string;
  readonly manuscriptVersionId: string;
  readonly versionNumber: number;
  readonly label: string;
  readonly sourceActiveVersionId: string | null;
  readonly shadowHash: string;
  readonly wordCount: number;
  readonly characterCount: number;
  readonly appliedRevisionCount: number;
  readonly integrity: {
    readonly canonicalManuscriptModified: false;
    readonly currentVersionIdUnchanged: true;
    readonly promotedVersionIsActive: false;
    readonly sourceVersionStillActive: boolean;
  };
}
