import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, MoveRight } from 'lucide-react';
import { PublicHeader } from '@/components/brand/public-header';
import { SERVICES, SERVICE_SLUGS } from '@/lib/services';

export const metadata: Metadata = {
  title: 'Services',
  description: 'Daily, scheduled, bulk, interstate and ecommerce delivery services from Veencart Logistics.',
};

export default function ServicesIndexPage() {
  return (
    <main className="min-h-dvh bg-[#F4F7F6]">
      <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8"><PublicHeader />
        <section className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[.85fr_1.15fr] lg:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">The Veencart network</p><h1 className="mt-4 max-w-xl text-5xl font-extrabold leading-[0.98] tracking-[-0.065em] text-content sm:text-6xl">Services built for movement.</h1></div><p className="max-w-lg text-lg leading-8 text-content-muted">From an everyday parcel to a high-volume consignment, choose a service that keeps the next handoff clear.</p></section>
        <div className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">{SERVICE_SLUGS.map((slug, index) => { const s = SERVICES[slug]; return <Link key={slug} href={`/services/${slug}`} className={index === 0 ? 'lift group rounded-[24px] border border-[#0A8F8E]/25 bg-[#071C24] p-6 text-white shadow-[0_18px_50px_rgb(7_28_36_/_16%)] sm:p-8 lg:col-span-2' : 'lift group rounded-[24px] border border-line bg-white/80 p-6 shadow-[0_8px_28px_rgb(7_28_36_/_5%)] backdrop-blur-sm sm:p-8'}><div className="flex items-start justify-between"><span className={index === 0 ? 'text-xs font-bold tracking-[0.2em] text-[#6ED0C7]' : 'text-xs font-bold tracking-[0.2em] text-content-subtle'}>0{index + 1}</span><span className={index === 0 ? 'grid size-10 place-items-center rounded-full bg-[#F47A28] text-[#071C24]' : 'grid size-10 place-items-center rounded-full bg-[#DDF4F0] text-primary'}><MoveRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" /></span></div><h2 className="mt-16 text-2xl font-bold tracking-[-0.04em]">{s.name}</h2><p className={index === 0 ? 'mt-3 max-w-xl leading-7 text-white/65' : 'mt-3 leading-7 text-content-muted'}>{s.summary}</p><span className={index === 0 ? 'mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#A9E5DF]' : 'mt-8 inline-flex items-center gap-2 text-sm font-bold text-primary'}>Explore service <ArrowRight aria-hidden="true" className="size-4" /></span></Link>; })}</div>
        <div className="mb-16 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line-subtle pt-6 text-sm text-content-muted"><span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="size-4 text-primary" /> Coverage confirmed per route</span><span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="size-4 text-primary" /> No invented prices or promises</span></div>
      </div>
    </main>
  );
}
