'use client';

import React, { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { formatRupiah } from '@/lib/utils';
import { GlassCard, ProgressBar } from '@/components/ui/minimal';

export function SpendingCategories({ className = 's5' }: { className?: string }) {
  const { transactions, selectedYear } = useFinance();

  const cats = useMemo(() => {
    const scoped =
      selectedYear === 'all'
        ? transactions
        : transactions.filter((t) => t.date.startsWith(selectedYear));
    const map = new Map<string, number>();
    scoped
      .filter((t) => (t.type === 'Needs' || t.type === 'Wants') && !t.isExcludeReport)
      .forEach((t) => map.set(t.category, (map.get(t.category) ?? 0) + t.amount));
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value, pct: (value / total) * 100 }));
  }, [transactions, selectedYear]);

  return (
    <GlassCard className={className}>
      <div className="lbl ttl">
        <Layers size={17} strokeWidth={2.2} />
        Spending per Kategori
      </div>
      <div className="sub">
        Dari transaksi Needs &amp; Wants — periode {selectedYear === 'all' ? 'semua tahun' : selectedYear}
      </div>
      {cats.length > 0 ? (
        <div style={{ marginTop: 4 }}>
          {cats.map((c) => (
            <div key={c.name} className="cat">
              <div className="row">
                <span style={{ color: 'var(--text)' }}>{c.name}</span>
                <span className="mono money">
                  {formatRupiah(c.value)} · {c.pct.toFixed(0)}%
                </span>
              </div>
              <ProgressBar percent={c.pct} />
            </div>
          ))}
        </div>
      ) : (
        <div className="sub" style={{ marginTop: 14 }}>
          Belum ada transaksi Needs/Wants pada periode ini.
        </div>
      )}
    </GlassCard>
  );
}
