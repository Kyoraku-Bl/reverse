import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // This app lives inside a larger monorepo checkout that has its own lockfile.
  // Pinning the root stops Turbopack from guessing the parent directory.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
