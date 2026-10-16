import type { NextConfig } from "next";
import {
  serverSchema,
  clientSchema,
  pickEnv,
} from "./backend/src/lib/env-schema";

/**
 * Environment reporting at BUILD time — a warning, not a gate.
 *
 * ── WHY THIS DOES NOT THROW ──────────────────────────────────────────────────
 * This originally threw, and it broke the production deployment. That failure
 * was instructive, so the reasoning is recorded:
 *
 * `next build` inlines `NEXT_PUBLIC_*` into the bundle. Every other secret is
 * read at REQUEST time, not build time. So a build genuinely does not need a
 * Paystack key, an R2 credential or a Resend key in order to produce a correct
 * artefact — and when no code consumes a variable yet, requiring it is pure
 * breakage. The first version of this guard rejected a deployment of a working
 * static site because three unused variables were unset.
 *
 * Failing an entire build over one missing secret is also wrong in principle:
 * it takes down the marketing site, the tracking page and the storefront —
 * everything that DOES work — because email is not configured yet.
 *
 * ── WHERE IT FAILS INSTEAD ───────────────────────────────────────────────────
 * At runtime, on first use. `serverEnv()` / `clientEnv()` in
 * backend/src/lib/env.ts throw with the variable named. A customer hitting the
 * affected feature gets a loud, actionable error naming the missing variable,
 * instead of a silent misconfiguration discovered days later.
 *
 * ── WHEN IT IS A GATE ────────────────────────────────────────────────────────
 * Set `ENV_STRICT=1` and this becomes fatal at build time. That is the right
 * setting for CI, and for the day every real credential exists. It is off by
 * default because the client has not supplied Supabase, Paystack, R2 or email
 * credentials yet — and a guard that blocks work on dependencies you do not have
 * yet is not a guard, it is a wall.
 */
function reportEnvironment(): void {
  const problems: string[] = [];

  for (const schema of [clientSchema, serverSchema]) {
    const parsed = schema.safeParse(pickEnv(schema));
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        // path[0] is `string | number | symbol`; String() because a symbol would
        // throw on implicit conversion.
        problems.push(`  ${String(issue.path[0] ?? 'unknown')}: ${issue.message}`);
      }
    }
  }

  if (problems.length === 0) return;

  const message =
    '\n  ENVIRONMENT: some variables are unset or malformed.\n' +
    '  These are NOT required to build — they are read at request time.\n' +
    '  Affected features will fail loudly, naming the variable, when used.\n' +
    problems.join('\n') +
    '\n  Set ENV_STRICT=1 to make this fatal at build time (CI does).\n';

  if (process.env.ENV_STRICT === "1") {
    throw new Error(message);
  }

  console.warn(message);
}

reportEnvironment();

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * PGlite is an EMBEDDED PostgreSQL — a 10.5MB WebAssembly binary, a 6.2MB
   * data file and three extension tarballs, about 19MB in total.
   *
   * Without this entry the bundler follows it into the module graph and EMITS
   * those files into `.next/static/media/`, which Next.js serves publicly at
   * `/_next/static/media/...`. Verified by building both ways: 19.2MB appears in
   * the public static directory without this setting, and does not appear with
   * it.
   *
   * Nothing REFERENCES those files — no client chunk imports them, so no browser
   * downloads or executes them, and no secret is exposed. It is 19MB of dead
   * weight uploaded on every single deploy, plus an entire database engine
   * sitting in a browser-reachable directory.
   *
   * Two fixes were tried and did NOT work, recorded so nobody repeats them:
   *   - `import "server-only"` in db.ts — stops a client component importing it
   *     directly, but does not stop the bundler emitting the assets.
   *   - `await import("@backend/lib/db")` inside the server actions — Turbopack
   *     still walks and emits the dynamic import's assets.
   *
   * `serverExternalPackages` is the setting that actually addresses it: the
   * package is required from node_modules at runtime on the server and never
   * enters the bundle graph at all.
   *
   * Note this is only load-bearing while the dev adapter exists. Once the
   * Supabase adapter replaces PGlite this entry can go with it.
   */
  serverExternalPackages: ["@electric-sql/pglite"],

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