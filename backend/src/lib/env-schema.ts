import { z } from "zod";

/**
 * Environment SCHEMA — pure, with no `server-only` import.
 *
 * WHY THIS IS A SEPARATE FILE
 * `server-only` throws when imported outside a React Server Component. That
 * guard is valuable in application code (it stops a service-role key reaching
 * a browser bundle) but it makes the module unusable from `next.config.ts`,
 * which runs in plain Node at build and start time.
 *
 * Splitting the schema from the accessors means:
 *   - next.config.ts can validate the environment at boot, which is the only
 *     way "fail loudly at startup" actually happens
 *   - the application keeps its `server-only` guard
 *   - there is still exactly ONE definition of what a valid environment is
 *
 * If the schema were duplicated, the build could pass on values the app then
 * rejects — or worse, the reverse.
 */

/**
 * A value that must be present AND non-blank.
 *
 * `.min(n)` alone is not enough: `'   '` is a 3-character string, so a
 * whitespace-only value sails through a `min(3)` check and then fails somewhere
 * unrelated much later. `trim()` runs first, so the length check applies to
 * what a human would actually read.
 */
export const required = (min = 1) => z.string().trim().min(min);

/** Browser-safe. The only values a client component may ever read. */
export const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().describe('Public base URL, e.g. https://veencart.com'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().describe('Supabase project URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required(20).describe(
    'Supabase publishable/anon key — safe in the browser, still subject to RLS'
  ),
});

/** Server-only, grouped by the capability each variable gates. */
export const serverSchema = z.object({
  // ── Supabase ─────────────────────────────────────────────────────────────
  SUPABASE_SERVICE_ROLE_KEY: required(20).describe(
    'Server-only. BYPASSES RLS entirely — re-check permissions yourself on this path.'
  ),

  // ── Paystack ─────────────────────────────────────────────────────────────
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: z
    .string()
    .regex(/^pk_(test|live)_/, 'Must be pk_test_… or pk_live_…'),
  PAYSTACK_SECRET_KEY: z
    .string()
    .regex(/^sk_(test|live)_/, 'Must be sk_test_… or sk_live_…')
    .describe(
      'Server-only. ALSO the HMAC key for verifying inbound webhooks — Paystack has no separate webhook secret.',
    ),

  // ── Cloudflare R2 ────────────────────────────────────────────────────────
  R2_ACCOUNT_ID: required(8),
  R2_ACCESS_KEY_ID: required(8).describe('Server-only'),
  R2_SECRET_ACCESS_KEY: required(8).describe('Server-only'),
  R2_S3_ENDPOINT: z.string().url(),
  R2_BUCKET_PUBLIC_MEDIA: required(1),
  R2_BUCKET_PRIVATE_FILES: required(1),
  R2_PUBLIC_MEDIA_BASE_URL: z.string().url(),

  // ── Email ────────────────────────────────────────────────────────────────
  RESEND_API_KEY: required(10).describe(
    'Server-only. Missing means no transactional email at all.'
  ),
  EMAIL_FROM: required(3).describe('e.g. "Veencart Logistics <no-reply@veencart.com>"'),

  // ── Local development database ────────────────────────────────────────────
  // All three OPTIONAL, and all three default to the safe behaviour. They are
  // declared here rather than read ad-hoc in db.ts so that `ENV_STRICT=1` in CI
  // validates them too, and so they are discoverable in one place.
  SEED_DEMO_DATA: z
    .enum(['1'])
    .optional()
    .describe(
      'Set to "1" to load backend/supabase/seed.sql into the local PGlite database. ' +
        'Demo data ONLY. Never set this on a real deployment: the seed publishes ' +
        'fabricated shipments to the public /track page.',
    ),
  ALLOW_DEV_DB_IN_PRODUCTION: z
    .enum(['1'])
    .optional()
    .describe(
      'Set to "1" ONLY on a preview deployment to allow the PGlite dev adapter under ' +
        'NODE_ENV=production. Defaults to off, so forgetting it fails closed rather ' +
        'than silently serving ephemeral demo data.',
    ),
  PGLITE_DATA_DIR: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Where the local PGlite database lives. Defaults to backend/.pglite.'),
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

/** Pick a schema key set out of `process.env`, ignoring undefined extras. */
export function pickEnv(schema: z.ZodTypeAny, env: NodeJS.ProcessEnv = process.env) {
  const shape = (schema as unknown as { shape: Record<string, unknown> }).shape;
  const raw: Record<string, string | undefined> = {};
  for (const key of Object.keys(shape)) raw[key] = env[key];
  return raw;
}

/**
 * Turn a ZodError into something a human can act on at 3am.
 *
 * Zod's default output is a wall of one-line issues. This groups them by
 * variable and says what breaks, because "email will not send" is the sentence
 * that saves the night.
 */
export function explainEnvError(error: z.ZodError): string {
  const byVariable = new Map<string, string[]>();

  for (const issue of error.issues) {
    const key = issue.path[0] === undefined ? '(unknown)' : String(issue.path[0]);
    const list = byVariable.get(key) ?? [];
    list.push(issue.message);
    byVariable.set(key, list);
  }

  const lines: string[] = [
    '',
    '  ENVIRONMENT IS NOT CONFIGURED CORRECTLY',
    '  ────────────────────────────────────────────────────────────',
  ];

  for (const [key, problems] of byVariable) {
    lines.push(`  ✗ ${key}`);
    for (const p of problems) lines.push(`      ${p}`);
  }

  lines.push('  ────────────────────────────────────────────────────────────');
  lines.push('  Copy .env.example to .env.local and fill in every value.');
  lines.push('  Server-only values must NEVER be prefixed with NEXT_PUBLIC_.');
  lines.push('');

  return lines.join('\n');
}