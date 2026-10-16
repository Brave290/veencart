import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

/**
 * THE PRODUCTION DATA ADAPTER GUARD
 *
 * WHY THIS TEST EXISTS
 * --------------------
 * `assertNotProduction()` was written into the data layer early and then never
 * called by anything. The protection existed as a comment and nowhere else, so
 * the deployed site booted a file-backed development database on every Vercel
 * cold start.
 *
 * The failure mode was invisible and bad in three ways at once:
 *
 *   1. The public /track page served the two DEMO shipments from seed.sql to
 *      every visitor — fabricated data on a real URL.
 *   2. Any booking written through /book was discarded the next time the
 *      serverless instance was recycled. Silent data loss, no error.
 *   3. Nothing logged. The page rendered "successfully".
 *
 * Reproduced by simulation before the fix: two consecutive "cold starts"
 * against separate data directories both reported 2 bookings at boot, and each
 * ended at 3. The first container's write was simply absent for the second.
 *
 * A test is the only thing that catches a guard nobody calls.
 */

/**
 * `process.env.NODE_ENV` is typed readonly by Node's own definitions, because
 * assigning it is nonsense in a real application. This suite has to do exactly
 * that, so the cast is deliberate and confined to these helpers.
 */
const env = process.env as unknown as Record<string, string | undefined>;

const ORIGINAL: Record<string, string | undefined> = {
  NODE_ENV: process.env.NODE_ENV,
  ALLOW_DEV_DB_IN_PRODUCTION: process.env.ALLOW_DEV_DB_IN_PRODUCTION,
  SEED_DEMO_DATA: process.env.SEED_DEMO_DATA,
  PGLITE_DATA_DIR: process.env.PGLITE_DATA_DIR,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
});

describe("assertNotProduction — production data adapter guard", () => {
  beforeEach(() => {
    env.NODE_ENV = "production";
    delete env.ALLOW_DEV_DB_IN_PRODUCTION;
    delete env.SEED_DEMO_DATA;
    // db.ts reads PGLITE_DATA_DIR once at module load, and this suite reloads
    // the module. Leaking a previously-used directory makes the next test
    // replay migrations against an existing schema — which fails on
    // `create function uid()` and looks like a migration bug rather than a
    // test-isolation bug.
    env.PGLITE_DATA_DIR = uniqueDir();
  });

  it("throws in production by default", async () => {
    const { assertNotProduction } = await freshModule();
    expect(() => assertNotProduction()).toThrow(/must never serve production/i);
  });

  it("names the actual problem, not a generic failure", async () => {
    const { assertNotProduction } = await freshModule();
    // An operator hitting this needs to know the fix, not just that it broke.
    // "Use the Supabase adapter" is the actionable half.
    expect(() => assertNotProduction()).toThrow(/supabase adapter/i);
  });

  it("does not throw in development", async () => {
    env.NODE_ENV = "development";
    const { assertNotProduction } = await freshModule();
    expect(() => assertNotProduction()).not.toThrow();
  });

  it("does not throw in test", async () => {
    env.NODE_ENV = "test";
    const { assertNotProduction } = await freshModule();
    expect(() => assertNotProduction()).not.toThrow();
  });

  it("allows an explicit opt-in for preview deployments", async () => {
    // Reachable-but-opt-in. Anything easier would fail open by accident.
    env.ALLOW_DEV_DB_IN_PRODUCTION = "1";
    const { assertNotProduction } = await freshModule();
    expect(() => assertNotProduction()).not.toThrow();
  });

  it("still refuses unless the opt-in is exactly '1'", async () => {
    // Guards against `=true`, `=yes`, `=` (empty) sneaking through a truthiness
    // check. This only works because the guard uses an explicit comparison.
    for (const value of ["true", "yes", "0", "", "TRUE", " 1"]) {
      env.ALLOW_DEV_DB_IN_PRODUCTION = value;
      const { assertNotProduction } = await freshModule();
      expect(
        () => assertNotProduction(),
        `"${value}" must not enable the dev adapter in production`
      ).toThrow(/must never serve production/i);
    }
  });

  it("fails closed: getDb() REJECTS rather than throwing synchronously", async () => {
    // getDb() is declared to return Promise<Db>, so it must fail the way a
    // promise fails. It used to throw synchronously, which meant
    // `getDb().catch(...)` never saw the error and the process died on an
    // unhandled throw. Both calling styles must work.
    const { getDb } = await freshModule();

    await expect(getDb()).rejects.toThrow(/must never serve production/i);
    await expect(getDb().catch((e) => e)).resolves.toBeInstanceOf(Error);
  });

  it("refuses before it creates a database directory", async () => {
    // The guard has to run at the TOP of getDb(). If it ran after
    // PGlite.create(), a production cold start would still write a database
    // directory onto a filesystem that should not be receiving one.
    const target = uniqueDir();
    env.PGLITE_DATA_DIR = target;
    const { getDb } = await freshModule();

    await expect(getDb()).rejects.toThrow();
    expect(existsSync(target)).toBe(false);
  });

  it("never seeds demo rows in production", async () => {
    // Belt and braces. Even if the guard were bypassed, the seed must not run:
    // it is what publishes fabricated shipments to a public tracking page.
    env.ALLOW_DEV_DB_IN_PRODUCTION = "1";
    delete env.SEED_DEMO_DATA;
    const { getDb } = await freshModule();

    const db = await getDb();

    // Migrations ran, so the table exists...
    const areas = await db.query<{ n: number }>(
      "select count(*)::int as n from public.service_areas"
    );
    expect(areas.rows[0]?.n).toBe(0);

    // ...but no demo coverage was published to it.
    const shipments = await db.query<{ n: number }>(
      "select count(*)::int as n from public.shipments"
    );
    expect(shipments.rows[0]?.n).toBe(0);

    await db.close();
  });

  it("seeds demo rows only when explicitly asked", async () => {
    // Proves the flag above is what gates the seed, not merely a side effect of
    // the guard refusing — otherwise "0 rows" would pass for the wrong reason.
    env.SEED_DEMO_DATA = "1";
    delete env.ALLOW_DEV_DB_IN_PRODUCTION;
    env.NODE_ENV = "development";
    const { getDb } = await freshModule();

    const db = await getDb();
    const areas = await db.query<{ n: number }>(
      "select count(*)::int as n from public.service_areas"
    );
    expect(areas.rows[0]?.n).toBeGreaterThan(0);
    await db.close();
  });
  it("can never serve a seeded demo shipment in production", async () => {
    // THE END-TO-END CONTRACT.
    //
    // `/track` is a PUBLIC page. Before the fix, every Vercel cold start
    // replayed the migrations AND the seed, so the page displayed the two
    // fabricated demo shipments from seed.sql to any visitor. Not a leak of real
    // data — a leak of INVENTED data, which is worse for a logistics company:
    // it implies a parcel exists that does not.
    //
    // TWO EARLIER VERSIONS OF THIS TEST WERE WORTHLESS, both fixed here:
    //
    //  1. It queried "VCTR-0001", a reference that exists in no seed and no
    //     database, so it returned not-found and passed even with the guard
    //     deleted. The seed's real references are "VCTR-DEMO-000N".
    //  2. It asserted `threw || !found`, which accepts ANY exception as a pass —
    //     so an unrelated crash in PGlite also "proved" the guard worked.
    //
    // It now requires the SPECIFIC guard error. An unrelated failure must fail
    // this test, not satisfy it.
    env.NODE_ENV = "production";
    delete env.ALLOW_DEV_DB_IN_PRODUCTION;
    delete env.SEED_DEMO_DATA;

    // `freshModule()` resolves the DATA LAYER, so importing tracking through it
    // yields `{ lookupTracking: undefined }`. Reset the registry, then import the
    // module that actually owns the lookup — which picks up the reset db module.
    vi.resetModules();
    const { lookupTracking } = await import("../backend/src/lib/tracking");

    let failure: unknown;
    let result: Awaited<ReturnType<typeof lookupTracking>> | undefined;
    try {
      result = await lookupTracking("VCTR-DEMO-0001");
    } catch (err) {
      failure = err;
    }

    // If it returned at all, it must not have found the demo shipment.
    expect(
      result?.found,
      "production tracking returned the seeded demo shipment"
    ).toBeFalsy();

    // And if it failed, it must have failed for the RIGHT reason.
    expect(failure, "lookup succeeded in production — demo data is reachable").toBeInstanceOf(Error);
    expect((failure as Error).message).toMatch(/must never serve production/i);
  });

});

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const TMP_ROOT = "/data/data/com.foxdebug.acode/cache/opencode/veencart-guard-tests";

function uniqueDir(): string {
  // PGlite creates its own data directory but not the parents of it, so the
  // shared root has to exist first.
  mkdirSync(TMP_ROOT, { recursive: true });
  return join(TMP_ROOT, `cold-${process.pid}-${Math.random().toString(36).slice(2)}`);
}

/**
 * db.ts memoises its PGlite instance in a module-level variable. Without a
 * module reset, whichever test ran first would boot the database and every
 * later assertion would read that same instance — a test that passes for the
 * wrong reason.
 */
async function freshModule() {
  vi.resetModules();
  return import("../backend/src/lib/db");
}