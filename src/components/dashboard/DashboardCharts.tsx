'use client';

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type MouseHandlerDataParam,
} from 'recharts';
import { BarChart3, LineChart, PieChart as PieIcon, TrendingUp } from 'lucide-react';
import { formatCompactRupiah, formatPercent, formatRupiah } from '@/lib/utils';
import { useFinance } from '@/context/FinanceContext';
import { useActiveSlice } from '@/hooks/useActiveSlice';
import { useThemeMode } from '@/hooks/useThemeMode';
import { GlassCard } from '@/components/ui/minimal';
import {
  buildCashflowSeries,
  type CashflowGrain,
  type CashflowPoint,
  type CashflowRange,
} from '@/lib/cashflow-series';

/* Donut & kumulatif tetap agregat bulanan (scoped per Periode Tahun,
   tanpa Internal Transfer & exclude report). Kartu Pemasukan vs Pengeluaran
   memakai seri harian yang bisa digeser — lihat buildCashflowSeries. */

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const MIX_COLORS: Record<string, string> = {
  Needs: '#93B4F5',
  Wants: '#CBD5E1',
  Savings: '#2563EB',
  Investment: '#64748B',
};
const MIX_LABELS: Record<string, string> = {
  Needs: 'Needs',
  Wants: 'Wants',
  Savings: 'Savings',
  Investment: 'Investasi',
};

function usePalette() {
  const mode = useThemeMode();
  const dark = mode === 'dark';
  return useMemo(
    () => ({
      dark,
      accent: dark ? '#5B8DEF' : '#2563EB',
      grey: '#94A3B8',
      net: dark ? '#CBD5E1' : '#374151',
      grid: dark ? 'rgba(255,255,255,0.07)' : 'rgba(20,30,80,0.08)',
      axis: dark ? '#9AA1AD' : '#6B7280',
      sliceBorder: dark ? 'rgba(15,17,21,0.8)' : 'rgba(255,255,255,0.9)',
    }),
    [dark],
  );
}

type Palette = ReturnType<typeof usePalette>;

function useChartData() {
  const { transactions, selectedYear } = useFinance();

  const scoped = useMemo(() => {
    const yearFiltered =
      selectedYear === 'all' ? transactions : transactions.filter((tx) => tx.date.startsWith(selectedYear));
    return yearFiltered.filter((tx) => !tx.isExcludeReport && tx.type !== 'Internal Transfer');
  }, [transactions, selectedYear]);

  const monthlySeries = useMemo(() => {
    const income = scoped.filter((t) => t.type === 'Income');
    const expense = scoped.filter((t) => ['Needs', 'Wants', 'Savings', 'Investment'].includes(t.type));
    if (selectedYear === 'all') {
      const years = Array.from(new Set(transactions.map((t) => t.date.slice(0, 4)))).sort();
      return years.map((y) => {
        const sum = (list: typeof scoped) =>
          list.filter((t) => t.date.slice(0, 4) === y).reduce((acc, t) => acc + t.amount, 0);
        const i = sum(income);
        const e = sum(expense);
        return { label: y, income: i, expense: e, net: i - e };
      });
    }
    return MONTHS_ID.map((label, m) => {
      const idx = String(m + 1).padStart(2, '0');
      const sum = (list: typeof scoped) =>
        list.filter((t) => t.date.slice(5, 7) === idx).reduce((acc, t) => acc + t.amount, 0);
      const i = sum(income);
      const e = sum(expense);
      return { label, income: i, expense: e, net: i - e };
    });
  }, [scoped, selectedYear, transactions]);

  const cumulativeSeries = useMemo(
    () =>
      monthlySeries.reduce<Array<{ label: string; cumulative: number }>>((list, d) => {
        const prev = list.length > 0 ? list[list.length - 1].cumulative : 0;
        list.push({ label: d.label, cumulative: Math.max(0, prev + d.net) });
        return list;
      }, []),
    [monthlySeries],
  );

  const mixData = useMemo(() => {
    const map: Record<string, number> = { Needs: 0, Wants: 0, Savings: 0, Investment: 0 };
    scoped.forEach((t) => {
      if (t.type in map) map[t.type] += t.amount;
    });
    return Object.entries(map).map(([key, value]) => ({
      key,
      label: MIX_LABELS[key],
      value,
      color: MIX_COLORS[key],
    }));
  }, [scoped]);

  return { scoped, monthlySeries, cumulativeSeries, mixData, selectedYear };
}

/* Tooltip kaca */
function GlassTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: Record<string, unknown> }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entries = payload.map((p) => ({
    name: (p.payload?.label as string) && !label ? (p.payload?.label as string) : (p.name ?? '-'),
    value: (p.value as number) ?? 0,
    color: (p.payload?.color as string) ?? p.color ?? '#2563EB',
  }));
  return (
    <div className="chart-tip glass">
      {label && <p className="lbl" style={{ fontSize: 10, marginBottom: 6 }}>{label}</p>}
      {entries.map((e, i) => (
        <div key={i} className="chart-tip-row">
          <i style={{ background: e.color }} />
          <span>{e.name}</span>
          <b className="mono money">{formatRupiah(e.value)}</b>
        </div>
      ))}
    </div>
  );
}

function EmptyChart({ message, height = 260 }: { message: string; height?: number }) {
  return (
    <div className="emptystate" style={{ height, display: 'grid', placeContent: 'center', padding: 20 }}>
      <div className="ico" style={{ width: 48, height: 48, borderRadius: 16 }}>
        <LineChart size={20} />
      </div>
      <p className="sub" style={{ maxWidth: 260 }}>{message}</p>
    </div>
  );
}

const compactTick = (v: number) => formatCompactRupiah(v).replace('Rp ', '');

const RANGES: { id: CashflowRange; label: string; aria: string }[] = [
  { id: '7', label: '7H', aria: '7 hari' },
  { id: '30', label: '30H', aria: '30 hari' },
  { id: '90', label: '90H', aria: '90 hari' },
  { id: 'all', label: 'Semua', aria: 'Semua hari' },
];

const GRAINS: { id: CashflowGrain; label: string; aria: string }[] = [
  { id: 'day', label: 'Hari', aria: 'Per hari' },
  { id: 'week', label: 'Minggu', aria: 'Per minggu' },
  { id: 'month', label: 'Bulan', aria: 'Per bulan' },
];

const AXIS_H = 42;
const PLOT_BOX = 292;
const Y_W = 64;
const AXIS_STUB = [{ k: 'y' }];

type TickProps = {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string | number };
  index?: number;
};

function DailyAxisTick({
  x,
  y,
  payload,
  index,
  points,
  grain,
  fill,
}: TickProps & { points: CashflowPoint[]; grain: CashflowGrain; fill: string }) {
  const idx = typeof index === 'number' ? index : points.findIndex((p) => p.key === String(payload?.value ?? ''));
  const point = idx >= 0 ? points[idx] : undefined;
  if (!point || x == null || y == null) return <g />;
  const nx = Number(x);
  const ny = Number(y);
  if (grain === 'day') {
    return (
      <text x={nx} y={ny} textAnchor="middle" fill={fill} fontSize={11} fontWeight={500}>
        <tspan x={nx} dy={12} fontSize={10} opacity={point.monthMark ? 0.85 : 0}>
          {point.monthMark || '.'}
        </tspan>
        <tspan x={nx} dy={14}>{point.axisLabel}</tspan>
      </text>
    );
  }
  return (
    <text x={nx} y={ny} dy={26} textAnchor="middle" fill={fill} fontSize={11} fontWeight={500}>
      {point.axisLabel}
    </text>
  );
}

function DailyCashflowPlot({
  points,
  grain,
  kind,
  domain,
  ticks,
  pointMin,
  pal,
  reduceMotion,
  onHover,
}: {
  points: CashflowPoint[];
  grain: CashflowGrain;
  kind: 'bar' | 'line';
  domain: [number, number];
  ticks: number[];
  pointMin: number;
  pal: Palette;
  reduceMotion: boolean;
  onHover: (key: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const needsPin = useRef(true);
  const seenKey = useRef('');
  const stickEnd = useRef(true);
  const programmatic = useRef(false);
  const panning = useRef(false);
  const drag = useRef<{ id: number; x: number; left: number; moved: boolean } | null>(null);
  const [plotH, setPlotH] = useState(PLOT_BOX);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [grabbing, setGrabbing] = useState(false);
  const gid = `cf${useId().replace(/:/g, '')}`;
  const seriesKey = `${points[0]?.key ?? ''}|${points[points.length - 1]?.key ?? ''}|${points.length}|${grain}`;
  const isBar = kind === 'bar';
  const animate = !reduceMotion && points.length <= 42;
  const showDot = points.length <= 16;
  const axisTick = {
    fontSize: 11,
    fill: pal.axis,
    fontWeight: 500,
  } as const;
  const canPan = edges.left || edges.right;

  const publishEdges = (el: HTMLDivElement) => {
    const max = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft > 2;
    const right = max - el.scrollLeft > 2;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  };

  const measure = (el: HTMLDivElement) => {
    const h = el.clientHeight;
    if (h > 0) setPlotH((prev) => (prev === h ? prev : h));
    const sb = Math.max(0, el.offsetHeight - el.clientHeight);
    el.parentElement?.style.setProperty('--cf-sb', `${sb}px`);
  };

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    measure(el);
    if (seenKey.current !== seriesKey) {
      seenKey.current = seriesKey;
      needsPin.current = true;
      stickEnd.current = true;
    }
    if (needsPin.current) {
      programmatic.current = true;
      el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
      programmatic.current = false;
      needsPin.current = false;
    }
    publishEdges(el);
  }, [seriesKey]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      if (el.scrollWidth <= el.clientWidth + 1) return;
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const max = el.scrollWidth - el.clientWidth;
      const next = Math.min(max, Math.max(0, el.scrollLeft + e.deltaY));
      if (next === el.scrollLeft) return;
      e.preventDefault();
      el.scrollLeft = next;
    };
    const ro = new ResizeObserver(() => {
      measure(el);
      if (stickEnd.current) {
        programmatic.current = true;
        el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
        programmatic.current = false;
      }
      publishEdges(el);
    });
    ro.observe(el);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener('wheel', onWheel);
    };
  }, [seriesKey]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.id || e.pointerType === 'touch') return;
      const dx = e.clientX - d.x;
      if (!d.moved && Math.abs(dx) < 5) return;
      d.moved = true;
      panning.current = true;
      setGrabbing(true);
      const el = scrollerRef.current;
      if (el) el.scrollLeft = d.left - dx;
    };
    const onUp = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.id) return;
      const moved = d.moved;
      drag.current = null;
      setGrabbing(false);
      if (moved) window.setTimeout(() => { panning.current = false; }, 80);
      else panning.current = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const select = (state: MouseHandlerDataParam) => {
    if (panning.current) return;
    const label = state?.activeLabel;
    if (label == null || label === '') return;
    onHover(String(label));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    const el = scrollerRef.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    drag.current = { id: e.pointerId, x: e.clientX, left: el.scrollLeft, moved: false };
  };

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    if (!programmatic.current) {
      const max = el.scrollWidth - el.clientWidth;
      stickEnd.current = max - el.scrollLeft < 3;
    }
    publishEdges(el);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = Math.max(pointMin, 48) * 3;
    if (e.key === 'ArrowRight') { el.scrollBy({ left: step }); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { el.scrollBy({ left: -step }); e.preventDefault(); }
    else if (e.key === 'Home') { el.scrollTo({ left: 0 }); e.preventDefault(); }
    else if (e.key === 'End') { el.scrollTo({ left: el.scrollWidth }); e.preventDefault(); }
  };

  return (
    <>
      <div className="cf-plot" data-chart="cashflow-daily" data-points={points.length}>
        <div className="cf-yaxis" style={{ height: plotH }} aria-hidden>
          <ResponsiveContainer className="money-axis" width="100%" height={plotH} initialDimension={{ width: Y_W, height: plotH }}>
            <ComposedChart data={AXIS_STUB} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="k" height={AXIS_H} tick={false} axisLine={false} tickLine={false} />
              <YAxis
                width={Y_W}
                domain={domain}
                ticks={ticks}
                allowDataOverflow
                interval={0}
                tickFormatter={compactTick}
                tick={axisTick}
                tickLine={false}
                axisLine={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div
          ref={scrollerRef}
          className={`cf-pan-view${canPan ? ' can-pan' : ''}${grabbing ? ' is-grabbing' : ''}`}
          tabIndex={0}
          role="region"
          aria-label="Grafik pemasukan dan pengeluaran. Geser horizontal untuk melihat hari lain. Ujung kanan adalah hari terakhir."
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
        >
          <div style={{ width: Math.max(points.length, 1) * pointMin, minWidth: '100%', height: plotH }}>
            <ResponsiveContainer className="money-axis" width="100%" height={plotH} initialDimension={{ width: Math.max(points.length, 1) * pointMin, height: plotH }}>
              <ComposedChart
                key={kind}
                data={points}
                margin={{ top: 10, right: 10, bottom: 0, left: 2 }}
                barCategoryGap="22%"
                barGap={2}
                onMouseMove={select}
                onClick={select}
                onTouchEnd={select}
              >
                <defs>
                  <linearGradient id={`${gid}-in`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={pal.accent} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={pal.accent} stopOpacity={0.35} />
                  </linearGradient>
                  <linearGradient id={`${gid}-out`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#94A3B8" stopOpacity={pal.dark ? 0.55 : 0.75} />
                    <stop offset="100%" stopColor="#94A3B8" stopOpacity={pal.dark ? 0.18 : 0.3} />
                  </linearGradient>
                  <linearGradient id={`${gid}-area`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={pal.accent} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={pal.accent} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={pal.grid} vertical={false} />
                <XAxis
                  dataKey="key"
                  height={AXIS_H}
                  interval={0}
                  minTickGap={0}
                  tickLine={false}
                  axisLine={false}
                  padding={{ left: 8, right: 12 }}
                  tick={(props: TickProps) => (
                    <DailyAxisTick {...props} points={points} grain={grain} fill={pal.axis} />
                  )}
                />
                <YAxis hide width={0} domain={domain} ticks={ticks} allowDataOverflow />
                <Tooltip
                  cursor={{ fill: pal.dark ? 'rgba(91,141,239,0.12)' : 'rgba(37,99,235,0.07)' }}
                  content={() => null}
                  isAnimationActive={false}
                  wrapperStyle={{ visibility: 'hidden', pointerEvents: 'none' }}
                />
                {isBar ? (
                  <>
                    <Bar dataKey="income" name="Masuk" fill={`url(#${gid}-in)`} radius={[8, 8, 8, 8]} maxBarSize={18} isAnimationActive={animate} animationDuration={700} />
                    <Bar dataKey="expense" name="Keluar" fill={`url(#${gid}-out)`} radius={[8, 8, 8, 8]} maxBarSize={18} isAnimationActive={animate} animationDuration={700} />
                  </>
                ) : (
                  <>
                    <Area type="linear" dataKey="income" name="Masuk" stroke={pal.accent} strokeWidth={2.5} fill={`url(#${gid}-area)`} dot={showDot ? { r: 3, fill: pal.accent, strokeWidth: 0 } : false} activeDot={showDot ? { r: 4 } : false} isAnimationActive={animate} animationDuration={700} />
                    <Line type="linear" dataKey="expense" name="Keluar" stroke="#94A3B8" strokeWidth={2.5} dot={showDot ? { r: 3, fill: '#94A3B8', strokeWidth: 0 } : false} activeDot={showDot ? { r: 4 } : false} isAnimationActive={animate} animationDuration={700} />
                  </>
                )}
                <Line
                  type="linear"
                  dataKey="net"
                  name="Net"
                  stroke={pal.net}
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  dot={showDot ? { r: 3, fill: pal.net, stroke: pal.net } : false}
                  activeDot={showDot ? { r: 4 } : false}
                  isAnimationActive={animate}
                  animationDuration={700}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        {edges.left ? <span className="cf-fade left" aria-hidden /> : null}
        {edges.right ? <span className="cf-fade right" aria-hidden /> : null}
      </div>
      <p className="cf-pan-hint">Geser, seret, atau gulir untuk hari lain. Ujung kanan = hari terakhir.</p>
    </>
  );
}

/* ── A. Pemasukan vs Pengeluaran — harian, bisa digeser (s8) ── */
export function CashflowChartCard({ className = 's8' }: { className?: string }) {
  const { transactions, selectedYear } = useFinance();
  const pal = usePalette();
  const [kind, setKind] = useState<'bar' | 'line'>('bar');
  const [range, setRange] = useState<CashflowRange>('30');
  const [grain, setGrain] = useState<CashflowGrain>('day');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  const model = useMemo(
    () => buildCashflowSeries(transactions, selectedYear, range, grain),
    [transactions, selectedYear, range, grain],
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const onHover = useCallback((key: string) => {
    setActiveKey((prev) => (prev === key ? prev : key));
  }, []);

  const active = model.points.find((p) => p.key === activeKey) ?? model.points[model.points.length - 1];

  return (
    <GlassCard className={`cf-chart ${className}`}>
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div className="lbl ttl" id="cf-chart-title">
            <BarChart3 size={17} strokeWidth={2.2} />
            Pemasukan vs Pengeluaran
          </div>
          <div className="sub">
            {model.grainLabel} · {model.rangeLabel} · {model.yearLabel} · keluar = needs, wants, savings &amp; investasi
          </div>
        </div>
        <div className="chips" role="group" aria-label="Jenis grafik">
          <button type="button" className={`chip ${kind === 'bar' ? 'on' : ''}`} aria-pressed={kind === 'bar'} onClick={() => setKind('bar')}>
            Bar
          </button>
          <button type="button" className={`chip ${kind === 'line' ? 'on' : ''}`} aria-pressed={kind === 'line'} onClick={() => setKind('line')}>
            Line
          </button>
        </div>
      </div>
      <div className="cf-tools">
        <div className="chips" role="group" aria-label="Rentang hari">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip ${range === item.id ? 'on' : ''}`}
              aria-pressed={range === item.id}
              aria-label={item.aria}
              onClick={() => setRange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="cf-sep" aria-hidden />
        <div className="chips" role="group" aria-label="Pengelompokan">
          {GRAINS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip ${grain === item.id ? 'on' : ''}`}
              aria-pressed={grain === item.id}
              aria-label={item.aria}
              onClick={() => setGrain(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-legend">
        <span><i style={{ background: pal.accent }} />Masuk</span>
        <span><i style={{ background: pal.grey }} />Keluar</span>
        <span><i className="dash" style={{ borderColor: pal.net }} />Net</span>
      </div>
      {model.hasData && active ? (
        <>
          <div className="cf-readout" data-readout data-active={active.key}>
            <p className="cf-readout-date">
              {active.fullLabel}
              {active.includesToday ? <span className="cf-today">hari ini</span> : null}
            </p>
            <div className="cf-readout-metrics">
              <span><i style={{ background: pal.accent }} />Masuk <b className="mono money">{formatRupiah(active.income)}</b></span>
              <span><i style={{ background: pal.grey }} />Keluar <b className="mono money">{formatRupiah(active.expense)}</b></span>
              <span><i className="dash" style={{ borderColor: pal.net }} />Net <b className="mono money">{formatRupiah(active.net)}</b></span>
            </div>
          </div>
          <DailyCashflowPlot
            points={model.points}
            grain={grain}
            kind={kind}
            domain={model.domain}
            ticks={model.ticks}
            pointMin={model.pointMin}
            pal={pal}
            reduceMotion={reduceMotion}
            onHover={onHover}
          />
        </>
      ) : (
        <EmptyChart message="Belum ada transaksi pada periode ini. Tambah transaksi untuk melihat grafik cashflow." />
      )}
    </GlassCard>
  );
}

/* ── B. Donut Komposisi Uang (s4) ── */
export function CompositionCard({ className = 's4' }: { className?: string }) {
  const { mixData } = useChartData();
  const pal = usePalette();
  const total = mixData.reduce((a, d) => a + d.value, 0);
  const pieData = mixData.filter((d) => d.value > 0);
  const slice = useActiveSlice();
  const { activeIdx } = slice;
  const active = activeIdx !== null ? pieData[activeIdx] : undefined;

  return (
    <GlassCard className={className}>
      <div className="lbl ttl">
        <PieIcon size={17} strokeWidth={2.2} />
        Komposisi Uang
      </div>
      <div className="sub">Needs · Wants · Savings · Investasi pada periode ini</div>
      {total > 0 ? (
        <>
          <div className="donut-box" {...slice.boxProps}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius="74%"
                  outerRadius="98%"
                  paddingAngle={1}
                  cornerRadius={8}
                  stroke={pal.sliceBorder}
                  strokeWidth={4}
                  animationDuration={1600}
                  {...slice.pieProps}
                >
                  {pieData.map((d, i) => (
                    <Cell
                      key={d.key}
                      fill={d.color}
                      fillOpacity={activeIdx === null || activeIdx === i ? 1 : 0.35}
                      style={{ cursor: 'pointer', transition: 'fill-opacity .15s' }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Tengah donut: total, atau slice aktif (tanpa tooltip melayang yang menimpa label) */}
            <div className="donut-c">
              {active ? (
                <div>
                  <b className="money">{formatCompactRupiah(active.value).replace('Rp ', '')}</b>
                  <small>
                    {active.label} · {formatPercent((active.value / total) * 100)}
                  </small>
                </div>
              ) : (
                <div>
                  <b className="money">{formatCompactRupiah(total).replace('Rp ', '')}</b>
                  <small>total terpakai</small>
                </div>
              )}
            </div>
          </div>
          <div className="legend">
            {mixData.map((d) => (
              <div key={d.key}>
                <i style={{ background: d.color }} />
                {d.label}
                <span className="mono money">{formatRupiah(d.value)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyChart message="Belum ada pengeluaran pada periode ini." height={220} />
      )}
    </GlassCard>
  );
}

/* ── C. Akumulasi net (progres penumpukan dana) ── */
export function CumulativeCard({ className = 's7' }: { className?: string }) {
  const { cumulativeSeries, selectedYear } = useChartData();
  const pal = usePalette();
  const axisProps = {
    tick: { fontSize: 11, fill: pal.axis, fontWeight: 500 },
    tickLine: false,
    axisLine: false,
  } as const;
  return (
    <GlassCard className={className}>
      <div className="lbl ttl">
        <TrendingUp size={17} strokeWidth={2.2} />
        Progres Penumpukan Dana
      </div>
      <div className="sub">
        {selectedYear === 'all' ? 'Kumulatif seluruh tahun' : `Kumulatif net per bulan · ${selectedYear}`}
      </div>
      {cumulativeSeries.some((d) => d.cumulative > 0) ? (
        <div style={{ height: 210, marginTop: 14 }}>
          <ResponsiveContainer className="money-axis" width="100%" height="100%">
            <AreaChart data={cumulativeSeries} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={pal.accent} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={pal.accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={pal.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} tickMargin={8} />
              <YAxis width={52} tickFormatter={compactTick} {...axisProps} />
              <Tooltip content={<GlassTooltip />} cursor={{ stroke: pal.grey, strokeWidth: 1, strokeDasharray: '4 3' }} />
              <Area type="monotone" dataKey="cumulative" name="Akumulasi" stroke={pal.accent} strokeWidth={2.5} fill="url(#cumGrad)" animationDuration={1200} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyChart message="Progres kumulatif akan muncul begitu ada selisih net positif." height={210} />
      )}
    </GlassCard>
  );
}
