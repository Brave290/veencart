import "server-only";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { splitStatements } from "@/lib/sql";
import type { Db } from "@/lib/types";

/**
 * DATA LAYER — development/test adapter.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ THIS MODULE IS DEV AND TEST ONLY. IT IS NOT THE PRODUCTION DATABASE.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * PRODUCTION uses Supabase Postgres over the wire, reached with the
 * service-role key, and relies on the RLS policies defined in
 * supabase/migrations/0007_rls.sql for tenant isolation.
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

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Persisted so bookings survive a dev-server restart, like a real database. */
const DATA_DIR = process.env.PGLITE_DATA_DIR ?? join(root, ".pglite");

let instance: Promise<Db> | null = null;

/**
 * Boot the database once per process and apply the migration chain.
 *
 * The `ready` promise is memoised rather than the value: two concurrent
 * requests during the first boot must not each replay seven migrations, which
 * would race on CREATE TYPE and fail. Caching the PROMISE means the second
 * caller awaits the first one's work instead of starting its own.
 */
export function getDb(): Promise<Db> {
  if (instance) return instance;

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
    // In production the seed never runs — it is demo data, explicitly labelled.
    await db.exec(readFileSync(join(root, "supabase", "seed.sql"), "utf8"));

    return db as unknown as Db;
  })();

  return instance;
}

/**
 * Fail loudly rather than silently falling back to a local database in
 * production. A dev adapter quietly serving production traffic would write real
 * bookings into a file nobody backs up, and nobody would notice until the data
 * was gone.
 */
export function assertNotProduction() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "getDb() is the development PGlite adapter and must never serve production " +
        "traffic. Use the Supabase adapter. This guard is deliberate: silently " +
        "using a local file-backed database in production would lose data."
    );
  }
}