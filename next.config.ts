import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,
  async redirects() {
    return [
      { source: "/us", destination: "/#us", statusCode: 301 },
      { source: "/wissen/schwellenwerte-vergabe-2025", destination: "/wissen/schwellenwerte-vergabe", statusCode: 301 },
    ];
  },
  experimental: {
    optimizePackageImports: ["@mui/material", "@mui/icons-material", "lucide-react"],
    cpus: 2,
  },
};

export default nextConfig;
