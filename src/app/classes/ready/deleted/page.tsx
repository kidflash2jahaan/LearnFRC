import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/email";
import { UNDER_13_COOKIE, UNDER_13_COOKIE_VALUE, classesVisible } from "@/lib/classes/config";

export const metadata: Metadata = {
  title: "Account deleted",
  robots: { index: false, follow: false },
};

/**
 * Where an under-13 answer on /classes/ready lands (classes-design.md
 * section 5). By now the account is deleted and the browser signed out, so
 * this page knows nothing about the person: it shows the message only on a
 * device carrying the lf_cls_age cookie and nobody signed in. The URL holds
 * nothing either.
 */
export default async function AccountDeletedPage() {
  if (!(await classesVisible())) notFound();
  const jar = await cookies();
  if (jar.get(UNDER_13_COOKIE)?.value !== UNDER_13_COOKIE_VALUE) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/classes/ready");

  return (
    <div className="nb-wrap flex min-h-[60dvh] max-w-[38rem] flex-col justify-center py-[clamp(2.5rem,6vw,4rem)]">
      <div className="nb-box nb-tilt-1 p-[clamp(1.3rem,3vw,2rem)]">
        <span className="nb-tape -top-3 left-[22%] rotate-[-3.4deg]" aria-hidden="true" />
        <p className="nb-slug">learnfrc / account deleted</p>
        <h1 className="mt-3 text-[clamp(1.6rem,1.2rem+1.6vw,2.2rem)]">We&rsquo;ve deleted this account.</h1>
        <p className="mt-4 text-[0.99rem] leading-relaxed text-graphite">
          LearnFRC accounts are for people 13 and up, so we&rsquo;ve deleted this one. Every lesson is still
          free to read without an account. If you&rsquo;re a parent or guardian and want to talk to us, write
          to{" "}
          <a href={`mailto:${PUBLIC_CONTACT_EMAIL}`} className="nb-link">
            {PUBLIC_CONTACT_EMAIL}
          </a>
          .
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/guides" className="nb-btn">
            Read the lessons
          </Link>
        </div>
      </div>
    </div>
  );
}
