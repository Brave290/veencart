'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export function PagePreloader() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setHidden(true), 520);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div aria-hidden="true" className={`pointer-events-none fixed inset-0 z-[100] grid place-items-center bg-[#071C24] transition-opacity duration-slow ${hidden ? 'opacity-0' : 'opacity-100'}`}>
      <div className="flex flex-col items-center gap-4">
        <Image src="/brand/veencart-logo-original-transparent.png" alt="" width={88} height={88} className="size-[88px] object-contain" priority />
        <div className="h-px w-20 overflow-hidden rounded-full bg-white/15"><span className="block h-full w-1/2 animate-[preloader-sweep_520ms_ease-out_forwards] bg-[#F47A28]" /></div>
      </div>
    </div>
  );
}
