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
    "A complete, structured guide to every department of the FIRST Robotics Competition: mechanical, CAD, programming, electrical, controls, strategy, business, outreach, and more. Free, web-grounded, and built for new teams.",
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
  // The author link points at /about, which is where the site's E-E-A-T lives
  // (who writes the lessons, what they're drafted from, how they're checked).
  authors: [{ name: "Jahaan Pardhanani", url: `${SITE_URL}/about` }],
  creator: "Jahaan Pardhanani",
  publisher: "LearnFRC",
  // NOTE: feed autodiscovery is deliberately NOT declared here as
  // `alternates.types`. Metadata is *shallow* merged, so every page that sets
  // its own `alternates` (all public pages do, for `canonical`) would replace
  // the whole object and drop the feed link — verified: it never reached the
  // homepage <head>. It's rendered as a real <link> in the body instead, which
  // React hoists into <head> on every route. Declaring it in both places
  // emits the tag twice on the pages that don't override `alternates`.
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "LearnFRC — Master FIRST Robotics Competition",
    description:
      "Structured, web-grounded guides for every FRC department. Build robots, write code, win awards.",
    siteName: "LearnFRC",
  },
  // Card type only — leaving title/description unset lets every page's own
  // OpenGraph values mirror into its Twitter card (hard-coding them here made
  // all 578 pages share the homepage card).
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Discover large-card eligibility + unclamped snippets.
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
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
        {/* Feed autodiscovery. React hoists this into <head> on every route,
            which the `alternates.types` metadata above cannot do on its own:
            metadata is shallow-merged, so every page that declares its own
            `alternates` (all of them, for canonical) would drop the feed link. */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title="LearnFRC articles"
          href={`${SITE_URL}/rss.xml`}
        />
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
                // Only URLs that are verifiably ours belong here — the public
                // source repo. No invented social profiles.
                sameAs: ["https://github.com/kidflash2jahaan/LearnFRC"],
                founder: { "@id": `${SITE_URL}/#person` },
              },
              {
                // Site-wide author identity, described in full on /about. Every
                // Article's `author` should reference this @id.
                "@type": "Person",
                "@id": `${SITE_URL}/#person`,
                name: "Jahaan Pardhanani",
                url: `${SITE_URL}/about`,
                sameAs: ["https://github.com/kidflash2jahaan"],
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
        {/* SourceCapture must stay ahead of PageViewBeacon: React flushes
            sibling passive effects in mount order, and the beacon's request is
            what carries the lf_src cookie to /api/page-view. The beacon also
            calls ensureSourceCookie() itself, so correctness no longer *depends*
            on this order — but keeping it makes the dependency legible. */}
        <SourceCapture />
        <PageViewBeacon />
      </body>
    </html>
  );
}
