'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { PublicHeader } from '@/components/brand/public-header';
import { SiteFooter } from '@/components/brand/site-footer';

/**
 * Route-level error boundary.
 *
 * WHAT THIS MUST NOT DO
 *   - Print `error.message` or `error.stack` to the page. An error message
 *     from the server is a reconnaissance gift: it leaks table names, file
 *     paths, SQL fragments and sometimes connection strings. A 500 page is the
 *     most-read attacker-facing page you own.
 *   - Show a retry button that reloads the route indefinitely. `reset()` retries
 *     the render; if the cause is deterministic it fails identically. Offer
 *     both, but make full reload the honest default.
 *   - Swallow the error. `useEffect` logging to the error reporter is the only
 *     thing that makes production failures diagnosable.
 *
 * `digest` is Next.js's stable, non-sensitive correlation id. It is safe to
 * show and is how a user reports the problem to support without disclosing
 * internals.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Replace with your real reporter (Sentry etc.) before launch.
    // Deliberately logs the message and digest, never the stack, because a
    // client-side log is also readable by anyone with devtools open.
    console.error('Route error', { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
        <PublicHeader />
        <main id="main" className="mx-auto flex w-full max-w-2xl flex-col py-16 sm:py-24">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-danger-text/25 bg-danger-subtle px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-danger-text">
            Something went wrong
          </p>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.04] tracking-[-0.05em] text-content sm:text-5xl">
            We could not load this page.
          </h1>

          <p className="mt-5 text-base leading-7 text-content-muted sm:text-lg">
            This is a problem on our side, not something you did. Nothing you have booked or paid is affected by it.
          </p>

          {error.digest ? (
            <p className="mt-5 text-sm text-content-muted">
              If you need to report this, quote reference{' '}
              <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">{error.digest}</code>
            </p>
          ) : null}

          <div className="mt-9 flex flex-wrap gap-3">
            <button type="button" onClick={reset} className={buttonVariants({ size: 'lg' })}>
              Try again
            </button>
            <Link href="/" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              Back to home
            </Link>
          </div>

          <p className="mt-10 text-sm text-content-muted">
            If this keeps happening, visit{' '}
            <Link href="/contact" className="font-medium text-primary underline-offset-4 hover:underline">
              contact
            </Link>{' '}
            and include the reference above.
          </p>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
