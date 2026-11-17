'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Fuel,
  PiggyBank,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { formatCompactRupiah, formatRupiah } from '@/lib/utils';
import { AnimatedRupiah, GlassCard, ProgressBar, Ring } from '@/components/ui/minimal';

/* Semua angka utama = `summary` dari FinanceContext (sama seperti versi sebelumnya:
   income/spending/savings rate mengikuti filter Periode Tahun). Kartu ini hanya
   mengubah presentasi + menambah insight yang diturunkan dari data yang sama. */

type Tip = { icon: LucideIcon; title: string; desc: React.ReactNode };

/* Tips masuk bertahap (150ms + 170ms × idx) seperti mockup */
function TipList({ tips }: { tips: Tip[] }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timers = tips.map((_, i) => window.setTimeout(() => setShown(i + 1), 150 + i * 170));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [tips]);

  return (
    <div>
      {tips.map((t, i) => (
        <div key={i} className={`tip ${i < shown ? 'in' : ''}`}>
          <span className="ico">
            <t.icon size={16} strokeWidth={2.2} />
          </span>
          <div>
            <b>{t.title}</b>
            <p>{t.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const fmtShortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

export function SummaryCards() {
  const { summary, transactions, recoveryItems, assets, selectedYear } = useFinance();

  const rate = summary.monthlySavingsRate;
  const liquidPct = summary.netWorth > 0 ? Math.round((summary.liquidTotal / summary.netWorth) * 100) : 0;
  const needsPct = summary.totalSpending > 0 ? Math.round((summary.needsAmount / summary.totalSpending) * 100) : 0;
  const wantsPct = summary.totalSpending > 0 ? Math.round((summary.wantsAmount / summary.totalSpending) * 100) : 0;

  /* Progress target keseluruhan (Σ terealisasi / Σ target) */
  const overallTarget = useMemo(() => {
    const total = recoveryItems.reduce((a, t) => a + (t.targetAmount || 0), 0);
    const done = recoveryItems.reduce((a, t) => a + (t.recoveredAmount || 0), 0);
    return total > 0 ? (done / total) * 100 : 0;
  }, [recoveryItems]);

  /* Kategori pengeluaran terbesar (periode yang sama dengan summary) */
  const topCategory = useMemo(() => {
    const scoped = transactions.filter(
      (t) =>
        (selectedYear === 'all' || t.date.startsWith(selectedYear)) &&
        !t.isExcludeReport &&
        (t.type === 'Needs' || t.type === 'Wants'),
    );
    const map = new Map<string, { sum: number; last: string }>();
    scoped.forEach((t) => {
      const cur = map.get(t.category) ?? { sum: 0, last: t.date };
      cur.sum += t.amount;
      if (t.date > cur.last) cur.last = t.date;
      map.set(t.category, cur);
    });
    const sorted = Array.from(map.entries()).sort((a, b) => b[1].sum - a[1].sum);
    return sorted[0] ?? null;
  }, [transactions, selectedYear]);

  const tipSets = useMemo<Tip[][]>(() => {
    const leftover = summary.totalIncome - summary.totalSpending;
    const liquidRatio = summary.totalSpending > 0 ? summary.liquidTotal / summary.totalSpending : 0;
    const topTarget = [...recoveryItems].filter((t) => t.targetAmount > 0).sort((a, b) => b.targetAmount - a.targetAmount)[0];
    const setA: (Tip | null)[] = [
      {
        icon: PiggyBank,
        title: `Savings rate ${rate.toFixed(0)}%${rate >= 50 ? ' — mantap!' : ''}`,
        desc:
          leftover > 0 ? (
            <>Sisa ±<span className="money">{formatCompactRupiah(leftover)}</span> bisa dialokasikan ke target tabunganmu.</>
          ) : (
            <>Pengeluaran ≥ pemasukan pada periode ini — cek kategori terbesar.</>
          ),
      },
      topCategory && {
        icon: Fuel,
        title: `${topCategory[0]} paling besar`,
        desc: (
          <>
            <span className="money">{formatRupiah(topCategory[1].sum)}</span> · terakhir {fmtShortDate(topCategory[1].last)}.
          </>
        ),
      },
      transactions.length === 0
        ? {
            icon: Wallet,
            title: assets.length === 0 ? 'Mulai dari akun kosong' : 'Belum ada transaksi',
            desc:
              assets.length === 0
                ? <>Tambah akun di Setup, lalu catat transaksi pertama.</>
                : <>Tekan Catat Transaksi untuk mengisi cashflow.</>,
          }
        : null,
    ];
    const setB: (Tip | null)[] = [
      {
        icon: ShieldCheck,
        title: `Dana likuid ≈ ${liquidRatio.toFixed(1)}× pengeluaran`,
        desc: <>Likuid <span className="money">{formatCompactRupiah(summary.liquidTotal)}</span> — idealnya dana darurat 3–6× pengeluaran bulanan.</>,
      },
      topTarget
        ? {
            icon: Target,
            title: `${topTarget.title} ${((topTarget.recoveredAmount / topTarget.targetAmount) * 100).toFixed(1)}%`,
            desc: <>Sisa <span className="money">{formatCompactRupiah(Math.max(0, topTarget.targetAmount - topTarget.recoveredAmount))}</span> — target terbesarmu.</>,
          }
        : null,
      {
        icon: CheckCircle2,
        title: `Wants ${wantsPct}% dari pengeluaran`,
        desc: wantsPct <= 30 ? <>Porsi keinginan terjaga. Disiplin! ✨</> : <>Porsi Wants di atas 30% — coba dikurangi.</>,
      },
    ];
    return [setA.filter(Boolean) as Tip[], setB.filter(Boolean) as Tip[]];
  }, [summary, rate, recoveryItems, topCategory, transactions.length, assets.length, wantsPct]);

  const [tipSet, setTipSet] = useState(0);

  const healthLabel =
    rate >= 50 ? 'Sangat sehat 🎯' : rate >= 30 ? 'Sehat' : rate >= 10 ? 'Cukup baik' : 'Perlu penyesuaian';

  return (
    <>
      {/* ── HERO Net Worth (s8) ── */}
      <GlassCard tilt className="hero s8">
        <div className="ring-deco" aria-hidden />
        <div className="ring-deco two" aria-hidden />
        <div className="row" style={{ position: 'relative' }}>
          <div className="lbl">
            <Wallet size={15} strokeWidth={2.3} />
            Net Worth
          </div>
          <span className="trend">
            <ShieldCheck size={14} strokeWidth={2.3} />
            {liquidPct}% Likuid
          </span>
        </div>
        <div className="nw money mono-nums">
          <AnimatedRupiah value={summary.netWorth} />
        </div>
        <div className="sub">Total aset dari seluruh wadah &amp; akun</div>
        <div className="split">
          <span>
            ● Likuid <b className="mono money">{formatRupiah(summary.liquidTotal)}</b>
          </span>
          <span>
            ○ Non-Likuid <b className="mono money">{formatRupiah(summary.nonLiquidTotal)}</b>
          </span>
          <span>
            Savings rate <b className="mono">{rate.toFixed(0)}%</b>
          </span>
        </div>
        <div className="hstats">
          <div>
            <small>Income {selectedYear === 'all' ? 'semua tahun' : selectedYear}</small>
            <b className="mono money">+{formatRupiah(summary.totalIncome)}</b>
          </div>
          <div>
            <small>Spending {selectedYear === 'all' ? 'semua tahun' : selectedYear}</small>
            <b className="mono money">−{formatRupiah(summary.totalSpending)}</b>
          </div>
          <div>
            <small>Target tercapai</small>
            <b className="mono">{overallTarget.toFixed(1)}%</b>
          </div>
          <div>
            <small>Akun</small>
            <b className="mono">{assets.length}</b>
          </div>
        </div>
      </GlassCard>

      {/* ── Insight (s4) ── */}
      <GlassCard tilt className="insight s4">
        <div className="row">
          <span className="ai">
            <Sparkles size={15} strokeWidth={2.3} />
            INSIGHT
          </span>
          <button
            type="button"
            className="ibtn"
            style={{ width: 34, height: 34 }}
            title="Insight lain"
            aria-label="Insight lain"
            onClick={() => setTipSet((s) => (s + 1) % tipSets.length)}
          >
            <RefreshCw size={15} strokeWidth={2.3} />
          </button>
        </div>
        <TipList key={tipSet} tips={tipSets[tipSet] ?? []} />
      </GlassCard>

      {/* ── Monthly Income (s4) ── */}
      <GlassCard tilt className="s4">
        <div className="row">
          <div className="lbl">Monthly Income</div>
          <div className="ico">
            <TrendingUp size={18} strokeWidth={2.2} />
          </div>
        </div>
        <div className="big money">
          <AnimatedRupiah value={summary.totalIncome} />
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <span className="sub" style={{ margin: 0 }}>
            Gaji, Freelance &amp; Pelunasan
          </span>
          <span className="pill ok">Tabungan {rate.toFixed(1)}%</span>
        </div>
      </GlassCard>

      {/* ── Monthly Spending (s4) ── */}
      <GlassCard tilt className="s4">
        <div className="row">
          <div className="lbl">Monthly Spending</div>
          <div className="ico">
            <TrendingDown size={18} strokeWidth={2.2} />
          </div>
        </div>
        <div className="big money">
          <AnimatedRupiah value={summary.totalSpending} />
        </div>
        <div className="row sub mono" style={{ fontSize: 11.5, marginTop: 12 }}>
          <span>
            Needs <span className="money">{formatRupiah(summary.needsAmount)}</span>
          </span>
          <span>
            Wants <span className="money">{formatRupiah(summary.wantsAmount)}</span>
          </span>
        </div>
        <ProgressBar percent={needsPct} />
        <div className="row sub mono" style={{ fontSize: 10.5 }}>
          <span>{needsPct}% Needs</span>
          <span>{wantsPct}% Wants</span>
        </div>
      </GlassCard>

      {/* ── Savings Rate + ring (s4) ── */}
      <GlassCard tilt className="s4">
        <div className="row" style={{ alignItems: 'center' }}>
          <div>
            <div className="lbl">Savings Rate</div>
            <div className="big">{rate.toFixed(0)}%</div>
            <div className="sub">porsi income yang tertahan</div>
            <span className="pill ok" style={{ display: 'inline-block', marginTop: 10 }}>
              {healthLabel}
            </span>
          </div>
          <Ring percent={rate} label={Math.round(rate)} />
        </div>
      </GlassCard>
    </>
  );
}
