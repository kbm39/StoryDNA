/** Sanitized filenames for Studio revision exports. */

function safeBase(title: string): string {
  return title.replace(/[^\w \-]+/g, "").trim().replace(/\s+/g, "-") || "manuscript";
}

export function studioRevisionExportDateStamp(iso: string): string {
  return iso.slice(0, 10);
}

export function buildStudioRevisionJsonFilename(title: string, generatedAt: string): string {
  return `${safeBase(title)}-accepted-revisions-${studioRevisionExportDateStamp(generatedAt)}.json`;
}

export function buildStudioRevisionMarkdownFilename(title: string, generatedAt: string): string {
  return `${safeBase(title)}-accepted-revisions-${studioRevisionExportDateStamp(generatedAt)}.md`;
}

export function buildStudioRevisionPlanningJsonFilename(title: string, generatedAt: string): string {
  return `${safeBase(title)}-planning-revisions-${studioRevisionExportDateStamp(generatedAt)}.json`;
}

export function buildStudioRevisionPlanningMarkdownFilename(title: string, generatedAt: string): string {
  return `${safeBase(title)}-planning-revisions-${studioRevisionExportDateStamp(generatedAt)}.md`;
}

export const PRIVATE_EXPORT_CACHE_CONTROL = "private, no-store" as const;
