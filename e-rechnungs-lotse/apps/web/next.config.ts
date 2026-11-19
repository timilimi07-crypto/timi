import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  transpilePackages: ["@erl/core", "@erl/db"],
  // pdf.js lädt seinen Worker zur Laufzeit selbst – nicht bündeln.
  serverExternalPackages: ["pdfjs-dist"],
  poweredByHeader: false,
  experimental: {
    // Upload-Grenze 10 MB (+ Puffer für Formular-Overhead); die genaue Prüfung erfolgt in lib/pruefen.ts.
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
