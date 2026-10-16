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
 * Whether every REQUIRED server variable is usable, WITHOUT throwing.
 *
 * Used by `/api/health`. A health check must ANSWER rather than crash, or the
 * thing monitoring the deployment goes down at the exact moment it does — and
 * an endpoint that dies when config is broken cannot report that config is
 * broken.
 *
 * WHY THIS ASKS ZOD INSTEAD OF COUNTING BLANK STRINGS
 * The obvious implementation is "walk the schema keys, flag any that are
 * absent" — and that is what this used to do. It silently treated EVERY key as
 * mandatory, including ones explicitly marked `.optional()`. Nothing caught it
 * because no variable was optional yet, so the first optional flag added to the
 * schema would have flipped `/api/health` to unhealthy and taken the deployment
 * out of rotation for a variable nobody needed.
 *
 * Deriving the answer from the parse keeps the two definitions from drifting:
 * the schema says what is required, and this reports what the schema rejected.
 */
export function checkServerEnv(): { ok: boolean; missing: string[] } {
  const parsed = serverSchema.safeParse(pickEnv(serverSchema));

  if (parsed.success) return { ok: true, missing: [] };

  // `missing` is the field name the health endpoint contract uses; in practice
  // it holds required fields that are absent OR present-but-invalid, because
  // both need a human to fix them and neither can be served.
  const missing = [...new Set(parsed.error.issues.map((i) => i.path.join('.')))].filter(
    Boolean
  );

  return { ok: false, missing };
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