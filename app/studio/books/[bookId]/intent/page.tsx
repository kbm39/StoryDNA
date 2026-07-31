import { notFound } from "next/navigation";
import { getStudioBookWorkspace } from "@/lib/studio/book-workspace.ts";
import { StudioNav } from "../../../components/StudioShell.tsx";
import { getAuthorIntentPageData } from "@/app/studio/actions/author-intent.ts";
import { AuthorIntentClient } from "./AuthorIntentClient.tsx";

export default async function StudioAuthorIntentPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const workspace = await getStudioBookWorkspace(bookId);
  if (!workspace) notFound();

  const pageData = await getAuthorIntentPageData(bookId);
  if (!pageData) notFound();

  const versionLabel =
    workspace.activeVersionLabel ??
    (workspace.activeVersionNumber ? `v${workspace.activeVersionNumber}` : null);

  return (
    <section className="space-y-6">
      <StudioNav bookId={bookId} />
      <AuthorIntentClient
        bookId={bookId}
        bookTitle={workspace.title}
        enabled={pageData.enabled}
        eicEnabled={pageData.eicEnabled}
        activeIntent={pageData.activeIntent}
        history={pageData.history}
        planPreview={pageData.planPreview}
        versionLabel={versionLabel}
      />
    </section>
  );
}
