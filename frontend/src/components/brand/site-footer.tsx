import Link from 'next/link';
import { VeencartLogo } from '@/components/brand/veencart-logo';

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-20 border-t border-line-subtle py-12 sm:mt-28 sm:py-16">
      <div className="grid gap-10 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div className="flex flex-col items-center text-center sm:items-start sm:text-left"><VeencartLogo compact href="/" /><p className="mt-4 max-w-xs text-sm font-light leading-6 text-content-muted">Clearer movement for people, parcels and growing businesses.</p></div>
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-content">Explore</p><div className="mt-4 grid gap-3 text-sm font-light text-content-muted"><Link className="hover:text-primary" href="/services">Services</Link><Link className="hover:text-primary" href="/store">Shop essentials</Link><Link className="hover:text-primary" href="/track">Track your parcel</Link></div></div>
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-content">Start here</p><div className="mt-4 grid gap-3 text-sm font-light text-content-muted"><Link className="hover:text-primary" href="/book">Start a delivery</Link><Link className="hover:text-primary" href="/services">How it works</Link></div></div>
      </div>
      <div className="mt-12 flex flex-col gap-2 border-t border-line-subtle pt-5 text-xs font-light text-content-subtle sm:flex-row sm:items-center sm:justify-between"><p>© {year} Veencart Logistics. Built for the next handoff.</p><p>Coverage varies by route.</p></div>
    </footer>
  );
}
