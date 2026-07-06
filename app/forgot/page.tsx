import ForgotForm from "./ForgotForm";

export const dynamic = "force-dynamic";

export default function ForgotPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Forgot password</h1>
      <p className="mb-6 text-sm text-black/55 dark:text-white/55">
        Reset your Manuscript Review password.
      </p>
      <div className="rounded-xl border border-black/10 bg-paper p-6 shadow-sm dark:border-white/15 dark:bg-white/5">
        <ForgotForm />
      </div>
    </main>
  );
}
