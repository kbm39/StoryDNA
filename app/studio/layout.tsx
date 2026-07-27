import Link from "next/link";
import { requireStudioAccess } from "@/lib/studio/access.ts";
import { StudioHeader, StudioNav } from "./components/StudioShell.tsx";

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStudioAccess("/studio");

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
      <div className="mb-8 space-y-6">
        <StudioHeader />
        <StudioNav />
      </div>
      {children}
    </main>
  );
}
