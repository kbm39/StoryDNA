import { notFound } from "next/navigation";
import { getStudioBookWorkspace } from "@/lib/studio/book-workspace.ts";
import { StudioNav } from "../../../components/StudioShell.tsx";
import { getAuthorIntentPageData } from "@/app/studio/actions/author-intent.ts";
import { getConversationalIntakePageData } from "@/app/studio/actions/manuscript-brief.ts";
import { AuthorIntentClient } from "./AuthorIntentClient.tsx";
import { ConversationalIntakeClient } from "./ConversationalIntakeClient.tsx";

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

  const briefData = await getConversationalIntakePageData(bookId);

  return (
    <section className="space-y-6">
      <StudioNav bookId={bookId} />
      {briefData?.conversationalEnabled ? (
        <ConversationalIntakeClient
          bookId={bookId}
          bookTitle={workspace.title}
          versionLabel={versionLabel}
          draftBrief={briefData.draftBrief}
          submittedBrief={briefData.submittedBrief}
        />
      ) : (
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
      )}
    </section>
  );
}
