'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

/** A short, fail-safe first-paint handoff for slow and fast connections. */
export function PagePreloader() {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    let finished = false;
    const started = window.performance.now();
    const finish = () => {
      if (finished) return;
      finished = true;
      const remaining = Math.max(0, 260 - (window.performance.now() - started));
      window.setTimeout(() => {
        setVisible(false);
        window.setTimeout(() => setMounted(false), 220);
      }, remaining);
    };
    if (document.readyState === 'complete') finish();
    else window.addEventListener('load', finish, { once: true });
    const fallback = window.setTimeout(finish, 1800);
    return () => {
      window.removeEventListener('load', finish);
      window.clearTimeout(fallback);
    };
  }, []);

  if (!mounted) return null;
  return (
    <div role="status" aria-label="Loading Veencart" className={`pointer-events-none fixed inset-0 z-[100] grid place-items-center bg-[#071C24] transition-opacity duration-base ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex flex-col items-center gap-4">
        <Image src="/brand/veencart-logo-original-transparent.png" alt="" width={88} height={88} className="size-[88px] object-contain" priority />
        <div className="relative h-1 w-28 overflow-hidden rounded-full bg-white/15">
          <span data-motion-essential className="absolute inset-y-0 left-0 w-1/2 animate-[preloader-sweep_900ms_linear_infinite] rounded-full bg-[#F47A28]" />
        </div>
        <span className="sr-only">Loading content</span>
      </div>
    </div>
  );
}
