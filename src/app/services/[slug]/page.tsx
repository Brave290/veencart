import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, ShieldAlert } from 'lucide-react';
import { notFound } from 'next/navigation';
import { PublicHeader } from '@/components/brand/public-header';
import { buttonVariants } from '@/components/ui/button';
import { SERVICES, SERVICE_SLUGS, isServiceSlug, type ServiceSlug } from '@/lib/services';

export function generateStaticParams() { return SERVICE_SLUGS.map((slug) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; if (!isServiceSlug(slug)) return { title: 'Service not found' }; return { title: SERVICES[slug].name, description: SERVICES[slug].summary }; }

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isServiceSlug(slug)) notFound();
  const service: (typeof SERVICES)[ServiceSlug] = SERVICES[slug];
  return <main className="min-h-dvh bg-[#F4F7F6]"><div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8"><PublicHeader />
    <div className="py-12 sm:py-20"><Link href="/services" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft aria-hidden="true" className="size-4" /> All services</Link>
      <section className="mt-10 grid gap-10 lg:grid-cols-[1fr_.72fr] lg:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Veencart service / {slug}</p><h1 className="mt-4 max-w-3xl text-5xl font-extrabold leading-[0.98] tracking-[-0.065em] text-content sm:text-6xl">{service.name}</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-content-muted">{service.summary}</p></div><div className="rounded-[24px] border border-[#0A8F8E]/20 bg-[#071C24] p-6 text-white shadow-[0_18px_50px_rgb(7_28_36_/_12%)]"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6ED0C7]">Built into every movement</p><p className="mt-4 text-2xl font-bold tracking-[-0.04em]">A clear next step, from pickup to handover.</p><div className="mt-7 flex items-center gap-2"><span className="size-2 rounded-full bg-[#6ED0C7]" /><span className="h-px flex-1 bg-white/20" /><span className="size-2 rounded-full bg-[#F47A28]" /></div></div></section>
      <section aria-labelledby="included-heading" className="mt-16 grid gap-6 lg:grid-cols-[1fr_.75fr]"><div className="rounded-[24px] border border-line bg-white/80 p-6 shadow-[0_8px_28px_rgb(7_28_36_/_5%)] backdrop-blur-sm sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">The service detail</p><h2 id="included-heading" className="mt-3 text-2xl font-bold tracking-[-0.04em]">What is included</h2><ul className="mt-8 grid gap-4 sm:grid-cols-2">{service.included.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-content-muted"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#DDF4F0] text-primary"><Check aria-hidden="true" className="size-3.5" /></span><span>{item}</span></li>)}</ul></div><section aria-labelledby="limits-heading" className="rounded-[24px] border border-[#F47A28]/25 bg-[#FFF0E5]/75 p-6 sm:p-8"><span className="grid size-10 place-items-center rounded-full bg-[#F47A28] text-[#071C24]"><ShieldAlert aria-hidden="true" className="size-5" /></span><h2 id="limits-heading" className="mt-6 text-xl font-bold tracking-[-0.03em]">What we do not promise</h2><p className="mt-3 text-sm leading-7 text-content-muted">{service.notPromised}</p></section></section>
      <div className="mt-10 flex flex-wrap gap-3"><Link href="/book" className={buttonVariants({ size: 'lg' })}>Book this service <ArrowRight aria-hidden="true" className="size-5" /></Link><Link href="/track" className={buttonVariants({ variant: 'outline', size: 'lg' })}>Track a shipment</Link></div>
    </div></div></main>;
}
