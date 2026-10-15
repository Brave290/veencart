import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { VeencartLogo } from '@/components/brand/veencart-logo';
import { buttonVariants } from '@/components/ui/button';

type PublicHeaderProps = { dark?: boolean };

export function PublicHeader({ dark = false }: PublicHeaderProps) {
  return (
    <header className={dark ? 'relative z-10 flex min-h-[76px] items-center justify-between rounded-[22px] border border-white/12 bg-white/[0.07] px-4 shadow-[0_16px_40px_rgb(0_0_0_/_10%)] backdrop-blur-xl sm:px-5' : 'relative z-10 flex min-h-[76px] items-center justify-between border-b border-line-subtle bg-white/70 px-0 backdrop-blur-xl'}>
      <VeencartLogo href="/" />
      <nav aria-label="Primary" className={dark ? 'hidden items-center gap-7 text-sm font-semibold text-white/75 md:flex' : 'hidden items-center gap-7 text-sm font-semibold text-content-muted md:flex'}>
        <Link className="transition-colors hover:text-primary" href="/services">Services</Link>
        <Link className="transition-colors hover:text-primary" href="/store">Marketplace</Link>
        <Link className="transition-colors hover:text-primary" href="/track">Track</Link>
        <Link className={buttonVariants({ size: 'sm', className: dark ? 'bg-white text-brand-900 hover:bg-white/90' : '' })} href="/book">Book a delivery <ArrowRight aria-hidden="true" className="size-4" /></Link>
      </nav>
      <Link aria-label="Book a delivery" className={buttonVariants({ size: 'sm', className: 'md:hidden' })} href="/book">Book <ArrowRight aria-hidden="true" className="size-4" /></Link>
    </header>
  );
}
