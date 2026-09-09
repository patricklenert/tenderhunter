import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/us", destination: "/#us", permanent: true },
      { source: "/wissen/schwellenwerte-vergabe-2025", destination: "/wissen/schwellenwerte-vergabe", permanent: true },
    ];
  },
  experimental: {
    optimizePackageImports: ["@mui/material", "@mui/icons-material", "lucide-react"],
    cpus: 2,
  },
};

export default nextConfig;
