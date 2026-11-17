import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Erzeugt ein schlankes, eigenständiges Server-Bundle für das Docker-Image.
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["bullmq", "ioredis"],
};

export default nextConfig;
