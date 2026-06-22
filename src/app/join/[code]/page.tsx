import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users, ArrowRight } from "lucide-react";
import { getSession } from "@/lib/auth";
import { joinTeamByCode } from "@/app/actions/team";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Join a team · LearnFRC",
  robots: { index: false },
};

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const { user } = await getSession();
  if (!user) redirect(`/login?next=/join/${encodeURIComponent(code)}`);

  async function doJoin() {
    "use server";
    const err = await joinTeamByCode(code);
    redirect(err ? `/teams?err=${encodeURIComponent(err)}` : "/teams?joined=1");
  }

  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 pt-24 pb-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-[var(--shadow-md)]">
        <Users className="h-7 w-7" />
      </span>
      <Badge variant="primary" className="mt-5">
        Team invite
      </Badge>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Join a team on LearnFRC</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You&apos;re about to join with code{" "}
        <span className="font-mono font-semibold tracking-widest text-foreground">{clean}</span>.
        Your account and all your progress stay exactly as they are.
      </p>
      <form action={doJoin} className="mt-6 w-full">
        <Button type="submit" variant="brand" size="lg" className="w-full">
          Join team <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
      <p className="mt-4 text-xs text-muted-foreground">
        Wrong account?{" "}
        <a href="/teams" className="text-primary underline-offset-4 hover:underline">
          Go to my team
        </a>
      </p>
    </div>
  );
}
