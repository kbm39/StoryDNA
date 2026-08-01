"use server";

import { requireStudioAccess } from "@/lib/studio/access.ts";
import { getActiveAuthorIntent } from "@/lib/author-intent/service.ts";
import {
  loadEditorialProfilePresentation,
  type EditorialProfilePresentationResult,
} from "@/lib/studio/editorial-profile-presentation.ts";
import { getStudioBookWorkspace } from "@/lib/studio/book-workspace.ts";

export async function getEditorialProfilePageData(
  manuscriptId: string,
): Promise<EditorialProfilePresentationResult | null> {
  await requireStudioAccess(`/studio/books/${manuscriptId}/editorial-profile`);

  const workspace = await getStudioBookWorkspace(manuscriptId);
  if (!workspace) return null;

  const versionLabel =
    workspace.activeVersionLabel ??
    (workspace.activeVersionNumber ? `v${workspace.activeVersionNumber}` : null);

  let authorIntentionSummary: string | null = null;
  if (workspace.activeVersionId) {
    const intent = await getActiveAuthorIntent({
      manuscriptId,
      manuscriptVersionId: workspace.activeVersionId,
    });
    authorIntentionSummary = intent?.author_success_definition ?? null;
  }

  return loadEditorialProfilePresentation({
    manuscriptId,
    manuscriptVersionId: workspace.activeVersionId,
    manuscriptTitle: workspace.title,
    versionLabel,
    authorIntentionSummary,
  });
}
