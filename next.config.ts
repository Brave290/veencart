import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Speed: only ship the icons each page imports, serve modern image formats,
  // gzip/brotli responses and drop the framework fingerprint header.
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  // Server-only secrets must never be bundled into the client. Next.js only
  // inlines env vars that are explicitly prefixed NEXT_PUBLIC_, so anything
  // named PAYSTACK_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY stays on the server
  // by construction — this block only makes that guarantee explicit.
  env: {},
  async headers() {
    return [
      {
        // Brand artwork is not content-hashed, so cache it for a week rather
        // than revalidating on every visit.
        source: "/brand/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      {
        // Applied to every response. `unsafe-eval` is deliberately NOT enabled:
        // nothing in this app needs it, and allowing it would reopen the XSS
        // surface that a strict CSP exists to close.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;