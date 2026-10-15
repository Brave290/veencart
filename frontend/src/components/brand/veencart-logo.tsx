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
 * 256px transparent export is a pre-resized copy of the original (the
 * original is 1254px and was ~740 KB); it is displayed at 44–52px, so the
 * 256px file covers 2x displays with room to spare.
 */
export function VeencartLogo({ href, compact = false, className, label = 'Veencart Logistics home', inverse = false }: VeencartLogoProps) {
  const logo = (
    <span className={cn('inline-flex min-h-11 items-center gap-2.5', className)} aria-label={label}>
      <Image
        src="/brand/veencart-logo-256.png"
        alt=""
        aria-hidden="true"
        width={256}
        height={256}
        sizes="52px"
        className={compact ? 'size-11 object-contain' : 'size-[46px] object-contain sm:size-[52px]'}
        priority={!compact}
      />
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span className={`text-[0.98rem] font-semibold tracking-[0.04em] sm:text-[1.02rem] ${inverse ? 'text-white' : 'text-content'}`}>
            VEEN<span className="text-[#F47A28]">CART</span>
          </span>
          <span className={`mt-1 text-[0.55rem] font-medium uppercase tracking-[0.28em] ${inverse ? 'text-[#A9E5DF]' : 'text-primary'}`}>Logistics</span>
        </span>
      ) : null}
    </span>
  );

  return href ? (
    <Link href={href} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
      {logo}
    </Link>
  ) : (
    logo
  );
}
