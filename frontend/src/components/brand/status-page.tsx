import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { PublicHeader } from '@/components/brand/public-header';
import { SiteFooter } from '@/components/brand/site-footer';
import { buttonVariants } from '@/components/ui/button';

type StatusPageProps = {
  eyebrow: string;
  title: string;
  body: string;
  icon: LucideIcon;
  /** Optional honest detail list, e.g. what the visitor can do right now. */
  points?: string[];
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
  /** Accent for the status chip: 'teal' for neutral progress, 'orange' for attention. */
  tone?: 'teal' | 'orange';
};

/**
 * Shared shell for pages that exist so no link is dead, but whose feature is
 * not live yet. Every one of these says plainly what is and is not available
 * and never invents a date, price or contact channel.
 */
export function StatusPage({ eyebrow, title, body, icon: Icon, points = [], primary, secondary, tone = 'teal' }: StatusPageProps) {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
        <PublicHeader />
        <main id="main" className="grid gap-10 py-12 sm:py-20 lg:grid-cols-[1fr_.9fr] lg:items-center lg:gap-16">
          <section>
            <p className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] ${tone === 'orange' ? 'border-[#F47A28]/35 bg-[#FFF0E5] text-[#8A3F12]' : 'border-primary/25 bg-primary-subtle text-primary'}`}>
              <Icon aria-hidden="true" className="size-3.5" /> {eyebrow}
            </p>
            <h1 className="mt-6 max-w-2xl text-4xl font-extrabold leading-[1.02] tracking-[-0.05em] text-content sm:text-6xl">{title}</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-content-muted sm:text-lg">{body}</p>
            {(primary || secondary) && (
              <div className="mt-9 flex flex-wrap gap-3">
                {primary ? <Link href={primary.href} className={buttonVariants({ size: 'lg' })}>{primary.label} <ArrowRight aria-hidden="true" className="size-4" /></Link> : null}
                {secondary ? <Link href={secondary.href} className={buttonVariants({ variant: 'outline', size: 'lg' })}>{secondary.label}</Link> : null}
              </div>
            )}
          </section>
          {points.length ? (
            <aside aria-label="What is available now" className="rounded-[24px] border border-line bg-surface p-6 shadow-[0_8px_28px_rgb(32_41_39_/_5%)] sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-content-subtle">Available now</p>
              <ul className="mt-5 grid gap-4">
                {points.map((point) => (
                  <li key={point} className="flex gap-3 text-sm leading-6 text-content-muted">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
