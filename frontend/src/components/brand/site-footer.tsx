import Link from 'next/link';
import { AtSign, Globe2, MessageCircle, Share2 } from 'lucide-react';
import { VeencartLogo } from '@/components/brand/veencart-logo';

const socialIcons = [
  { label: 'Social updates', Icon: Share2 },
  { label: 'Community', Icon: Globe2 },
  { label: 'Messages', Icon: MessageCircle },
  { label: 'Email updates', Icon: AtSign },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative mt-20 -mx-5 overflow-hidden border-t border-[#21424A] bg-[#071C24] text-white sm:mt-28 sm:-mx-8">
      <div className="mx-auto max-w-[1200px] px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_.7fr_.7fr]">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left"><VeencartLogo compact href="/" /><p className="mt-5 max-w-xs text-sm leading-6 text-white/60">Clearer movement for people, parcels and growing businesses.</p><div className="mt-7 flex items-center gap-2" aria-label="Social channels"><span className="mr-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Follow</span>{socialIcons.map(({ label, Icon }) => <span key={label} title={`${label} — coming soon`} aria-label={`${label} social profile coming soon`} className="grid size-9 place-items-center rounded-full border border-white/15 text-white/65"><Icon aria-hidden="true" className="size-4" /></span>)}</div></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A9E5DF]">Explore</p><div className="mt-5 grid gap-3 text-sm text-white/65"><Link className="hover:text-white" href="/services">Services</Link><Link className="hover:text-white" href="/store">Shop essentials</Link><Link className="hover:text-white" href="/track">Track your parcel</Link></div></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A9E5DF]">Start here</p><div className="mt-5 grid gap-3 text-sm text-white/65"><Link className="hover:text-white" href="/book">Start a delivery</Link><Link className="hover:text-white" href="/services">How it works</Link></div></div>
        </div>
        <div className="mt-14 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between"><p>© {year} Veencart Logistics. Built for the next handoff.</p><p>Coverage varies by route.</p></div>
      </div>
    </footer>
  );
}
