'use client';

export interface GoldPriceInfo {
  source: 'galeri24' | 'logam-mulia';
  vendor?: string; // 'ANTAM'
  priceType?: 'buyback' | 'sell';
  sourceUrl?: string;
  // Nama lama dipertahankan: isinya = harga per gram yang dipakai valuasi
  // (sekarang Galeri24 ANTAM 1 gram BUYBACK).
  sellPricePerGram: number;
  updatedLabel?: string; // mis. Sabtu, 31 Oktober 2026
  weight: number;
  weightUnit: string;
  recordedDate: string;
  fetchedAt: string;
  stale?: boolean;
  note?: string;
}

// TANPA localStorage: cache in-memory per page-load (TTL 1 jam).
// Semua device tetap satu sumber (API route) — refresh = fetch ulang bila kadaluarsa.
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 jam — Galeri24 update harga sekali sehari (pagi WIB)

interface GoldPriceCache {
  cachedAt: string;
  price: GoldPriceInfo;
}

// In-memory saja — hilang saat tab ditutup, tidak tersisa antar device.
let memCache: GoldPriceCache | null = null;

function readCache(): GoldPriceCache | null {
  if (!memCache?.price?.sellPricePerGram || !memCache?.cachedAt) return null;
  return memCache;
}

function writeCache(price: GoldPriceInfo): void {
  memCache = { cachedAt: new Date().toISOString(), price };
}

async function fetchPrice(): Promise<GoldPriceInfo | null> {
  try {
    const res = await fetch('/api/gold-price', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as GoldPriceInfo;
    if (!data?.sellPricePerGram || data.sellPricePerGram <= 0) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getGoldPrice(force = false): Promise<GoldPriceInfo | null> {
  const cached = readCache();
  if (!force && cached) {
    const age = Date.now() - new Date(cached.cachedAt).getTime();
    if (age < CACHE_TTL_MS) return cached.price;
  }

  const fresh = await fetchPrice();
  if (fresh) {
    writeCache(fresh);
    return fresh;
  }
  // Fallback: bila fetch gagal, pakai cache stale agar UI tidak merah
  // — route juga sudah fallback ke harga terakhir Galeri24, tapi jaga-jaga bila route 502
  if (cached) return cached.price;
  return null;
}

export function formatGoldQty(qtyGr: number): string {
  if (Number.isInteger(qtyGr)) return `${qtyGr} gr`;
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(qtyGr)} gr`;
}