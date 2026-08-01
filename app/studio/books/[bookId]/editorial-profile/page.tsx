import { notFound } from "next/navigation";
import { getEditorialProfilePageData } from "@/app/studio/actions/editorial-profile.ts";
import { StudioNav } from "../../../components/StudioShell.tsx";
import { EditorialProfileClient } from "./EditorialProfileClient.tsx";

export default async function StudioEditorialProfilePage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const result = await getEditorialProfilePageData(bookId);
  if (!result) notFound();

  return (
    <section className="space-y-6">
      <StudioNav bookId={bookId} />
      <EditorialProfileClient result={result} />
    </section>
  );
}
