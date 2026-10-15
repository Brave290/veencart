'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { VeencartLogo } from '@/components/brand/veencart-logo';
import { ThemeToggle } from '@/components/theme-provider';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

type PublicHeaderProps = { dark?: boolean };

/**
 * Site header.
 *
 * LAYOUT CONTRACT (all breakpoints)
 *   Left:  logo, then the primary nav text (from md up).
 *   Right: theme toggle, the menu button, and the Book CTA (from lg up).
 *
 * The menu button is shown at every width so the full site map is always one
 * tap away; on desktop it sits after the theme toggle, on mobile it is the
 * right-most control.
 */
const links = [
  { href: '/services', label: 'Services' },
  { href: '/store', label: 'Marketplace' },
  { href: '/track', label: 'Track' },
  { href: '/contact', label: 'Contact' },
];

export function PublicHeader({ dark = false }: PublicHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 18);
    };
    const onScroll = () => {
      // Coalesce scroll events into one state read per frame.
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const solid = scrolled || !dark;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="relative z-50 h-[76px] sm:h-[84px]">
      <header
        className={cn(
          'fixed inset-x-0 top-0 px-3 pt-3 transition-colors duration-base sm:px-5 sm:pt-4',
          solid ? 'text-content' : 'text-white',
        )}
      >
        <div
          className={cn(
            'relative mx-auto flex h-[60px] w-full max-w-[1200px] items-center justify-between gap-3 rounded-full border pl-3 pr-2 backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-base sm:pl-4 sm:pr-2.5',
            solid
              ? 'border-line bg-surface/95 shadow-[0_14px_36px_rgb(7_28_36_/_12%)]'
              : 'border-white/20 bg-[#071C24]/60 shadow-[0_14px_36px_rgb(0_0_0_/_12%)]',
          )}
        >
          {/* LEFT: logo and primary navigation text */}
          <div className="flex min-w-0 items-center gap-6 lg:gap-8">
            <VeencartLogo href="/" inverse={!solid} className="shrink-0" />
            <nav aria-label="Primary" className="hidden md:block">
              <ul className="flex items-center gap-1">
                {links.map((link) => {
                  const active = isActive(link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium transition-colors duration-fast',
                          active
                            ? solid ? 'bg-primary text-primary-fg' : 'bg-white/12 text-white'
                            : solid ? 'text-content-muted hover:bg-surface-muted hover:text-content' : 'text-white/80 hover:bg-white/10 hover:text-white',
                        )}
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          {/* RIGHT: theme toggle, Book CTA (lg+), menu button */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle inverse={!solid} className="size-11" />
            <Link
              href="/book"
              className={cn(buttonVariants({ size: 'sm', className: 'hidden h-11 lg:inline-flex' }), !solid && 'bg-white text-brand-900 hover:bg-white/90')}
            >
              Book a delivery <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((open) => !open)}
              className={cn(
                'grid size-11 place-items-center rounded-full border transition-colors duration-fast',
                solid
                  ? 'border-line-strong text-content hover:border-primary hover:text-primary'
                  : 'border-white/25 text-white hover:bg-white/10',
              )}
            >
              {menuOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
            </button>
          </div>
        </div>

        {/* Drawer. Always in the DOM; `inert` keeps hidden links out of the tab order. */}
        <div className={cn('fixed inset-0 z-[60]', menuOpen ? 'visible' : 'invisible')} inert={!menuOpen}>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className={cn('absolute inset-0 cursor-default bg-[#071C24]/55 transition-opacity duration-base', menuOpen ? 'opacity-100' : 'opacity-0')}
          />
          <aside
            id="site-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className={cn(
              'absolute inset-y-0 right-0 flex w-[min(88vw,22rem)] flex-col overflow-y-auto border-l border-line bg-surface p-6 text-content shadow-dialog transition-transform duration-moderate ease-enter',
              menuOpen ? 'translate-x-0' : 'translate-x-full',
            )}
          >
            <div className="flex items-center justify-between border-b border-line-subtle pb-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-content-subtle">Menu</p>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="grid size-11 place-items-center rounded-full border border-line-strong text-content-muted hover:border-primary hover:text-primary"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <nav aria-label="Mobile primary" className="mt-6 grid gap-1">
              {[{ href: '/', label: 'Home' }, ...links].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-12 items-center rounded-2xl px-4 text-lg font-semibold tracking-[-0.02em] hover:bg-surface-muted aria-[current=page]:bg-primary-subtle aria-[current=page]:text-primary"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto border-t border-line-subtle pt-6">
              <Link className={buttonVariants({ size: 'lg', className: 'w-full' })} href="/book" onClick={() => setMenuOpen(false)}>
                Book a delivery <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <p className="mt-4 text-center text-xs leading-5 text-content-subtle">Clearer movement for people, parcels and growing businesses.</p>
            </div>
          </aside>
        </div>
      </header>
    </div>
  );
}
