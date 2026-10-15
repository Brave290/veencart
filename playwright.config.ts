import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Playwright — browser-level end-to-end tests.
 *
 * These run against a REAL `next build` output, not the dev server, so the
 * suite also proves the production bundle actually boots. `npm run build`
 * failing therefore fails the E2E suite rather than being discovered later.
 *
 * SCOPE, HONESTLY STATED: the journeys that can run without third-party
 * credentials are covered here — guest booking, public tracking, access
 * control. The Paystack, R2 and email journeys are NOT yet covered because
 * they need real credentials; they are listed in the phase plan as blocked on
 * client-supplied sandbox keys. A test that silently skips because a key is
 * absent is worse than no test, so those are wired but not claimed as passing.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // The driver workspace is mobile-first; it is tested at a real phone size.
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /driver.*\.spec\.ts/,
    },
  ],

  webServer: {
    // The shim exists ONLY because this build sandbox blocks the
    // uv_interface_addresses syscall that `next start` calls on startup. See
    // scripts/sandbox-network-shim.cjs.
    //
    // OPT-IN, NOT OPT-OUT. The default is "0" (shim off). The earlier version
    // defaulted to "1", which meant any environment that merely failed to set
    // the variable — CI included — silently got the sandbox shim. A
    // sandbox-only workaround must never be the default anywhere else.
    //
    // CI sets VEENCART_ALLOW_NETWORK_SHIM=0 explicitly so nobody "cleans up"
    // that line later and reintroduces the bug.
    command:
      process.env.VEENCART_ALLOW_NETWORK_SHIM === '1'
        ? `npx next start --port ${PORT} --hostname 127.0.0.1`
        : `npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      VEENCART_ALLOW_NETWORK_SHIM: process.env.VEENCART_ALLOW_NETWORK_SHIM ?? '0',
      NODE_OPTIONS:
        process.env.VEENCART_ALLOW_NETWORK_SHIM === '1'
          ? ['--require ./scripts/sandbox-network-shim.cjs', process.env.NODE_OPTIONS ?? '']
              .filter(Boolean)
              .join(' ')
          : (process.env.NODE_OPTIONS ?? ''),
    },
  },
});