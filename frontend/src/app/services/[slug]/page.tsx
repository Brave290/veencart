import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, CircleDot, ShieldAlert } from 'lucide-react';
import { notFound } from 'next/navigation';
import { PublicHeader } from '@/components/brand/public-header';
import { SiteFooter } from '@/components/brand/site-footer';
import { Reveal } from '@/components/motion/reveal';
import { buttonVariants } from '@/components/ui/button';
import { SERVICES, SERVICE_SLUGS, isServiceSlug, type ServiceSlug } from '@/lib/services';

export function generateStaticParams() { return SERVICE_SLUGS.map((slug) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; if (!isServiceSlug(slug)) return { title: 'Service not found' }; return { title: SERVICES[slug].name, description: SERVICES[slug].summary }; }

const stages = ['Share the route', 'Confirm the service', 'Follow the handoff'];

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isServiceSlug(slug)) notFound();
  const service: (typeof SERVICES)[ServiceSlug] = SERVICES[slug];
  return <main className="min-h-dvh bg-canvas"><div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8"><PublicHeader />
    <div className="py-10 sm:py-16"><Link href="/services" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft aria-hidden="true" className="size-4" /> All services</Link>
      <section className="mt-10 grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-end"><Reveal><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Veencart service / {slug}</p><h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[0.98] tracking-[-0.065em] text-content sm:text-6xl">{service.name}</h1><p className="mt-6 max-w-2xl text-base leading-7 text-content-muted">{service.summary}</p></Reveal><Reveal className="rounded-[24px] bg-[#071C24] p-6 text-white shadow-[0_18px_50px_rgb(7_28_36_/_14%)] sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A9E5DF]">How this moves</p><div className="mt-7 grid gap-5">{stages.map((stage, index) => <div className="flex items-center gap-3" key={stage}><span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-semibold text-[#A9E5DF]">0{index + 1}</span><span className="text-sm text-white/75">{stage}</span>{index < stages.length - 1 ? <span className="hidden h-px flex-1 bg-white/15 sm:block" /> : null}</div>)}</div></Reveal></section>
      <section className="content-section mt-14 grid gap-5 lg:grid-cols-[1fr_.68fr]"><div className="rounded-[24px] border border-line bg-surface p-6 shadow-xs sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Included in the service</p><h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-content">A clearer handoff, from start to finish.</h2><ul className="mt-8 grid gap-4 sm:grid-cols-2">{service.included.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-content-muted"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary-subtle text-primary"><Check aria-hidden="true" className="size-3.5" /></span><span>{item}</span></li>)}</ul></div><aside className="rounded-[24px] border border-orange-500/25 bg-orange-50 p-6 sm:p-8"><span className="grid size-10 place-items-center rounded-full bg-[#F47A28] text-[#071C24]"><ShieldAlert aria-hidden="true" className="size-5" /></span><h2 className="mt-6 text-lg font-semibold text-content">What we do not promise</h2><p className="mt-3 text-sm leading-7 text-content-muted">{service.notPromised}</p></aside></section>
      <section className="content-section mt-6 flex flex-col gap-4 rounded-[24px] border border-line bg-surface-muted p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"><div><div className="flex items-center gap-2 text-sm font-semibold text-primary"><CircleDot aria-hidden="true" className="size-4" /> Ready when you are</div><p className="mt-2 text-sm text-content-muted">Start with your route details. Coverage and any manual confirmation will be explained before you continue.</p></div><div className="flex flex-wrap gap-3"><Link href="/book" className={buttonVariants({ size: 'lg' })}>Book this service <ArrowRight aria-hidden="true" className="size-5" /></Link><Link href="/track" className={buttonVariants({ variant: 'outline', size: 'lg' })}>Track a shipment</Link></div></section>
    </div><SiteFooter /></div></main>;
}
