import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @aicss/react ships TypeScript source and CSS modules, so Next must compile it.
  transpilePackages: ["@aicss/react"],
};

export default nextConfig;
