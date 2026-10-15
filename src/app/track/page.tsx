import type { Metadata } from 'next';
import { TrackLookup } from './track-lookup';

export const metadata: Metadata = {
  title: 'Track a shipment',
  description:
    'Follow a Veencart shipment from pickup to delivery using your tracking reference.',
};

/**
 * /track — public shipment tracking.
 *
 * This page is a Server Component that fetches nothing, so it renders
 * instantly on a slow connection. The lookup happens in a server action, which
 * means the browser never talks to the database and there is no second code path
 * that could bypass the public-safe projection in src/lib/tracking.ts.
 */
export default function TrackPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">Track a shipment</h1>

      <p className="mt-4 max-w-2xl text-base leading-relaxed text-content-muted">
        Enter the tracking reference from your booking confirmation. It looks
        like{' '}
        <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-sm">
          VCTR-0001
        </code>{' '}
        and begins with <span className="font-mono text-sm">VCTR</span>.
      </p>

      <TrackLookup />
    </main>
  );
}