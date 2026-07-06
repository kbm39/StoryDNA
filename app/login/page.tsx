import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const { next, reset } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Manuscript Review</h1>
      <p className="mb-6 text-sm text-black/55 dark:text-white/55">
        Enter your password to continue.
      </p>
      {reset && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-300">
          Password updated. Sign in with your new password.
        </p>
      )}
      <div className="rounded-xl border border-black/10 bg-paper p-6 shadow-sm dark:border-white/15 dark:bg-white/5">
        <LoginForm next={next ?? "/"} />
      </div>
    </main>
  );
}
