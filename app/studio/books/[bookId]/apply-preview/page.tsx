import { notFound } from "next/navigation";
import { getShadowPreviewBootstrap } from "@/app/studio/actions/shadow-preview.ts";
import { StudioNav } from "../../../components/StudioShell.tsx";
import { ShadowPreviewClient } from "./ShadowPreviewClient.tsx";

export default async function StudioApplyPreviewPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const bootstrap = await getShadowPreviewBootstrap(bookId);
  if (!bootstrap.ok) notFound();

  return (
    <section className="space-y-6">
      <StudioNav bookId={bookId} />
      <div>
        <h2 className="font-serif text-2xl font-semibold">Shadow Manuscript Preview</h2>
        <p className="mt-1 text-sm text-black/55">
          Apply approved revisions to a non-canonical in-memory preview and compare with your active manuscript.
        </p>
      </div>
      <ShadowPreviewClient
        bookId={bookId}
        manifest={bootstrap.manifest}
        defaultSelectedIds={bootstrap.defaultSelectedIds}
      />
    </section>
  );
}
