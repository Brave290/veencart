/**
 * verify-migrations.mjs
 *
 * Applies every file in supabase/migrations/ to a throwaway PGlite instance and
 * reports which ones applied, plus a schema inventory.
 *
 * WHY THIS EXISTS: production runs these files on Supabase PostgreSQL, but CI
 * and local dev have no Docker daemon. PGlite is real PostgreSQL (18.x, WASM),
 * so the SAME files are genuinely executed here rather than lint-parsed. A
 * migration that breaks in PGlite will break on Supabase.
 *
 * Usage:  node scripts/verify-migrations.mjs [--seed] [--quiet]
 * Exit 0 = all migrations applied. Exit 1 = at least one failed.
 */
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { splitStatements } from "./sql.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase", "migrations");
const quiet = process.argv.includes("--quiet");

const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const db = new PGlite({ extensions: { pgcrypto, citext, btree_gist } });
let failed = 0;

for (const f of files) {
  let n = 0;
  try {
    // Statement-by-statement so a failure names the exact statement.
    for (const stmt of splitStatements(readFileSync(join(dir, f), "utf8"))) {
      n++;
      await db.query(stmt);
    }
    if (!quiet) console.log(`PASS  ${f} (${n} statements)`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${f} statement #${n}\n      ${String(e.message).split("\n")[0]}`);
  }
}

if (!quiet) {
  const q = async (sql) => (await db.query(sql)).rows;
  const tables = await q(
    `select tablename from pg_tables where schemaname='public' order by tablename`
  );
  const enums = await q(
    `select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typtype = 'e' order by t.typname`
  );
  const rls = await q(
    `select count(*)::int c from pg_tables where schemaname='public' and rowsecurity`
  );
  const forced = await q(
    `select count(*)::int c from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relforcerowsecurity`
  );
  const pol = await q(
    `select tablename, policyname from pg_policies where schemaname='public' order by tablename, policyname`
  );

  console.log(`\n--- ${files.length} files, ${failed} failed ---`);
  console.log(`tables (${tables.length}): ${tables.map((r) => r.tablename).join(", ")}`);
  console.log(`enums (${enums.length}): ${enums.map((r) => r.typname).join(", ")}`);
  console.log(`RLS enabled: ${rls[0].c} | FORCE RLS: ${forced[0].c} | policies: ${pol.length}`);
  const byTable = {};
  for (const p of pol) byTable[p.tablename] = (byTable[p.tablename] || 0) + 1;
  console.log(
    "policies per table: " +
      Object.entries(byTable)
        .map(([t, n]) => `${t}=${n}`)
        .join(", ")
  );
}

await db.close();
process.exit(failed ? 1 : 0);