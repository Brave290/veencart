'use client';

import Link from 'next/link';

/**
 * global-error — the last line of defence.
 *
 * REPLACES THE ROOT LAYOUT, which means it must render its own <html> and
 * <body>. It only catches errors in the root layout itself or below it in a way
 * the route-level error.tsx cannot. In practice that is rare, but when it
 * happens the alternative is Next's bare default page.
 *
 * Because this file replaces the layout, it CANNOT use the design-system
 * classes that depend on globals.css being loaded — if globals.css is what
 * failed to load, those classes do not exist and this page renders unstyled.
 * So the styles here are inline. That is a deliberate constraint, not an
 * oversight.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#f7f8f5',
          color: '#202927',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          lineHeight: 1.6,
        }}
      >
        <main style={{ maxWidth: '34rem' }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#b91c1c',
            }}
          >
            Application error
          </p>

          <h1 style={{ margin: '0.75rem 0 0', fontSize: '1.75rem', lineHeight: 1.2 }}>
            Veencart could not start
          </h1>

          <p style={{ margin: '1rem 0 0', color: '#4a5754' }}>
            Something failed before the site could load. No booking, payment or
            delivery record was affected. Please try again in a moment.
          </p>

          {error.digest ? (
            <p style={{ margin: '1rem 0 0', fontSize: '0.875rem', color: '#4a5754' }}>
              Quote reference{' '}
              <code
                style={{
                  background: '#eef0ec',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.8125rem',
                }}
              >
                {error.digest}
              </code>
            </p>
          ) : null}

          <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: '0.625rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: '#087e67',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                minHeight: '2.75rem',
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{
                padding: '0.625rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid #b8c3bd',
                background: 'transparent',
                color: '#202927',
                fontSize: '0.875rem',
                fontWeight: 500,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: '2.75rem',
              }}
            >
              Back to home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}