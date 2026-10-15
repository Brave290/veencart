import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MapPinned, Compass, PackageSearch, ShoppingBag, Truck } from 'lucide-react';
import { PublicHeader } from '@/components/brand/public-header';
import { SiteFooter } from '@/components/brand/site-footer';
import { VeencartLogo } from '@/components/brand/veencart-logo';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Page not found',
};

/**
 * 404 — rendered by Next.js for any unmatched route.
 *
 * THE HONEST-STATE RULE (unchanged from the previous version)
 * No fake search, no "did you mean" guesses, no popular-destination lists that
 * might point nowhere. The page says plainly that the address does not exist
 * and offers only links that are verified by the build.
 *
 * Next.js emits `noindex` for not-found pages automatically; setting robots
 * here as well produced a duplicate meta tag, so it is left to the framework.
 */
const destinations = [
  { href: '/services', title: 'Services', body: 'What each delivery service includes.', icon: Truck },
  { href: '/track', title: 'Track a shipment', body: 'Use the reference from your confirmation.', icon: PackageSearch },
  { href: '/store', title: 'Marketplace', body: 'Everyday essentials, when the store opens.', icon: ShoppingBag },
  { href: '/services/interstate', title: 'Interstate', body: 'Routes subject to confirmation.', icon: MapPinned },
];

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
        <PublicHeader />

        <main id="main" className="relative grid gap-10 py-12 sm:py-20 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:gap-16">
          <section aria-labelledby="not-found-heading">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-content-subtle">
              <Compass aria-hidden="true" className="size-3.5 text-primary" /> Error 404
            </p>

            <p
              aria-hidden="true"
              className="mt-6 select-none text-[clamp(6rem,24vw,13rem)] font-extrabold leading-[0.85] tracking-[-0.08em] text-primary/15"
            >
              404
            </p>

            <h1 id="not-found-heading" className="-mt-2 max-w-xl text-4xl font-extrabold leading-[1.02] tracking-[-0.05em] text-content sm:text-5xl">
              This page is off the route.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-content-muted sm:text-lg">
              The address you followed is not part of this site. It may have been mistyped or the link may be out of date. Nothing has gone wrong with any booking you made.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/" className={buttonVariants({ size: 'lg' })}>
                Back to home
              </Link>
              <Link href="/track" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                Track a shipment
              </Link>
            </div>
          </section>

          <aside aria-labelledby="not-found-links" className="relative overflow-hidden rounded-[28px] bg-[#071C24] p-6 text-white shadow-[0_24px_60px_rgb(7_28_36_/_20%)] sm:p-8">
            <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-[#0A8F8E]/25 blur-3xl" />
            <div className="relative flex items-center justify-between gap-4">
              <h2 id="not-found-links" className="text-sm font-bold uppercase tracking-[0.18em] text-[#A9E5DF]">
                What is here
              </h2>
              <VeencartLogo compact />
            </div>
            <ul className="relative mt-6 grid gap-3">
              {destinations.map(({ href, title, body, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-colors duration-fast hover:border-[#6ED0C7]/40 hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6ED0C7]"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#6ED0C7]/15 text-[#A9E5DF]">
                      <Icon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-white">{title}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-white/60">{body}</span>
                    </span>
                    <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-1 group-hover:text-[#F47A28]" />
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}
