import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // hide the floating dev-tools indicator so local review matches production
  devIndicators: false,
  async redirects() {
    // Old department slugs that still exist in early external links
    // (pre-rename staging URLs shared on Chief Delphi etc.).
    return [
      {
        source: "/guides/electrical",
        destination: "/guides/electrical-wiring",
        permanent: true,
      },
      {
        source: "/guides/electrical/:path*",
        destination: "/guides/electrical-wiring/:path*",
        permanent: true,
      },
      {
        source: "/guides/programming-controls-sensors",
        destination: "/guides/programming-software",
        permanent: true,
      },
      {
        source: "/guides/programming-controls-sensors/:path*",
        destination: "/guides/programming-software/:path*",
        permanent: true,
      },
      // Truncated external link (the trailing "first" was lost when the URL
      // was shared). It is not generated anywhere in this repo or in the
      // content database, so a redirect is the only place it can be fixed.
      {
        source: "/guides/getting-started/what-first-and-frc-are/what-is-",
        destination: "/guides/getting-started/what-first-and-frc-are/what-is-first",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
