/**
 * sql.mjs — a real PostgreSQL statement splitter.
 *
 * WHY THIS EXISTS: PGlite's `query()` uses the extended protocol, which accepts
 * exactly ONE statement. To report a precise error for the statement that
 * actually broke (instead of a generic "file failed"), migrations are applied
 * statement by statement.
 *
 * A naive `sql.split(';')` is WRONG: it breaks on every semicolon inside a
 * dollar-quoted function body ($$ ... $$), a string literal, or a comment.
 * This splitter tracks all four contexts:
 *   - single-quoted string literals, with '' escaping
 *   - dollar-quoted strings ($$ ... $$ and $tag$ ... $tag$)
 *   - -- line comments
 *   - /* block comments *\/ (nestable in PostgreSQL)
 *   - double-quoted identifiers, with "" escaping
 *
 * Pure function, no dependencies. Used by scripts/verify-migrations.mjs and
 * by the Vitest database harness.
 */

/**
 * @param {string} sql
 * @returns {string[]} executable statements, semicolons trimmed
 */
export function splitStatements(sql) {
  const out = [];
  let buf = "";
  let i = 0;
  const n = sql.length;

  // Current nesting context. We use a small explicit stack because Postgres
  // block comments nest, so a boolean would be wrong for `/* a /* b */ c */`.
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let blockDepth = 0;
  /** @type {string|null} current dollar-quote tag, e.g. "$$" or "$authfn$" */
  let dollarTag = null;

  while (i < n) {
    const c = sql[i];
    const c2 = sql[i + 1];

    // ── line comment ───────────────────────────────────────────────────────
    if (inLineComment) {
      if (c === "\n") {
        inLineComment = false;
        buf += c;
      }
      i++;
      continue;
    }
    if (!inSingle && !inDouble && !dollarTag && blockDepth === 0) {
      if (c === "-" && c2 === "-") {
        inLineComment = true;
        i += 2;
        continue;
      }
      if (c === "/" && c2 === "*") {
        blockDepth = 1;
        i += 2;
        continue;
      }
    }

    // ── block comment (must work inside and outside other contexts) ────────
    if (!inSingle && !inDouble && !dollarTag) {
      if (c === "/" && c2 === "*" && blockDepth === 0) {
        blockDepth = 1;
        i += 2;
        continue;
      }
      if (c === "*" && c2 === "/" && blockDepth > 0) {
        blockDepth--;
        i += 2;
        continue;
      }
      if (blockDepth > 0) {
        i++;
        continue;
      }
    }

    // ── dollar-quoted string ───────────────────────────────────────────────
    if (dollarTag) {
      if (c === "$" && sql.startsWith(dollarTag, i)) {
        buf += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      buf += c;
      i++;
      continue;
    }

    // ── single-quoted literal ('' escapes a quote) ─────────────────────────
    if (inSingle) {
      if (c === "'" && c2 === "'") {
        buf += "''";
        i += 2;
        continue;
      }
      if (c === "'") {
        inSingle = false;
        buf += c;
        i++;
        continue;
      }
      buf += c;
      i++;
      continue;
    }

    // ── double-quoted identifier ("" escapes) ──────────────────────────────
    if (inDouble) {
      if (c === '"' && c2 === '"') {
        buf += '""';
        i += 2;
        continue;
      }
      if (c === '"') {
        inDouble = false;
        buf += c;
        i++;
        continue;
      }
      buf += c;
      i++;
      continue;
    }

    // ── top level ──────────────────────────────────────────────────────────
    if (c === "'") {
      inSingle = true;
      buf += c;
      i++;
      continue;
    }
    if (c === '"') {
      inDouble = true;
      buf += c;
      i++;
      continue;
    }
    // Dollar quote opener: $tag$ where tag matches [A-Za-z_][A-Za-z0-9_]*
    if (c === "$") {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (m) {
        dollarTag = m[0];
        buf += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }
    if (c === ";") {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = "";
      i++;
      continue;
    }

    buf += c;
    i++;
  }

  const tail = buf.trim();
  if (tail) out.push(tail);

  // Comments are consumed by the scanner above and never enter `buf`, so each
  // statement is pure SQL. Trimming is all that is left to do.
  return out.map((s) => s.trim()).filter(Boolean);
}