import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

/**
 * 404 — Next.js renders this automatically for any unmatched route.
 *
 * THE HONEST-STATE RULE
 * This page deliberately does NOT show a fake tracking form, a fake "was this
 * meant to be…" search, or a list of popular destinations that may not exist.
 * A 404 that pretends to help is worse than a 404 that says plainly "this
 * address does not exist" and offers the two things that definitely do.
 *
 * `noindex` matters here: an unmatched route must never enter a search index.
 * A page that gets indexed is a page you keep getting reports about.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-5 py-16">
      <p className="text-sm font-semibold tracking-tight text-primary">404</p>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance">
        That page does not exist
      </h1>

      <p className="mt-4 text-base leading-relaxed text-content-muted">
        The address you followed is not part of this site. It may have been
        mistyped, or the link may be out of date. Nothing has gone wrong with any
        booking you made with us.
      </p>

      {/*
        Only two actions, both of which are guaranteed to resolve. Every one of
        these routes exists and is verified by the build.
      */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/">
          <Button>Back to home</Button>
        </Link>
        <Link href="/track">
          <Button variant="outline">Track a shipment</Button>
        </Link>
      </div>

      <section aria-labelledby="real-sections" className="mt-12 border-t border-line pt-6">
        <h2 id="real-sections" className="text-sm font-semibold tracking-tight">
          What is here
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {[
            { href: '/services', label: 'Delivery services and what each includes' },
            { href: '/services/interstate', label: 'Interstate delivery, subject to route availability' },
            { href: '/book', label: 'Book a delivery' },
            { href: '/track', label: 'Track a shipment you have a reference for' },
          ].map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}