'use client';

import { useEffect, useRef } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { isMarketPollEnabled, refreshMarket, type HoldingQuote, type PriceWrite } from '@/lib/market-refresh';

/**
 * Mengambil harga saham + IHSG sekali saat halaman selesai dimuat,
 * lagi saat kembali ke Setup (kalau kutipan sudah lebih dari 20 detik),
 * saat tab browser kembali terlihat (jeda 60 detik), dan tiap 30 detik
 * hanya selama opsi Realtime di Setup menyala.
 */
export function MarketAutoRefresh() {
  const { stockHoldings, applyStockMarketPrices, activeTab, isLoaded } = useFinance();
  const holdingsRef = useRef(stockHoldings);
  const applyRef = useRef(applyStockMarketPrices);
  useEffect(() => {
    holdingsRef.current = stockHoldings;
    applyRef.current = applyStockMarketPrices;
  });

  const getHoldings = () => holdingsRef.current as HoldingQuote[];
  const apply = (updates: PriceWrite[]) => applyRef.current(updates);

  useEffect(() => {
    if (!isLoaded) return;
    void refreshMarket(getHoldings, apply, { boot: true });
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded || activeTab !== 'setup') return;
    void refreshMarket(getHoldings, apply, { minIntervalMs: 20_000 });
  }, [activeTab, isLoaded]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void refreshMarket(getHoldings, apply, { minIntervalMs: 60_000 });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!isMarketPollEnabled()) return;
      if (document.visibilityState !== 'visible') return;
      void refreshMarket(getHoldings, apply, { minIntervalMs: 25_000 });
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
