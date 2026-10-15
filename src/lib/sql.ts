/**
 * PostgreSQL statement splitter.
 *
 * WHY THIS EXISTS: PGlite's `query()` uses the extended protocol, which accepts
 * exactly ONE statement. To report a precise error for the statement that
 * actually broke — rather than a generic "file failed" — migrations are applied
 * statement by statement.
 *
 * A naive `sql.split(';')` is wrong: it breaks on every semicolon inside a
 * dollar-quoted function body ($$ … $$), a string literal, or a comment. This
 * scanner tracks all four contexts:
 *
 *   - single-quoted string literals, with '' escaping
 *   - dollar-quoted strings ($$ … $$ and $tag$ … $tag$)
 *   - -- line comments
 *   - block comments, which NEST in PostgreSQL
 *   - double-quoted identifiers, with "" escaping
 *
 * Comments are consumed by the scanner and never emitted, so every returned
 * statement is pure SQL. That matters: an earlier version leaked the `--`
 * marker into the buffer, producing a statement beginning with `--`, which
 * PGlite's parser rejected with a baffling "relation does not exist" error
 * several hundred lines away from the real cause.
 */

/**
 * Split a SQL script into individual executable statements.
 * @param sql the full script
 * @returns executable statements, semicolons trimmed, comments removed
 */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let i = 0;
  const n = sql.length;

  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let blockDepth = 0;
  /** Current dollar-quote tag, e.g. "$$" or "$do$". */
  let dollarTag: string | null = null;

  while (i < n) {
    const c = sql[i] as string;
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

    // ── block comment (nests, so depth is a counter, not a boolean) ────────
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
    // Dollar-quote opener: $tag$ where tag matches [A-Za-z_][A-Za-z0-9_]*
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

  return out.map((s) => s.trim()).filter(Boolean);
}