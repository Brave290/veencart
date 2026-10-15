import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // PGlite boots a real PostgreSQL WASM instance and replays every migration
    // before the first assertion. Slow the first time, fast afterwards, but it
    // is NOT instant — hence the generous timeouts.
    testTimeout: 120_000,
    hookTimeout: 180_000,
    // One worker: the RLS suite mutates session state (set role and
    // request.jwt.claim.sub), which must not interleave across files.
    fileParallelism: false,
    pool: "forks",
  },
});