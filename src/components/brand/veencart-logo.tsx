import Link from 'next/link';
import { cn } from '@/lib/cn';

type VeencartLogoProps = {
  href?: string;
  compact?: boolean;
  className?: string;
  label?: string;
};

export function VeencartLogo({
  href,
  compact = false,
  className,
  label = 'Veencart home',
}: VeencartLogoProps) {
  const logo = (
    <span className={cn('inline-flex items-center gap-2.5', className)} aria-label={label}>
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        className={compact ? 'size-10' : 'size-11'}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="48" height="48" rx="15" fill="currentColor" />
        <path d="M11 14h4.2l2.45 15.1a3.2 3.2 0 0 0 3.15 2.7h13.1a3.2 3.2 0 0 0 3.1-2.42L39 20.2H18.2" stroke="#F4773B" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20.6 21.5h13.8l-1.6 6.3H21.7l-1.1-6.3Z" fill="#F4773B" />
        <circle cx="22.5" cy="36.3" r="2.4" fill="#F4773B" />
        <circle cx="34.2" cy="36.3" r="2.4" fill="#F4773B" />
        <path d="M23.4 11.5 26 14l4.1-4.2" stroke="#DCEFE8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span className="text-[1.1rem] font-extrabold tracking-[-0.045em] text-content">veen<span className="text-primary">cart</span></span>
          <span className="mt-1 text-[0.58rem] font-bold uppercase tracking-[0.2em] text-content-muted">move with care</span>
        </span>
      ) : null}
    </span>
  );

  return href ? <Link href={href}>{logo}</Link> : logo;
}
