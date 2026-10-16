import "server-only";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { splitStatements } from "@backend/lib/sql";
import type { Db } from "@backend/lib/types";

/**
 * DATA LAYER — development/test adapter.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ THIS MODULE IS DEV AND TEST ONLY. IT IS NOT THE PRODUCTION DATABASE.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * PRODUCTION uses Supabase Postgres over the wire, reached with the
 * service-role key, and relies on the RLS policies defined in
 * backend/supabase/migrations/0007_rls.sql for tenant isolation.
 *
 * WHY AN ADAPTER AT ALL
 * The application talks to this narrow interface, never to PGlite directly.
 * That means the exact same migrations, the exact same RLS policies and the
 * exact same SQL run in dev and in production — so a policy bug cannot hide
 * until after deploy, and a migration that breaks here breaks loudly.
 *
 * WHY PGlite SPECIFICALLY
 * PGlite is real PostgreSQL 18.6 compiled to WebAssembly. It is NOT a mock.
 * Row Level Security is genuinely enforced. Transactions genuinely roll back.
 * CHECK constraints and triggers genuinely fire. The alternative — SQLite, or
 * an in-memory fake — would let every one of those diverge silently from
 * production, and the divergence always shows up as a production incident.
 *
 * TRADE-OFF, STATED PLAINLY
 * PGlite is single-connection and in-process. It is not a substitute for a real
 * database under concurrent load, and it does not give you connection pooling.
 * For local development and CI that is irrelevant. For production, use Supabase.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Persisted so bookings survive a dev-server restart, like a real database. */
const DATA_DIR = process.env.PGLITE_DATA_DIR ?? join(root, ".pglite");

let instance: Promise<Db> | null = null;

/**
 * Boot the database once per process and apply the migration chain.
 *
 * The `ready` promise is memoised rather than the value: two concurrent
 * requests during the first boot must not each replay the migrations, which
 * would race on CREATE TYPE and fail. Caching the PROMISE means the second
 * caller awaits the first one's work instead of starting its own.
 *
 * WHY THIS IS `async` AND NOT A PLAIN FUNCTION
 * It is declared to return `Promise<Db>`, so it must fail the way a promise
 * fails. When the production guard threw synchronously, `getDb().catch(...)`
 * missed the error entirely and the process died on an unhandled throw —
 * `await getDb()` inside try/catch worked, the promise form silently did not.
 * A function whose error behaviour depends on how the caller invokes it is a
 * trap. Declaring it `async` makes every path return a promise and every
 * failure a rejection.
 */
export async function getDb(): Promise<Db> {
  // Refuse in production BEFORE doing any work, and before creating a database
  // directory on a filesystem that should not be receiving one.
  assertNotProduction();

  if (!instance) {
    instance = (async () => {
      const db = await PGlite.create({
        extensions: { pgcrypto, citext, btree_gist },
        dataDir: DATA_DIR,
      });

      const migrationsDir = join(root, "supabase", "migrations");
      for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
        for (const stmt of splitStatements(readFileSync(join(migrationsDir, file), "utf8"))) {
          await db.query(stmt);
        }
      }

      // Seed is idempotent in effect: every insert uses fixed uuids, so replaying
      // it after a schema reset is a no-op conflict rather than duplicate data.
      //
      // CORRECTION — an earlier version of this file claimed "in production the
      // seed never runs". That was false, and it was the bug that hid a much
      // worse one. There was no production adapter to fall through to, so on
      // Vercel this seed ran on EVERY cold start, republishing the demo
      // shipments to anyone who loaded /track, and discarding every real booking
      // written since the last container started. Asserted above now, but also
      // gated on its own flag so the two failures cannot be conflated.
    if (process.env.SEED_DEMO_DATA === "1") {
        await db.exec(readFileSync(join(root, "supabase", "seed.sql"), "utf8"));
      }

      return db as unknown as Db;
    })();
  }

  return instance;
}

/**
 * Fail loudly rather than silently falling back to a local database in
 * production. A dev adapter quietly serving production traffic would write real
 * bookings into a file nobody backs up, and nobody would notice until the data
 * was gone.
 *
 * WHY THIS IS NOW ACTUALLY ENFORCED (it was not, for a while)
 * ----------------------------------------------------------------
 * This function existed from the start and was never called. Nothing in the
 * application referenced it, so the protection existed only as prose. Meanwhile
 * the deployed site happily booted PGlite on every Vercel cold start, replays
 * the migrations, and re-seeds the demo rows — so the public /track page
 * served two fabricated shipments to every visitor, and a real booking written
 * through /book disappeared the next time the instance was recycled.
 *
 * Verified by simulation: two consecutive "cold starts" against separate data
 * directories both reported 2 bookings at boot, and each ended at 3. The write
 * from the first container was simply not there for the second.
 *
 * THE ESCAPE HATCH, AND WHY IT IS OPT-IN
 * `ALLOW_DEV_DB_IN_PRODUCTION=1` re-enables the dev adapter deliberately, for
 * preview deploys where demo data is the entire point. It defaults to off, so
 * forgetting to set it fails closed. Reaching for it on the production domain
 * is a decision someone has to make out loud.
 */
export function assertNotProduction() {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.ALLOW_DEV_DB_IN_PRODUCTION === "1") return;

  throw new Error(
    "getDb() is the development PGlite adapter and must never serve production " +
      "traffic. Use the Supabase adapter. This guard is deliberate: silently " +
      "using a local file-backed database in production would lose data."
  );
}