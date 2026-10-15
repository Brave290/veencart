import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, MoveRight, Route, ShieldCheck } from 'lucide-react';
import { PublicHeader } from '@/components/brand/public-header';
import { SiteFooter } from '@/components/brand/site-footer';
import { Reveal, Stagger } from '@/components/motion/reveal';
import { SERVICES, SERVICE_SLUGS } from '@/lib/services';

export const metadata: Metadata = {
  title: 'Services',
  description: 'Daily, scheduled, bulk, interstate and ecommerce delivery services from Veencart Logistics.',
};

export default function ServicesIndexPage() {
  return (
    <main className="min-h-dvh bg-canvas">
      <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
        <PublicHeader />
        <section className="relative overflow-hidden rounded-[30px] bg-[#071C24] px-6 py-12 text-white shadow-[0_24px_70px_rgb(7_28_36_/_16%)] sm:px-10 sm:py-16 lg:px-14">
          <div className="pointer-events-none absolute -right-24 -top-36 size-96 rounded-full border-[42px] border-[#6ED0C7]/10" />
          <div className="relative grid gap-10 lg:grid-cols-[1.25fr_.75fr] lg:items-end">
            <Reveal><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#A9E5DF]">The Veencart network</p><h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-[0.98] tracking-[-0.065em] sm:text-6xl">Services built for the next handoff.</h1><p className="mt-6 max-w-xl text-base leading-7 text-white/65">From an everyday parcel to a high-volume consignment, choose a service that keeps every movement clear, considered and easy to follow.</p></Reveal>
            <Reveal className="rounded-2xl border border-white/10 bg-white/[0.06] p-5"><div className="flex items-center gap-3 text-[#A9E5DF]"><Route aria-hidden="true" className="size-5" /><span className="text-sm font-semibold">A route-first operation</span></div><p className="mt-4 text-sm leading-6 text-white/60">Coverage is confirmed per route. No invented delivery times, prices or promises.</p></Reveal>
          </div>
        </section>

        <section aria-labelledby="service-list-heading" className="content-section py-16 sm:py-24">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Choose your movement</p><h2 id="service-list-heading" className="mt-3 text-3xl font-bold tracking-[-0.055em] text-content sm:text-4xl">One clear path for every parcel.</h2></div><p className="max-w-sm text-sm leading-6 text-content-muted">Select a service to see what is included, what to expect and where the route needs confirmation.</p></div>
          <Stagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{SERVICE_SLUGS.map((slug, index) => { const service = SERVICES[slug]; return <div key={slug} className={index === 0 ? 'sm:col-span-2' : ''}><Link href={`/services/${slug}`} className={`lift group flex h-full min-h-64 flex-col rounded-[24px] border p-6 shadow-xs transition-colors sm:p-8 ${index === 0 ? 'border-primary/30 bg-primary text-white shadow-[0_18px_50px_rgb(8_126_103_/_16%)]' : 'border-line bg-surface hover:border-primary/35'}`}><div className="flex items-start justify-between"><span className={`text-xs font-bold tracking-[0.2em] ${index === 0 ? 'text-[#A9E5DF]' : 'text-content-subtle'}`}>0{index + 1}</span><span className={`grid size-10 place-items-center rounded-full ${index === 0 ? 'bg-white/15 text-white' : 'bg-primary-subtle text-primary'}`}><MoveRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" /></span></div><div className="mt-auto"><h3 className="mt-12 text-xl font-semibold tracking-[-0.04em]">{service.name}</h3><p className={`mt-3 max-w-xl text-sm leading-6 ${index === 0 ? 'text-white/70' : 'text-content-muted'}`}>{service.summary}</p><span className={`mt-7 inline-flex items-center gap-2 text-sm font-bold ${index === 0 ? 'text-[#A9E5DF]' : 'text-primary'}`}>Explore service <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" /></span></div></Link></div>; })}</Stagger>
        </section>

        <section className="content-section mb-16 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-line bg-surface p-6"><ShieldCheck aria-hidden="true" className="size-5 text-primary" /><h2 className="mt-5 text-lg font-semibold text-content">Clear by design</h2><p className="mt-2 text-sm leading-6 text-content-muted">Every service keeps the next status visible, from booking request to delivery evidence.</p></div><div className="rounded-2xl border border-line bg-surface-muted p-6"><Check aria-hidden="true" className="size-5 text-primary" /><h2 className="mt-5 text-lg font-semibold text-content">Honest coverage</h2><p className="mt-2 text-sm leading-6 text-content-muted">Availability and pricing are confirmed as your booking details are reviewed.</p></div></section>
        <SiteFooter />
      </div>
    </main>
  );
}
