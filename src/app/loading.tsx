/**
 * Route-level loading UI.
 *
 * WHY A SKELETON AND NOT A SPINNER
 * A spinner says "something is happening" and destroys the layout it sits in,
 * so the page jumps when content arrives. A skeleton holds the final shape, so
 * nothing shifts. This matters doubly on slow mobile data, which is a primary
 * condition for Veencart's users.
 *
 * The shimmer is marked `data-motion-essential`: reduced-motion users still get
 * it, because a frozen placeholder reads as a broken page rather than a calm
 * one. See src/app/motion.css.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      <div className="sweep relative h-4 w-24 overflow-hidden rounded bg-surface-muted" data-motion-essential />

      <div className="sweep relative mt-4 h-9 w-3/4 overflow-hidden rounded bg-surface-muted" data-motion-essential />

      <div className="sweep relative mt-4 h-4 w-full overflow-hidden rounded bg-surface-muted" data-motion-essential />
      <div className="sweep relative mt-2 h-4 w-5/6 overflow-hidden rounded bg-surface-muted" data-motion-essential />

      <div className="mt-10 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-line p-4">
            <div
              className="sweep relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-muted"
              data-motion-essential
            />
            <div className="flex-1">
              <div
                className="sweep relative h-3.5 w-1/3 overflow-hidden rounded bg-surface-muted"
                data-motion-essential
              />
              <div
                className="sweep relative mt-2 h-3 w-1/2 overflow-hidden rounded bg-surface-muted"
                data-motion-essential
              />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}