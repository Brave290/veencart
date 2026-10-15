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
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    if (menuOpen) window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
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
          <div className="ml-auto flex items-center gap-2 md:hidden">
            <ThemeToggle inverse={!solid} />
            <button type="button" aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen((open) => !open)} className={`grid size-10 place-items-center rounded-full border ${solid ? 'border-line-strong' : 'border-white/20'}`}>
              {menuOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
            </button>
          </div>
        </div>
        <div className={`fixed inset-0 z-[60] md:hidden ${menuOpen ? 'visible' : 'invisible'}`} aria-hidden={!menuOpen}>
          <button type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} className={`absolute inset-0 cursor-default bg-[#071C24]/55 transition-opacity duration-base ${menuOpen ? 'opacity-100' : 'opacity-0'}`} />
          <aside id="mobile-navigation" role="dialog" aria-modal="true" aria-label="Mobile navigation" className={`absolute inset-y-0 right-0 flex w-[min(88vw,22rem)] flex-col border-l border-line bg-surface p-6 text-content shadow-dialog transition-transform duration-moderate ease-enter ${menuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex items-center justify-between border-b border-line-subtle pb-5"><p className="text-xs font-bold uppercase tracking-[0.2em] text-content-subtle">Menu</p><button type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} className="grid size-10 place-items-center rounded-full border border-line-strong text-content-muted hover:border-primary hover:text-primary"><X aria-hidden="true" className="size-5" /></button></div>
            <nav aria-label="Mobile primary" className="mt-6 grid gap-2">{links.map((link) => <Link className="rounded-2xl px-4 py-4 text-lg font-semibold tracking-[-0.02em] hover:bg-surface-muted" href={link.href} key={link.href} onClick={() => setMenuOpen(false)}>{link.label}</Link>)}</nav>
            <div className="mt-auto border-t border-line-subtle pt-6"><Link className={buttonVariants({ size: 'lg', className: 'w-full' })} href="/book" onClick={() => setMenuOpen(false)}>Book a delivery <ArrowRight aria-hidden="true" className="size-4" /></Link><p className="mt-4 text-center text-xs leading-5 text-content-subtle">Clearer movement for people, parcels and growing businesses.</p></div>
          </aside>
        </div>
      </header>
    </div>
  );
}
