import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { JsonLd } from "@/components/json-ld";
import { ToolCTA } from "@/components/tools/tool-cta";
import Calculator from "./_calculator";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export const metadata: Metadata = {
  title: "FRC Robot Tip-Over Calculator — Center of Gravity & Stability",
  description:
    "Free FRC tip-over and traction-stability calculator. Enter your track width, wheelbase, and center-of-gravity height to find the maximum turning acceleration and ramp/incline angle before your robot tips — plus a traction-limited pushing-force estimate. Exact rigid-body statics.",
  alternates: { canonical: `${SITE}/tools/frc-tipping-calculator` },
  openGraph: {
    title: "FRC Tip-Over & Stability Calculator (Free) — LearnFRC",
    description:
      "Will your robot tip? Enter track width, wheelbase, and CoG height for tip acceleration and ramp angle.",
    url: `${SITE}/tools/frc-tipping-calculator`,
    type: "website",
  },
};

export default async function Page() {
  const { user } = await getSession();
  return (
    <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-32">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "FRC Robot Tip-Over & Stability Calculator",
          applicationCategory: "UtilityApplication",
          operatingSystem: "Web",
          url: `${SITE}/tools/frc-tipping-calculator`,
          description:
            "Free FRC tip-over and traction-stability calculator from track width, wheelbase, and center-of-gravity height.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          publisher: { "@type": "Organization", name: "LearnFRC", url: SITE },
        }}
      />
      <Calculator authed={!!user} />
      <ToolCTA
        related={[
          { href: "/tools/frc-current-budget", label: "Current & brownout checker" },
          { href: "/tools/frc-wire-gauge-calculator", label: "Wire gauge & voltage drop" },
          { href: "/guides", label: "All FRC guides" },
        ]}
      />
    </main>
  );
}
