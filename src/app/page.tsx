import Link from 'next/link';
import { ArrowRight, Check, Clock3, MapPin, PackageCheck, ScanLine, ShoppingBag, Sparkles } from 'lucide-react';
import { VeencartLogo } from '@/components/brand/veencart-logo';
import { buttonVariants } from '@/components/ui/button';
import { Reveal, Stagger } from '@/components/motion/reveal';

export const metadata = {
  title: 'Veencart Logistics — Move with care',
  description: 'Book deliveries, track shipments and shop everyday essentials through Veencart Logistics.',
};

const services = [
  { href: '/services/daily', eyebrow: '01', title: 'Daily delivery', body: 'For the parcels that need to move across town, with a clear handoff from pickup to drop-off.', icon: Clock3 },
  { href: '/services/scheduled', eyebrow: '02', title: 'Scheduled delivery', body: 'Choose a collection window that fits the rhythm of your business or your day.', icon: MapPin },
  { href: '/services/bulk', eyebrow: '03', title: 'Bulk and freight', body: 'A considered route for larger consignments, palletised goods and high-volume movement.', icon: PackageCheck },
  { href: '/services/ecommerce', eyebrow: '04', title: 'Ecommerce fulfilment', body: 'Keep orders moving with dispatch and delivery evidence in one operational flow.', icon: ShoppingBag },
  { href: '/services/interstate', eyebrow: '05', title: 'Interstate delivery', body: 'Move consignments between states, subject to route availability and confirmation.', icon: MapPin },
];

export default function HomePage() {
  return (
    <main className="overflow-hidden">
      <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
        <header className="flex min-h-[76px] items-center justify-between border-b border-line-subtle">
          <VeencartLogo href="/" />
          <nav aria-label="Primary" className="hidden items-center gap-7 text-sm font-semibold text-content-muted md:flex">
            <Link className="transition-colors hover:text-primary" href="/services">Services</Link>
            <Link className="transition-colors hover:text-primary" href="/store">Marketplace</Link>
            <Link className="transition-colors hover:text-primary" href="/track">Track</Link>
            <Link className={buttonVariants({ size: 'sm' })} href="/book">Book a delivery <ArrowRight aria-hidden="true" className="size-4" /></Link>
          </nav>
          <Link aria-label="Book a delivery" className={buttonVariants({ size: 'sm', className: 'md:hidden' })} href="/book">Book <ArrowRight aria-hidden="true" className="size-4" /></Link>
        </header>

        <section className="relative grid gap-10 pb-20 pt-16 sm:pt-20 lg:grid-cols-[1.04fr_.96fr] lg:items-center lg:gap-16 lg:pb-28 lg:pt-24">
          <div className="pointer-events-none absolute -left-24 top-10 -z-10 size-72 rounded-full bg-brand-100/60 blur-3xl" />
          <div>
            <Reveal><p className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary-subtle px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary"><Sparkles aria-hidden="true" className="size-3.5" /> Logistics, made human</p></Reveal>
            <Reveal><h1 className="max-w-[680px] text-[clamp(2.8rem,7vw,5.9rem)] font-extrabold leading-[0.96] tracking-[-0.065em] text-content">Move what matters<span className="text-accent">.</span><br /><span className="text-primary">with care.</span></h1></Reveal>
            <Reveal className="mt-7 max-w-xl"><p className="text-lg leading-8 text-content-muted sm:text-xl">A calmer way to send parcels, fulfil orders and follow every handoff. Veencart brings delivery and commerce into one clear operation.</p></Reveal>
            <Reveal className="mt-8 flex flex-wrap gap-3"><Link className={buttonVariants({ size: 'lg' })} href="/book">Start a delivery <ArrowRight aria-hidden="true" className="size-5" /></Link><Link className={buttonVariants({ variant: 'outline', size: 'lg' })} href="/track"><ScanLine aria-hidden="true" className="size-5" /> Track a shipment</Link></Reveal>
            <Reveal className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-content-muted"><span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="size-4 text-primary" /> Guest booking available</span><span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="size-4 text-primary" /> Coverage confirmed per route</span></Reveal>
          </div>
          <Reveal className="relative">
            <div className="relative overflow-hidden rounded-[28px] bg-brand-900 p-5 shadow-[0_24px_70px_rgb(11_79_74_/_18%)] sm:p-7">
              <div className="absolute -right-20 -top-20 size-64 rounded-full border border-white/10" /><div className="absolute -right-8 -top-8 size-40 rounded-full border border-white/10" />
              <div className="relative flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">The Veencart way</span><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">01 — 04</span></div>
              <div className="relative mt-20 sm:mt-28"><p className="max-w-sm text-3xl font-bold leading-tight tracking-[-0.04em] text-white sm:text-4xl">One handoff at a time. Nothing lost in between.</p><div className="mt-12 flex items-end justify-between gap-5"><div><p className="text-xs uppercase tracking-[0.16em] text-white/55">Built for</p><p className="mt-2 font-semibold text-white">People + businesses</p></div><div className="flex -space-x-2"><span className="size-9 rounded-full border-2 border-brand-900 bg-accent" /><span className="size-9 rounded-full border-2 border-brand-900 bg-primary-subtle" /><span className="size-9 rounded-full border-2 border-brand-900 bg-white/80" /></div></div></div>
              <div className="relative mt-8 h-1 overflow-hidden rounded-full bg-white/15"><div className="h-full w-2/3 rounded-full bg-accent" /></div>
            </div>
          </Reveal>
        </section>

        <section className="grid gap-4 border-y border-line-subtle py-5 text-sm text-content-muted sm:grid-cols-3 sm:gap-8"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-primary-subtle text-primary"><MapPin aria-hidden="true" className="size-4" /></span><span><strong className="block text-content">Nigeria-first</strong>Routes checked as you book</span></div><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-accent-100 text-accent"><PackageCheck aria-hidden="true" className="size-4" /></span><span><strong className="block text-content">Clear status</strong>From pickup to delivery</span></div><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-primary-subtle text-primary"><ShoppingBag aria-hidden="true" className="size-4" /></span><span><strong className="block text-content">Delivery + commerce</strong>One connected operation</span></div></section>

        <section aria-labelledby="services-heading" className="py-20 sm:py-28"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">What we move</p><h2 id="services-heading" className="mt-3 max-w-xl text-3xl font-bold tracking-[-0.04em] sm:text-4xl">The right service for the way you work.</h2></div><Link className="inline-flex items-center gap-2 text-sm font-bold text-primary" href="/services">Explore all services <ArrowRight aria-hidden="true" className="size-4" /></Link></div><Stagger className="mt-10 grid gap-4 sm:grid-cols-2">{services.map(({ href, eyebrow, title, body, icon: Icon }) => <div key={href}><Link href={href} className="lift group block h-full rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_3px_rgb(32_41_39_/_5%)] hover:border-primary/40 hover:shadow-[0_12px_30px_rgb(32_41_39_/_8%)]"><div className="flex items-start justify-between"><span className="text-xs font-bold tracking-[0.16em] text-content-subtle">{eyebrow}</span><span className="grid size-10 place-items-center rounded-xl bg-primary-subtle text-primary transition-transform duration-base group-hover:-translate-y-1"><Icon aria-hidden="true" className="size-5" /></span></div><h3 className="mt-10 text-xl font-bold tracking-[-0.03em]">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-content-muted">{body}</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary">Learn more <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" /></span></Link></div>)}</Stagger></section>

        <section className="relative overflow-hidden rounded-[28px] bg-accent px-6 py-12 sm:px-12 sm:py-14"><div className="absolute -right-16 -top-24 size-72 rounded-full border-[34px] border-white/20" /><div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-orange-ink/70">Always know what’s next</p><h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-[-0.04em] text-brand-orange-ink sm:text-4xl">Your shipment has a story. We make it easy to follow.</h2><p className="mt-4 max-w-xl leading-7 text-brand-orange-ink/80">Use your shipment reference to see the latest verified status and the next handoff in the journey.</p></div><Link className={buttonVariants({ variant: 'outline', size: 'lg', className: 'border-brand-orange-ink/30 bg-transparent text-brand-orange-ink hover:bg-white/20' })} href="/track">See tracking details <ArrowRight aria-hidden="true" className="size-5" /></Link></div></section>

        <footer className="flex flex-col gap-5 py-12 text-sm text-content-muted sm:flex-row sm:items-center sm:justify-between"><VeencartLogo compact href="/" /><div className="flex flex-wrap gap-x-6 gap-y-2"><Link className="hover:text-primary" href="/services">Services</Link><Link className="hover:text-primary" href="/track">Track</Link></div><p>© {new Date().getFullYear()} Veencart</p></footer>
      </div>
    </main>
  );
}
