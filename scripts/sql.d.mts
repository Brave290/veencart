/**
 * Type declarations for the plain-JS statement splitter.
 *
 * `scripts/sql.mjs` is JavaScript so it can be imported by both `node` (the
 * migration verifier) and Vitest without a build step. These declarations give
 * TypeScript its types back, so `allowJs: false` still type-checks the tests
 * that import it. The behaviour is documented in sql.mjs itself.
 */
export declare function splitStatements(sql: string): string[];