import type { Metadata } from 'next';
import Link from 'next/link';
import { SERVICES, SERVICE_SLUGS } from '@/lib/services';

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Daily, scheduled, bulk, interstate and ecommerce delivery services from Veencart Logistics.',
};

export default function ServicesIndexPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">Services</h1>
      <p className="mt-4 text-base leading-relaxed text-content-muted">
        Five ways to move a parcel with Veencart. Each one states plainly what it
        includes and what it does not promise.
      </p>

      <ul className="mt-8 space-y-3">
        {SERVICE_SLUGS.map((slug) => {
          const s = SERVICES[slug];
          return (
            <li key={slug}>
              <Link
                href={`/services/${slug}`}
                className="block rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <p className="font-medium tracking-tight">{s.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-content-muted">
                  {s.summary}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}