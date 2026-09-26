import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@cortex/schema", "@cortex/persona"],
};

export default nextConfig;
