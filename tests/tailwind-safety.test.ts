import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards against Tailwind's most dangerous failure mode: a class that does not
 * exist and produces no error.
 *
 * Tailwind builds its stylesheet by SCANNING SOURCE TEXT for complete class
 * names. It does not evaluate JavaScript. So this:
 *
 *     `bg-[${token}] text-[${token}]`
 *
 * compiles fine, type-checks fine, lints fine, renders fine — and produces a
 * completely UNSTYLED element. No build error. No runtime error. Just a badge
 * with no tint, which is the one thing a status badge must never be.
 *
 * This shipped once in this repo (status-badge.tsx) and was caught only by
 * grepping the compiled CSS for the values. These tests make that automatic.
 */

const SRC = join(process.cwd(), "src");
const SKIP = new Set(["node_modules", ".next"]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
    } else if (/\.(tsx|ts)$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

/** Matches a template literal that builds Tailwind classes at runtime. */
const INTERPOLATED_CLASS = /(?:class|cn|classes)\s*=\s*\{?`[^`]*\$\{/g;

describe("no runtime-interpolated Tailwind classes", () => {
  it("finds none in src/", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const contents = readFileSync(file, "utf8");
      contents.split("\n").forEach((line, i) => {
        // Ignore comments — the explanatory comments in status-badge.tsx
        // legitimately quote the broken pattern.
        if (line.trim().startsWith("*") || line.trim().startsWith("//")) return;
        if (INTERPOLATED_CLASS.test(line)) {
          offenders.push(`${file}:${i + 1}`);
        }
        INTERPOLATED_CLASS.lastIndex = 0;
      });
    }

    expect(
      offenders,
      "Tailwind cannot see a class assembled at runtime. Write complete class " +
        "name literals in the source instead."
    ).toEqual([]);
  });

  it("status-badge uses literal classes, not interpolation", () => {
    const raw = readFileSync(join(SRC, "components", "ui", "status-badge.tsx"), "utf8");
    expect(raw).toContain("bg-success-surface");
    expect(raw).toContain("text-success-text");
    expect(raw).toContain("bg-warning-surface");
    expect(raw).toContain("bg-info-surface");
    expect(raw).toContain("bg-danger-subtle");

    // Check CODE only. The comment in this file deliberately QUOTES the broken
    // pattern to explain why it is broken, so a naive source grep flags the
    // explanation as if it were the bug. Strip block comments and line
    // comments before testing for the pattern.
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
      .join('\n');

    expect(code).not.toMatch(/bg-\[\$\{/);
    expect(code).not.toMatch(/text-\[\$\{/);
    expect(code).not.toMatch(/ring-\[\$\{/);
  });
});

describe("motion tokens have a single source of truth", () => {
  it("globals.css does not redefine durations owned by motion.css", () => {
    const globals = readFileSync(join(SRC, "app", "globals.css"), "utf8");

    // Duplicated `--duration-*` definitions with different values made the
    // effective value depend on import order in layout.tsx. Reordering the two
    // CSS imports would retime every transition silently.
    const defined = [...globals.matchAll(/^\s*--duration-[a-z]+:\s*[0-9]/gm)];
    expect(
      defined.map((m) => m[0].trim()),
      "motion durations belong to motion.css only"
    ).toEqual([]);
  });

  it("motion.css defines the full duration scale", () => {
    const motion = readFileSync(join(SRC, "app", "motion.css"), "utf8");
    for (const token of [
      "duration-instant",
      "duration-fast",
      "duration-base",
      "duration-moderate",
      "duration-slow",
    ]) {
      expect(motion, `motion.css must define --${token}`).toContain(`--${token}:`);
    }
  });
});