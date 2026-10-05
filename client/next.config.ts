import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Visual-regression builds (e2e/) use a separate output dir so they never
  // collide with a running `next dev`. Unset → default ".next".
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // App lives in /client — keep Turbopack rooted here even if a stray
  // lockfile exists one level up.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
