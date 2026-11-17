'use client';

import React from 'react';

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden />;
}

export function SkeletonLine({ className = '', width }: { className?: string; width?: string | number }) {
  return (
    <div
      className={`skeleton-line ${className}`}
      style={width != null ? { width: typeof width === 'number' ? `${width}px` : width } : undefined}
      aria-hidden
    />
  );
}

export function SkeletonCard({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <div className={`skeleton-card ${className}`}>{children}</div>;
}

/** Shimmer card skeleton untuk Summary / Asset / Target */
export function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <SkeletonLine width={90} className="h-3" />
            <Skeleton className="w-7 h-7 rounded-md" />
          </div>
          <SkeletonLine width="55%" className="h-7" />
          <div className="pt-3 border-t border-[#E5E5E3] flex gap-3">
            <SkeletonLine width={70} className="h-3 flex-1" />
            <SkeletonLine width={70} className="h-3 flex-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="skeleton-card p-5 space-y-4">
      <SkeletonLine width={180} className="h-4" />
      <SkeletonLine width="60%" className="h-3" />
      <div className="flex gap-6 pt-2">
        <Skeleton className="w-56 h-56 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="100%" className="h-8" />
          <SkeletonLine width="100%" className="h-8" />
          <SkeletonLine width="100%" className="h-8" />
          <SkeletonLine width="70%" className="h-8" />
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton-card p-0 overflow-hidden">
      <div className="p-4 border-b border-[#E5E5E3]">
        <SkeletonLine width={140} className="h-4" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-3 items-center">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <SkeletonLine width="30%" className="h-4 flex-1" />
            <SkeletonLine width={80} className="h-4" />
            <SkeletonLine width={60} className="h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
