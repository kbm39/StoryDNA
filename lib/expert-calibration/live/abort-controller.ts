import type { AbortControllerLike, LiveCalibrationAbortDependencies } from "./contracts.ts";

class TimeoutAbortController implements AbortControllerLike {
  readonly signal: AbortSignal;
  private readonly controller: AbortController;
  private readonly timer: ReturnType<typeof setTimeout>;

  constructor(timeoutMs: number) {
    this.controller = new AbortController();
    this.signal = this.controller.signal;
    this.timer = setTimeout(() => {
      this.controller.abort("timeout");
    }, timeoutMs);
  }

  abort(reason?: string): void {
    clearTimeout(this.timer);
    this.controller.abort(reason);
  }
}

export function createAbortController(
  timeoutMs: number,
  dependencies: LiveCalibrationAbortDependencies = {},
): AbortControllerLike {
  const factory =
    dependencies.createAbortController ??
    ((ms: number) => new TimeoutAbortController(ms));
  return factory(timeoutMs);
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === "AbortError" || error.message.includes("abort");
  }
  return false;
}

export { TimeoutAbortController };
