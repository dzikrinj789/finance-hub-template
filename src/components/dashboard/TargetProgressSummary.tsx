'use client';

import React, { useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { formatPercent, formatRupiah } from '@/lib/utils';
import { RecoveryItem, getRecoveryCategoryLabel } from '@/types/finance';
import { Target, CheckCircle2, Clock, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react';

const getStatusIcon = (item: RecoveryItem) => {
  switch (item.status) {
    case 'Recovered':
      return CheckCircle2;
    case 'Partial':
      return Clock;
    default:
      return AlertCircle;
  }
};

export function TargetProgressSummary() {
  const { recoveryItems, setActiveTab } = useFinance();
  // Mobile: tampilkan 5 target dulu (presentasi saja)
  const [showAllMobile, setShowAllMobile] = useState(false);

  const totalTarget = recoveryItems.reduce((sum, it) => sum + it.targetAmount, 0);
  const totalRecovered = recoveryItems.reduce((sum, it) => sum + it.recoveredAmount, 0);
  const totalRemaining = Math.max(0, totalTarget - totalRecovered);
  const progressPercent =
    totalTarget > 0 ? Math.min(100, (totalRecovered / totalTarget) * 100) : 0;

  return (
    <div className="notion-card">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#E5E5E3]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F1F1EF] border border-[#E5E5E3] text-[#1A1A1A]">
            <Target className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wider">
              Target &amp; Recovery Progress
            </h3>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Terealisasi selalu sinkron real-time dengan transaksi Cashflow yang tertaut
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('recovery')}
          className="h-8 px-3 rounded-lg border border-[#E5E5E3] bg-white text-xs font-medium text-[#374151] hover:bg-[#F1F1EF] transition flex items-center gap-1.5"
        >
          Kelola Target
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Overall progress + metrics */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
        <div className="rounded-lg bg-[#F7F7F5] border border-[#E5E5E3] px-3 py-2">
          <span className="block text-[10px] uppercase tracking-wider text-[#9CA3AF] font-sans">
            Total Target
          </span>
          <strong className="money text-[#1A1A1A]">{formatRupiah(totalTarget)}</strong>
        </div>
        <div className="rounded-lg bg-[#F7F7F5] border border-[#E5E5E3] px-3 py-2">
          <span className="block text-[10px] uppercase tracking-wider text-[#9CA3AF] font-sans">
            Terealisasi
          </span>
          <strong className="money text-[#1A1A1A]">{formatRupiah(totalRecovered)}</strong>
        </div>
        <div className="rounded-lg bg-[#F7F7F5] border border-[#E5E5E3] px-3 py-2">
          <span className="block text-[10px] uppercase tracking-wider text-[#9CA3AF] font-sans">
            Sisa Target
          </span>
          <strong className="money text-[#374151]">{formatRupiah(totalRemaining)}</strong>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="progress-track flex-1">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <span className="text-xs font-mono text-[#1A1A1A] whitespace-nowrap">
          {formatPercent(progressPercent)}
        </span>
      </div>

      {/* Per-target mini progress rows */}
      {recoveryItems.length === 0 ? (
        <p className="mt-4 text-xs text-[#9CA3AF]">
          Belum ada target. Buka{' '}
          <button
            onClick={() => setActiveTab('recovery')}
            className="text-[#6B7280] underline underline-offset-2 hover:text-[#1A1A1A]"
          >
            Target &amp; Recovery
          </button>{' '}
          untuk membuat target pemulihan modal pertama.
        </p>
      ) : (
        <>
        <div className={`mt-5 space-y-2.5 ${showAllMobile ? '' : 'mob-collapsed'}`}>
          {recoveryItems.map((item, idx) => {
            const percent = Math.min(100, (item.recoveredAmount / item.targetAmount) * 100);
            const StatusIcon = getStatusIcon(item);
            return (
              <div
                key={item.id}
                className={`${idx >= 5 ? 'mob-extra ' : ''}grid grid-cols-1 sm:grid-cols-[1fr_auto] sm:items-center gap-2 rounded-lg border border-[#E5E5E3] bg-white px-3 py-2.5`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusIcon
                      className={`h-3.5 w-3.5 shrink-0 ${
                        item.status === 'Recovered' ? 'text-[#1A1A1A]' : 'text-[#9CA3AF]'
                      }`}
                    />
                    <p className="text-xs font-semibold text-[#1A1A1A] truncate">{item.title}</p>
                    <span className="badge bg-[#F7F7F5] text-[#9CA3AF] border border-[#E5E5E3]">
                      {getRecoveryCategoryLabel(item.category)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="progress-track flex-1">
                      <div className="progress-fill" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="w-11 text-right text-[11px] font-mono text-[#6B7280]">
                      {formatPercent(percent)}
                    </span>
                  </div>
                </div>
                <div className="text-left sm:text-right font-mono text-xs">
                  <strong className="money text-[#1A1A1A]">{formatRupiah(item.recoveredAmount)}</strong>
                  <span className="text-[#9CA3AF]"> / <span className="money">{formatRupiah(item.targetAmount)}</span></span>
                </div>
              </div>
            );
          })}
        </div>
        {recoveryItems.length > 5 && (
          <button
            type="button"
            className="btn mobile-more mobile-only"
            onClick={() => setShowAllMobile((v) => !v)}
            aria-expanded={showAllMobile}
          >
            {showAllMobile ? 'Tampilkan lebih sedikit' : `Lihat semua (${recoveryItems.length})`}
            <ChevronDown size={14} style={{ transform: showAllMobile ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
          </button>
        )}
        </>
      )}
    </div>
  );
}