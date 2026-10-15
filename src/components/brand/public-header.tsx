'use client';

import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { VeencartLogo } from '@/components/brand/veencart-logo';
import { ThemeToggle } from '@/components/theme-provider';
import { buttonVariants } from '@/components/ui/button';

type PublicHeaderProps = { dark?: boolean };
const links = [
  { href: '/services', label: 'Services' },
  { href: '/store', label: 'Marketplace' },
  { href: '/track', label: 'Track' },
];

export function PublicHeader({ dark = false }: PublicHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 18);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);
  const solid = scrolled || !dark;
  const foreground = solid ? 'text-content' : 'text-white';
  return (
    <div className="relative z-50 h-[94px]">
      <header className={`fixed inset-x-0 top-3 px-3 transition-[transform,opacity,background-color,box-shadow] duration-base sm:px-5 ${foreground}`}>
        <div className={`relative mx-auto flex min-h-[68px] max-w-[1200px] items-center justify-between rounded-full border px-4 backdrop-blur-2xl transition-[background-color,border-color,box-shadow] duration-base sm:px-5 ${solid ? 'border-white/70 bg-white/90 shadow-[0_14px_36px_rgb(7_28_36_/_12%)]' : 'border-white/20 bg-[#071C24]/55 shadow-[0_14px_36px_rgb(0_0_0_/_12%)]'}`}>
          <div className="absolute left-1/2 -translate-x-1/2"><VeencartLogo href="/" inverse={!solid} /></div>
          <nav aria-label="Primary" className={`hidden items-center gap-7 text-sm font-medium md:flex ${solid ? 'text-content/80' : 'text-white/90'}`}>
            {links.map((link) => <Link className="transition-colors hover:text-primary" href={link.href} key={link.href}>{link.label}</Link>)}
            <ThemeToggle inverse={!solid} />
            <Link className={buttonVariants({ size: 'sm', className: solid ? '' : 'bg-white text-brand-900 hover:bg-white/90' })} href="/book">Book a delivery <ArrowRight aria-hidden="true" className="size-4" /></Link>
          </nav>
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle inverse={!solid} />
            <button type="button" aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen((open) => !open)} className={`grid size-10 place-items-center rounded-full border ${solid ? 'border-line-strong' : 'border-white/20'}`}>
              {menuOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <nav id="mobile-navigation" aria-label="Mobile primary" className="mx-3 mt-2 grid gap-1 rounded-3xl border border-line bg-surface p-3 text-content shadow-popover md:hidden">
            {links.map((link) => <Link className="rounded-2xl px-4 py-3 font-medium hover:bg-surface-muted" href={link.href} key={link.href} onClick={() => setMenuOpen(false)}>{link.label}</Link>)}
            <Link className={buttonVariants({ size: 'lg', className: 'mt-2' })} href="/book" onClick={() => setMenuOpen(false)}>Book a delivery <ArrowRight aria-hidden="true" className="size-4" /></Link>
          </nav>
        ) : null}
      </header>
    </div>
  );
}
