import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { getSession } from "@/lib/auth";
import { Rise, Glow } from "@/components/motion/primitives";
import { ForgotForm } from "./_forgot-form";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Forgot your LearnFRC password? Get a reset link by email.",
  robots: { index: false, follow: true },
};

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const { user } = await getSession();
  if (user) redirect("/dashboard");

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
            <KeyRound className="h-3.5 w-3.5 text-primary" aria-hidden />
            <span className="ac-eyebrow">Account recovery</span>
          </span>
        </Rise>

        <Rise delay={0.08} className="mt-6 w-full">
          <div className="ac-glass relative w-full overflow-hidden p-6 sm:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(37,96,230,0.22),transparent_70%)] blur-2xl"
            />
            <h1 className="text-balance text-center font-display text-2xl font-extrabold leading-[1.1] sm:text-3xl">
              Forgot your <span style={BRAND_GRADIENT}>password?</span>
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-pretty text-center text-sm leading-relaxed text-foreground/70">
              No problem. Enter your email and we&rsquo;ll send you a secure link
              to set a new one.
            </p>

            <div className="mt-6">
              <ForgotForm defaultEmail={email} />
            </div>
          </div>
        </Rise>
      </section>
    </div>
  );
}
