import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // App lives in /client — keep Turbopack rooted here even if a stray
  // lockfile exists one level up.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
