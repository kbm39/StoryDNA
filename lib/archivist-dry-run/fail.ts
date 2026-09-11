import { ARCHIVIST_DRY_RUN_BANNERS, type ArchivistDryRunSnapshot, type ArchivistDryRunUiFailure } from "./types.ts";

export function failArchivistDryRun(
  error_code: ArchivistDryRunUiFailure["error_code"],
  error_message: string,
  extras?: Partial<Pick<ArchivistDryRunUiFailure, "pin" | "scenario">>,
): ArchivistDryRunUiFailure {
  return {
    ok: false,
    error_code,
    error_message,
    banners: ARCHIVIST_DRY_RUN_BANNERS,
    ...extras,
  };
}

export function pinChanged(
  before: ArchivistDryRunSnapshot,
  after: ArchivistDryRunSnapshot,
): boolean {
  return (
    before.manuscript_id !== after.manuscript_id ||
    before.manuscript_version_id !== after.manuscript_version_id ||
    before.content_hash !== after.content_hash
  );
}
