'use client';

import { useEffect, useRef, useState } from 'react';

/* Count-up angka (requestAnimationFrame) — port dari mockup (easeOutQuart ±700ms).
   Mulus saat target berubah (animasi dari nilai sebelumnya). */
export function useAnimatedNumber(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutQuart — persis seperti mockup: 1-(1-t)^4
      const eased = 1 - Math.pow(1 - t, 4);
      const next = from + (target - from) * eased;
      setValue(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}
