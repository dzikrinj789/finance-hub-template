'use client';

import React from 'react';
import { useFinance } from '@/context/FinanceContext';
import { formatRupiah } from '@/lib/utils';
import { getStockCostValue, getStockMarketValue } from '@/types/finance';
import { TrendingUp, Layers, Wallet, BarChart3, Target } from 'lucide-react';
import { formatMarketClock, IhsgStrip } from '@/components/dashboard/IhsgStrip';
import { useMarketStatus } from '@/lib/market-refresh';

export function StockPortfolioSummary() {
  const { stockHoldings, totalStockRealizedProfit } = useFinance();
  const market = useMarketStatus();

  const costTotal = stockHoldings.reduce((s, h) => s + getStockCostValue(h), 0);
  const marketTotal = stockHoldings.reduce((s, h) => s + getStockMarketValue(h), 0);
  const unrealized = marketTotal - costTotal;
  const unrealizedPct = costTotal > 0 ? (unrealized / costTotal) * 100 : 0;

  const swingHoldings = stockHoldings.filter((h) => (h.strategy ?? 'Long-Term') === 'Swing');
  const swingValue = swingHoldings.reduce((s, h) => s + getStockMarketValue(h), 0);
  const swingCount = swingHoldings.length;

  const hasPositions = stockHoldings.length > 0;

  return (
    <div className="notion-card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-[#E5E5E3]">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-center text-[#3730A3]">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wider">Kelola Aset Saham — Ringkasan Dashboard</h3>
            <p className="text-xs text-[#6B7280] mt-0.5">Total modal, nilai pasar & P&L real-time · Swing & Realized Profit</p>
          </div>
        </div>
        <span className="badge border border-[#E5E5E3] bg-[#F7F7F5] text-[#6B7280] text-[10px]">1 lot = 100 lbr</span>
      </div>

      <IhsgStrip className="mt-4" />
      {hasPositions && (
        <p className="mt-2 text-[10px] font-mono text-[#9CA3AF]">
          {market.loading
            ? 'Memperbarui harga saham…'
            : market.lastUpdatedAt
              ? `Harga saham diperbarui ${formatMarketClock(market.lastUpdatedAt)} WIB${market.detail ? ` · ${market.detail}` : ''}`
              : 'Harga saham diperbarui otomatis saat halaman dibuka.'}
        </p>
      )}

      {!hasPositions ? (
        <p className="mt-4 text-xs text-[#9CA3AF]">Belum ada posisi saham. Tambahkan di <strong className="text-[#6B7280]">Setup → Kelola Aset Saham</strong>.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="rounded-lg border border-[#E5E5E3] bg-[#FBFBFA] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[#9CA3AF]"><Wallet className="h-3 w-3" /><span className="text-[10px] uppercase tracking-wider font-semibold">Total Modal Saham</span></div>
            <p className="money text-sm font-bold text-[#1A1A1A] font-mono mt-1">{formatRupiah(costTotal)}</p>
            <p className="text-[10px] font-mono text-[#9CA3AF]">Investasi · {stockHoldings.length} posisi</p>
          </div>
          <div className="rounded-lg border border-[#E5E5E3] bg-[#FBFBFA] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[#9CA3AF]"><Layers className="h-3 w-3" /><span className="text-[10px] uppercase tracking-wider font-semibold">Nilai Pasar</span></div>
            <p className="money text-sm font-bold text-[#1A1A1A] font-mono mt-1">{formatRupiah(marketTotal)}</p>
            <p className="text-[10px] font-mono text-[#9CA3AF]">Real-time · Σ lot × Harga Saat Ini</p>
          </div>
          <div className={`rounded-lg border px-3 py-2.5 ${unrealized >= 0 ? 'border-[#A7F3D0] bg-[#ECFDF5]' : 'border-[#FECACA] bg-[#FEF2F2]'}`}>
            <div className="flex items-center gap-1.5 text-[#6B7280]"><BarChart3 className="h-3 w-3" /><span className="text-[10px] uppercase tracking-wider font-semibold">P&L Unrealized</span></div>
            <p className={`money text-sm font-bold font-mono mt-1 ${unrealized >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>{unrealized >= 0 ? '+' : ''}{formatRupiah(unrealized)}</p>
            <p className={`text-[10px] font-mono ${unrealized >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>{unrealized >= 0 ? '+' : ''}{unrealizedPct.toFixed(2)}%</p>
          </div>
          <div className="rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[#3B82F6]"><TrendingUp className="h-3 w-3" /><span className="text-[10px] uppercase tracking-wider font-semibold">Swing Position</span></div>
            <p className="text-sm font-bold text-[#1E40AF] font-mono mt-1">{swingCount} saham</p>
            <p className="text-[10px] font-mono text-[#60A5FA]"><span className="money">{formatRupiah(swingValue)}</span> · {swingCount === 0 ? 'Tidak ada' : `${swingCount} posisi`}</p>
          </div>
          <div className={`rounded-lg border px-3 py-2.5 ${totalStockRealizedProfit >= 0 ? 'border-[#E5E5E3] bg-[#F7F7F5]' : 'border-[#FECACA] bg-[#FFF7F7]'}`}>
            <div className="flex items-center gap-1.5 text-[#6B7280]"><Target className="h-3 w-3" /><span className="text-[10px] uppercase tracking-wider font-semibold">Realized Profit</span></div>
            <p className={`money text-sm font-bold font-mono mt-1 ${totalStockRealizedProfit >= 0 ? 'text-[#1A1A1A]' : 'text-[#DC2626]'}`}>{totalStockRealizedProfit >= 0 ? '+' : ''}{formatRupiah(totalStockRealizedProfit)}</p>
            <p className="text-[10px] font-mono text-[#9CA3AF]">Terealisasi → Pemulihan Saham</p>
          </div>
        </div>
      )}
    </div>
  );
}
