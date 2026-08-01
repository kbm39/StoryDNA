/** Amendment 002 feature flags — safe for unit tests (no server-only). */

import { isStudioConversationalIntelligenceEnabled } from "@/lib/conversational-intelligence/feature-flag.ts";

export const STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING_FLAG_NAME =
  "STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING_ENABLED" as const;

export const STUDIO_PEU_ANTI_ECHO_FLAG_NAME = "STUDIO_PEU_ANTI_ECHO_ENABLED" as const;

export const STUDIO_PEU_PROVIDER_SYNTHESIS_FLAG_NAME =
  "STUDIO_PEU_PROVIDER_SYNTHESIS_ENABLED" as const;

function envFlag(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function isStudioProgressiveEditorialUnderstandingFlagSet(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return envFlag(STUDIO_PROGRESSIVE_EDITORIAL_UNDERSTANDING_FLAG_NAME);
}

/** Requires all four prior flags: studio, author intent, EIC, conversational intake, CI. */
export function isStudioProgressiveEditorialUnderstandingEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (!isStudioConversationalIntelligenceEnabled()) return false;
  return isStudioProgressiveEditorialUnderstandingFlagSet();
}

export function isStudioPeuAntiEchoEnabled(): boolean {
  if (!isStudioProgressiveEditorialUnderstandingEnabled()) return false;
  return envFlag(STUDIO_PEU_ANTI_ECHO_FLAG_NAME);
}

export function isStudioPeuProviderSynthesisEnabled(): boolean {
  if (!isStudioProgressiveEditorialUnderstandingEnabled()) return false;
  return envFlag(STUDIO_PEU_PROVIDER_SYNTHESIS_FLAG_NAME);
}
