'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useFinance } from '@/context/FinanceContext';
import { useActiveSlice } from '@/hooks/useActiveSlice';
import { formatCompactRupiah, formatPercent, formatRupiah } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
  PieChart as PieIcon,
  Landmark,
  MoonStar,
  Sprout,
  TrendingUp,
  Coins,
  Bike,
  Handshake,
  Wallet,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';

const ASSET_COLORS: Record<string, string> = {
  Mandiri: '#16a34a', // Emerald
  'Jago Syariah': '#34d399', // Mint
  Bibit: '#06b6d4', // Cyan
  Saham: '#6366f1', // Indigo
  'Emas Fisik': '#eab308', // Amber Gold
  Motor: '#f97316', // Orange
  'Piutang Teman': '#ec4899', // Pink
};

/* Icon lucu per wadah aset (fallback Wallet untuk wadah dinamis Setup) */
const ASSET_ICONS: Record<string, LucideIcon> = {
  Mandiri: Landmark,
  'Jago Syariah': MoonStar,
  Bibit: Sprout,
  Saham: TrendingUp,
  'Emas Fisik': Coins,
  Motor: Bike,
  'Piutang Teman': Handshake,
};

function getAssetIcon(name: string): LucideIcon {
  return ASSET_ICONS[(name || '').trim()] ?? Wallet;
}

const MOBILE_LIMIT = 5;

export function AssetBreakdown() {
  const { assets } = useFinance();
  // Mobile: tampilkan 5 wadah dulu (presentasi saja, data sama)
  const [showAllMobile, setShowAllMobile] = useState(false);
  // Slice aktif (hover / tap) ditampilkan DI TENGAH donut menggantikan "Total Aset" —
  // dulu tooltip melayang menumpuk di atas label tengah (angka saling timpa).
  const slice = useActiveSlice();
  const { activeIdx } = slice;

  const totalNetWorth = assets.reduce((sum, a) => sum + a.value, 0);
  const totalLiquid = assets
    .filter((a) => a.category === 'likuid')
    .reduce((sum, a) => sum + a.value, 0);
  const totalNonLiquid = totalNetWorth - totalLiquid;

  const chartData = assets.map((a) => ({
    name: a.name,
    displayName: a.displayName,
    value: a.value,
    category: a.category,
    color: ASSET_COLORS[a.name] || '#94a3b8',
    percent: totalNetWorth > 0 ? (a.value / totalNetWorth) * 100 : 0,
  }));

  return (
    <div className="notion-card">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#E5E5E3]">
        <div>
          <div className="flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-[#1A1A1A]" />
            <h3 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wider">
              Asset Allocation (Account Assets)
            </h3>
          </div>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Distribusi saldo di akun yang sudah Anda buat
          </p>
        </div>

        <div className="flex items-center gap-2.5 text-[10px] sm:text-xs flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-[#6B7280]">Likuid:</span>
            <strong className="money text-[#1A1A1A] font-mono">{formatCompactRupiah(totalLiquid)}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-400" />
            <span className="text-[#6B7280]">Non-Likuid:</span>
            <strong className="money text-[#1A1A1A] font-mono">{formatCompactRupiah(totalNonLiquid)}</strong>
          </div>
        </div>
      </div>

      {/* Main Grid: Chart + Spreadsheet Table */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-center">
        {/* Donut Chart */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="relative h-56 w-56" {...slice.boxProps}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  {...slice.pieProps}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      fillOpacity={activeIdx === null || activeIdx === index ? 1 : 0.35}
                      style={{ cursor: 'pointer', transition: 'fill-opacity .15s' }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Tengah donut: Total Aset, atau detail slice yang sedang aktif */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              {activeIdx !== null && chartData[activeIdx] ? (
                <>
                  <span className="max-w-[118px] truncate text-[10px] font-semibold text-[#6B7280]">
                    {chartData[activeIdx].displayName || chartData[activeIdx].name}
                  </span>
                  <span className="money text-xs font-bold text-[#1A1A1A] font-mono">
                    {formatRupiah(chartData[activeIdx].value)}
                  </span>
                  <span className="text-[10px] text-[#6B7280] font-mono">
                    {formatPercent(chartData[activeIdx].percent)} dari total
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] uppercase font-semibold text-[#6B7280] tracking-wider">
                    Total Aset
                  </span>
                  <span className="money text-sm font-bold text-[#1A1A1A] font-mono">
                    {formatCompactRupiah(totalNetWorth)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── MOBILE: daftar aset native, tanpa scroll horizontal ── */}
        <div className="lg:hidden">
          {chartData.length === 0 ? (
            <p className="py-6 text-center text-[11px] text-[#8A93A8]">
              Belum ada data aset.
            </p>
          ) : (
            <>
            <div className="divide-y divide-[#F1F3FA]">
              {(showAllMobile ? chartData : chartData.slice(0, MOBILE_LIMIT)).map((item, idx) => {
                const Icon = getAssetIcon(item.name);
                return (
                  <motion.div
                    key={`${item.name}-${idx}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16, delay: Math.min(idx * 0.03, 0.15) }}
                    className="flex items-center gap-3 py-3 first:pt-1"
                  >
                    <span
                      className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${item.color}1A`, color: item.color }}
                    >
                      <Icon size={16} strokeWidth={2.2} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-[#0F1932] truncate">
                        {item.displayName || item.name}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className={`rounded-full border px-1.5 py-px text-[8px] font-bold uppercase tracking-wide ${
                            item.category === 'likuid'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              : 'bg-indigo-50 text-indigo-500 border-indigo-100'
                          }`}
                        >
                          {item.category === 'likuid' ? 'Likuid' : 'Non-Likuid'}
                        </span>
                        <span className="text-[10px] text-[#8A93A8] font-mono">
                          {formatPercent(item.percent)}
                        </span>
                      </div>
                    </div>
                    <p className="money r shrink-0 font-mono text-[12.5px] font-bold text-[#0F1932] whitespace-nowrap">
                      {formatCompactRupiah(item.value)}
                    </p>
                  </motion.div>
                );
              })}
            </div>
            {chartData.length > MOBILE_LIMIT && (
              <button
                type="button"
                className="btn mobile-more"
                onClick={() => setShowAllMobile((v) => !v)}
                aria-expanded={showAllMobile}
              >
                {showAllMobile ? 'Tampilkan lebih sedikit' : `Lihat semua (${chartData.length})`}
                <ChevronDown size={14} style={{ transform: showAllMobile ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
              </button>
            )}
            </>
          )}
        </div>

        {/* Spreadsheet-like Clean Table — desktop */}
        <div className="hidden lg:block lg:col-span-7 overflow-x-auto">
          <table className="notion-table">
            <thead>
              <tr>
                <th>Akun / Wadah Aset</th>
                <th>Kategori</th>
                <th className="text-right">Nilai (IDR)</th>
                <th className="text-right">Porsi</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {chartData.map((item, idx) => (
                <tr key={idx} className="hover:bg-[#F1F1EF] transition-colors">
                  <td className="py-2 px-2.5">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-[#1A1A1A] font-sans truncate" title={item.displayName}>
                        {item.name}
                      </span>
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    <span
                      className={`badge ${
                        item.category === 'likuid'
                          ? 'bg-[#F1F1EF] text-[#1A1A1A] border border-[#CDCDC9]'
                          : 'bg-[#F7F7F5] text-[#6B7280] border border-[#E5E5E3]'
                      }`}
                    >
                      {item.category === 'likuid' ? 'Likuid' : 'Non-Likuid'}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right text-[#1A1A1A] font-medium">
                    <span className="money">{formatRupiah(item.value)}</span>
                  </td>
                  <td className="py-2 px-2 text-right text-[#6B7280]">
                    {formatPercent(item.percent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}