/** Private feature flags — safe for unit tests (no server-only). */

import { isStudioAuthorIntentEnabled } from "@/lib/author-intent/feature-flag.ts";
import { isStudioEicEnabled } from "@/lib/eic/feature-flag.ts";

export const STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_FLAG_NAME =
  "STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_ENABLED" as const;

export const STUDIO_KNOWLEDGE_DOMAIN_RECOMMENDATIONS_FLAG_NAME =
  "STUDIO_KNOWLEDGE_DOMAIN_RECOMMENDATIONS_ENABLED" as const;

export function isStudioKnowledgeDomainAnalysisFlagSet(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const raw = process.env[STUDIO_KNOWLEDGE_DOMAIN_ANALYSIS_FLAG_NAME]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function isStudioKnowledgeDomainRecommendationsFlagSet(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const raw = process.env[STUDIO_KNOWLEDGE_DOMAIN_RECOMMENDATIONS_FLAG_NAME]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/** Master gate — default off; dev-only; requires EIC + Author Intent. */
export function isStudioKnowledgeDomainAnalysisEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (!isStudioEicEnabled()) return false;
  if (!isStudioAuthorIntentEnabled()) return false;
  return isStudioKnowledgeDomainAnalysisFlagSet();
}

/** Recommendations sub-flag — requires master KDA flag. */
export function isStudioKnowledgeDomainRecommendationsEnabled(): boolean {
  if (!isStudioKnowledgeDomainAnalysisEnabled()) return false;
  return isStudioKnowledgeDomainRecommendationsFlagSet();
}

export function kdaGrantsSpecialistAccess(): boolean {
  return false;
}

export function kdaEnablesCommercialExperts(): boolean {
  return false;
}

export function kdaGeneratesRoadmap(): boolean {
  return false;
}

export function kdaAssignsGrade(): boolean {
  return false;
}

export function kdaPerformsExpertActivation(): boolean {
  return false;
}
