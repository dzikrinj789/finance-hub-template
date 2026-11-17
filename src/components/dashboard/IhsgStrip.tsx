'use client';

import { useMarketStatus } from '@/lib/market-refresh';

function formatPoints(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatSigned(n: number, digits = 2): string {
  const abs = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(n));
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return abs;
}

function sourceLabel(source: string): string {
  if (source.includes('tradingview')) return 'TradingView';
  if (source.includes('yahoo')) return 'Yahoo Finance';
  return 'Pasar';
}

function delayLabel(delayed: boolean, seconds: number | null): string | null {
  if (seconds != null && seconds >= 60) return `tertunda ±${Math.round(seconds / 60)} mnt`;
  if (delayed) return 'kutipan tertunda';
  return null;
}

export function formatMarketClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
}

/** Strip IHSG — harga terakhir, rentang hari ini, dan kinerja dari sumber yang sama. */
export function IhsgStrip({ className = '' }: { className?: string }) {
  const market = useMarketStatus();
  const q = market.ihsg;
  const tone = (q?.change ?? 0) >= 0 ? 'text-[#059669]' : 'text-[#DC2626]';
  const delay = q ? delayLabel(q.delayed, q.delaySeconds) : null;
  const range =
    q && q.low != null && q.high != null
      ? `${formatPoints(q.low)}–${formatPoints(q.high)}`
      : null;

  return (
    <div className={`rounded-lg border border-[#E5E5E3] bg-[#FBFBFA] px-3 py-2.5 ${className}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-[#9CA3AF]">IHSG</p>
        {q ? (
          <>
            <p className={`text-sm font-bold font-mono text-[#1A1A1A] ${market.loading ? 'opacity-60' : ''}`}>
              {formatPoints(q.price)}
            </p>
            {q.change != null && (
              <p className={`text-[12px] font-mono font-semibold ${tone}`}>
                {formatSigned(q.change)}
                {q.changePercent != null ? ` (${formatSigned(q.changePercent)}%)` : ''}
              </p>
            )}
          </>
        ) : (
          <p className="text-[12px] text-[#6B7280]">
            {market.loading ? 'Memuat IHSG…' : 'IHSG belum tersedia'}
          </p>
        )}
        <p className="text-[10px] font-mono text-[#9CA3AF] ml-auto">
          {market.loading
            ? 'Memperbarui…'
            : market.lastUpdatedAt
              ? `Diperbarui ${formatMarketClock(market.lastUpdatedAt)} WIB`
              : 'Menunggu harga'}
        </p>
      </div>

      {q && (
        <p className="mt-1 text-[10px] font-mono text-[#9CA3AF] leading-relaxed">
          {q.open != null ? `Buka ${formatPoints(q.open)}` : null}
          {q.open != null && range ? ' · ' : ''}
          {range ? `Hari ini ${range}` : ''}
          {(q.open != null || range) && q.previousClose != null ? ' · ' : ''}
          {q.previousClose != null ? `Kemarin ${formatPoints(q.previousClose)}` : ''}
          {' · '}
          {sourceLabel(q.source)}
          {delay ? ` · ${delay}` : ' · harga terakhir'}
        </p>
      )}

      {q && (q.perfWeek != null || q.perfMonth != null || q.perfYtd != null) && (
        <p className="mt-0.5 text-[10px] font-mono text-[#9CA3AF]">
          {[
            q.perfWeek != null ? `1 minggu ${formatSigned(q.perfWeek)}%` : null,
            q.perfMonth != null ? `1 bulan ${formatSigned(q.perfMonth)}%` : null,
            q.perfYtd != null ? `YTD ${formatSigned(q.perfYtd)}%` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      {market.ihsgError && (
        <p className="mt-1 text-[10px] text-[#B45309]">
          {q ? 'Pembaruan IHSG gagal — angka di atas masih yang terakhir berhasil.' : market.ihsgError}
        </p>
      )}
    </div>
  );
}
