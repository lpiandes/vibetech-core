import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // This foundation sprint focuses on architecture/shell. Keep builds
    // deterministic even if lint plugins/config drift (e.g. during init).
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    // Primary routes must work even though legacy pages still exist.
    // This keeps navigation primary destinations clean while preserving compatibility.
    return [
      { source: "/knowledge", destination: "/dashboard" },
      { source: "/company", destination: "/dashboard" },
      { source: "/analytics", destination: "/dashboard" },
      { source: "/settings", destination: "/dashboard" },
    ];
  },
};

export default nextConfig;
