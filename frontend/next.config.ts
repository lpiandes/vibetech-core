import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(frontendDir, "..");

const distDir = process.env.NEXT_DIST_DIR ?? ".next";

const nextConfig: NextConfig = {
  distDir,
  outputFileTracingRoot: repoRoot,
  serverExternalPackages: ["pg", "bcryptjs"],
  eslint: {
    // This foundation sprint focuses on architecture/shell. Keep builds
    // deterministic even if lint plugins/config drift (e.g. during init).
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    // Primary routes must work even though legacy pages still exist.
    // This keeps navigation primary destinations clean while preserving compatibility.
    return [
      { source: "/company", destination: "/dashboard" },
      { source: "/analytics", destination: "/dashboard" },
      { source: "/settings", destination: "/dashboard" },
    ];
  },
};

export default nextConfig;
