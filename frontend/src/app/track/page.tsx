import type { Metadata } from 'next';
import { CheckCircle2, LockKeyhole, MapPinned } from 'lucide-react';
import { PublicHeader } from '@/components/brand/public-header';
import { SiteFooter } from '@/components/brand/site-footer';
import { Reveal } from '@/components/motion/reveal';
import { TrackLookup } from './track-lookup';

export const metadata: Metadata = { title: 'Track a shipment', description: 'Follow a Veencart shipment from pickup to delivery using your tracking reference.' };

export default function TrackPage() {
  return <main className="min-h-dvh bg-canvas"><div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8"><PublicHeader /><section className="py-10 sm:py-16"><Reveal><div className="flex items-center gap-3 text-sm font-semibold text-primary"><MapPinned aria-hidden="true" className="size-5" /> Shipment visibility</div><h1 className="mt-5 max-w-3xl text-5xl font-extrabold leading-[0.94] tracking-[-0.07em] text-content sm:text-7xl">Know where the handoff stands.</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-content-muted">Enter the tracking reference from your booking confirmation. We show verified status and milestones without exposing private delivery details.</p></Reveal>
    <section aria-labelledby="lookup-heading" className="content-section mx-auto mt-16 max-w-3xl border-y border-content py-9"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Look up a shipment</p><h2 id="lookup-heading" className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-content">Enter your reference</h2><p className="mt-2 text-sm leading-6 text-content-muted">It looks like <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">VCTR-0001</code> and begins with <span className="font-mono text-xs">VCTR</span>.</p></div><LockKeyhole aria-hidden="true" className="mt-1 size-5 shrink-0 text-content-subtle" /></div><TrackLookup /></section>
    <div className="mx-auto mt-8 grid max-w-3xl gap-4 text-sm text-content-muted sm:grid-cols-2"><p className="flex gap-3"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><span>Verified milestones only. No unsupported live-GPS claims.</span></p><p className="flex gap-3"><LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><span>Private addresses and internal notes stay protected.</span></p></div>
    </section><SiteFooter /></div></main>;
}
