import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // hide the floating dev-tools indicator so local review matches production
  devIndicators: false,
};

export default nextConfig;
