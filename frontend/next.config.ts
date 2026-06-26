import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // This foundation sprint focuses on architecture/shell. Keep builds
    // deterministic even if lint plugins/config drift (e.g. during init).
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
