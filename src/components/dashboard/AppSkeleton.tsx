'use client';

import React from 'react';
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton';

/**
 * Layout-level skeleton — ditampilkan di (app)/layout saat isLoaded false.
 * Mencegah glitch refresh: UI tidak kosong, tampilkan shimmer yang mirip struktur asli.
 */
export function AppSkeleton() {
  return (
    <div className="flex h-dvh overflow-hidden bg-[#F2F5FD]" aria-busy="true" aria-label="Memuat Finance Hub">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-[244px] shrink-0 border-r border-[#E7EBF6] bg-white/80 flex-col p-4 gap-4">
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
          <div className="space-y-1.5 flex-1">
            <SkeletonLine width="60%" className="h-3" />
            <SkeletonLine width="45%" className="h-2.5" />
          </div>
        </div>
        <div className="space-y-2 pt-2">
          <SkeletonLine width="40%" className="h-2.5" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 rounded-xl skeleton" />
          ))}
        </div>
        <div className="mt-auto pt-4 border-t border-[#EDF0FA] space-y-2">
          <Skeleton className="h-10 rounded-xl w-full" />
          <Skeleton className="h-7 rounded-xl w-full" />
        </div>
      </div>

      {/* Main skeleton */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Greeting hero */}
        <div className="px-4 sm:px-7 md:px-8 pt-[calc(2rem_+_env(safe-area-inset-top))] md:pt-5 pb-3 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="space-y-1.5">
              <SkeletonLine width={170} className="h-4" />
              <SkeletonLine width={210} className="h-2.5" />
            </div>
          </div>
          <SkeletonLine width={110} className="h-7 rounded-full" />
        </div>

        {/* Page title */}
        <div className="px-4 sm:px-7 md:px-8 pb-3 shrink-0 space-y-2">
          <SkeletonLine width={230} className="h-8 rounded-xl" />
          <SkeletonLine width="45%" className="h-3.5" />
        </div>

        {/* Tabs + actions */}
        <div className="px-3 sm:px-7 md:px-8 py-2.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="w-20 h-9 rounded-xl" />
            ))}
          </div>
          <div className="hidden sm:flex gap-2">
            <Skeleton className="w-20 h-9 rounded-full" />
            <Skeleton className="w-20 h-9 rounded-full" />
            <Skeleton className="w-36 h-9 rounded-full" />
          </div>
        </div>

        {/* Content cards shimmer */}
        <div className="flex-1 overflow-hidden px-3 sm:px-7 md:px-8 py-3 space-y-4">
          <div className="grid md:grid-cols-3 gap-4 max-w-7xl">
            <div className="md:col-span-3 h-36 rounded-3xl bg-white border border-[#E7EBF6] skeleton" />
            <div className="h-32 bg-white border border-[#E7EBF6] rounded-2xl skeleton" />
            <div className="h-32 bg-white border border-[#E7EBF6] rounded-2xl skeleton" />
            <div className="h-32 bg-white border border-[#E7EBF6] rounded-2xl skeleton" />
          </div>
          <div className="h-64 bg-white border border-[#E7EBF6] rounded-2xl skeleton max-w-7xl" />
          <div className="h-64 bg-white border border-[#E7EBF6] rounded-2xl skeleton max-w-7xl hidden sm:block" />
        </div>
      </div>
    </div>
  );
}

/** Inline dashboard content skeleton — dipakai fallback di child page bila layout gate lolos tapi data susulan */
export function DashboardContentSkeleton() {
  return (
    <div className="space-y-5 max-w-7xl">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 bg-white border border-[#E7EBF6] rounded-2xl skeleton" />
        ))}
      </div>
      <div className="h-72 bg-white border border-[#E7EBF6] rounded-2xl skeleton" />
    </div>
  );
}
