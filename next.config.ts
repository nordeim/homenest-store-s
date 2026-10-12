import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Don't advertise the framework version (session-5 S5-5) — one less signal
  // for opportunistic scanners.
  poweredByHeader: false,
  // Hide the floating dev-tools indicator — dev-only chrome that pollutes
  // UI screenshots. No effect on production builds.
  devIndicators: false,
  // Pin file tracing to this project so the standalone server always lands
  // at .next/standalone/server.js, even when the repo sits inside a parent
  // workspace that owns its own lockfile.
  outputFileTracingRoot: path.join(import.meta.dirname, "."),
  reactStrictMode: false,
  // Next 16 dev-origin protection silently blocks dev chunks served to a
  // 127.0.0.1 origin — allow both loopback hostnames during development.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    // Product/hero art ships as self-hosted static files in public/images;
    // optimization is disabled so the standalone server needs no sharp
    // dependency and serves the same sources dev does.
    unoptimized: true,
  },
  // Security headers. CSP with per-request nonce ships via src/proxy.ts
  // (Next 16's proxy convention, the middleware successor).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
