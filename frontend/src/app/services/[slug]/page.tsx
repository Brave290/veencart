import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, ShieldAlert } from 'lucide-react';
import { notFound } from 'next/navigation';
import { PublicHeader } from '@/components/brand/public-header';
import { SiteFooter } from '@/components/brand/site-footer';
import { Reveal } from '@/components/motion/reveal';
import { buttonVariants } from '@/components/ui/button';
import { SERVICES, SERVICE_SLUGS, isServiceSlug, type ServiceSlug } from '@/lib/services';

export function generateStaticParams() { return SERVICE_SLUGS.map((slug) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; if (!isServiceSlug(slug)) return { title: 'Service not found' }; return { title: SERVICES[slug].name, description: SERVICES[slug].summary }; }

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isServiceSlug(slug)) notFound();
  const service: (typeof SERVICES)[ServiceSlug] = SERVICES[slug];
  return <main className="min-h-dvh bg-canvas"><div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8"><PublicHeader /><div className="py-10 sm:py-16"><Link href="/services" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft aria-hidden="true" className="size-4" /> All services</Link>
    <section className="mt-12 grid gap-10 border-b border-line pb-14 lg:grid-cols-[1fr_.62fr] lg:items-end"><Reveal><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Veencart service / {slug}</p><h1 className="mt-4 max-w-3xl text-5xl font-extrabold leading-[0.94] tracking-[-0.07em] text-content sm:text-7xl">{service.name}</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-content-muted">{service.summary}</p></Reveal><Reveal><p className="text-xs font-bold uppercase tracking-[0.18em] text-content-subtle">The movement</p><ol className="mt-5 grid gap-4 text-sm text-content-muted">{['Share the route', 'Confirm the service', 'Follow the handoff'].map((stage, index) => <li key={stage} className="flex items-center gap-3"><span className="font-mono text-xs text-primary">0{index + 1}</span><span>{stage}</span></li>)}</ol></Reveal></section>
    <section className="content-section grid gap-12 py-14 lg:grid-cols-[1fr_.55fr]"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Included in the service</p><h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-0.05em] text-content">A clearer handoff, from start to finish.</h2><ul className="mt-9 grid gap-x-8 gap-y-5 border-t border-line pt-6 sm:grid-cols-2">{service.included.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-content-muted"><Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" /><span>{item}</span></li>)}</ul></div><aside className="border-l-2 border-[#F47A28] pl-6 sm:pl-8"><ShieldAlert aria-hidden="true" className="size-5 text-[#B2551F]" /><h2 className="mt-5 text-lg font-semibold text-content">What we do not promise</h2><p className="mt-3 text-sm leading-7 text-content-muted">{service.notPromised}</p></aside></section>
    <section className="content-section flex flex-col gap-5 border-t border-content py-8 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-primary">Ready when you are</p><p className="mt-2 max-w-xl text-sm leading-6 text-content-muted">Start with your route details. Coverage and any manual confirmation will be explained before you continue.</p></div><div className="flex flex-wrap gap-3"><Link href="/book" className={buttonVariants({ size: 'lg' })}>Book this service <ArrowRight aria-hidden="true" className="size-5" /></Link><Link href="/track" className={buttonVariants({ variant: 'outline', size: 'lg' })}>Track a shipment</Link></div></section>
    </div><SiteFooter /></div></main>;
}
