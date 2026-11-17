'use client';

import React, { useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  Bike,
  Coffee,
  PiggyBank,
  Receipt,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { formatRupiah } from '@/lib/utils';
import type { Transaction } from '@/types/finance';
import { GlassCard } from '@/components/ui/minimal';

const CAT_ICON: Record<string, LucideIcon> = {
  Transportation: Bike,
  'Food & Groceries': Coffee,
  'Utilities & Bill': Smartphone,
  'Nongkrong & Kopi': Coffee,
  'Shopping & Outfit': ShoppingBag,
};

export function txIcon(t: Transaction): LucideIcon {
  if (t.type === 'Income') return ArrowDownLeft;
  if (t.type === 'Internal Transfer') return ArrowLeftRight;
  if (t.type === 'Savings') return PiggyBank;
  if (t.type === 'Investment') return TrendingUp;
  return CAT_ICON[t.category] ?? Receipt;
}

/* Nominal bertanda sesuai tipe (presentasi saja) */
export function TxAmount({ t }: { t: Transaction }) {
  if (t.type === 'Income') return <span className="pos money">+ {formatRupiah(t.amount)}</span>;
  if (t.type === 'Internal Transfer')
    return (
      <span className="money" style={{ color: 'var(--muted)' }}>
        ⇄ {formatRupiah(t.amount)}
      </span>
    );
  return <span className="neg money">− {formatRupiah(t.amount)}</span>;
}

/* ── Transaksi Terbaru (s7) ── */
export function RecentTransactions({ className = 's7' }: { className?: string }) {
  const { transactions, setActiveTab } = useFinance();
  const recent = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt ?? '').localeCompare(a.createdAt ?? '')))
        .slice(0, 5),
    [transactions],
  );

  return (
    <GlassCard className={className}>
      <div className="row">
        <div className="lbl ttl">
          <Receipt size={17} strokeWidth={2.2} />
          Transaksi Terbaru
        </div>
        <button type="button" className="btn" style={{ padding: '7px 12px' }} onClick={() => setActiveTab('cashflow')}>
          Lihat semua <ArrowRight size={15} />
        </button>
      </div>
      {recent.length > 0 ? (
        <div className="tablewrap">
          <table className="glass-table">
            <tbody>
              {recent.map((t, i) => {
                const Icon = txIcon(t);
                return (
                  <tr key={t.id} style={{ animationDelay: `${i * 40}ms` }}>
                    <td style={{ width: 52, padding: 10 }}>
                      <div className="ico" style={{ width: 34, height: 34, borderRadius: 11 }}>
                        <Icon size={16} />
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {t.note || t.category}
                      <div className="sub" style={{ marginTop: 2, fontWeight: 500 }}>
                        {t.category} · {t.wallet}
                      </div>
                    </td>
                    <td className="amtcell">
                      <TxAmount t={t} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">Belum ada transaksi. Catat transaksi pertama setelah menambah akun di Setup.</div>
      )}
    </GlassCard>
  );
}
