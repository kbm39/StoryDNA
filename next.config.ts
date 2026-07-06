import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root — there is an unrelated lockfile in the home dir,
  // and Next would otherwise infer the wrong root for file tracing.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
