/**
 * rename-brand.mjs — case-preserving brand rename across the repo.
 *
 * Written as a file rather than an inline `node -e` because inline shell
 * quoting mangled backticks and, worse, an inline walker used `return` where
 * it meant `continue` — which silently skips the rest of a directory and makes
 * a "0 remaining" result that is simply wrong. Both failures produced
 * confident, incorrect numbers. This version uses `continue` and prints the
 * files it actually touched.
 *
 * Usage: node scripts/rename-brand.mjs --from Veencart --to Veencart [--dry]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const from = args[args.indexOf("--from") + 1] ?? "Veencart";
const to = args[args.indexOf("--to") + 1] ?? "Veencart";

const SKIP = new Set([
  "node_modules", ".git", ".next", "test-results",
  "playwright-report", ".cache", "coverage",
]);
const EXTS = /\.(md|tsx|ts|jsx|js|css|sql|mjs|cjs|json|cls)$/;

const touched = [];
let occurrences = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue; // continue, never return
    const path = join(dir, entry);
    const st = statSync(path);
    if (st.isDirectory()) {
      walk(path);
      continue; // <-- the bug that produced false "0 remaining" counts
    }
    if (!EXTS.test(entry)) continue;

    const before = readFileSync(path, "utf8");
    if (!before.includes(from)) continue;

    const count = before.split(from).length - 1;
    const after = before.split(from).join(to);
    occurrences += count;
    if (!dry) writeFileSync(path, after);
    touched.push([relative(".", path), count]);
  }
}

walk(".");

console.log(`${dry ? "[dry] would rewrite" : "rewrote"} ${touched.length} files, ${occurrences} occurrences`);
for (const [p, n] of touched) console.log(`  ${String(n).padStart(3)}  ${p}`);

// Independent recount after the pass, using a fresh walk.
let remaining = 0;
const left = [];
(function scan(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      scan(path);
      continue;
    }
    if (!EXTS.test(entry)) continue;
    const s = readFileSync(path, "utf8");
    const c = s.split(from).length - 1;
    if (c > 0) {
      remaining += c;
      left.push(relative(".", path));
    }
  }
})(".");

console.log(`\nverified remaining "${from}": ${remaining} in ${left.length} files`);
for (const p of left) console.log(`  ${p}`);
process.exit(remaining > 0 ? 1 : 0);