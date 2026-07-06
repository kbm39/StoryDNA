import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { logout } from "@/app/login/actions";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Manuscript Review",
  description: "Review and revise novel manuscripts",
};

/** True when password protection is on and a valid session cookie is present. */
async function isAuthed(): Promise<boolean> {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) return false;
  const token = (await cookies()).get("ms_session")?.value ?? "";
  return token.length === secret.length && token === secret;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authed = await isAuthed();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          data-* attributes onto <body> before React hydrates, which would
          otherwise trip a harmless hydration mismatch warning. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <header className="sticky top-0 z-20 border-b border-black/10 bg-background/85 backdrop-blur dark:border-white/10">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
            <Link
              href="/"
              className="font-serif text-lg font-semibold tracking-tight hover:text-accent"
            >
              Manuscript Review
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/" className="text-black/55 hover:text-accent dark:text-white/55">
                All works
              </Link>
              {authed && (
                <form action={logout}>
                  <button
                    type="submit"
                    className="text-black/55 hover:text-accent dark:text-white/55"
                  >
                    Log out
                  </button>
                </form>
              )}
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
