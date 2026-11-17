'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface YearScrollPickerProps {
  selectedYear: string;
  onSelect: (year: string) => void;
  startYear?: number;
  endYear?: number;
}

export function YearScrollPicker({ selectedYear, onSelect, startYear = 2020, endYear = 2070 }: YearScrollPickerProps) {
  const years = React.useMemo(() => {
    const arr: string[] = ['all'];
    for (let y = startYear; y <= endYear; y++) arr.push(String(y));
    return arr;
  }, [startYear, endYear]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const timeoutRef = useRef<number | null>(null);

  // Scroll to selected year on mount / change
  const scrollToYear = useCallback(
    (year: string, smooth = true) => {
      const el = itemRefs.current.get(year);
      const container = scrollRef.current;
      if (!el || !container) return;
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
        const top = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
        container.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
      } else {
        const left = el.offsetLeft - container.clientWidth / 2 + el.clientWidth / 2;
        container.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
      }
    },
    [],
  );

  useEffect(() => {
    // initial scroll without smooth to avoid jump
    scrollToYear(selectedYear, false);
  }, [selectedYear, scrollToYear]);

  // Detect center year on scroll with debounce + snap
  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container || isDragging) return;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      const isMobile = window.innerWidth < 1024;
      const containerRect = container.getBoundingClientRect();
      const center = isMobile ? containerRect.top + containerRect.height / 2 : containerRect.left + containerRect.width / 2;
      let closest: string | null = null;
      let minDist = Infinity;
      years.forEach((yr) => {
        const el = itemRefs.current.get(yr);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const elCenter = isMobile ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
        const dist = Math.abs(elCenter - center);
        if (dist < minDist) {
          minDist = dist;
          closest = yr;
        }
      });
      if (closest && closest !== selectedYear) {
        onSelect(closest);
      }
      // Snap to closest
      if (closest) {
        scrollToYear(closest, true);
      }
    }, 80) as unknown as number;
  }, [selectedYear, onSelect, years, scrollToYear, isDragging]);

  // Drag handling for inertia-like feel (horizontal desktop, vertical mobile)
  const handleMouseDown = (e: React.MouseEvent) => {
    const c = scrollRef.current;
    if (!c) return;
    setIsDragging(true);
    const isMobile = window.innerWidth < 1024;
    if (isMobile) {
      setStartY(e.pageY - c.offsetTop);
      setScrollTop(c.scrollTop);
    } else {
      setStartX(e.pageX - c.offsetLeft);
      setScrollLeft(c.scrollLeft);
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const c = scrollRef.current;
    if (!c) return;
    const isMobile = window.innerWidth < 1024;
    if (isMobile) {
      const y = e.pageY - c.offsetTop;
      c.scrollTop = scrollTop - (y - startY);
    } else {
      const x = e.pageX - c.offsetLeft;
      c.scrollLeft = scrollLeft - (x - startX);
    }
  };
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);

  // Touch for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    const c = scrollRef.current;
    if (!c) return;
    const isMobile = window.innerWidth < 1024;
    if (isMobile) {
      setStartY(e.touches[0].pageY - c.offsetTop);
      setScrollTop(c.scrollTop);
    } else {
      setStartX(e.touches[0].pageX - c.offsetLeft);
      setScrollLeft(c.scrollLeft);
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const c = scrollRef.current;
    if (!c) return;
    const isMobile = window.innerWidth < 1024;
    if (isMobile) {
      const y = e.touches[0].pageY - c.offsetTop;
      c.scrollTop = scrollTop - (y - startY);
    } else {
      const x = e.touches[0].pageX - c.offsetLeft;
      c.scrollLeft = scrollLeft - (x - startX);
    }
  };

  return (
    <div className="w-full sm:w-64 lg:w-[320px]">
      <p className="text-[10px] font-medium text-[#A8B0C2] text-center pb-1.5 tracking-wide">Geser untuk memilih tahun</p>
      <div className="relative">
        {/* soft shadow highlight in center */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="hidden lg:block w-[96px] h-7 rounded-full bg-[#EFF4FF] border border-[#DBEAFE] shadow-sm opacity-70" />
          <div className="lg:hidden w-full h-[36px] rounded-xl bg-[#EFF4FF] border border-[#DBEAFE] shadow-sm opacity-70 absolute" />
        </div>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          className={`
            relative flex gap-1.5 p-2 bg-transparent
            lg:flex-row flex-col
            lg:overflow-x-auto lg:overflow-y-hidden overflow-y-auto overflow-x-hidden
            lg:snap-x snap-y snap-mandatory
            lg:max-h-none max-h-[180px]
            scroll-smooth
            select-none cursor-grab active:cursor-grabbing
            scrollbar-thin
          `}
          style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {/* spacer for centering first/last */}
          <div className="shrink-0 lg:w-[96px] lg:h-7 w-full h-2" aria-hidden />
          {years.map((yr) => {
            const active = selectedYear === yr;
            return (
              <button
                key={yr}
                ref={(el) => {
                  if (el) itemRefs.current.set(yr, el);
                  else itemRefs.current.delete(yr);
                }}
                onClick={() => {
                  onSelect(yr);
                  scrollToYear(yr, true);
                }}
                className={`shrink-0 snap-center rounded-full px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap lg:min-w-[64px] min-w-full
                  ${active ? 'bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white font-semibold shadow-[0_4px_12px_-3px_rgba(37,99,235,0.5)] scale-105' : 'bg-white border border-[#E7EBF6] text-[#8A93A8] hover:text-[#2563EB] hover:border-[#93C5FD]'}
                `}
                style={{ scrollSnapAlign: 'center' }}
              >
                {yr === 'all' ? 'Semua' : yr}
              </button>
            );
          })}
          <div className="shrink-0 lg:w-[96px] lg:h-7 w-full h-2" aria-hidden />
        </div>
      </div>
      <p className="text-[10px] text-center text-[#A8B0C2] pt-1">
        {selectedYear === 'all' ? 'Semua Tahun' : `Tahun ${selectedYear}`} • {years.length - 1} tahun tersedia
      </p>
    </div>
  );
}
