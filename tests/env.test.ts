import { describe, expect, it, beforeEach } from "vitest";
import {
  serverEnv,
  clientEnv,
  checkServerEnv,
  __resetEnvCacheForTests,
} from "../backend/src/lib/env";

/**
 * Environment validation tests.
 *
 * The behaviour worth protecting is not "the schema validates" — it is that a
 * missing variable produces a NAMED, ACTIONABLE failure instead of a runtime
 * surprise days later. These tests assert the message, because the message is
 * the product.
 */

const GOOD: Record<string, string> = {
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-long-enough-to-pass-validation',
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: 'pk_test_abcdefghijklmnop',
  PAYSTACK_SECRET_KEY: 'sk_test_abcdefghijklmnop',
  R2_ACCOUNT_ID: '0123456789abcdef',
  R2_ACCESS_KEY_ID: 'access-key-id-long-enough',
  R2_SECRET_ACCESS_KEY: 'secret-access-key-long-enough',
  R2_S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
  R2_BUCKET_PUBLIC_MEDIA: 'veencart-public-media',
  R2_BUCKET_PRIVATE_FILES: 'veencart-private-files',
  R2_PUBLIC_MEDIA_BASE_URL: 'https://media.veencart.com',
  RESEND_API_KEY: 're_api_key_long_enough_to_pass',
  EMAIL_FROM: 'Veencart <no-reply@veencart.com>',

  NEXT_PUBLIC_APP_URL: 'https://veencart.com',
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_key_long_enough_here',
};

function setEnv(overrides: Record<string, string | undefined> = {}) {
  for (const [k, v] of Object.entries(GOOD)) process.env[k] = v;
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  __resetEnvCacheForTests();
}

beforeEach(() => {
  __resetEnvCacheForTests();
});

describe("serverEnv", () => {
  it("returns the parsed values when everything is present", () => {
    setEnv();
    const env = serverEnv();
    expect(env.PAYSTACK_SECRET_KEY).toBe(GOOD.PAYSTACK_SECRET_KEY);
    expect(env.R2_BUCKET_PRIVATE_FILES).toBe('veencart-private-files');
  });

  it("throws and NAMES the missing variable", () => {
    setEnv({ RESEND_API_KEY: undefined });
    // The message is the product. "Invalid environment" at 3am is useless.
    expect(() => serverEnv()).toThrow(/RESEND_API_KEY/);
  });

  it("lists EVERY missing variable at once, not just the first", () => {
    setEnv({ RESEND_API_KEY: undefined, R2_ACCOUNT_ID: undefined });
    let message = '';
    try {
      serverEnv();
    } catch (e) {
      message = (e as Error).message;
    }
    // Fixing them one deploy at a time is the failure mode this prevents.
    expect(message).toMatch(/RESEND_API_KEY/);
    expect(message).toMatch(/R2_ACCOUNT_ID/);
  });

  it("rejects an empty string rather than treating it as valid", () => {
    setEnv({ EMAIL_FROM: '   ' });
    expect(() => serverEnv()).toThrow(/EMAIL_FROM/);
  });

  it("rejects a Paystack key with the wrong prefix", () => {
    // A live public key pasted where a test key belongs, or an OpenAI key
    // pasted in the wrong slot. The prefix is the cheapest sanity check there is.
    setEnv({ PAYSTACK_SECRET_KEY: 'whsec_wrong_provider_secret' });
    expect(() => serverEnv()).toThrow(/PAYSTACK_SECRET_KEY/);
  });

  it("rejects a Stripe webhook secret being used as the Paystack secret", () => {
    // The exact mistake this project already made once. A guard means the
    // second occurrence fails at boot instead of at 2am.
    setEnv({ PAYSTACK_SECRET_KEY: 'whsec_abc123' });
    expect(() => serverEnv()).toThrow(/PAYSTACK_SECRET_KEY/);
  });

  it("memoises so validation is not repeated per call", () => {
    setEnv();
    const first = serverEnv();
    // Corrupt the environment after the first read; a memoised read must not
    // notice, because that is what "parse once" means.
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_changed_after_first_read';
    expect(serverEnv().PAYSTACK_SECRET_KEY).toBe(first.PAYSTACK_SECRET_KEY);
  });
});

describe("clientEnv", () => {
  it("exposes only browser-safe values", () => {
    setEnv();
    const env = clientEnv();

    expect(env.NEXT_PUBLIC_APP_URL).toBe(GOOD.NEXT_PUBLIC_APP_URL);
    // The whole point: a client component cannot reach a server secret through
    // the safe accessor, because it is not on this object.
    expect(Object.keys(env)).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(Object.keys(env)).not.toContain('PAYSTACK_SECRET_KEY');
    expect(Object.keys(env)).not.toContain('R2_SECRET_ACCESS_KEY');
    expect(Object.keys(env)).not.toContain('RESEND_API_KEY');
  });

  it("names the missing public variable", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: undefined });
    expect(() => clientEnv()).toThrow(/NEXT_PUBLIC_APP_URL/);
  });
});

describe("checkServerEnv", () => {
  it("reports ok when complete", () => {
    setEnv();
    expect(checkServerEnv()).toEqual({ ok: true, missing: [] });
  });

  it("reports every missing variable without throwing", () => {
    // Used by /api/health: a health check must ANSWER, not crash, or the
    // thing monitoring the deployment goes down at the same moment it does.
    setEnv({ RESEND_API_KEY: undefined, PAYSTACK_SECRET_KEY: undefined });
    const result = checkServerEnv();

    expect(result.ok).toBe(false);
    expect(result.missing).toContain('RESEND_API_KEY');
    expect(result.missing).toContain('PAYSTACK_SECRET_KEY');
  });
});

describe("build-time gating is warn-by-default, strict on demand", () => {
  // This behaviour is not theoretical. The first version threw at build time
  // and broke the production deployment, because `next build` does not need
  // secrets it does not consume — and nothing consumed those three variables
  // yet. The regression test asserts the rule that replaces it.
  it("ENV_STRICT is not set by default, so Vercel builds are not gated", async () => {
    // The env file must never set ENV_STRICT, or every local build would be
    // fatal. CI sets it in the workflow, where it belongs.
    const { readFileSync } = await import('node:fs');
    const example = readFileSync('.env.example', 'utf8');
    expect(example).not.toMatch(/^ENV_STRICT=/m);
  });

  it('the CI workflow sets ENV_STRICT so a dropped placeholder is caught', async () => {
    const { readFileSync } = await import('node:fs');
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(ci).toContain('ENV_STRICT: "1"');
  });

  it('next.config reports rather than throws when not strict', async () => {
    const { readFileSync } = await import('node:fs');
    const config = readFileSync('next.config.ts', 'utf8');

    // Regex, not a literal: matching exact quote style couples the test to a
    // formatting choice, so a harmless quote flip fails the suite.
    expect(config).toMatch(/process\.env\.ENV_STRICT\s*===\s*["']1["']/);
    expect(config).toMatch(/console\.warn\(message\)/);

    // And the runtime accessors must still throw loudly — that is where a
    // missing variable is supposed to bite.
    const accessors = readFileSync('backend/src/lib/env.ts', 'utf8');
    expect(accessors).toMatch(/throw new Error\(explainEnvError\(parsed\.error\)\)/);
  });
});

describe("the env module has no server-only leaks", () => {
  it("does not reference server secrets from a NEXT_PUBLIC_ name", async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(
      new URL('../backend/src/lib/env.ts', import.meta.url),
      'utf8'
    );

    // Guard against a well-meaning future edit renaming a secret to a
    // NEXT_PUBLIC_ variable, which would ship it to every browser.
    const forbidden = [
      'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_PAYSTACK_SECRET_KEY',
      'NEXT_PUBLIC_R2_SECRET_ACCESS_KEY',
      'NEXT_PUBLIC_RESEND_API_KEY',
    ];
    for (const name of forbidden) {
      expect(src, `${name} would leak a server secret to the browser`).not.toContain(
        `process.env.${name}`
      );
    }
  });
});

describe("checkServerEnv — optional variables are NOT required", () => {
  // THE BUG THIS PREVENTS
  // `checkServerEnv` used to walk every schema key and flag any blank one. That
  // silently treated `.optional()` variables as mandatory. No variable was
  // optional at the time, so nothing failed — until the first optional flag
  // (`SEED_DEMO_DATA`) was added to the schema, at which point `/api/health`
  // would have reported the deployment UNHEALTHY and pulled it out of rotation
  // over a variable nobody needed. A latent outage, one schema edit away.
  //
  // Uses the file's existing GOOD fixture and setEnv() helper rather than a
  // second, differently-shaped copy of the same environment.

  it("reports ok when only optional variables are absent", () => {
    setEnv();
    delete process.env.SEED_DEMO_DATA;
    delete process.env.ALLOW_DEV_DB_IN_PRODUCTION;
    delete process.env.PGLITE_DATA_DIR;
    __resetEnvCacheForTests();

    const result = checkServerEnv();
    expect(
      result.ok,
      `optional flags wrongly reported missing: ${result.missing.join(", ")}`
    ).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("still reports a genuinely missing REQUIRED variable", () => {
    // The other direction. Making the check lenient must not blind it.
    setEnv({ PAYSTACK_SECRET_KEY: undefined });

    const result = checkServerEnv();
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("PAYSTACK_SECRET_KEY");
  });

  it("rejects an optional variable set to a wrong value", () => {
    // `.optional()` means "may be absent", not "may be anything".
    setEnv({ SEED_DEMO_DATA: "yes" });

    const result = checkServerEnv();
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("SEED_DEMO_DATA");
  });

  it("accepts the optional variable when set to its one legal value", () => {
    setEnv({ SEED_DEMO_DATA: "1" });

    expect(checkServerEnv().ok).toBe(true);
  });
});
