'use client';

import { useSyncExternalStore } from 'react';

export type HoldingQuote = { id: string; ticker: string; marketPrice: number };
export type PriceWrite = { id: string; marketPrice: number };

export type IhsgView = {
  price: number;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  perfWeek: number | null;
  perfMonth: number | null;
  perfYtd: number | null;
  source: string;
  quoteTime: number | null;
  delayed: boolean;
  delaySeconds: number | null;
};

export type MarketView = {
  loading: boolean;
  lastUpdatedAt: number | null;
  detail: string | null;
  error: string | null;
  ihsg: IhsgView | null;
  ihsgError: string | null;
};

export type RefreshOutcome = {
  updated: { ticker: string; price: number }[];
  unchanged: string[];
  failed: string[];
  skipped: boolean;
};

const SERVER_VIEW: MarketView = {
  loading: false,
  lastUpdatedAt: null,
  detail: null,
  error: null,
  ihsg: null,
  ihsgError: null,
};

let view: MarketView = SERVER_VIEW;
const listeners = new Set<() => void>();
let inFlight: Promise<RefreshOutcome> | null = null;
let lastDoneAt = 0;
let bootStarted = false;
let pollEnabled = false;

const PRICE_EPSILON = 0.5;

function emit(next: MarketView) {
  view = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMarketStatus(): MarketView {
  return useSyncExternalStore(subscribe, () => view, () => SERVER_VIEW);
}

export function setMarketPollEnabled(on: boolean) {
  pollEnabled = on;
}

export function isMarketPollEnabled() {
  return pollEnabled;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function mapIhsg(data: Record<string, unknown>): IhsgView | null {
  const price = num(data.price);
  if (price == null || price <= 0) return null;
  return {
    price,
    change: num(data.change),
    changePercent: num(data.changePercent),
    open: num(data.open),
    high: num(data.high),
    low: num(data.low),
    previousClose: num(data.previousClose),
    perfWeek: num(data.perfWeek),
    perfMonth: num(data.perfMonth),
    perfYtd: num(data.perfYtd),
    source: typeof data.source === 'string' ? data.source : '',
    quoteTime: num(data.quoteTime),
    delayed: Boolean(data.delayed),
    delaySeconds: num(data.delaySeconds),
  };
}

async function fetchIhsg(): Promise<{ ihsg: IhsgView | null; error: string | null }> {
  try {
    const res = await fetch('/api/ihsg', { cache: 'no-store' });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || data.error) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Gagal memuat IHSG');
    }
    const ihsg = mapIhsg(data);
    if (!ihsg) throw new Error('Harga IHSG tidak valid');
    return { ihsg, error: null };
  } catch (err) {
    return { ihsg: null, error: err instanceof Error ? err.message : 'Gagal memuat IHSG' };
  }
}

async function fetchOne(ticker: string): Promise<number> {
  const res = await fetch(`/api/stock-price?symbol=${encodeURIComponent(ticker)}`, { cache: 'no-store' });
  const data = (await res.json()) as { price?: unknown; error?: string };
  const price = num(data.price);
  if (!res.ok || data.error || price == null || price <= 0) {
    throw new Error(data.error || 'Gagal fetch');
  }
  return price;
}

async function fetchSequential(tickers: string[]): Promise<{ prices: Map<string, number>; failed: string[] }> {
  const prices = new Map<string, number>();
  const failed: string[] = [];
  for (let i = 0; i < tickers.length; i++) {
    if (i > 0) await sleep(200);
    try {
      prices.set(tickers[i], await fetchOne(tickers[i]));
    } catch {
      failed.push(tickers[i]);
    }
  }
  return { prices, failed };
}

async function fetchPrices(tickers: string[]): Promise<{ prices: Map<string, number>; failed: string[] }> {
  const unique = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return { prices: new Map(), failed: [] };
  try {
    const res = await fetch(`/api/stock-price?symbols=${encodeURIComponent(unique.join(','))}`, {
      cache: 'no-store',
    });
    if (!res.ok) return fetchSequential(unique);
    const data = (await res.json()) as {
      quotes?: { symbol?: string; price?: unknown }[];
    };
    // Respons batch sudah mencoba TradingView lalu Yahoo. Jangan ulangi sumber yang sama.
    if (!Array.isArray(data.quotes)) return fetchSequential(unique);
    const prices = new Map<string, number>();
    const missing = new Set(unique);
    for (const quote of data.quotes) {
      const symbol = quote.symbol?.trim().toUpperCase();
      const price = num(quote.price);
      if (!symbol || price == null || price <= 0) continue;
      prices.set(symbol, price);
      missing.delete(symbol);
    }
    return { prices, failed: [...missing] };
  } catch {
    return fetchSequential(unique);
  }
}

const SKIPPED: RefreshOutcome = { updated: [], unchanged: [], failed: [], skipped: true };

async function runRefresh(
  getHoldings: () => HoldingQuote[],
  applyPrices: (updates: PriceWrite[]) => Promise<void>
): Promise<RefreshOutcome> {
  emit({ ...view, loading: true, error: null });
  const holdings = getHoldings();
  try {
    const [ihsgResult, stockResult] = await Promise.all([
      fetchIhsg(),
      fetchPrices(holdings.map((h) => h.ticker)),
    ]);

    const updated: { ticker: string; price: number }[] = [];
    const unchanged: string[] = [];
    const writes: PriceWrite[] = [];
    const seen = new Set<string>();

    for (const holding of holdings) {
      const ticker = holding.ticker.trim().toUpperCase();
      if (seen.has(holding.id)) continue;
      seen.add(holding.id);
      const price = stockResult.prices.get(ticker);
      if (price == null) continue;
      if (Math.abs(price - holding.marketPrice) < PRICE_EPSILON) {
        unchanged.push(ticker);
        continue;
      }
      updated.push({ ticker, price });
      writes.push({ id: holding.id, marketPrice: price });
    }

    const failed = stockResult.failed;
    const parts: string[] = [];
    if (updated.length > 0) parts.push(`${updated.length} harga berubah`);
    if (unchanged.length > 0) parts.push(`${unchanged.length} sudah sama`);
    if (failed.length > 0) parts.push(`gagal: ${failed.join(', ')}`);
    const quoteOk = Boolean(ihsgResult.ihsg) || updated.length + unchanged.length > 0;

    emit({
      ...view,
      loading: true,
      ihsg: ihsgResult.ihsg ?? view.ihsg,
      ihsgError: ihsgResult.error,
    });

    if (writes.length > 0) {
      await applyPrices(writes);
    }

    const stockError =
      holdings.length > 0 && updated.length === 0 && unchanged.length === 0 && failed.length > 0
        ? `Gagal memperbarui: ${failed.join(', ')}`
        : null;

    emit({
      loading: false,
      lastUpdatedAt: quoteOk ? Date.now() : view.lastUpdatedAt,
      detail: parts.length > 0 ? parts.join(' · ') : holdings.length === 0 ? null : view.detail,
      error: stockError,
      ihsg: ihsgResult.ihsg ?? view.ihsg,
      ihsgError: ihsgResult.error,
    });

    return { updated, unchanged, failed, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memperbarui harga';
    emit({ ...view, loading: false, error: message });
    return { updated: [], unchanged: [], failed: [], skipped: false };
  }
}

/**
 * Satu siklus refresh: IHSG + semua kode yang diberikan.
 * Permintaan yang bertumpuk menunggu siklus yang sedang jalan (tidak memanggil pasar dua kali).
 * `boot` hanya jalan sekali per muatan halaman. `minIntervalMs` melewati siklus kalau baru selesai,
 * kecuali `force`.
 */
export function refreshMarket(
  getHoldings: () => HoldingQuote[],
  applyPrices: (updates: PriceWrite[]) => Promise<void>,
  opts?: { force?: boolean; minIntervalMs?: number; boot?: boolean }
): Promise<RefreshOutcome> {
  if (opts?.boot) {
    if (bootStarted) return inFlight ?? Promise.resolve(SKIPPED);
    bootStarted = true;
  }
  if (inFlight) return inFlight;
  if (!opts?.force && opts?.minIntervalMs && Date.now() - lastDoneAt < opts.minIntervalMs) {
    return Promise.resolve(SKIPPED);
  }
  const job = runRefresh(getHoldings, applyPrices).finally(() => {
    lastDoneAt = Date.now();
    if (inFlight === job) inFlight = null;
  });
  inFlight = job;
  return job;
}
