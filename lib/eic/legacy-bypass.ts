/**
 * Legacy direct-launch bypass documentation.
 *
 * When STUDIO_AUTHOR_INTENT_ENABLED and STUDIO_EIC_ENABLED are off (default),
 * existing Literary Agent and Military Expert launch paths operate unchanged.
 * This bypass is intentional for Phase 1A backward compatibility and will be
 * removed in a future phase after author intent adoption.
 */

export const LEGACY_DIRECT_LAUNCH_BYPASS = Object.freeze({
  description:
    "Expert launch server actions bypass the EIC plan gate when feature flags are off.",
  paths: [
    "app/studio/actions/expert-execution.ts → launchStudioExpertReview",
    "app/actions/editorial-workflows.ts → startLiteraryAgentPublishingWorkflow",
    "lib/editorial-workflow/start-literary-agent-workflow.ts",
    "lib/editorial-workflow/start-military-expert-studio-workflow.ts",
  ],
  removal_phase: "Post Phase 1A adoption — requires separate PRD",
});
