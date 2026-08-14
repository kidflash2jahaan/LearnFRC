import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, ShieldCheck, Clock } from "lucide-react";
import { getSession } from "@/lib/auth";
import { Rise, Glow } from "@/components/motion/primitives";
import { PasswordForm } from "./_password-form";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export default async function UpdatePasswordPage() {
  // The recovery link (via /auth/confirm) mints a session before landing here.
  // No session ⇒ the user opened this page directly or the link expired.
  const { user } = await getSession();

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "560px", pos: { left: "-180px", top: "-200px" }, color: "#8bbcff", opacity: 0.6 },
          { size: "520px", pos: { right: "-160px", top: "-120px" }, color: "#6ff0ea", opacity: 0.5, delay: 2 },
          { size: "480px", pos: { left: "30%", bottom: "-220px" }, color: "#c8b6ff", opacity: 0.4, delay: 4 },
        ]}
      />

      <section className="mx-auto flex min-h-[100svh] max-w-md flex-col items-center justify-center px-4 pb-16 pt-28 sm:px-6">
        <Rise className="flex justify-center">
          <span className="ac-chip inline-flex items-center gap-2">
            {user ? (
              <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
            ) : (
              <Clock className="h-3.5 w-3.5 text-primary" aria-hidden />
            )}
            <span className="ac-eyebrow">
              {user ? "Choose a new password" : "Link expired"}
            </span>
          </span>
        </Rise>

        <Rise delay={0.08} className="mt-6 w-full">
          <div className="ac-glass relative w-full overflow-hidden p-6 sm:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(37,96,230,0.22),transparent_70%)] blur-2xl"
            />

            {user ? (
              <>
                <span
                  className="ac-badge mx-auto flex h-12 w-12 items-center justify-center"
                  style={{ "--a": "#2560e6" } as CSSProperties}
                >
                  <KeyRound className="h-6 w-6" aria-hidden />
                </span>
                <h1 className="mt-4 text-balance text-center font-display text-2xl font-extrabold leading-[1.1] sm:text-3xl">
                  Set a <span style={BRAND_GRADIENT}>new password</span>
                </h1>
                <p className="mx-auto mt-2 max-w-sm text-pretty text-center text-sm leading-relaxed text-foreground/70">
                  Almost done — pick a password you&rsquo;ll remember. You&rsquo;ll
                  be signed in right after.
                </p>
                <div className="mt-6">
                  <PasswordForm />
                </div>
              </>
            ) : (
              <div className="text-center">
                <span
                  className="ac-badge mx-auto flex h-12 w-12 items-center justify-center"
                  style={{ "--a": "var(--destructive)" } as CSSProperties}
                >
                  <Clock className="h-6 w-6" aria-hidden />
                </span>
                <h1 className="mt-4 font-display text-2xl font-extrabold">
                  This link has expired
                </h1>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-foreground/70">
                  Password-reset links are single-use and expire after an hour
                  for your security. Request a fresh one and it&rsquo;ll land in
                  your inbox within a minute.
                </p>
                <Link href="/forgot-password" className="ac-btn mt-6 text-sm">
                  Send a new reset link
                </Link>
              </div>
            )}
          </div>
        </Rise>
      </section>
    </div>
  );
}
