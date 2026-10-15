import { LoaderCircle } from 'lucide-react';

/** Secondary routes use a quiet spinner; the full brand preloader belongs to home only. */
export default function Loading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5" aria-busy="true" aria-live="polite">
      <div role="status" className="flex items-center gap-3 rounded-full border border-line bg-surface px-4 py-3 text-sm text-content-muted shadow-xs">
        <LoaderCircle data-motion-essential aria-hidden="true" className="size-5 animate-spin text-primary" />
        <span>Loading page…</span>
      </div>
    </main>
  );
}
