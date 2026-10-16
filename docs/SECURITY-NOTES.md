# Security Notes — Dependency Risk Register

A running record of dependency advisories, what was decided about each, and why.
The point is that the next person to see an `npm audit` warning can read the
decision instead of re-deriving it — or worse, blindly running
`npm audit fix --force`.

---

## CVE-2026-93687 — `braces` stack exhaustion

| | |
|---|---|
| **Severity** | High (CVSS 8.7) |
| **Advisory** | GHSA-vfj7-8cjw-p6xm |
| **CWE** | CWE-674, Uncontrolled Recursion |
| **Impact** | Availability only — crashes the Node process. No confidentiality or integrity loss. |
| **Patched version** | **None exists.** `braces@3.0.3` is the newest published. |
| **EPSS** | 0.757% |
| **Status** | **Accepted. Not fixable upstream. No production exposure.** |

### The dependency chain

```
eslint-config-next  (devDependency)
  └─ @next/eslint-plugin-next
       └─ fast-glob
            └─ micromatch
                 └─ braces          ← affected
```

Every hop is dev tooling. `braces` is not in `dependencies` — it is reachable
only through the linter.

### Why this is not being "fixed"

`npm audit fix --force` proposes installing `eslint-config-next@14.2.35`.
That is a **downgrade of Next.js 16 → 14**, a two-major-version breaking
change, offered as the remedy for a dev-tooling DoS. Running it would trade a
theoretical availability issue in lint tooling for a guaranteed breakage of the
framework the entire application is built on. That is not a fix; it is a much
larger vulnerability.

It also cannot work. Latest `micromatch@4.0.8` still declares
`braces: ^3.0.3`, and latest `fast-glob@3.3.3` still depends on `micromatch`.
There is no version of anything to upgrade to.

### Why there is no production exposure — verified, not assumed

1. `npm audit --omit=dev` reports **0 vulnerabilities**. The production
   dependency tree is clean.
2. `braces` appears in **no executable server chunk** of the build output —
   only in `.js.map` source maps, which are not executed.
3. `next build` does **not** invoke ESLint. Verified against the build log.
4. The exploit requires an attacker to *supply a deeply nested brace pattern*
   to `braces`. In this repository the glob patterns come from our own ESLint
   config; no user input reaches a glob.

### What it WOULD take to exploit

An attacker who can already write to this repository's ESLint configuration has
far better options than crashing a linter. The realistic threat model is an
untrusted glob arriving from user input — and this project has none.

### Tracking

CI runs `npm audit --omit=dev --audit-level=high` on every build. That gate
covers the production tree and **must stay at zero**. A new advisory in a
production dependency fails the build immediately.

The dev tree is audited but its one open advisory is this documented one. If a
patched `braces` is ever published, bump the override and delete this entry.

---

## Install-script policy

Vercel and npm both warn about packages with lifecycle scripts. Two packages
in this tree have them — `esbuild` and `unrs-resolver` — and both are build-time
only with no post-install network access. Reviewed and accepted.

No package in this repository runs an install script that fetches from the
network. Adding one would need a fresh review here, because install scripts run
with the developer's or CI's credentials.

---

## How to add an entry

1. Reproduce with `npm audit --registry=https://registry.npmjs.org`
   (the configured mirror does not implement the audit endpoint).
2. Determine whether it is reachable from `dependencies` or only
   `devDependencies`. `npm audit --omit=dev` answers this directly.
3. Grep the build output for the package name, excluding `.map` files.
4. Record the decision and the reasoning. An accepted risk with no recorded
   rationale is an unmaintained risk.