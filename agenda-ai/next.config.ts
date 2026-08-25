import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "pg"],
  turbopack: { root: __dirname },
};

export default nextConfig;
