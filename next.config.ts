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
    ];
  },
};

export default nextConfig;
