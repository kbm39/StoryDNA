import type { ExpertScope } from "./types.ts";

export type PlatformWriteContext = "seed" | "admin" | "system";

/**
 * Platform experts require an explicit privileged write context.
 * Do not infer authorization from user-provided data.
 */
export function assertPlatformExpertWriteAllowed(args: {
  scope: ExpertScope;
  context: PlatformWriteContext;
}): void {
  if (args.scope !== "platform") return;
  const allowed: PlatformWriteContext[] = ["seed", "admin", "system"];
  if (!allowed.includes(args.context)) {
    throw new Error("PLATFORM_EXPERT_WRITE_FORBIDDEN");
  }
}

export function isPlatformExpert(scope: ExpertScope): boolean {
  return scope === "platform";
}
