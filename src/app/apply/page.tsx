import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/email";
import { classesVisible } from "@/lib/classes/config";

export const metadata: Metadata = {
  title: "Apply",
  robots: { index: false, follow: true },
  alternates: { canonical: "/apply" },
};

// The classes switch is read at request time, like /apply/teach: never
// prerendered, so the closed page can't outlive the switch being turned on.
export const dynamic = "force-dynamic";

/**
 * /apply. Teaching live classes is the only role LearnFRC takes applications
 * for (decided Nov 9: the marketing role this page used to take is removed
 * for now, and may come back; git history has it).
 *
 * While classes are visible it's a temporary (307) redirect to /apply/teach,
 * not a permanent one, since the page may take another role again. There's
 * no loading.tsx in this segment, so it's a real HTTP redirect. While classes
 * are hidden it says there's nothing to apply for, and never mentions
 * classes or teaching (classes-design.md section 1).
 *
 * The app's learnfrc://apply and learnfrc.com/apply links land here too.
 */
export default async function ApplyPage() {
  if (await classesVisible()) redirect("/apply/teach");

  return (
    <div className="nb-wrap max-w-[52rem] py-[clamp(2.2rem,5vw,3.8rem)]">
      <header>
        <p className="nb-marker">apply</p>
        <h1 className="text-[clamp(2.2rem,1.2rem+3.4vw,3.4rem)]">Nothing to apply for right now.</h1>
        <p className="nb-lede mt-5">
          LearnFRC isn&rsquo;t taking applications at the moment. The lessons are all still yours, free.
        </p>
      </header>
      <p className="nb-hint mt-6">
        Questions go to{" "}
        <a href={`mailto:${PUBLIC_CONTACT_EMAIL}`} className="nb-link">
          {PUBLIC_CONTACT_EMAIL}
        </a>
        .
      </p>
      <Link href="/guides" className="nb-btn mt-8">
        Back to the guides
      </Link>
    </div>
  );
}
