import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono, Baloo_2 } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ScrollProgress } from "@/components/scroll-progress";
import { JsonLd } from "@/components/json-ld";
import { PresenceBeacon } from "@/components/presence-beacon";
import { PageViewBeacon } from "@/components/page-view-beacon";
import { SourceCapture } from "@/components/source-capture";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  weight: ["500", "600", "700"],
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const jbmono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jbmono",
  display: "swap",
});
// Rounded display face for the Arena Clay homepage (light glass + clay).
const baloo = Baloo_2({
  subsets: ["latin"],
  variable: "--font-baloo",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "LearnFRC — Master FIRST Robotics Competition",
    template: "%s · LearnFRC",
  },
  description:
    "The complete, structured guide to mastering every department of the FIRST Robotics Competition — mechanical, CAD, programming, electrical, controls, strategy, business, outreach and more. Free, web-grounded, and built for new teams.",
  keywords: [
    "FRC",
    "FIRST Robotics Competition",
    "robotics",
    "WPILib",
    "swerve drive",
    "Onshape",
    "Impact Award",
    "FRC programming",
    "learn robotics",
    "STEM",
  ],
  authors: [{ name: "Jahaan Pardhanani" }],
  creator: "Jahaan Pardhanani",
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "LearnFRC — Master FIRST Robotics Competition",
    description:
      "Structured, web-grounded guides for every FRC department. Build robots, write code, win awards.",
    siteName: "LearnFRC",
  },
  twitter: {
    card: "summary_large_image",
    title: "LearnFRC — Master FIRST Robotics Competition",
    description:
      "Structured, web-grounded guides for every FRC department. Build robots, write code, win awards.",
  },
  robots: { index: true, follow: true },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  themeColor: "#e6eefb",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      data-theme="arena"
      className={`${grotesk.variable} ${inter.variable} ${jbmono.variable} ${baloo.variable} h-full`}
    >
      <body className="flex min-h-full flex-col antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('perf-mode')==='on')document.documentElement.dataset.perf='on';}catch(e){}`,
          }}
        />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                "@id": `${SITE_URL}/#website`,
                url: SITE_URL,
                name: "LearnFRC",
                description:
                  "Free, structured guides for every department of the FIRST Robotics Competition.",
                publisher: { "@id": `${SITE_URL}/#org` },
              },
              {
                "@type": "Organization",
                "@id": `${SITE_URL}/#org`,
                name: "LearnFRC",
                url: SITE_URL,
                logo: `${SITE_URL}/opengraph-image`,
                description:
                  "A free, complete learning platform for the FIRST Robotics Competition.",
              },
            ],
          }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-[var(--shadow-lg)]"
        >
          Skip to content
        </a>
        <Providers>
          <ScrollProgress />
          <Navbar />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
        </Providers>
        <Analytics />
        <SpeedInsights />
        <PresenceBeacon />
        <PageViewBeacon />
        <SourceCapture />
      </body>
    </html>
  );
}
