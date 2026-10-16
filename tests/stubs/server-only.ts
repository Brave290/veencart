/**
 * Test stub for the `server-only` package.
 *
 * `server-only` exists to make the CLIENT/SERVER boundary a build-time error:
 * importing a server module from a `"use client"` file fails the Next.js build
 * instead of quietly shipping secrets to the browser. That guard is worth
 * keeping — it is the single most valuable thing this project does to stop a
 * service-role key reaching a browser bundle.
 *
 * But the real package throws unconditionally at import time outside a React
 * Server Component context, and Vitest runs in plain Node with no React
 * renderer. So the test suite cannot import the module at all.
 *
 * Aliasing it to this empty stub keeps the production guard intact and makes
 * the module testable. The alternative — removing `import "server-only"` so the
 * tests pass — would delete a real security control to satisfy a test runner.
 * That is exactly backwards.
 */
export {};