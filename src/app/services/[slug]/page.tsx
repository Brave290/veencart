import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SERVICES, SERVICE_SLUGS, isServiceSlug, type ServiceSlug } from '@/lib/services';

export function generateStaticParams() {
  return SERVICE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isServiceSlug(slug)) return { title: 'Service not found' };
  return { title: SERVICES[slug].name, description: SERVICES[slug].summary };
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // An unknown slug is a 404, never a rendered "empty service" page. Serving
  // one would tell a crawler the service exists.
  if (!isServiceSlug(slug)) notFound();

  const service: (typeof SERVICES)[ServiceSlug] = SERVICES[slug];

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12">
      <Link
        href="/services"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        ← All services
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance">
        {service.name}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-content-muted">
        {service.summary}
      </p>

      <section aria-labelledby="included-heading" className="mt-10">
        <h2 id="included-heading" className="text-lg font-semibold tracking-tight">
          What is included
        </h2>
        <ul className="mt-3 space-y-2">
          {service.included.map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-relaxed">
              <span aria-hidden="true" className="text-primary">
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/*
        The "not promised" block is deliberate and unusual for a marketing page.
        Publishing the limits up front is what keeps the site truthful while the
        rate card, coverage map and delivery-time policies are still being
        confirmed with the business.
      */}
      <section
        aria-labelledby="limits-heading"
        className="mt-10 rounded-xl border border-line bg-surface-muted p-5"
      >
        <h2 id="limits-heading" className="text-sm font-semibold tracking-tight">
          What we do not promise
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-content-muted">
          {service.notPromised}
        </p>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/book"
          className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-content-inverted transition-colors hover:bg-primary-hover"
        >
          Book this service
        </Link>
        <Link
          href="/track"
          className="inline-flex items-center rounded-lg border border-line-strong px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-muted"
        >
          Track a shipment
        </Link>
      </div>
    </main>
  );
}