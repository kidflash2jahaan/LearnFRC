import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Lightweight session probe so the (static) layout's Navbar can fetch auth
// state client-side instead of forcing the whole app to render dynamically.
export async function GET() {
  const { user, profile, isAdmin } = await getSession();
  return NextResponse.json(
    {
      authed: !!user,
      email: user?.email ?? null,
      profile,
      isAdmin,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
