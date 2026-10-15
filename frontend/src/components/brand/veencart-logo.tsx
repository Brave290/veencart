import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/cn';

type VeencartLogoProps = {
  href?: string;
  compact?: boolean;
  className?: string;
  label?: string;
  inverse?: boolean;
};

/**
 * Uses the supplied production logo artwork as the source of truth. The
 * transparent version removes only the outside canvas, preserving the badge,
 * wing/V, wordmark, logistics label and delivery truck exactly.
 */
export function VeencartLogo({ href, compact = false, className, label = 'Veencart Logistics home', inverse = false }: VeencartLogoProps) {
  const logo = (
    <span className={cn('inline-flex items-center gap-2.5', className)} aria-label={label}>
      <Image
        src="/brand/veencart-logo-original-transparent.png"
        alt=""
        aria-hidden="true"
        width={compact ? 44 : 52}
        height={compact ? 44 : 52}
        className={compact ? 'size-11 object-contain' : 'size-[52px] object-contain'}
        priority={!compact}
      />
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span className={`text-[1.02rem] font-semibold tracking-[0.04em] ${inverse ? 'text-white' : 'text-content'}`}>VEEN<span className="text-[#F47A28]">CART</span></span>
          <span className={`mt-1 text-[0.55rem] font-medium uppercase tracking-[0.28em] ${inverse ? 'text-[#A9E5DF]' : 'text-primary'}`}>Logistics</span>
        </span>
      ) : null}
    </span>
  );

  return href ? <Link href={href}>{logo}</Link> : logo;
}
