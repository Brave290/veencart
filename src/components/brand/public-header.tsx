'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { VeencartLogo } from '@/components/brand/veencart-logo';
import { buttonVariants } from '@/components/ui/button';

type PublicHeaderProps = { dark?: boolean };

export function PublicHeader({ dark = false }: PublicHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 18);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  const solid = scrolled || !dark;
  return (
    <div className="relative z-50 h-[94px]">
      <header className={`fixed inset-x-0 top-3 px-3 transition-all duration-base sm:px-5 ${solid ? 'text-content' : 'text-white'}`}>
        <div className={`mx-auto flex min-h-[68px] max-w-[1200px] items-center justify-between rounded-full border px-4 backdrop-blur-2xl transition-all duration-base sm:px-5 ${solid ? 'border-white/70 bg-white/90 shadow-[0_14px_36px_rgb(7_28_36_/_12%)]' : 'border-white/20 bg-[#071C24]/55 shadow-[0_14px_36px_rgb(0_0_0_/_12%)]'}`}>
          <VeencartLogo href="/" inverse={!solid} />
          <nav aria-label="Primary" className={`hidden items-center gap-7 text-sm font-medium md:flex ${solid ? 'text-content/80' : 'text-white/90'}`}>
            <Link className="transition-colors hover:text-primary" href="/services">Services</Link>
            <Link className="transition-colors hover:text-primary" href="/store">Marketplace</Link>
            <Link className="transition-colors hover:text-primary" href="/track">Track</Link>
            <Link className={buttonVariants({ size: 'sm', className: solid ? '' : 'bg-white text-brand-900 hover:bg-white/90' })} href="/book">Book a delivery <ArrowRight aria-hidden="true" className="size-4" /></Link>
          </nav>
          <Link aria-label="Book a delivery" className={buttonVariants({ size: 'sm', className: solid ? 'md:hidden' : 'bg-white text-brand-900 hover:bg-white/90 md:hidden' })} href="/book">Book <ArrowRight aria-hidden="true" className="size-4" /></Link>
        </div>
      </header>
    </div>
  );
}
