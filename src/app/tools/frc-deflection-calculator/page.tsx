import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { JsonLd } from "@/components/json-ld";
import { ToolCTA } from "@/components/tools/tool-cta";
import Calculator from "./_calculator";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export const metadata: Metadata = {
  title: "FRC Structural Deflection Calculator — Tube & Arm Sag / Bending",
  description:
    "Free FRC deflection calculator. Enter beam type, material (6061-T6 aluminum or steel), cross-section, length, and load to get tip/center sag, bending stress, and a safety factor — for arms, elevators, and drivetrain rails. Beam-mechanics formulas, sourced material properties.",
  alternates: { canonical: `${SITE}/tools/frc-deflection-calculator` },
  openGraph: {
    title: "FRC Structural Deflection Calculator (Free) — LearnFRC",
    description:
      "Will your arm or rail sag? Enter geometry + load for deflection, bending stress, and a safety factor.",
    url: `${SITE}/tools/frc-deflection-calculator`,
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
          name: "FRC Structural Deflection Calculator",
          applicationCategory: "UtilityApplication",
          operatingSystem: "Web",
          url: `${SITE}/tools/frc-deflection-calculator`,
          description:
            "Free FRC beam-deflection and bending-stress calculator for arms, elevators, and rails.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          publisher: { "@type": "Organization", name: "LearnFRC", url: SITE },
        }}
      />
      <Calculator authed={!!user} />
      <ToolCTA
        related={[
          { href: "/tools/frc-tipping-calculator", label: "Tip-over & stability" },
          { href: "/blog/frc-elevator-arm-design-guide", label: "Elevator & arm design guide" },
          { href: "/guides", label: "All FRC guides" },
        ]}
      />
    </main>
  );
}
