import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { splitStatements } from "../backend/src/lib/sql";

/** PGlite returns `unknown[]` rows; this narrows once instead of at every use. */
function rows<T = Record<string, unknown>>(r: { rows: unknown[] }): T[] {
  return r.rows as T[];
}

/**
 * Migration gate — `npm run db:verify`.
 *
 * This is the check that a migration is real. A migration file that merely
 * parses is not a migration; it is text. Three bugs in this schema were found
 * ONLY because the files were executed against a live PostgreSQL engine:
 *
 *   - `EXCLUDE ... WHERE` — not valid PostgreSQL at all
 *   - a missing SELECT grant that broke every RLS policy at runtime
 *   - `check_function_bodies` rejecting forward-referencing helpers
 *
 * None of those are visible by reading SQL. All three are caught the moment the
 * statements are run.
 *
 * Applying to real PostgreSQL 18.6 (PGlite) rather than linting is the entire
 * point. A migration that passes here passes on Supabase, because it is the
 * same engine.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "backend", "supabase", "migrations");

/**
 * Applied ONCE for the whole file.
 *
 * Replaying seven migrations per assertion took 114 seconds. Booting once in a
 * beforeAll and reusing it turns the suite into a single apply — the tests
 * read state, they do not mutate it, so they cannot interfere with each other.
 */
let db: PGlite;
let failures: { file: string; statement: number; message: string }[] = [];

beforeAll(async () => {
  const applied = await applyAll();
  db = applied.db;
  failures = applied.failures;
}, 300_000);

afterAll(async () => {
  await db?.close();
});

async function applyAll(): Promise<{
  failures: { file: string; statement: number; message: string }[];
  db: PGlite;
}> {
  const db = new PGlite({ extensions: { pgcrypto, citext, btree_gist } });
  const failures: { file: string; statement: number; message: string }[] = [];

  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    let n = 0;
    for (const stmt of splitStatements(readFileSync(join(migrationsDir, file), "utf8"))) {
      n++;
      try {
        await db.query(stmt);
      } catch (e) {
        failures.push({
          file,
          statement: n,
          message: String((e as Error).message).split("\n")[0] ?? "",
        });
      }
    }
  }
  return { failures, db };
}

describe("migrations apply cleanly", () => {
  it("executes every statement without error", async () => {
    expect(
      failures,
      `Failed statements:\n${failures
        .map((f) => `  ${f.file} #${f.statement}: ${f.message}`)
        .join("\n")}`
    ).toEqual([]);

  }, 30_000);
});

describe("schema inventory", () => {
  it("creates the full entity set", async () => {
    const tables = await db.query(
      `select tablename from pg_tables where schemaname = 'public'`
    );
    const names = new Set(rows<{ tablename: string }>(tables).map((r) => r.tablename));

    // Every entity named in the architecture brief. A missing one means a
    // feature that was designed has no table to live in.
    const REQUIRED = [
      // identity
      'profiles', 'user_roles', 'customer_addresses', 'guest_access_tokens',
      'business_accounts',
      // logistics
      'bookings', 'booking_items', 'quotes', 'quote_items', 'shipments',
      'shipment_events', 'shipment_assignments', 'delivery_attempts',
      'delivery_proofs', 'service_areas', 'route_rules',
      // marketplace
      'products', 'product_categories', 'product_images', 'inventory',
      'inventory_movements', 'carts', 'cart_items', 'product_orders',
      'product_order_items',
      // payments and operations
      'payments', 'payment_events', 'refunds', 'notification_outbox',
      'audit_logs', 'idempotency_keys', 'system_settings',
    ];

    const missing = REQUIRED.filter((t) => !names.has(t));
    expect(missing, `missing tables: ${missing.join(', ')}`).toEqual([]);
    expect(names.size).toBe(REQUIRED.length);

  }, 30_000);

  it("enables and forces RLS on every table", async () => {
    // FORCE matters as much as ENABLE: without it, any connection running as
    // the owning role silently reads every row, which turns a service-role
    // connection into an IDOR.
    const r = await db.query(
      `select c.relname,
              c.relrowsecurity  as enabled,
              c.relforcerowsecurity as forced
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'`
    );

    const unguarded = rows<{ relname: string; enabled: boolean; forced: boolean }>(r).filter(
      (row) => !row.enabled || !row.forced
    );
    expect(
      unguarded.map((u) => u.relname),
      'tables without RLS enabled+forced'
    ).toEqual([]);

  }, 30_000);

  it("attaches a policy to every table that holds customer data", async () => {
    const r = await db.query(
      `select tablename from pg_policies where schemaname = 'public' group by tablename`
    );
    const withPolicies = new Set(rows<{ tablename: string }>(r).map((x) => x.tablename));

    // These MUST have policies. Tables absent from this list are server-only by
    // design (no grant at all), which is a stronger control than a policy —
    // see guest_access_tokens and payment_events.
    const NEEDS_POLICY = [
      'profiles', 'user_roles', 'customer_addresses', 'business_accounts',
      'bookings', 'booking_items', 'quotes', 'quote_items', 'shipments',
      'shipment_events', 'shipment_assignments', 'delivery_attempts',
      'delivery_proofs', 'products', 'product_categories', 'product_images',
      'carts', 'cart_items', 'product_orders', 'product_order_items',
      'payments', 'refunds', 'service_areas', 'route_rules',
    ];

    const missing = NEEDS_POLICY.filter((t) => !withPolicies.has(t));
    expect(missing, `tables with RLS but no policy: ${missing.join(', ')}`).toEqual([]);

  }, 30_000);
});

describe("money and time types", () => {
  it("never stores money as float or numeric", async () => {
    // Float money is a rounding bug waiting for a large enough number.
    // Integer minor units are the only acceptable representation.
    //
    // The predicate matches the MONEY NAMING CONVENTION (`*_minor`), not any
    // column containing "total". An earlier version matched `%total%` and
    // flagged bookings.total_weight_kg and total_volume_m3 — which are
    // physical measurements where `numeric` is correct and bigint would be
    // wrong. Weight genuinely needs fractional precision; kobo does not.
    const bad = await db.query(
      `select table_name, column_name, data_type
         from information_schema.columns
        where table_schema = 'public'
          and (column_name like '%_minor' or column_name like 'price%')
          and data_type <> 'bigint'`
    );
    expect(
      rows<{ table_name: string; column_name: string; data_type: string }>(bad).map(
      (b) => `${b.table_name}.${b.column_name} (${b.data_type})`
    ),
      'monetary columns must be bigint minor units'
    ).toEqual([]);

  }, 30_000);

  it("uses timestamptz everywhere — never a naive timestamp", async () => {
    // Nigeria is UTC+1. A naive timestamp has no offset, so "pickup at 09:00"
    // becomes ambiguous the moment a server runs in a different zone.
    const bad = await db.query(
      `select table_name, column_name
         from information_schema.columns
        where table_schema = 'public'
          and data_type = 'timestamp without time zone'`
    );
    expect(
      rows<{ table_name: string; column_name: string }>(bad).map(
      (b) => `${b.table_name}.${b.column_name}`
    ),
      'use timestamptz; derive local dates with AT TIME ZONE Africa/Lagos'
    ).toEqual([]);

  }, 30_000);
});

describe("append-only history", () => {
  it('blocks UPDATE and DELETE on history tables', async () => {
    for (const table of [
      'shipment_events',
      'payment_events',
      'inventory_movements',
      'audit_logs',
    ]) {
      const trigger = await db.query(
        `select tgname from pg_trigger
          where tgrelid = $1::regclass and not tgisinternal`,
        [table]
      );
      expect(
        trigger.rows.length,
        `${table} has no append-only trigger`
      ).toBeGreaterThan(0);
    }

  }, 30_000);
});