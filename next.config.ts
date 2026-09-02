import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev-tools overlay so it doesn't sit on top of the UI in
  // documentation screenshots. No effect on production builds.
  devIndicators: false,
  /* config options here */
};

export default nextConfig;
