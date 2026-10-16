import "server-only";

import {
  clientSchema,
  serverSchema,
  pickEnv,
  explainEnvError,
  type ClientEnv,
  type ServerEnv,
} from "./env-schema";

/**
 * Environment ACCESSORS — server-guarded.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM THE SCHEMA
 * This module carries `import "server-only"`, which is a build-time guard: if
 * any `"use client"` file imports it, the Next.js build FAILS rather than
 * quietly shipping a service-role key to the browser. That guard is the single
 * most valuable thing this project does to keep secrets out of the client
 * bundle.
 *
 * But `server-only` throws outside a React Server Component, so it cannot be
 * imported by `next.config.ts` — which is where boot-time validation actually
 * runs. Hence: the schema is pure and shared (`env-schema.ts`), and only the
 * accessors are guarded.
 *
 * THE RULES
 *  1. Parse once, memoised. Validating per access is wasted work and invites
 *     the check to be skipped somewhere.
 *  2. Fail LOUDLY and name the variable. "Invalid environment" is useless at
 *     3am; "RESEND_API_KEY is required for transactional email" is actionable.
 *  3. Never invent a default for a secret. A default that works quietly in
 *     development is a default that works quietly in production.
 *  4. The safe accessor is the easy one. Client code reaches browser-safe
 *     values through `clientEnv()`; reaching a server secret requires
 *     deliberately importing a module that refuses to compile on the client.
 */

let cachedClient: ClientEnv | null = null;
let cachedServer: ServerEnv | null = null;

/**
 * Browser-safe environment. Safe to call from client components.
 *
 * Contains no secrets — that is the entire point. The safe accessor is the only
 * one a client component can reach.
 */
export function clientEnv(): ClientEnv {
  if (cachedClient) return cachedClient;

  const parsed = clientSchema.safeParse(pickEnv(clientSchema));
  if (!parsed.success) {
    throw new Error(explainEnvError(parsed.error));
  }

  cachedClient = parsed.data;
  return cachedClient;
}

/**
 * Server-only environment.
 *
 * THROWS rather than returning a partial object. A caller that received `{}`
 * and carried on would fail later, further from the cause.
 */
export function serverEnv(): ServerEnv {
  if (cachedServer) return cachedServer;

  const parsed = serverSchema.safeParse(pickEnv(serverSchema));
  if (!parsed.success) {
    throw new Error(explainEnvError(parsed.error));
  }

  cachedServer = parsed.data;
  return cachedServer;
}

/**
 * Whether every server variable is present, WITHOUT throwing.
 *
 * Used by `/api/health`. A health check must ANSWER rather than crash, or the
 * thing monitoring the deployment goes down at the exact moment it does — and
 * an endpoint that dies when config is broken cannot report that config is
 * broken.
 */
export function checkServerEnv(): { ok: boolean; missing: string[] } {
  const required = Object.keys(serverSchema.shape) as (keyof ServerEnv)[];
  const missing = required.filter((k) => {
    const v = process.env[k as string];
    return !v || v.trim() === '';
  });
  return { ok: missing.length === 0, missing: missing as string[] };
}

/**
 * Test seam. Not used by application code.
 *
 * Memoisation makes the module impossible to test twice with different inputs;
 * this clears it so the suite can assert that a bad environment throws.
 */
export function __resetEnvCacheForTests(): void {
  cachedClient = null;
  cachedServer = null;
}

export type { ClientEnv, ServerEnv };