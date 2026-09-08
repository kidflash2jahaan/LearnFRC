import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { VerifyList, type VerifyRow } from "./verify-list";

/**
 * Tick lessons as verified.
 *
 * Its own page rather than another drawer on /admin: 394 rows need search and
 * filters, which is a working surface, not a readout, and the admin panel is
 * for reading numbers.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify lessons",
  robots: { index: false, follow: false },
};

export default async function VerifyPage() {
  const { user, isAdmin } = await getSession();
  if (!user) redirect("/login?next=/admin/verify");
  if (!isAdmin) redirect("/admin");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("lessons")
    .select("id, slug, title, verified_at, sort_order, modules(departments(slug, name))")
    .order("sort_order", { ascending: true });

  type Raw = {
    id: string;
    slug: string;
    title: string;
    verified_at: string | null;
    modules: { departments: { slug: string; name: string } | null } | null;
  };

  const rows: VerifyRow[] = ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    dept: r.modules?.departments?.slug ?? "unfiled",
    deptName: r.modules?.departments?.name ?? "Unfiled",
    verifiedAt: r.verified_at,
  }));

  return (
    <main className="nb-wrap py-[clamp(1.6rem,4vw,2.6rem)]">
      <p className="nb-marker">admin / verify</p>
      <h1 className="max-w-[18ch]">Tick what you have checked.</h1>
      <p className="nb-lede mt-3 max-w-[58ch]">
        Ticking a lesson stamps today&rsquo;s date and puts a verified mark on
        the page. Untick to take it back off. The public count on{" "}
        <Link href="/fact-check" className="nb-link">
          the fact-check page
        </Link>{" "}
        updates straight away.
      </p>

      <VerifyList rows={rows} />
    </main>
  );
}
