import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Reveal, Stagger } from '@/components/motion/reveal';

export const metadata = {
  title: 'Veencart Logistics — Delivery and Commerce',
  description:
    'Veencart Logistics handles local and interstate delivery across Nigeria and runs a marketplace for everyday essentials.',
};

/**
 * PLACEHOLDER HOMEPAGE — not the final marketing site.
 *
 * It states only what is genuinely known: the services Veencart offers and how
 * to act on them. It deliberately does NOT contain prices, delivery-time
 * promises, coverage guarantees, partner logos, customer counts or testimonials.
 * Those are business facts the client has not confirmed, and inventing them is
 * the fastest way to lose a logistics company's credibility.
 */
export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-12 sm:py-16">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-semibold tracking-tight text-primary">
          Veencart Logistics
        </p>
        <nav aria-label="Primary" className="flex items-center gap-2">
          <Link href="/track">
            <Button variant="ghost" size="sm">
              Track a shipment
            </Button>
          </Link>
          <Link href="/book">
            <Button size="sm">Book a delivery</Button>
          </Link>
        </nav>
      </header>

      {/*
        Motion hierarchy: the headline is the primary movement, the supporting
        copy secondary, the CTA tertiary. One primary motion per viewport — if
        three things compete, the eye cancels them out and notices none. That
        is why these are three separate Reveals with a small offset rather than
        one container animating everything at once.
      */}
      <section className="mt-14 max-w-2xl">
        <Reveal>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Delivery and commerce, run as one operation.
          </h1>
        </Reveal>
        <Reveal className="mt-4">
          <p className="text-base leading-relaxed text-content-muted">
            Veencart Logistics moves parcels across Nigeria and sells everyday
            essentials through its own marketplace. You can book without creating
            an account, pay online, and follow your shipment from pickup to
            delivery.
          </p>
        </Reveal>
        <Reveal className="mt-6 flex flex-wrap gap-3">
          <Link href="/book">
            <Button>Book a delivery</Button>
          </Link>
          <Link href="/track">
            <Button variant="outline">Track a shipment</Button>
          </Link>
        </Reveal>
      </section>

      <section aria-labelledby="services-heading" className="mt-14">
        <Reveal>
          <h2 id="services-heading" className="text-lg font-semibold tracking-tight">
            Services
          </h2>
        </Reveal>
        <Stagger className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            {
              href: '/services/daily',
              title: 'Daily delivery',
              body: 'Same-day and next-day movement within covered areas.',
            },
            {
              href: '/services/scheduled',
              title: 'Scheduled delivery',
              body: 'Book a collection window that suits you.',
            },
            {
              href: '/services/bulk',
              title: 'Bulk and freight',
              body: 'Palletised and high-volume consignments.',
            },
            {
              href: '/services/interstate',
              title: 'Interstate delivery',
              body: 'Between states, subject to route availability.',
            },
            {
              href: '/services/ecommerce',
              title: 'Ecommerce fulfilment',
              body: 'Order dispatch with delivery evidence captured.',
            },
            {
              href: '/store',
              title: 'Marketplace',
              body: 'Everyday essentials, delivered on the same operation.',
            },
          ].map((s) => (
            <div key={s.href}>
              <Link
                href={s.href}
                className="lift block rounded-xl border border-line bg-surface p-4 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <p className="font-medium tracking-tight">{s.title}</p>
                <p className="mt-1 text-sm text-content-muted">{s.body}</p>
              </Link>
            </div>
          ))}
        </Stagger>
      </section>

      <section aria-labelledby="coverage-heading" className="mt-14">
        <h2 id="coverage-heading" className="text-lg font-semibold tracking-tight">
          Coverage is confirmed per route
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-content-muted">
          Veencart serves Nigeria-wide as an ambition, not a guarantee. Every
          booking is checked against live service areas. If a route is not
          currently covered, you get a quote request handled by our team rather
          than a price or a delivery date we cannot keep.
        </p>
      </section>

      <footer className="mt-16 border-t border-line pt-6 text-sm text-content-muted">
        <p>
          Contact details and operating hours are shown once confirmed by the
          business. Nothing on this page is presented as a guarantee of coverage,
          price or delivery time.
        </p>
      </footer>
    </main>
  );
}