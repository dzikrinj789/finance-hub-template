'use client';

import { useCallback } from 'react';

/* Efek kartu mockup: glow mengikuti kursor (--mx/--my untuk .card::before)
   + tilt 3D opsional untuk .card.tilt (pointer halus, hormati reduced-motion). */
export function useCardFx(tilt = false) {
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
      if (
        tilt &&
        window.matchMedia('(pointer: fine)').matches &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        const rx = Math.max(-2.5, Math.min(2.5, (0.5 - py) * 6));
        const ry = Math.max(-2.5, Math.min(2.5, (px - 0.5) * 6));
        el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      }
    },
    [tilt],
  );

  const onPointerLeave = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    el.style.removeProperty('--mx');
    el.style.removeProperty('--my');
    if (el.style.transform) el.style.transform = '';
  }, []);

  return { onPointerMove, onPointerLeave };
}
