import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { splitStatements } from "../../scripts/sql.mjs";

// tests/helpers/db.ts -> tests/helpers -> tests -> <project root>
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Fixed demo identities from supabase/seed.sql. */
export const IDS = {
  admin: "00000000-0000-0000-0000-000000000001",
  staff: "00000000-0000-0000-0000-000000000002",
  dispatcher: "00000000-0000-0000-0000-000000000003",
  driver: "00000000-0000-0000-0000-000000000004",
  driver2: "00000000-0000-0000-0000-000000000005",
  customerA: "00000000-0000-0000-0000-00000000000a",
  customerB: "00000000-0000-0000-0000-00000000000b",
} as const;

export const BOOKING_A = "50000000-0000-0000-0000-000000000001";
export const BOOKING_B = "50000000-0000-0000-0000-000000000002";
export const SHIPMENT_FOR_DRIVER1 = "70000000-0000-0000-0000-000000000001";
export const SHIPMENT_FOR_DRIVER2 = "70000000-0000-0000-0000-000000000002";
export const ORDER_A = "c0000000-0000-0000-0000-000000000001";
export const ORDER_B = "c0000000-0000-0000-0000-000000000002";
export const DRAFT_PRODUCT = "40000000-0000-0000-0000-000000000003";
export const SCARCE_PRODUCT = "40000000-0000-0000-0000-000000000002";

export type Db = PGlite & { __as?: (role: string, userId?: string | null) => Promise<void> };

/**
 * Boot a real PostgreSQL (PGlite/WASM) with every migration and the seed applied.
 *
 * PGlite is genuinely PostgreSQL 18.6, so RLS, transactions, CHECK constraints
 * and triggers behave exactly as they will on Supabase. There is no mock and no
 * in-memory fake here — these tests exercise the actual policy engine.
 */
export async function bootDatabase(): Promise<Db> {
  const db = new PGlite({
    extensions: { pgcrypto, citext, btree_gist },
  }) as Db;

  const migrations = join(root, "supabase", "migrations");
  for (const f of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of splitStatements(readFileSync(join(migrations, f), "utf8"))) {
      await db.query(stmt);
    }
  }

  await db.exec(readFileSync(join(root, "supabase", "seed.sql"), "utf8"));

  /**
   * Assume a database role and, optionally, an authenticated identity.
   *
   * `set role` is what makes RLS bite. PGlite's default connection is a
   * superuser, and superusers bypass row security entirely — so without this,
   * every "isolation" test below would pass vacuously.
   */
  db.__as = async (role: string, userId?: string | null) => {
    await db.query("reset role");
    await db.query(
      "select set_config('request.jwt.claim.sub', coalesce($1, ''), false)",
      [userId ?? null]
    );
    await db.query(`set role ${role}`);
  };

  return db;
}

/** Run a query and return typed rows. */
export async function rows<T = Record<string, unknown>>(
  db: Db,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const r = await db.query(sql, params as never[]);
  return r.rows as T[];
}

/** Run a query and return the row count. */
export async function count(db: Db, sql: string, params: unknown[] = []): Promise<number> {
  const r = await rows<{ c: number }>(db, sql, params);
  return Number(r[0]?.c ?? 0);
}

/** True when the statement was rejected by the database. */
export async function rejects(db: Db, sql: string, params: unknown[] = []): Promise<boolean> {
  try {
    await db.query(sql, params as never[]);
    return false;
  } catch {
    return true;
  }
}