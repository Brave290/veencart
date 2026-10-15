import type { Metadata } from 'next';
import { TrackLookup } from './track-lookup';
import { PublicHeader } from '@/components/brand/public-header';
import { SiteFooter } from '@/components/brand/site-footer';

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
    <main className="min-h-dvh bg-canvas">
      <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
        <PublicHeader />
        <section className="mx-auto max-w-3xl py-12 sm:py-20">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Shipment visibility</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">Track a shipment</h1>

      <p className="mt-4 max-w-2xl text-base leading-relaxed text-content-muted">
        Enter the tracking reference from your booking confirmation. It looks
        like{' '}
        <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-sm">
          VCTR-0001
        </code>{' '}
        and begins with <span className="font-mono text-sm">VCTR</span>.
      </p>

      <TrackLookup />
        </section>
        <SiteFooter />
      </div>
    </main>
  );
}
