'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

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
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-5 py-16">
      <p className="text-sm font-semibold tracking-tight text-danger-text">Something went wrong</p>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance">
        We could not load this page
      </h1>

      <p className="mt-4 text-base leading-relaxed text-content-muted">
        This is a problem on our side, not something you did. Nothing you have
        booked or paid is affected by it.
      </p>

      {error.digest ? (
        <p className="mt-4 text-sm text-content-muted">
          If you need to report this, quote reference{' '}
          <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">
            {error.digest}
          </code>
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/">
          <Button variant="outline">Back to home</Button>
        </Link>
      </div>

      <p className="mt-10 text-sm text-content-muted">
        If this keeps happening, use{' '}
        <Link href="/contact" className="text-primary underline-offset-4 hover:underline">
          contact
        </Link>{' '}
        and include the reference above.
      </p>
    </main>
  );
}