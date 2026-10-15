import { LoaderCircle } from 'lucide-react';

export default function ServicesLoading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5" aria-busy="true" aria-live="polite">
      <div role="status" className="flex items-center gap-3 text-sm text-content-muted">
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary" />
        <span>Loading services…</span>
      </div>
    </main>
  );
}
