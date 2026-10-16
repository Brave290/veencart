import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // The real `server-only` throws on import outside a React Server
      // Component, which is the correct behaviour in Next.js but makes any
      // module guarded by it untestable in plain Node. Aliasing to an empty
      // stub keeps the production build-time guard and makes the code testable.
      // Deleting `import "server-only"` to satisfy the runner would remove a
      // real security control — backwards.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url)
      ),
    },
  },
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