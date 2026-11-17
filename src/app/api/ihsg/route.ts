import { NextResponse } from 'next/server';
import { fetchIhsg } from '@/lib/idx-market';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const headers = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * GET /api/ihsg
 * Indeks Harga Saham Gabungan.
 * Utama: TradingView scanner IDX:COMPOSITE (close = harga terakhir, plus buka/tinggi/rendah,
 * perubahan, dan kinerja 1 minggu / 1 bulan / YTD).
 * Cadangan: Yahoo Finance ^JKSE regularMarketPrice (bukan previous close, kalau harga terakhir ada).
 */
export async function GET() {
  try {
    const quote = await fetchIhsg();
    return NextResponse.json(
      { ...quote, fetchedAt: new Date().toISOString() },
      { headers }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil IHSG';
    return NextResponse.json({ error: msg, symbol: 'IHSG' }, { status: 500, headers });
  }
}
