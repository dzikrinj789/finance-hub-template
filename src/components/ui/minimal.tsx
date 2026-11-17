'use client';

import { createPortal } from 'react-dom';

/* Atom UI "Glass Minimal" bersama: kartu kaca (glow + tilt), count-up rupiah, ring progress.
   Murni presentasi — semua angka datang dari props. */
import React from 'react';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { useCardFx } from '@/hooks/useCardFx';
import { formatRupiah } from '@/lib/utils';

export function GlassCard({
  className = '',
  tilt = false,
  style,
  children,
  as: Tag = 'section',
  ...rest
}: {
  className?: string;
  tilt?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
  as?: 'section' | 'div';
} & Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'style' | 'children'>) {
  const fx = useCardFx(tilt);
  return (
    <Tag
      {...rest}
      onPointerMove={fx.onPointerMove}
      onPointerLeave={fx.onPointerLeave}
      className={`glass card ${tilt ? 'tilt' : ''} ${className}`}
      style={style}
    >
      {children}
    </Tag>
  );
}

export function AnimatedRupiah({
  value,
  className,
  signed = false,
}: {
  value: number;
  className?: string;
  signed?: boolean;
}) {
  const animated = useAnimatedNumber(Math.round(value || 0));
  const v = Math.round(animated);
  const sign = v < 0 ? '-' : signed && value > 0 ? '+' : '';
  return <span className={className}>{sign + formatRupiah(Math.abs(v))}</span>;
}

export function AnimatedPercent({ value, digits = 0 }: { value: number; digits?: number }) {
  const animated = useAnimatedNumber(value || 0, 900);
  return <>{animated.toFixed(digits)}%</>;
}

/* Ring progress (mockup .ring). Track abu, progress biru solid → biru muda. */
export function Ring({
  percent,
  size = 118,
  stroke = 11,
  label,
  labelSize,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  label?: React.ReactNode;
  labelSize?: number;
}) {
  const p = Math.max(0, Math.min(100, percent || 0));
  // minimal 2% agar ujung ring tetap terlihat (sama seperti mockup)
  const animated = useAnimatedNumber(Math.max(p, 2), 1400);
  const r = (size - stroke) / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="trk" cx={size / 2} cy={size / 2} r={r} style={{ strokeWidth: stroke }} />
        <circle
          className="prog"
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#hubRingGrad)"
          style={{ strokeWidth: stroke, transition: 'none' }}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - animated / 100)}
        />
      </svg>
      <div className="val" style={labelSize ? { fontSize: labelSize } : undefined}>
        {label ?? `${Math.round(p)}`}
      </div>
    </div>
  );
}

/* Gradient global untuk semua ring (dirender sekali di shell). */
export function RingGradientDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="hubRingGrad" x1="0" x2="1">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="#3B74F0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* Progress bar yang terisi pelan saat muncul. */
export function ProgressBar({
  percent,
  height,
  minPx,
  style,
}: {
  percent: number;
  height?: number;
  minPx?: number;
  style?: React.CSSProperties;
}) {
  const p = Math.max(0, Math.min(100, percent || 0));
  const animated = useAnimatedNumber(p, 1200);
  return (
    <div className="bar" style={{ ...(height ? { height } : null), ...style }}>
      <i style={{ width: `${animated}%`, minWidth: minPx, transition: 'none' }} />
    </div>
  );
}

/* Render ke document.body agar position:fixed selalu relatif ke viewport
   (tidak terpengaruh ancestor ber-transform/filter/backdrop-filter). */
const subscribeNoop = () => () => {};
export function BodyPortal({ children }: { children: React.ReactNode }) {
  const isClient = React.useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!isClient) return null;
  return createPortal(children, document.body);
}
