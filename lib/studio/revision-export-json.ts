import type { StudioRevisionExport } from "./export-types.ts";

export function generateStudioRevisionJsonExport(manifest: StudioRevisionExport): string {
  return JSON.stringify(manifest, null, 2);
}

export function parseStudioRevisionJsonExport(json: string): StudioRevisionExport {
  return JSON.parse(json) as StudioRevisionExport;
}
