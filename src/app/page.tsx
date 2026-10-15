import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check, Clock3, MapPin, PackageCheck, ScanLine, ShoppingBag, Sparkles, Waypoints } from 'lucide-react';
import { PublicHeader } from '@/components/brand/public-header';
import { SiteFooter } from '@/components/brand/site-footer';
import { buttonVariants } from '@/components/ui/button';
import { Reveal, Stagger } from '@/components/motion/reveal';

export const metadata = {
  title: 'Veencart Logistics — Move with care',
  description: 'Book deliveries, track shipments and shop everyday essentials through Veencart Logistics.',
};

const services = [
  { href: '/services/daily', eyebrow: '01', title: 'Daily delivery', body: 'For parcels moving across town, with a clear handoff from pickup to drop-off.', icon: Clock3 },
  { href: '/services/scheduled', eyebrow: '02', title: 'Scheduled delivery', body: 'Choose a collection window that fits the rhythm of your business or your day.', icon: MapPin },
  { href: '/services/bulk', eyebrow: '03', title: 'Bulk and freight', body: 'A considered route for larger consignments and high-volume movement.', icon: PackageCheck },
  { href: '/services/ecommerce', eyebrow: '04', title: 'Ecommerce fulfilment', body: 'Keep orders moving with dispatch and delivery evidence in one flow.', icon: ShoppingBag },
  { href: '/services/interstate', eyebrow: '05', title: 'Interstate delivery', body: 'Move consignments between states, subject to route confirmation.', icon: Waypoints },
];

export default function HomePage() {
  return (
    <main className="overflow-hidden">
      <section className="relative bg-[#071C24] pb-24 pt-5 text-white sm:pb-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -right-24 -top-48 size-[540px] rounded-full bg-[#0A8F8E]/20 blur-3xl" /><div className="absolute -bottom-52 -left-24 size-[420px] rounded-full bg-[#F47A28]/10 blur-3xl" /><div className="absolute inset-x-0 top-[34%] h-px bg-white/[0.07]" /></div>
        <div className="relative mx-auto w-full max-w-[1200px] px-5 sm:px-8"><PublicHeader dark />
          <div className="grid gap-12 pt-16 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:gap-20 lg:pt-24">
            <div>
              <Reveal><p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#6ED0C7]/25 bg-[#6ED0C7]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#A9E5DF]"><Sparkles aria-hidden="true" className="size-3.5" /> Logistics, made human</p></Reveal>
              <Reveal><h1 className="max-w-3xl text-[clamp(2.8rem,6vw,5.6rem)] font-extrabold leading-[0.92] tracking-[-0.07em] text-white">Move what matters<span className="text-[#F47A28]">.</span><br /><span className="text-[#6ED0C7]">with care.</span></h1></Reveal>
              <Reveal className="mt-8 max-w-xl"><p className="text-lg leading-8 text-white/70 sm:text-xl">A calmer way to send parcels, fulfil orders and follow every handoff. Veencart brings delivery and commerce into one clear operation.</p></Reveal>
              <Reveal className="mt-9 flex flex-wrap gap-3"><Link className={buttonVariants({ size: 'lg', className: 'bg-[#F47A28] text-[#071C24] hover:bg-[#ff934d]' })} href="/book">Start a delivery <ArrowRight aria-hidden="true" className="size-5" /></Link><Link className={buttonVariants({ variant: 'outline', size: 'lg', className: 'border-white/25 bg-white/[0.06] text-white hover:bg-white/12' })} href="/track"><ScanLine aria-hidden="true" className="size-5" /> Track a shipment</Link></Reveal>
              <Reveal className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-white/65"><span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="size-4 text-[#6ED0C7]" /> Guest booking available</span><span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="size-4 text-[#6ED0C7]" /> Coverage confirmed per route</span></Reveal>
            </div>
            <Reveal className="relative">
              <div className="absolute -inset-4 rounded-[34px] border border-white/[0.06]" />
              <div className="relative overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.09] p-4 shadow-[0_28px_80px_rgb(0_0_0_/_18%)] backdrop-blur-xl sm:p-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Operations view</p><p className="mt-1 text-sm font-semibold text-white/90">A clear picture of every handoff</p></div><span className="grid size-9 place-items-center rounded-full bg-[#6ED0C7]/15 text-[#A9E5DF]"><Waypoints aria-hidden="true" className="size-4" /></span></div>
                <div className="relative my-6 flex justify-center"><div className="absolute left-[16%] right-[16%] top-1/2 h-px bg-gradient-to-r from-[#6ED0C7]/30 via-[#F47A28] to-white/20" /><div className="relative z-10 grid size-52 place-items-center rounded-full border border-white/10 bg-[#071C24]/55 shadow-inner shadow-white/5 backdrop-blur-md"><Image src="/brand/veencart-logo-original-transparent.png" alt="" aria-hidden="true" width={200} height={200} className="size-44 object-contain" priority /></div></div>
                <div className="grid grid-cols-3 gap-2"><div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><span className="mb-4 block size-2 rounded-full bg-[#6ED0C7]" /><p className="text-xs font-semibold text-white/90">Pickup</p><p className="mt-1 text-[11px] text-white/45">Details captured</p></div><div className="rounded-2xl border border-[#F47A28]/30 bg-[#F47A28]/10 p-3"><span className="mb-4 block size-2 rounded-full bg-[#F47A28]" /><p className="text-xs font-semibold text-white/90">In transit</p><p className="mt-1 text-[11px] text-white/45">Status visible</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><span className="mb-4 block size-2 rounded-full bg-white/35" /><p className="text-xs font-semibold text-white/90">Delivered</p><p className="mt-1 text-[11px] text-white/45">Evidence captured</p></div></div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <div className="relative mx-auto -mt-8 w-full max-w-[1200px] px-5 sm:px-8"><section className="grid gap-1 rounded-[24px] border border-white/70 bg-white/85 p-2 shadow-[0_20px_55px_rgb(7_28_36_/_12%)] backdrop-blur-xl sm:grid-cols-3"><div className="flex items-center gap-3 rounded-2xl p-4"><span className="grid size-10 place-items-center rounded-xl bg-[#DDF4F0] text-[#087E67]"><MapPin aria-hidden="true" className="size-4" /></span><span><strong className="block text-content">Nigeria-first</strong><span className="text-sm text-content-muted">Routes checked as you book</span></span></div><div className="flex items-center gap-3 rounded-2xl p-4"><span className="grid size-10 place-items-center rounded-xl bg-[#FFF0E5] text-[#B2551F]"><PackageCheck aria-hidden="true" className="size-4" /></span><span><strong className="block text-content">Clear status</strong><span className="text-sm text-content-muted">From pickup to delivery</span></span></div><div className="flex items-center gap-3 rounded-2xl p-4"><span className="grid size-10 place-items-center rounded-xl bg-[#DDF4F0] text-[#087E67]"><ShoppingBag aria-hidden="true" className="size-4" /></span><span><strong className="block text-content">Delivery + commerce</strong><span className="text-sm text-content-muted">One connected operation</span></span></div></section></div>

      <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8"><section aria-labelledby="services-heading" className="py-24 sm:py-32"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">What we move</p><h2 id="services-heading" className="mt-3 max-w-xl text-3xl font-bold tracking-[-0.055em] sm:text-4xl text-content ">The right service for the way you work.</h2></div><Link className="inline-flex items-center gap-2 text-sm font-bold text-primary" href="/services">Explore all services <ArrowRight aria-hidden="true" className="size-4" /></Link></div><Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{services.map(({ href, eyebrow, title, body, icon: Icon }, index) => <div key={href} className={index === 0 ? 'lg:col-span-2' : ''}><Link href={href} className="lift group block h-full rounded-[22px] border border-line bg-white/70 p-6 shadow-[0_8px_28px_rgb(32_41_39_/_4%)] backdrop-blur-sm hover:border-[#0A8F8E]/35 hover:bg-white hover:shadow-[0_18px_45px_rgb(7_28_36_/_10%)] sm:p-7"><div className="flex items-start justify-between"><span className="text-xs font-bold tracking-[0.18em] text-content-subtle">{eyebrow}</span><span className="grid size-11 place-items-center rounded-2xl bg-[#DDF4F0] text-[#087E67] transition-transform duration-base group-hover:-translate-y-1"><Icon aria-hidden="true" className="size-5" /></span></div><h3 className="mt-12 text-lg font-medium tracking-[-0.035em] text-content">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-content-muted">{body}</p><span className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-primary">Learn more <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" /></span></Link></div>)}</Stagger></section>
        <section className="relative overflow-hidden rounded-[28px] bg-[#F47A28] px-6 py-12 shadow-[0_20px_55px_rgb(244_122_40_/_22%)] sm:px-12 sm:py-14"><div className="absolute -right-24 -top-28 size-80 rounded-full border-[38px] border-white/20" /><div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#071C24]/65">Always know what’s next</p><h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-[-0.05em] text-[#071C24] sm:text-4xl">Your shipment has a story. We make it easy to follow.</h2><p className="mt-4 max-w-xl leading-7 text-[#071C24]/75">Use your shipment reference to see the latest verified status and the next handoff in the journey.</p></div><Link className={buttonVariants({ variant: 'outline', size: 'lg', className: 'border-[#071C24]/25 bg-transparent text-[#071C24] hover:bg-white/20' })} href="/track">See tracking details <ArrowRight aria-hidden="true" className="size-5" /></Link></div></section>
        <SiteFooter />
      </div>
    </main>
  );
}
