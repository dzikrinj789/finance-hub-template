'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Slice donut yang aktif (hover di desktop, tap di HP). Detailnya ditampilkan di tengah
 * donut, bukan tooltip melayang. Reset saat kursor keluar chart atau tap di luar chart.
 */
export function useActiveSlice<T extends HTMLElement = HTMLDivElement>() {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const boxRef = useRef<T | null>(null);

  useEffect(() => {
    if (activeIdx === null) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setActiveIdx(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [activeIdx]);

  return {
    activeIdx,
    boxRef,
    boxProps: { ref: boxRef, onMouseLeave: () => setActiveIdx(null) },
    pieProps: {
      onMouseEnter: (_: unknown, i: number) => setActiveIdx(i),
      onClick: (_: unknown, i: number) => setActiveIdx(i),
    },
  };
}
