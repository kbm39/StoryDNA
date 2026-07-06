import ResetForm from "./ResetForm";

export const dynamic = "force-dynamic";

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Set a new password</h1>
      <p className="mb-6 text-sm text-black/55 dark:text-white/55">
        Choose a new password for Manuscript Review.
      </p>
      <div className="rounded-xl border border-black/10 bg-paper p-6 shadow-sm dark:border-white/15 dark:bg-white/5">
        <ResetForm token={token ?? ""} />
      </div>
    </main>
  );
}
