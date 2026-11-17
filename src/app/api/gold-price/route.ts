// Harga emas per gram untuk valuasi aset Emas di Setup.
// Sumber: Galeri24 (https://galeri24.co.id/harga-emas#ANTAM) → bagian "Harga ANTAM",
// baris Berat 1, kolom "Harga Buyback". Halaman di-render server (Nuxt SSR) sehingga
// cukup fetch HTML + parse blok <div id="ANTAM"> … (tanpa API key / secret).
//
// Refresh harian tanpa cron/secret: hasil fetch disimpan di Next.js Data Cache dan
// divalidasi ulang tiap jam (revalidate 3600). Galeri24 memperbarui harga sekali sehari
// (pagi WIB), jadi harga di app paling lambat ±1 jam tertinggal dari situs.
//
// Fallback: bila fetch/parse gagal → harga terakhir yang berhasil (memori instance),
// lalu last-known konstan; response tetap 200 dengan stale:true + note (UI tampilkan notice).
//
// Response (kompatibel dengan GoldPriceInfo lama): sellPricePerGram = harga BUYBACK 1 gram.

import { parseGaleri24, type ParsedPrice } from '@/lib/galeri24';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SOURCE_URL = 'https://galeri24.co.id/harga-emas';
const VENDOR = 'ANTAM';
const FETCH_TIMEOUT_MS = 12000;
const REVALIDATE_SECONDS = 3600;
// Last-known Galeri24 ANTAM 1 gram buyback (Sabtu, 31 Oktober 2026) — hanya dipakai bila semua gagal.
const FALLBACK = { pricePerGram: 2274000, recordedDate: '2026-10-31', updatedLabel: 'Sabtu, 31 Oktober 2026' };

let lastGood: (ParsedPrice & { fetchedAt: string }) | null = null;

async function fetchGaleri24(): Promise<ParsedPrice | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(SOURCE_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'id-ID,id;q=0.9',
      },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseGaleri24(await res.text());
  } finally {
    clearTimeout(timer);
  }
}

function body(p: ParsedPrice, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    source: 'galeri24',
    vendor: VENDOR,
    priceType: 'buyback',
    sourceUrl: `${SOURCE_URL}#${VENDOR}`,
    // Nama field lama dipertahankan agar seluruh pemakaian di app tetap jalan:
    // isinya sekarang = harga BUYBACK ANTAM 1 gram.
    sellPricePerGram: p.pricePerGram,
    pricePerGram: p.pricePerGram,
    sellingPricePerGram: p.sellingPricePerGram,
    weight: 1,
    weightUnit: 'gram',
    recordedDate: p.recordedDate || new Date().toISOString().slice(0, 10),
    updatedLabel: p.updatedLabel,
    fetchedAt: new Date().toISOString(),
    ...extra,
  });
}

export async function GET() {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } as const;
  let reason = '';
  try {
    const p = await fetchGaleri24();
    if (p) {
      lastGood = { ...p, fetchedAt: new Date().toISOString() };
      return new Response(body(p), { status: 200, headers });
    }
    reason = 'struktur halaman Galeri24 berubah / baris ANTAM 1 gram tidak ditemukan';
  } catch (err) {
    reason = err instanceof Error ? err.message : String(err);
  }
  console.warn('[gold-price] Galeri24 gagal:', reason);
  const fb = lastGood ?? FALLBACK;
  return new Response(
    body(fb, {
      stale: true,
      note: `Gagal ambil harga terbaru dari Galeri24 (${reason}) — memakai harga terakhir ${fb.updatedLabel}.`,
    }),
    { status: 200, headers }
  );
}
