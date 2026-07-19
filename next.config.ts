import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["@mui/material", "@mui/icons-material", "lucide-react"],
    cpus: 2,
  },
};

export default nextConfig;
