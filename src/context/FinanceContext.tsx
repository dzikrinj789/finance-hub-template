'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  isAutoAssetSyncNote,
  isBalanceLockedTx,
  AssetItem,
  CashflowPoint,
  MainTabType,
  RecoveryItem,
  SHARES_PER_LOT,
  StockHolding,
  SummaryMetrics,
  Transaction,
  TransactionType,
  computeGoldValue,
  computeStockPortfolioValue,
  findLinkedRecoveryTargets,
  findUserReksaDanaAsset,
  getMappedTargetCategories,
  getStockShares,
  getTransactionAssetDeltas,
  reksaDanaDirection,
  TRANSACTION_TO_ASSET,
  isPiutangAsset,
  planWadahRename,
} from '@/types/finance';
import { MULTI_YEAR_CASHFLOW } from '@/lib/mock-data';
import { formatCompactRupiah } from '@/lib/utils';
import { isSelfWrite, markSelfWrite } from '@/lib/realtime-self';
import { useNotifications, type NotificationKind } from './NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured as isSupabaseEnvConfigured, supabase as supabaseSession } from '@/lib/supabase';
import { IS_UI_PREVIEW } from '@/lib/preview';
import { toast } from '@/lib/toast';

// Preview mode never opens a network client. Otherwise every read/write uses the
// logged-in session so Postgres RLS (auth.uid()) can scope rows to that user.
const isSupabaseConfigured = IS_UI_PREVIEW ? false : isSupabaseEnvConfigured;
const supabase = IS_UI_PREVIEW ? null : supabaseSession;

interface FinanceContextType {
  activeTab: MainTabType;
  setActiveTab: (tab: MainTabType) => void;
  transactions: Transaction[];
  recoveryItems: RecoveryItem[];
  assets: AssetItem[];
  cashflow: CashflowPoint[];
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  isQuickAddOpen: boolean;
  setIsQuickAddOpen: (open: boolean) => void;
  isImporterOpen: boolean;
  setIsImporterOpen: (open: boolean) => void;
  isLoaded: boolean;
  isSupabaseActive: boolean;
  supabaseError: string | null;
  retrySupabase: () => void;
  writeError: string | null;
  clearWriteError: () => void;
  summary: SummaryMetrics;
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>;
  addBulkTransactions: (txs: Omit<Transaction, 'id'>[]) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  /** Ubah transaksi: efek saldo lama dibalik lalu efek baru diterapkan (delta atomik ke DB). */
  updateTransaction: (id: string, data: Omit<Transaction, 'id'>) => Promise<void>;
  /** Transaksi yang sedang diedit lewat modal Catat Transaksi (null = mode tambah). */
  editingTx: Transaction | null;
  openEditTransaction: (tx: Transaction | null) => void;
  updateRecoveryItem: (id: string, updates: Partial<RecoveryItem>) => Promise<void>;
  addRecoveryItem: (data: Omit<RecoveryItem, 'id'>) => Promise<string>;
  deleteRecoveryItem: (id: string) => Promise<void>;
  updateAssetItem: (id: string, updates: Partial<AssetItem>) => Promise<void>;
  /** Ganti nama wadah + ikut ganti referensi teks nama di transaksi & target (tanpa ubah nominal). */
  renameAssetCascade: (
    id: string,
    updates: Partial<AssetItem>,
    oldName: string,
    newName: string
  ) => Promise<{ ok: boolean; txCount: number; targetCount: number; error?: string }>;
  addAssetItem: (data: Omit<AssetItem, 'id'>) => Promise<void>;
  deleteAssetItem: (id: string) => Promise<void>;
  stockHoldings: StockHolding[];
  addStockHolding: (data: Omit<StockHolding, 'id'>, opts?: { date?: string; wallet?: string }) => Promise<void>;
  updateStockHolding: (id: string, updates: Partial<StockHolding>, opts?: { date?: string; wallet?: string; fee?: number }) => Promise<void>;
  /** Tulis Harga Saat Ini saja. Harga yang sama tidak ditulis ulang, dan lot/kas/transaksi tidak berubah. */
  applyStockMarketPrices: (updates: { id: string; marketPrice: number }[]) => Promise<void>;
  deleteStockHolding: (id: string, opts?: { date?: string; wallet?: string }) => Promise<void>;
  totalStockRealizedProfit: number;
  resetStockRealizedProfit: () => Promise<void>;
  resetToDefault: () => Promise<void>;
  resetDatabase: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

// Safety: fetch Supabase dibatasi 15 dtk — selebihnya dianggap gagal
// agar isLoaded tetap true dan UI tidak nyangkut di loading selamanya.
function supabaseFetchTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(
      () =>
        reject(
          new Error(
            `Timeout membaca Supabase (>${Math.round(ms / 1000)} dtk). Cek koneksi internet lalu refresh.`
          )
        ),
      ms
    );
  });
}

// ── Supabase Realtime helpers (sinkron antar device/tab tanpa refresh) ──
interface RtRow {
  [column: string]: unknown;
}
type RtEventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

// Upsert by-id (idempotent untuk echo tulisan sendiri). prepend=false → append.
function upsertInto<T extends { id: string }>(list: T[], item: T, prepend = false): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx < 0) return prepend ? [item, ...list] : [...list, item];
  const next = [...list];
  next[idx] = { ...list[idx], ...item };
  return next;
}
function removeFromList<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}

// Mapper baris DB → tipe app (mirror mapping initial fetch di atas)
const mapRtTx = (r: RtRow): Transaction => ({
  id: String(r.id),
  date: String(r.date ?? ''),
  amount: Number(r.amount) || 0,
  category: (r.category_name as string) || '',
  type: (r.type as Transaction['type']) || 'Savings',
  wallet: (r.wallet_name as string) || '',
  note: (r.note as string) || '',
  isExcludeReport: Boolean(r.is_exclude_report),
  targetId: (r.target_id as string | null) ?? undefined,
  ...(isAutoAssetSyncNote(r.note as string) && { skipAssetSync: true }),
});
const mapRtRecovery = (r: RtRow): RecoveryItem => ({
  id: String(r.id),
  title: (r.title as string) || '',
  category: (r.category as string) || '',
  targetAmount: Number(r.target_amount) || 0,
  recoveredAmount: Number(r.recovered_amount) || 0,
  status: ((r.status as string) || 'Pending') as RecoveryItem['status'],
  dueDate: (r.due_date as string) || undefined,
  notes: (r.notes as string) || undefined,
});
const mapRtAsset = (r: RtRow): AssetItem => ({
  id: String(r.id),
  name: (r.name as AssetItem['name']) || '',
  displayName: (r.display_name as string) || (r.name as string) || '',
  category: (r.category as AssetItem['category']) || 'likuid',
  subCategory: (r.sub_category as AssetItem['subCategory']) || '',
  value: Number(r.value) || 0,
  details: (r.details as string) || '',
  isGold: Boolean(r.is_gold),
  goldQtyGr: r.gold_qty_gr != null ? Number(r.gold_qty_gr) : undefined,
  pricePerGram: r.price_per_gram != null ? Number(r.price_per_gram) : undefined,
});
const mapRtStock = (r: RtRow): StockHolding => ({
  id: String(r.id),
  ticker: (r.ticker as string) || '',
  companyName: (r.company_name as string) || undefined,
  lots: Number(r.lots) || 0,
  buyPrice: Number(r.buy_price) || 0,
  marketPrice: Number(r.market_price) || 0,
  category: (r.category as StockHolding['category']) ?? 'non_likuid',
  strategy: (r.strategy as StockHolding['strategy']) ?? 'Long-Term',
  realizedProfit: r.realized_profit != null ? Number(r.realized_profit) : 0,
  lastUpdated: (r.last_updated as string) || undefined,
});

// Meta notifikasi lonceng per tabel (tabel yang TIDAK ada di meta → senyap:
// aset/recovery/stock adalah write internal hasil sinkron transaksi, terlalu berisik).
const RT_NOTIFY_META: Partial<Record<string, { label: string; title: (r: RtRow) => string; kindFilter?: Partial<RtEventType>[] }>> = {
  transactions: { label: 'Cashflow', title: (r) => `${(r.category_name as string) ?? ''} · ${formatCompactRupiah(Number(r.amount) || 0)}` },
};

// PURE SUPABASE: semua state init kosong/default, diisi dari remote saat initial load.
// TANPA localStorage sama sekali — semua device (local, prod, laptop, android) baca Supabase.
// Satu-satunya pengecualian: cleanup SEKALI saat mount untuk menghapus sisa key lama
// di browser yang pernah buka versi lama (hygiene, tidak pernah dibaca).

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  // Supabase-only: semua data init kosong, UI prefs default
  const [activeTab, setActiveTab] = useState<MainTabType>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recoveryItems, setRecoveryItems] = useState<RecoveryItem[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [stockHoldings, setStockHoldings] = useState<StockHolding[]>([]);
  const stockHoldingsRef = useRef<StockHolding[]>([]);
  useEffect(() => {
    stockHoldingsRef.current = stockHoldings;
  });
  const [totalStockRealizedProfit, setTotalStockRealizedProfit] = useState<number>(0);
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [isQuickAddOpen, setIsQuickAddOpenRaw] = useState<boolean>(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  // Tutup modal → keluar dari mode edit; buka biasa (FAB/Catat) → selalu mode tambah.
  const setIsQuickAddOpen = useCallback((open: boolean) => {
    if (!open) setEditingTx(null);
    setIsQuickAddOpenRaw(open);
  }, []);
  const openEditTransaction = useCallback((tx: Transaction | null) => {
    setEditingTx(tx);
    setIsQuickAddOpenRaw(Boolean(tx));
  }, []);
  const [isImporterOpen, setIsImporterOpen] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  // writeError: tulis ke Supabase yang GAGAL — ditampilkan di SetupTab agar layar
  // yang beda dari Supabase langsung ketahuan (tidak diam-diam seperti dulu).
  const [writeError, setWriteError] = useState<string | null>(null);
  const clearWriteError = () => setWriteError(null);
  const noteWriteError = (table: string, err: unknown) => {
    const e = err as { message?: string; code?: string; details?: string; hint?: string };
    // supabase-js kadang mengembalikan objek error yang minim (terlihat `{}` di console),
    // jadi gali semua info yang ada agar penyebabnya ketahuan.
    let debugDetail = '';
    try {
      const json = JSON.stringify(err);
      if (json && json !== '{}') debugDetail = ` ${json}`;
    } catch {
      // ignore stringify errors
    }
    console.error(`[Supabase] tulis ${table} gagal:${debugDetail}`, err);
    const msg = e?.message || (debugDetail ? debugDetail : String(err));
    const code = e?.code ? ` (${e.code})` : '';
    const missingHint =
      !e?.message || e?.code === '42P01' || e?.code === 'PGRST205'
        ? ' Kemungkinan tabel belum ada — jalankan supabase/schema.sql di SQL Editor, lalu muat ulang.'
        : '';
    setWriteError(
      `Gagal menyimpan ${table}${code}: ${msg}.${missingHint} Nilai di layar BELUM masuk Supabase — cek koneksi/RLS lalu ulangi, atau refresh agar layar kembali mengikuti Supabase.`
    );
  };

  // ── Initial data fetch di level layout (FinanceProvider di RootLayout) ──
  // Supabase-only: local, prod, laptop, android SEMUA baca sumber yang sama.
  // Dijalankan sekali saat mount; bisa diulang manual via retrySupabase (tombol "Coba lagi")
  // untuk kasus fetch pertama gagal (mis. koneksi/ekstensi blokir) tanpa perlu reload.
  const [fetchNonce, setFetchNonce] = useState(0);
  const retrySupabase = useCallback(() => {
    setSupabaseError(null);
    setFetchNonce((n) => n + 1);
  }, []);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_UI_PREVIEW === '1') {
      let cancelled = false;
      void (async () => {
        const p = await import('@/lib/preview-data');
        if (cancelled) return;
        setTransactions(p.PREVIEW_TRANSACTIONS);
        setRecoveryItems(p.PREVIEW_RECOVERY_ITEMS);
        setAssets(p.PREVIEW_ASSETS);
        setIsLoaded(true);
      })();
      return () => {
        cancelled = true;
      };
    }

    if (authLoading) return;

    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (!user) {
        setTransactions([]);
        setRecoveryItems([]);
        setAssets([]);
        setStockHoldings([]);
        setTotalStockRealizedProfit(0);
        setIsLoaded(true);
        return;
      }
      setIsLoaded(false);
      try {
        const legacyKeys = [
          'finance_transactions',
          'finance_recovery',
          'finance_assets',
          'finance_stock_holdings',
          'finance_stock_realized_profit',
          'finance_selected_year',
          'finance_active_tab',
        ];
        legacyKeys.forEach((k) => localStorage.removeItem(k));
      } catch {
        // ignore cleanup errors
      }

      if (!isSupabaseConfigured || !supabase) {
        console.warn(
          '[Finance] Supabase tidak terkonfigurasi — state kosong. Set NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY lalu reload.'
        );
        if (!cancelled) {
          setSupabaseError(
            'Supabase tidak terkonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY, lalu muat ulang.'
          );
          setIsLoaded(true);
        }
        return;
      }

      try {
        const [txRes, recRes, astRes, stkRes, metaRes] = await Promise.race([
          Promise.all([
            supabase.from('transactions').select('*').order('date', { ascending: false }),
            supabase.from('recovery_items').select('*'),
            supabase.from('assets').select('*'),
            supabase.from('stock_holdings').select('*'),
            supabase
              .from('stock_holdings_meta')
              .select('total_realized_profit')
              .eq('id', user.id)
              .maybeSingle(),
          ]),
          supabaseFetchTimeout(15000),
        ]);
        if (cancelled) return;

        const labeled = [
          ['transactions', txRes],
          ['recovery_items', recRes],
          ['assets', astRes],
          ['stock_holdings', stkRes],
          ['stock_holdings_meta', metaRes],
        ] as const;
        const errs = labeled.filter(([, r]) => (r as { error?: unknown }).error);
        if (errs.length > 0) {
          errs.forEach(([name, r]) => {
            const errObj = (r as { error?: unknown }).error;
            console.error(`[Supabase] select ${name} error:`, JSON.stringify(errObj) === '{}' ? String(errObj) : errObj);
          });
          const first = errs[0][1] as { error: { message?: string; code?: string } };
          const msg = first.error?.message || 'Gagal baca Supabase';
          const code = first.error?.code ? ` (${first.error.code})` : '';
          const hint =
            first.error?.code === '42501' || /row-level security/i.test(msg)
              ? ' — masuk dengan akun Anda. RLS hanya mengembalikan baris milik akun yang sedang login.'
              : first.error?.code === '42P01' || /does not exist|Could not find/i.test(msg)
                ? ' — tabel belum ada. Jalankan supabase/schema.sql di SQL Editor.'
                : '';
          setSupabaseError(`${msg}${code}${hint}`);
        } else {
          setSupabaseError(null);
        }

        const remoteTx: Transaction[] = (txRes.data ?? []).map((r) => ({
          id: r.id as string,
          date: r.date as string,
          amount: Number(r.amount),
          category: r.category_name as string,
          type: r.type as Transaction['type'],
          wallet: r.wallet_name as string,
          note: (r.note as string) || '',
          isExcludeReport: Boolean(r.is_exclude_report),
          targetId: (r.target_id as string | null) ?? undefined,
          ...(isAutoAssetSyncNote(r.note as string) && { skipAssetSync: true }),
        }));
        const remoteRec: RecoveryItem[] = (recRes.data ?? []).map((r) => ({
          id: r.id,
          title: r.title,
          category: r.category,
          targetAmount: Number(r.target_amount),
          recoveredAmount: Number(r.recovered_amount),
          status: r.status,
          dueDate: r.due_date,
          notes: r.notes,
        }));
        const remoteAssets: AssetItem[] = (astRes.data ?? []).map((r) => ({
          id: r.id as string,
          name: r.name as AssetItem['name'],
          displayName: (r.display_name as string) || (r.name as string),
          category: r.category as AssetItem['category'],
          subCategory: r.sub_category as AssetItem['subCategory'],
          value: Number(r.value),
          details: (r.details as string) || '',
          isGold: Boolean(r.is_gold),
          goldQtyGr: r.gold_qty_gr != null ? Number(r.gold_qty_gr) : undefined,
          pricePerGram: r.price_per_gram != null ? Number(r.price_per_gram) : undefined,
        }));
        const remoteStocks: StockHolding[] = (stkRes.data ?? []).map((r) => ({
          id: r.id,
          ticker: r.ticker,
          companyName: r.company_name || undefined,
          lots: Number(r.lots),
          buyPrice: Number(r.buy_price),
          marketPrice: Number(r.market_price),
          category: (r.category as StockHolding['category']) ?? 'non_likuid',
          strategy: (r.strategy as StockHolding['strategy']) ?? 'Long-Term',
          realizedProfit: r.realized_profit != null ? Number(r.realized_profit) : 0,
          lastUpdated: r.last_updated || undefined,
        }));

        setTransactions(remoteTx);
        setRecoveryItems(remoteRec);
        setAssets(remoteAssets);
        setStockHoldings(remoteStocks);
        const remoteProfit =
          metaRes.data && metaRes.data.total_realized_profit != null
            ? Number(metaRes.data.total_realized_profit)
            : 0;
        setTotalStockRealizedProfit(remoteProfit || 0);
      } catch (err) {
        if (!cancelled) {
          console.error('Supabase fetch error:', err);
          setSupabaseError(err instanceof Error ? err.message : 'Gagal baca Supabase. Cek koneksi / RLS / env.');
        }
      }
      if (!cancelled) setIsLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchNonce, authLoading, user]);

  // ── Supabase Realtime: sinkron antar device/tab TANPA refresh ──
  // Setiap INSERT/UPDATE/DELETE di tabel-tabel di bawah di-apply ke state by-id
  // (idempotent — echo tulisan sendiri tidak menduplikasi apa pun). Notifikasi
  // lonceng hanya untuk tulisan dari device/orang LAIN (self-write di-skip via
  // markSelfWrite). Butuh setup sekali: jalankan supabase/realtime.sql di Supabase.
  const { push: pushRemoteNotification } = useNotifications();

  const applyRtRow = (table: string, event: RtEventType, row: RtRow, oldRow: RtRow) => {
    const id = String((row.id ?? (event === 'DELETE' ? oldRow.id : '')) ?? '');
    switch (table) {
      case 'transactions': {
        setTransactions((prev) =>
          event === 'DELETE' ? removeFromList(prev, id) : upsertInto(prev, mapRtTx(row), true)
        );
        break;
      }
      case 'recovery_items': {
        setRecoveryItems((prev) =>
          event === 'DELETE' ? removeFromList(prev, id) : upsertInto(prev, mapRtRecovery(row), false)
        );
        break;
      }
      case 'assets': {
        setAssets((prev) =>
          event === 'DELETE' ? removeFromList(prev, id) : upsertInto(prev, mapRtAsset(row), false)
        );
        break;
      }
      case 'stock_holdings': {
        setStockHoldings((prev) =>
          event === 'DELETE' ? removeFromList(prev, id) : upsertInto(prev, mapRtStock(row), false)
        );
        break;
      }
      case 'stock_holdings_meta': {
        setTotalStockRealizedProfit(event === 'DELETE' ? 0 : Number(row.total_realized_profit) || 0);
        break;
      }
    }
  };

  const maybeNotifyRt = (table: string, event: RtEventType, row: RtRow, oldRow: RtRow) => {
    if (event === '*') return;
    const meta = RT_NOTIFY_META[table];
    if (!meta) return;
    if (meta.kindFilter && !meta.kindFilter.includes(event)) return;
    const id = String((row.id ?? oldRow.id ?? ''));
    if (isSelfWrite(table, id)) return;
    let title = '';
    try {
      title = (event === 'DELETE' ? oldRow : row) ? meta.title(event === 'DELETE' ? oldRow : row) : '';
    } catch {
      title = '';
    }
    if (!title) return;
    const kind: NotificationKind = event === 'INSERT' ? 'add' : event === 'DELETE' ? 'delete' : 'update';
    pushRemoteNotification({ kind, label: meta.label, title });
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user) return;
    const sbRealtime = supabase;
    if (!isLoaded) return;
    const RT_TABLES = [
      'transactions',
      'recovery_items',
      'assets',
      'stock_holdings',
      'stock_holdings_meta',
    ];
    const handleRtEvent = (table: string) => (payload: { eventType: RtEventType; new: RtRow | null; old: RtRow | null }) => {
      const row = payload.new ?? {};
      const oldRow = payload.old ?? {};
      try {
        applyRtRow(table, payload.eventType, row, oldRow);
      } catch (err) {
        console.warn(`[Realtime] apply ${table} gagal:`, err);
      }
      try {
        maybeNotifyRt(table, payload.eventType, row, oldRow);
      } catch {
        // notifikasi gagal jangan pernah merusak sinkronisasi
      }
    };
    const channel = sbRealtime.channel(`finance-${user.id}`);
    RT_TABLES.forEach((t) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, handleRtEvent(t));
    });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.info('[Realtime] tersambung — isi dari tab/device lain masuk tanpa refresh.');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[Realtime] gagal subscribe — jalankan supabase/realtime.sql di Supabase SQL Editor (publikasi realtime + replica identity), lalu refresh. Pesan:', status);
      }
    });
    return () => {
      void sbRealtime.removeChannel(channel);
    };
    // applyRtRow/maybeNotifyRt disengaja tidak masuk deps: handler channel difiks
    // sekali per isLoaded/fetchNonce agar tidak re-subscribe tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, fetchNonce, user?.id]);



  // TANPA localStorage: filter tahun & tab selalu default tiap load (2026/dashboard)
  // agar semua device konsisten — satu-satunya sumber kebenaran adalah Supabase.

  // Derived metrics calculations — filter by Periode Tahun agar Filter terasa (tanpa ubah struktur UI)
  const summary: SummaryMetrics = useMemo(() => {
    const yearFiltered =
      selectedYear === 'all' ? transactions : transactions.filter((tx) => tx.date.startsWith(selectedYear));
    const activeTx = yearFiltered.filter((tx) => !tx.isExcludeReport && tx.type !== 'Internal Transfer');

    let totalIncome = 0;
    let needsAmount = 0;
    let wantsAmount = 0;
    let savingsAmount = 0;

    activeTx.forEach((tx) => {
      if (tx.type === 'Income') {
        totalIncome += tx.amount;
      } else if (tx.type === 'Needs') {
        needsAmount += tx.amount;
      } else if (tx.type === 'Wants') {
        wantsAmount += tx.amount;
      } else if (tx.type === 'Savings' || tx.type === 'Investment') {
        savingsAmount += tx.amount;
      }
    });

    const totalSpending = needsAmount + wantsAmount;
    const monthlySavingsRate =
      totalIncome > 0 ? ((totalIncome - totalSpending) / totalIncome) * 100 : 0;

    let liquidTotal = 0;
    let nonLiquidTotal = 0;

    assets.forEach((ast) => {
      if (ast.category === 'likuid') {
        liquidTotal += ast.value;
      } else {
        nonLiquidTotal += ast.value;
      }
    });

    const netWorth = liquidTotal + nonLiquidTotal;

    return {
      totalIncome,
      totalSpending,
      monthlySavingsRate: Math.max(0, monthlySavingsRate),
      netWorth,
      liquidTotal,
      nonLiquidTotal,
      needsAmount,
      wantsAmount,
      savingsAmount,
    };
  }, [transactions, assets, selectedYear]);

  // Filtered cashflow points
  const filteredCashflow = useMemo(() => {
    if (selectedYear === 'all') {
      return MULTI_YEAR_CASHFLOW;
    }
    const yearNum = parseInt(selectedYear, 10);
    return MULTI_YEAR_CASHFLOW.filter((pt) => pt.year === yearNum);
  }, [selectedYear]);


  // Semua mutasi (tambah/ubah/hapus) langsung tulis ke Supabase masing-masing —
  // tidak ada lagi bulk-push manual (tombol Push di SetupTab sudah dicabut).

  // Transaction handlers
  // Link/unlink transaksi → progres target: state + Supabase SEKALIGUS.
  // Dulu state-only → tab baru / reload balik ke angka lama (dalam vs luar beda).
  // Nilai `next` yang sama dipakai untuk state & DB agar keduanya selalu identik.
  const applyRecoveryDelta = (targetId: string, delta: number) => {
    if (!targetId || delta === 0) return;
    const current = recoveryItems.find((it) => it.id === targetId);
    if (!current) return;
    const next = Math.max(0, Math.min(current.targetAmount, current.recoveredAmount + delta));
    const status = next >= current.targetAmount ? 'Recovered' : next > 0 ? 'Partial' : 'Pending';
    const updatedAt = new Date().toISOString().split('T')[0];
    setRecoveryItems((prev) =>
      prev.map((item) =>
        item.id === targetId ? { ...item, recoveredAmount: next, status, updatedAt } : item
      )
    );
    if (isSupabaseConfigured && supabase) {
      void supabase
        .from('recovery_items')
        .update({ recovered_amount: next, status, updated_at: updatedAt })
        .eq('id', targetId)
        .then(({ error }) => {
          if (error) noteWriteError('progres target', error);
        });
    }
  };

  const applyRecoveryLinkAmount = (targetId: string, amount: number) => {
    if (amount <= 0) return;
    applyRecoveryDelta(targetId, amount);
  };

  const applyRecoveryUnlinkAmount = (targetId: string, amount: number) => {
    if (amount <= 0) return;
    applyRecoveryDelta(targetId, -amount);
  };

  // â”€â”€ MODUL SYNC: Transaksi â†’ Kelola Aset & Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Dipanggil di dalam setState updater — TIDAK boleh setState di sini (React purity),
  // jadi gagal tulis level ini hanya console.error; pemanggil (addTransaction dll) yang lapor ke UI.
  const persistAssetUpdate = (asset: AssetItem) => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      void supabase
        .from('assets')
        .update({
          value: asset.value,
          ...(asset.goldQtyGr != null ? { gold_qty_gr: asset.goldQtyGr } : {}),
          ...(asset.pricePerGram != null ? { price_per_gram: asset.pricePerGram } : {}),
        })
        .eq('id', asset.id)
        .then(({ error }) => {
          if (error) console.error('[Supabase] tulis assets (delta) gagal:', error);
        });
    } catch (err) {
      console.warn('Supabase asset sync error:', err);
    }
  };

  const saveSahamAssetValue = (value: number) => {
    const safeValue = Math.max(0, Math.round(value));
    setAssets((prev) => {
      const existing = prev.find((a) => a.name === 'Saham');
      const today = new Date().toISOString().split('T')[0];

      if (!existing) {
        // Mulai dari NOL: jangan auto-create saat portofolio kosong.
        // Aset 'Saham' baru dibuat setelah user benar-benar input holdings (nilai > 0) —
        // sebelum itu Setup tetap kosong dan Supabase tidak ditulis apa-apa.
        if (safeValue <= 0) return prev;
        // Langsung ada walau 0 — kaya sebelumnya, ambil dari nilai pasar total
        const created: AssetItem = {
          id: `ast-saham-stock-${Date.now().toString(36)}`,
          name: 'Saham',
          displayName: 'Portofolio Saham',
          category: 'non_likuid',
          subCategory: 'saham',
          value: safeValue,
          details: 'Otomatis dari portofolio saham (Σ lembar × harga pasar)',
          lastUpdated: today,
        };
        if (isSupabaseConfigured && supabase) {
          try {
            void supabase.from('assets').insert({
              id: created.id,
              name: 'Saham',
              display_name: 'Portofolio Saham',
              category: 'non_likuid',
              sub_category: 'saham',
              value: created.value,
              details: created.details,
              is_gold: false,
              gold_qty_gr: null,
              price_per_gram: null,
            });
          } catch (err) {
            console.warn('Supabase auto-create Saham asset error:', err);
          }
        }
        return [...prev, created];
      }

      if (Math.abs(existing.value - safeValue) < 0.5 && existing.lastUpdated) return prev;
      persistAssetUpdate({ ...existing, value: safeValue, lastUpdated: today });
      return prev.map((a) =>
        a.id === existing.id ? { ...a, value: safeValue, lastUpdated: today } : a
      );
    });
  };

  // Hitung nilai wadah setelah delta (aturan sama seperti sebelumnya):
  // emas → gram bertambah/berkurang sebesar delta/harga per gram; lainnya → nilai + delta (min 0).
  const applyDeltaToAsset = (a: AssetItem, delta: number, round = false): AssetItem => {
    const today = new Date().toISOString().split('T')[0];
    if (!round && a.isGold && a.pricePerGram && a.pricePerGram > 0) {
      const newQty = Math.max(0, (a.goldQtyGr ?? 0) + delta / a.pricePerGram);
      return { ...a, goldQtyGr: newQty, value: computeGoldValue(newQty, a.pricePerGram), lastUpdated: today };
    }
    const raw = a.value + delta;
    return { ...a, value: Math.max(0, round ? Math.round(raw) : raw), lastUpdated: today };
  };

  // Antrian tulis per wadah: delta beruntun ke wadah yang sama diproses berurutan.
  const assetWriteQueueRef = useRef(new Map<string, Promise<void>>());

  // Tulis delta saldo ke Supabase relatif terhadap nilai DB TERBARU (baca → hitung → update
  // bersyarat value masih sama). Dulu yang ditulis nilai absolut dari state tab ini, sehingga tab
  // / HP yang dibuka sejak kemarin (realtime putus, belum reload) menimpa koreksi saldo terbaru
  // menimpa koreksi saldo yang lebih baru. Tanpa perubahan schema: memakai select + update biasa.
  const persistAssetDelta = (assetId: string, delta: number, opts: { round?: boolean } = {}) => {
    if (!isSupabaseConfigured || !supabase || !delta) return;
    const sb = supabase;
    const prevRun = assetWriteQueueRef.current.get(assetId) ?? Promise.resolve();
    const run = prevRun.then(async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data: cur, error: readErr } = await sb
          .from('assets')
          .select('*')
          .eq('id', assetId)
          .maybeSingle();
        if (readErr || !cur) {
          console.error('[Supabase] baca assets sebelum delta gagal:', readErr ?? 'baris tidak ada');
          noteWriteError('saldo wadah', readErr ?? new Error('wadah tidak ditemukan'));
          return;
        }
        const fresh = mapRtAsset(cur as RtRow);
        const next = applyDeltaToAsset(fresh, delta, opts.round);
        const isLast = attempt === 3;
        let q = sb
          .from('assets')
          .update({
            value: next.value,
            ...(next.goldQtyGr != null && next.goldQtyGr !== fresh.goldQtyGr ? { gold_qty_gr: next.goldQtyGr } : {}),
          })
          .eq('id', assetId);
        // Update bersyarat: hanya bila nilai DB belum diubah device lain sejak dibaca.
        if (!isLast) q = q.eq('value', (cur as RtRow).value as number);
        const { data: upd, error: updErr } = await q.select('id');
        if (updErr) {
          console.error('[Supabase] tulis assets (delta) gagal:', updErr);
          noteWriteError('saldo wadah', updErr);
          return;
        }
        if (isLast || (Array.isArray(upd) && upd.length > 0)) {
          markSelfWrite('assets', assetId);
          // Samakan state lokal dengan nilai DB yang baru ditulis (sekaligus memperbaiki tab basi).
          setAssets((prev) =>
            prev.map((a) =>
              a.id === assetId
                ? { ...a, value: next.value, goldQtyGr: next.goldQtyGr, lastUpdated: next.lastUpdated }
                : a
            )
          );
          return;
        }
        // Nilai berubah di antara baca & tulis → ulangi dengan nilai terbaru.
      }
    });
    assetWriteQueueRef.current.set(assetId, run.catch(() => undefined));
  };

  const warnWalletUnmatched = (wallet: string) => {
    console.warn(`[Finance] Akun dompet "${wallet}" tidak cocok dengan wadah mana pun di Setup — saldo tidak diubah.`);
    toast(`Saldo tidak berubah: akun "${wallet}" tidak ditemukan di wadah Setup.`, 'err');
  };

  const applyAssetDelta = (target: string, delta: number) => {
    if (delta === 0) return;

    if (target === 'Saham' && stockHoldings.length > 0) {
      const basePrice =
        stockHoldings[0].marketPrice > 0
          ? stockHoldings[0].marketPrice
          : stockHoldings[0].buyPrice > 0
            ? stockHoldings[0].buyPrice
            : 1;
      const shareDelta = delta / basePrice;
      const nextHoldings = stockHoldings.map((h, i) =>
        i === 0 ? { ...h, lots: Math.max(0, h.lots + shareDelta / SHARES_PER_LOT) } : h
      );
      setStockHoldings(nextHoldings);
      const nextValue = computeStockPortfolioValue(nextHoldings);
      saveSahamAssetValue(nextValue);
      return;
    }

    // Cocokkan longgar: nama ATAU displayName, case-insensitive.
    const key = (target || '').trim().toLowerCase();
    const isMatch = (a: AssetItem) => {
      const nameKey = (a.name || '').trim().toLowerCase();
      const dispKey = (a.displayName || '').trim().toLowerCase();
      return nameKey === key || (dispKey !== '' && dispKey === key);
    };
    const hit = assets.find(isMatch);
    if (!hit) return;
    const hitId = hit.id;
    setAssets((prev) =>
      prev.map((a) => (a.id === hitId ? applyDeltaToAsset(a, delta) : a))
    );
    // Tulis ke DB sebagai DELTA terhadap nilai DB terbaru (bukan nilai absolut dari state
    // tab ini) — tab/HP yang datanya basi tidak bisa lagi menimpa saldo yang sudah dikoreksi.
    persistAssetDelta(hitId, delta);
  };

  // Kas transaksi → akun di Setup. Exact dulu, lalu nama lembaga bila pengguna
  // menamai akunnya dengan kata itu (opsional, bukan rekening bawaan).
  const resolveCashAsset = (wallet: string, list: AssetItem[] = assets): AssetItem | undefined => {
    const w = (wallet || '').trim();
    if (!w) return undefined;
    const lowerW = w.toLowerCase();
    let found = list.find((a) => a.name === w || a.displayName === w);
    if (found) return found;
    found = list.find(
      (a) => a.name.toLowerCase() === lowerW || (a.displayName || '').toLowerCase() === lowerW
    );
    if (found) return found;
    const hay = (a: AssetItem) => `${a.name || ''} ${(a.displayName || '')}`.toLowerCase();
    if (lowerW.includes('bibit') || lowerW.includes('rdn') || lowerW.includes('stockbit')) {
      found =
        list.find((a) => /rdn|stockbit/i.test(hay(a))) ||
        list.find((a) => /bibit/i.test(hay(a)));
      if (found) return found;
    }
    if (lowerW.includes('mandiri')) {
      found = list.find((a) => /mandiri/i.test(hay(a)));
      if (found) return found;
    }
    if (lowerW.includes('jago')) {
      found = list.find((a) => /jago/i.test(hay(a)));
      if (found) return found;
    }
    found = list.find(
      (a) => a.name.toLowerCase().includes(lowerW) || lowerW.includes(a.name.toLowerCase())
    );
    return found;
  };

  const adjustCashAsset = (wallet: string, delta: number) => {
    if (!delta) return;
    const cash = resolveCashAsset(wallet, assets);
    if (!cash) return;
    // Jangan gerakkan kas kalau targetnya wadah yang sama (hindari net-0 / double)
    const today = new Date().toISOString().split('T')[0];
    const cashId = cash.id;
    setAssets((prev) =>
      prev.map((a) =>
        a.id !== cashId ? a : { ...a, value: Math.max(0, Math.round(a.value + delta)), lastUpdated: today }
      )
    );
    persistAssetDelta(cashId, delta, { round: true });
  };

  const applyTransactionToAssets = (tx: Transaction, reverse = false) => {
    if (tx.skipAssetSync) return;
    const sign = reverse ? -1 : 1;

    // ── Savings: double-entry kas ↔ wadah tujuan ──
    // Alokasi ke wadah Setup (Dana Darurat, dsb): wadah +X, kas dompet -X (netral).
    // 'Top Up Saldo' = top-up kas operasional: kas +X.
    if (tx.type === 'Savings') {
      const cash = resolveCashAsset(tx.wallet, assets);
      if (tx.category === 'Top Up Saldo') {
        if (cash) applyAssetDelta(cash.name, sign * tx.amount);
        return;
      }
      const dest = assets.find((a) => a.name === tx.category || a.displayName === tx.category);
      if (dest) {
        applyAssetDelta(dest.name, sign * tx.amount);
        // Kurangi kas sumber bila beda wadah (hindari net-0 bila wallet = wadah tujuan)
        if (cash && cash.name !== dest.name && cash.id !== dest.id) {
          applyAssetDelta(cash.name, -sign * tx.amount);
        }
        return;
      }
      // Wadah tujuan belum ada di Setup → tetap kurangi kas agar pengeluaran tercatat
      if (cash) applyAssetDelta(cash.name, -sign * tx.amount);
      return;
    }

    // ── Income umum (Gaji, Freelance, Pencairan Investasi): kas +X ──
    // Pelunasan Piutang ditangani khusus di bawah (netral: piutang -X, kas +X).
    if (tx.type === 'Income' && tx.category !== 'Pelunasan Piutang') {
      const cash = resolveCashAsset(tx.wallet, assets);
      if (cash) {
        applyAssetDelta(cash.name, sign * tx.amount);
      } else {
        warnWalletUnmatched(tx.wallet);
      }
      return;
    }

    // Pelunasan piutang: kurangi wadah piutang yang cocok,
    // lalu masukkan ke akun tujuan sesuai wallet transaksi.
    // Netral terhadap net worth: piutang -X, kas +X.
    if (tx.type === 'Income' && tx.category === 'Pelunasan Piutang') {
      const specific = resolvePiutangAssetName(tx);
      if (specific) {
        applyAssetDelta(specific, reverse ? tx.amount : -tx.amount);
        const cash = resolveCashAsset(tx.wallet, assets);
        if (cash && cash.name !== specific) {
          applyAssetDelta(cash.name, reverse ? -tx.amount : tx.amount);
        }
        return; // jangan terapkan delta legacy agar tidak ganda
      }
    }

    const deltas = getTransactionAssetDeltas(tx);
    deltas.forEach(({ asset, delta }) => {
      applyAssetDelta(asset, reverse ? -delta : delta);
    });
    // Fallback pelunasan tanpa wadah spesifik (legacy 'Piutang Teman'):
    // tetap masukkan ke dompet tujuan bila beda wadah.
    if (tx.type === 'Income' && tx.category === 'Pelunasan Piutang') {
      const cash = resolveCashAsset(tx.wallet, assets);
      if (cash && cash.name !== 'Piutang Teman') {
        applyAssetDelta(cash.name, reverse ? -tx.amount : tx.amount);
      }
    }
    // Investment: gerakkan juga kas lawan (double-entry sederhana).
    // Beli/TopUp (in) → kas -amount · Jual/Tarik (out) → kas +amount.
    // Contoh: Jual Saham → Saham berkurang, akun kas yang dipilih bertambah.
    // Reksa dana hanya menggerakkan akun yang pengguna buat di Setup.
    if (tx.type === 'Investment') {
      const rule = (TRANSACTION_TO_ASSET[tx.type] as Record<string, { asset: string; direction: 'in' | 'out' }>)?.[tx.category];
      const rdDir = reksaDanaDirection(tx.category);
      const rdAsset = rdDir ? findUserReksaDanaAsset(tx.category, assets) : null;
      const assetName = rule?.asset ?? rdAsset;
      const direction = rule?.direction ?? (rdAsset ? rdDir : null);
      if (!rule && rdDir && !rdAsset) {
        console.warn(
          `[Finance] "${tx.category}" tidak punya wadah reksa dana di Setup — saldo instrumen tidak diubah.`
        );
      }
      if (assetName && direction) {
        if (!rule && rdAsset) {
          applyAssetDelta(rdAsset, (reverse ? -1 : 1) * (direction === 'in' ? tx.amount : -tx.amount));
        }
        const cash = resolveCashAsset(tx.wallet, assets);
        // Hindari net-0 bila kas dan wadah tujuan adalah akun yang sama.
        if (cash && cash.name !== assetName) {
          const cashDelta = direction === 'in' ? -tx.amount : tx.amount;
          const today = new Date().toISOString().split('T')[0];
          const cashId = cash.id;
          const applied = reverse ? -cashDelta : cashDelta;
          setAssets((prev) =>
            prev.map((a) =>
              a.id !== cashId ? a : { ...a, value: Math.max(0, Math.round(a.value + applied)), lastUpdated: today }
            )
          );
          persistAssetDelta(cashId, applied, { round: true });
        }
      }
    }
    // Pengeluaran umum (Needs/Wants): kas -X — selalu, tanpa kecuali.
    if (tx.type === 'Wants' || tx.type === 'Needs') {
      const cash = resolveCashAsset(tx.wallet, assets);
      if (cash) {
        const delta = reverse ? tx.amount : -tx.amount;
        applyAssetDelta(cash.name, delta);
      } else {
        warnWalletUnmatched(tx.wallet);
      }
      return;
    }
  };

  // Wadah piutang spesifik untuk pelunasan: cocokkan via target tertaut
  // (judul recovery = nama wadah), lalu via catatan, lalu wadah tunggal.
  const resolvePiutangAssetName = (tx: Transaction): string | null => {
    const piutangAssets = assets.filter(isPiutangAsset);
    if (piutangAssets.length === 0) return null;
    if (tx.targetId) {
      const linked = recoveryItems.find((it) => it.id === tx.targetId);
      if (linked) {
        const key = linked.title.trim().toLowerCase();
        const byTitle = piutangAssets.find(
          (a) =>
            a.name.trim().toLowerCase() === key ||
            a.displayName.trim().toLowerCase() === key
        );
        if (byTitle) return byTitle.name;
      }
    }
    const noteKey = (tx.note || '').toLowerCase();
    if (noteKey) {
      const byNote = piutangAssets.find(
        (a) => a.name && noteKey.includes(a.name.toLowerCase())
      );
      if (byNote) return byNote.name;
    }
    if (piutangAssets.length === 1) return piutangAssets[0].name;
    const legacy = piutangAssets.find((a) => a.name === 'Piutang Teman');
    return legacy ? legacy.name : null;
  };

  const resolveTargetByCategory = (
    type: TransactionType,
    category: string
  ): RecoveryItem | null => {
    const targetCategories = getMappedTargetCategories(type, category);
    if (targetCategories.length > 0) {
      const candidates = recoveryItems.filter((it) => (targetCategories as string[]).includes(it.category));
      if (candidates.length > 0) {
        return (
          candidates.find((it) => it.status !== 'Recovered' && it.recoveredAmount < it.targetAmount) ??
          candidates[0]
        );
      }
    }

    // Fallback: kategori Savings dinamis (nama wadah Setup) → target berjudul sama.
    const linked = findLinkedRecoveryTargets(type, category, recoveryItems);
    if (linked.length > 0) {
      const candidates = recoveryItems.filter((it) => linked.some((l) => l.id === it.id));
      return (
        candidates.find((it) => it.status !== 'Recovered' && it.recoveredAmount < it.targetAmount) ??
        candidates[0] ??
        null
      );
    }
    return null;
  };

  const addTransaction = async (txData: Omit<Transaction, 'id'>) => {
    let targetId: string | undefined;
    if (txData.targetId) {
      targetId = txData.targetId;
    } else if (txData.targetId !== '') {
      targetId = resolveTargetByCategory(txData.type, txData.category)?.id;
    }

    const newTx: Transaction = {
      ...txData,
      targetId,
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };

    // Supabase-only: setState + Supabase (tanpa localStorage).
    setTransactions((prev) => [newTx, ...prev]);

    if (newTx.targetId) {
      applyRecoveryLinkAmount(newTx.targetId, newTx.amount);
    }

    applyTransactionToAssets(newTx);

    if (isSupabaseConfigured && supabase) {
      try {
        markSelfWrite('transactions', newTx.id);
        const { error } = await supabase.from('transactions').insert({
          id: newTx.id,
          date: newTx.date,
          amount: newTx.amount,
          category_name: newTx.category,
          type: newTx.type,
          wallet_name: newTx.wallet,
          note: newTx.note,
          is_exclude_report: newTx.isExcludeReport,
          target_id: newTx.targetId ?? null,
        });
        if (error) {
          console.warn('Supabase insert transaction error:', error);
          noteWriteError('transaksi', error);
        }
      } catch (err) {
        console.warn('Supabase insert transaction error:', err);
        noteWriteError('transaksi', err);
      }
    } else if (!isSupabaseConfigured) {
      console.warn('[Finance] Supabase tidak terkonfigurasi — transaksi hanya di state (tidak persist). Set NEXT_PUBLIC_SUPABASE_URL/ANON_KEY lalu reload.');
    }
  };

  const addBulkTransactions = async (txList: Omit<Transaction, 'id'>[]) => {
    const newItems: Transaction[] = txList.map((tx, idx) => {
      let targetId: string | undefined;
      if (tx.targetId) {
        targetId = tx.targetId;
      } else if (tx.targetId !== '') {
        targetId = resolveTargetByCategory(tx.type, tx.category)?.id;
      }
      return {
        ...tx,
        targetId,
        id: `tx-bulk-${Date.now()}-${idx}`,
      };
    });

    setTransactions((prev) => [...newItems, ...prev]);

    // Agregasi per target dulu (1x apply per target) — kalau loop per tx,
    // hitungan DB bisa stale karena tiap apply baca state closure yang sama.
    const deltaByTarget = new Map<string, number>();
    newItems.forEach((tx) => {
      if (tx.targetId) {
        deltaByTarget.set(tx.targetId, (deltaByTarget.get(tx.targetId) ?? 0) + tx.amount);
      }
      applyTransactionToAssets(tx);
    });
    deltaByTarget.forEach((delta, targetId) => applyRecoveryDelta(targetId, delta));

    if (isSupabaseConfigured && supabase) {
      try {
        newItems.forEach((tx) => markSelfWrite('transactions', tx.id));
        const { error: bulkErr } = await supabase.from('transactions').insert(
          newItems.map((tx) => ({
            id: tx.id,
            date: tx.date,
            amount: tx.amount,
            category_name: tx.category,
            type: tx.type,
            wallet_name: tx.wallet,
            note: tx.note,
            is_exclude_report: tx.isExcludeReport,
            target_id: tx.targetId ?? null,
          }))
        );
        if (bulkErr) {
          console.warn('Supabase bulk insert error:', bulkErr);
          noteWriteError('transaksi (impor)', bulkErr);
        }
      } catch (err) {
        console.warn('Supabase bulk insert error:', err);
        noteWriteError('transaksi (impor)', err);
      }
    }
  };

  // ── EDIT transaksi (CRUD: Update) ──
  // Saldo: efek transaksi LAMA dibalik (reverse) lalu efek BARU diterapkan, lewat
  // applyTransactionToAssets yang sama dengan tambah/hapus — tiap wadah ditulis sebagai delta
  // terhadap nilai DB terbaru (persistAssetDelta), jadi tab basi tidak menimpa saldo.
  // Transaksi auto-catat (skipAssetSync) tidak pernah menggerakkan saldo: yang boleh diubah
  // hanya tanggal & catatan (UI mengunci nominal/tipe/kategori/akun).
  const updateTransaction = async (id: string, data: Omit<Transaction, 'id'>) => {
    const oldTx = transactions.find((tx) => tx.id === id);
    if (!oldTx) return;
    const locked = isBalanceLockedTx(oldTx);
    const nextTx: Transaction = locked
      ? { ...oldTx, date: data.date, note: data.note }
      : {
          ...oldTx,
          ...data,
          id,
          skipAssetSync: undefined,
          targetId: data.targetId === '' ? undefined : data.targetId ?? oldTx.targetId,
        };

    setTransactions((prev) => prev.map((tx) => (tx.id === id ? nextTx : tx)));

    if (!locked) {
      // Progres target: netto bila target sama (hindari closure basi 2x pada target yang sama)
      if (oldTx.targetId && oldTx.targetId === nextTx.targetId) {
        applyRecoveryDelta(oldTx.targetId, nextTx.amount - oldTx.amount);
      } else {
        if (oldTx.targetId) applyRecoveryUnlinkAmount(oldTx.targetId, oldTx.amount);
        if (nextTx.targetId) applyRecoveryLinkAmount(nextTx.targetId, nextTx.amount);
      }
      applyTransactionToAssets(oldTx, true);
      applyTransactionToAssets(nextTx);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        markSelfWrite('transactions', id);
        const { error } = await supabase
          .from('transactions')
          .update({
            date: nextTx.date,
            amount: nextTx.amount,
            category_name: nextTx.category,
            type: nextTx.type,
            wallet_name: nextTx.wallet,
            note: nextTx.note,
            is_exclude_report: nextTx.isExcludeReport,
            target_id: nextTx.targetId ?? null,
          })
          .eq('id', id);
        if (error) {
          console.warn('Supabase update transaction error:', error);
          noteWriteError('transaksi', error);
        }
      } catch (err) {
        console.warn('Supabase update transaction error:', err);
        noteWriteError('transaksi', err);
      }
    }
  };

  const deleteTransaction = async (id: string) => {
    const targetTx = transactions.find((tx) => tx.id === id);
    // Supabase-only: setState + Supabase (tanpa localStorage).
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));

    if (targetTx?.targetId) {
      applyRecoveryUnlinkAmount(targetTx.targetId, targetTx.amount);
    }

    if (targetTx) {
      applyTransactionToAssets(targetTx, true);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        markSelfWrite('transactions', id);
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) {
          console.warn('Supabase delete error:', error);
          noteWriteError('transaksi', error);
        }
      } catch (err) {
        console.warn('Supabase delete error:', err);
        noteWriteError('transaksi', err);
      }
    }
  };

  const updateRecoveryItem = async (id: string, updates: Partial<RecoveryItem>) => {
    setRecoveryItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );

    if (isSupabaseConfigured && supabase) {
      try {
        const { error: recUpdErr } = await supabase
          .from('recovery_items')
          .update({
            ...(updates.title !== undefined && { title: updates.title }),
            ...(updates.category !== undefined && { category: updates.category }),
            ...(updates.targetAmount !== undefined && {
              target_amount: updates.targetAmount,
            }),
            ...(updates.recoveredAmount !== undefined && {
              recovered_amount: updates.recoveredAmount,
            }),
            ...(updates.status !== undefined && { status: updates.status }),
            ...(updates.dueDate !== undefined && { due_date: updates.dueDate }),
            ...(updates.notes !== undefined && { notes: updates.notes }),
            ...(updates.updatedAt !== undefined && { updated_at: updates.updatedAt }),
          })
          .eq('id', id);
        if (recUpdErr) {
          console.warn('Supabase recovery update error:', recUpdErr);
          noteWriteError('target recovery', recUpdErr);
        }
      } catch (err) {
        console.warn('Supabase recovery update error:', err);
        noteWriteError('target recovery', err);
      }
    }
  };

  const addRecoveryItem = async (data: Omit<RecoveryItem, 'id'>): Promise<string> => {
    const newItem: RecoveryItem = {
      ...data,
      id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };

    setRecoveryItems((prev) => [...prev, newItem]);

    if (isSupabaseConfigured && supabase) {
      try {
        const { error: recInsErr } = await supabase.from('recovery_items').insert({
          id: newItem.id,
          title: newItem.title,
          category: newItem.category,
          target_amount: newItem.targetAmount,
          recovered_amount: newItem.recoveredAmount,
          status: newItem.status,
          due_date: newItem.dueDate || null,
          notes: newItem.notes || null,
        });
        if (recInsErr) {
          console.warn('Supabase insert recovery error:', recInsErr);
          noteWriteError('target recovery', recInsErr);
        }
      } catch (err) {
        console.warn('Supabase insert recovery error:', err);
        noteWriteError('target recovery', err);
      }
    }
    return newItem.id;
  };

  const deleteRecoveryItem = async (id: string) => {
    setRecoveryItems((prev) => prev.filter((item) => item.id !== id));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error: recDelErr } = await supabase.from('recovery_items').delete().eq('id', id);
        if (recDelErr) {
          console.warn('Supabase recovery delete error:', recDelErr);
          noteWriteError('target recovery', recDelErr);
        }
      } catch (err) {
        console.warn('Supabase recovery delete error:', err);
        noteWriteError('target recovery', err);
      }
    }
  };

  // Kolom DB yang di-update untuk sebuah aset (dipakai updateAssetItem & renameAssetCascade).
  const toAssetDbUpdate = (updates: Partial<AssetItem>) => ({
    // Nama/keterangan/kategori wadah ikut disimpan. Dulu tidak dikirim → nama baru
    // hanya hidup di state lokal lalu tertimpa lagi oleh echo realtime / reload
    // (bug "ganti nama wadah, ceklis, nama balik lagi").
    ...(updates.name !== undefined && { name: updates.name }),
    ...(updates.displayName !== undefined && { display_name: updates.displayName }),
    ...(updates.category !== undefined && { category: updates.category }),
    ...(updates.subCategory !== undefined && { sub_category: updates.subCategory }),
    ...(updates.value !== undefined && { value: updates.value }),
    ...(updates.details !== undefined && { details: updates.details }),
    ...(updates.isGold !== undefined && { is_gold: updates.isGold }),
    ...(updates.goldQtyGr !== undefined && { gold_qty_gr: updates.goldQtyGr }),
    ...(updates.pricePerGram !== undefined && { price_per_gram: updates.pricePerGram }),
  });

  const updateAssetItem = async (id: string, updates: Partial<AssetItem>) => {
    // Supabase-only: setState + Supabase (tanpa localStorage).
    setAssets((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error: astUpdErr } = await supabase
          .from('assets')
          .update(toAssetDbUpdate(updates))
          .eq('id', id);
        if (astUpdErr) {
          console.warn('Supabase asset update error:', astUpdErr);
          noteWriteError('aset', astUpdErr);
        }
      } catch (err) {
        console.warn('Supabase asset update error:', err);
        noteWriteError('aset', err);
      }
    }
  };

  // ── Ganti nama wadah + cascade referensi nama ──
  // Hanya kolom TEKS yang berubah: transactions.wallet_name / category_name,
  // recovery_items.title / category, lalu assets.name / display_name. Nominal tidak disentuh.
  // Urutan: referensi dulu, aset terakhir. supabase-js tidak punya transaksi multi-baris
  // (tanpa RPC), jadi kalau satu langkah gagal → rollback best-effort ke nilai sebelumnya
  // untuk langkah yang sudah berhasil, state lokal tidak diubah, dan error dikembalikan.
  const renameAssetCascade = async (
    id: string,
    updates: Partial<AssetItem>,
    oldName: string,
    newName: string
  ): Promise<{ ok: boolean; txCount: number; targetCount: number; error?: string }> => {
    const plan = planWadahRename(oldName, newName, transactions, recoveryItems);
    const txCount = plan.txChanges.length;
    const targetCount = plan.targetChanges.length;

    if (isSupabaseConfigured && supabase) {
      const sb = supabase;
      const undo: Array<() => Promise<unknown>> = [];
      // Kirim hanya kolom yang benar-benar berubah (jangan timpa kolom lain dari state lokal).
      const txCols = (from: { wallet: string; category: string }, to: { wallet: string; category: string }) => ({
        ...(from.wallet !== to.wallet && { wallet_name: to.wallet }),
        ...(from.category !== to.category && { category_name: to.category }),
      });
      const tgCols = (from: { title: string; category: string }, to: { title: string; category: string }) => ({
        ...(from.title !== to.title && { title: to.title }),
        ...(from.category !== to.category && { category: to.category }),
      });
      const fail = async (step: string, err: unknown) => {
        console.warn(`[Rename wadah] gagal di ${step}:`, err);
        let rollbackFailed = 0;
        for (const u of undo.reverse()) {
          try {
            const res = (await u()) as { error?: unknown } | undefined;
            if (res && res.error) rollbackFailed += 1;
          } catch {
            rollbackFailed += 1;
          }
        }
        noteWriteError('ganti nama wadah', err);
        const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || String(err);
        return {
          ok: false,
          txCount,
          targetCount,
          error:
            `Gagal ganti nama di ${step}: ${msg}.` +
            (rollbackFailed > 0
              ? ` ${rollbackFailed} perubahan tidak bisa dikembalikan — cek data lalu refresh.`
              : ' Semua perubahan dikembalikan ke nama lama.'),
        };
      };
      try {
        for (const c of plan.txChanges) {
          markSelfWrite('transactions', c.id);
          const { data, error } = await sb
            .from('transactions')
            .update(txCols(c.before, c.after))
            .eq('id', c.id)
            .select('id');
          if (!error && (!data || data.length === 0)) return await fail('transaksi', new Error('0 baris ter-update (izin/RLS?)'));
          if (error) return await fail('transaksi', error);
          undo.push(async () => {
            markSelfWrite('transactions', c.id);
            return sb
              .from('transactions')
              .update(txCols(c.after, c.before))
              .eq('id', c.id);
          });
        }
        for (const c of plan.targetChanges) {
          markSelfWrite('recovery_items', c.id);
          const { data, error } = await sb
            .from('recovery_items')
            .update(tgCols(c.before, c.after))
            .eq('id', c.id)
            .select('id');
          if (!error && (!data || data.length === 0)) return await fail('target', new Error('0 baris ter-update (izin/RLS?)'));
          if (error) return await fail('target', error);
          undo.push(async () => {
            markSelfWrite('recovery_items', c.id);
            return sb
              .from('recovery_items')
              .update(tgCols(c.after, c.before))
              .eq('id', c.id);
          });
        }
        markSelfWrite('assets', id);
        const { data: astData, error: astErr } = await sb
          .from('assets')
          .update(toAssetDbUpdate(updates))
          .eq('id', id)
          .select('id');
        if (astErr) return await fail('wadah aset', astErr);
        if (!astData || astData.length === 0)
          return await fail('wadah aset', new Error('0 baris ter-update (izin/RLS?)'));
      } catch (err) {
        return await fail('koneksi', err);
      }
    }

    // Sukses (atau mode lokal/preview): perbarui state agar semua section langsung pakai nama baru.
    const txMap = new Map(plan.txChanges.map((c) => [c.id, c.after]));
    const tgMap = new Map(plan.targetChanges.map((c) => [c.id, c.after]));
    if (txMap.size > 0)
      setTransactions((prev) => prev.map((t) => (txMap.has(t.id) ? { ...t, ...txMap.get(t.id)! } : t)));
    if (tgMap.size > 0)
      setRecoveryItems((prev) => prev.map((it) => (tgMap.has(it.id) ? { ...it, ...tgMap.get(it.id)! } : it)));
    setAssets((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
    return { ok: true, txCount, targetCount };
  };

  const addAssetItem = async (data: Omit<AssetItem, 'id'>) => {
    const newItem: AssetItem = {
      ...data,
      id: `ast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };

    // Supabase-only: setState + Supabase (tanpa localStorage).
    setAssets((prev) => [...prev, newItem]);

    if (isSupabaseConfigured && supabase) {
      try {
        const { error: astInsErr } = await supabase.from('assets').insert({
          id: newItem.id,
          name: newItem.name,
          display_name: newItem.displayName,
          category: newItem.category,
          sub_category: newItem.subCategory,
          value: newItem.value,
          details: newItem.details,
          is_gold: newItem.isGold ?? false,
          gold_qty_gr: newItem.goldQtyGr ?? null,
          price_per_gram: newItem.pricePerGram ?? null,
        });
        if (astInsErr) {
          console.warn('Supabase insert asset error:', astInsErr);
          noteWriteError('aset', astInsErr);
        }
      } catch (err) {
        console.warn('Supabase insert asset error:', err);
        noteWriteError('aset', err);
      }
    }
  };

  const deleteAssetItem = async (id: string) => {
    setAssets((prev) => prev.filter((item) => item.id !== id));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('assets').delete().eq('id', id);
        if (error) {
          console.warn('Supabase asset delete error:', error);
          noteWriteError('aset', error);
        }
      } catch (err) {
        console.warn('Supabase asset delete error:', err);
        noteWriteError('aset', err);
      }
    }
  };

  // Tab/HP yang lama terbuka (realtime putus saat di-background) memegang saldo basi.
  // Saat tab kembali aktif / online → ambil ulang saldo wadah dari Supabase.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !isLoaded) return;
    const sb = supabase;
    let last = 0;
    const refreshAssets = async () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - last < 5000) return;
      last = now;
      const { data, error } = await sb.from('assets').select('*');
      if (error || !data) return;
      setAssets(data.map((r) => mapRtAsset(r as RtRow)));
    };
    document.addEventListener('visibilitychange', refreshAssets);
    window.addEventListener('focus', refreshAssets);
    window.addEventListener('online', refreshAssets);
    return () => {
      document.removeEventListener('visibilitychange', refreshAssets);
      window.removeEventListener('focus', refreshAssets);
      window.removeEventListener('online', refreshAssets);
    };
  }, [isLoaded]);

  // â”€â”€ MODUL: MANAJEMEN PORTOFOLIO SAHAM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const defaultCashWallet = (): string => {
    const cash = assets.find((a) => a.name !== 'Saham' && !a.isGold && !isPiutangAsset(a));
    return cash?.name || 'Cash';
  };

  const todayISO = (): string => new Date().toISOString().split('T')[0];

  const reconcileSahamAsset = (holdings: StockHolding[]) => {
    saveSahamAssetValue(computeStockPortfolioValue(holdings));
  };

  // Pastikan aset "Saham" selalu ada & sinkron dengan total nilai pasar (kaya sebelumnya)
  // Dipanggil saat isLoaded + stockHoldings berubah (termasuk 0) — handle case reload/holdings kosong
  useEffect(() => {
    if (!isLoaded) return;
    const total = computeStockPortfolioValue(stockHoldings);
    // Trigger reconcile — saveSahamAssetValue sudah handle create-if-missing & no-op jika sama.
    // Dijadwalkan 1 microtask agar tidak setState sinkron di dalam effect.
    queueMicrotask(() => saveSahamAssetValue(total));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockHoldings, isLoaded]);

  const applySahamRealizedToTarget = (realizedPnL: number) => {
    if (realizedPnL <= 0) return;
    const target =
      recoveryItems.find(
        (it) => it.category === 'saham' && it.status !== 'Recovered' && it.recoveredAmount < it.targetAmount
      ) ?? recoveryItems.find((it) => it.category === 'saham');
    if (!target) return;
    applyRecoveryLinkAmount(target.id, realizedPnL);
  };

  const persistStockRealizedProfit = async (value: number) => {
    if (!isSupabaseConfigured || !supabase || !user) return;
    try {
      const { error } = await supabase
        .from('stock_holdings_meta')
        .upsert({ id: user.id, total_realized_profit: value }, { onConflict: 'id' });
      if (error) {
        console.warn('Supabase stock realized profit upsert error:', error);
        noteWriteError('saham (profit)', error);
      } else console.log('[Finance] stock realized profit persisted:', value);
    } catch (err) {
      console.warn('Supabase stock realized profit upsert error:', err);
      noteWriteError('saham (profit)', err);
    }
  };

  const persistStockHolding = async (holding: StockHolding) => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const { error } = await supabase.from('stock_holdings').upsert(
        {
          id: holding.id,
          ticker: holding.ticker,
          company_name: holding.companyName ?? null,
          lots: holding.lots,
          buy_price: holding.buyPrice,
          market_price: holding.marketPrice,
          category: holding.category ?? 'non_likuid',
          strategy: holding.strategy ?? 'Long-Term',
          realized_profit: holding.realizedProfit ?? 0,
          last_updated: holding.lastUpdated ?? null,
        },
        { onConflict: 'id' }
      );
      if (error) {
        console.warn('Supabase stock holding upsert error:', error);
        noteWriteError('saham', error);
      } else console.log('[Finance] stock holding persisted:', holding.ticker, holding.id);
    } catch (err) {
      console.warn('Supabase stock holding upsert error:', err);
      noteWriteError('saham', err);
    }
  };

  const addStockHolding = async (data: Omit<StockHolding, 'id'>, opts?: { date?: string; wallet?: string }) => {
    const txDate = opts?.date ?? todayISO();
    const wallet = opts?.wallet ?? defaultCashWallet();
    const newHolding: StockHolding = {
      ...data,
      category: data.category ?? 'non_likuid',
      strategy: data.strategy ?? 'Long-Term',
      realizedProfit: data.realizedProfit ?? 0,
      id: `stk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      lastUpdated: data.lastUpdated ?? txDate,
    };
    const next = [...stockHoldings, newHolding];
    setStockHoldings(next);
    reconcileSahamAsset(next);

    const shares = getStockShares(newHolding);
    if (shares > 0) {
      const cost = Math.round(shares * newHolding.buyPrice);
      // Cash-leg: beli → kas akun yang dipilih berkurang
      adjustCashAsset(wallet, -cost);
      await addTransaction({
        date: txDate,
        amount: cost,
        category: 'Beli Saham',
        type: 'Investment',
        wallet,
        note: `Beli ${newHolding.ticker} · ${newHolding.lots} lot (${shares} lembar) @ Rp ${newHolding.buyPrice}/lembar [${newHolding.category}/${newHolding.strategy}] (Portofolio Saham)`,
        isExcludeReport: false,
        skipAssetSync: true,
        targetId: '',
      });
    }

    await persistStockHolding(newHolding);
    // pastikan row meta 'main' selalu ada (walau 0) biar Table Editor tidak kosong
    await persistStockRealizedProfit(totalStockRealizedProfit);
  };

  const applyStockMarketPrices = async (updates: { id: string; marketPrice: number }[]) => {
    const today = todayISO();
    const changed = updates.filter((u) => {
      if (!Number.isFinite(u.marketPrice) || u.marketPrice <= 0) return false;
      const current = stockHoldingsRef.current.find((h) => h.id === u.id);
      return !!current && Math.abs(u.marketPrice - current.marketPrice) >= 0.5;
    });
    if (changed.length === 0) return;

    const byId = new Map(changed.map((u) => [u.id, u.marketPrice]));
    setStockHoldings((prev) => {
      let any = false;
      const next = prev.map((h) => {
        const price = byId.get(h.id);
        if (price == null || Math.abs(price - h.marketPrice) < 0.5) return h;
        any = true;
        return { ...h, marketPrice: price, lastUpdated: today };
      });
      if (any) stockHoldingsRef.current = next;
      return any ? next : prev;
    });

    if (!isSupabaseConfigured || !supabase) return;
    await Promise.all(
      changed.map(async (u) => {
        try {
          const { error } = await supabase
            .from('stock_holdings')
            .update({ market_price: u.marketPrice, last_updated: today })
            .eq('id', u.id);
          if (error) noteWriteError('saham', error);
        } catch (err) {
          noteWriteError('saham', err);
        }
      })
    );
  };

  const updateStockHolding = async (id: string, updates: Partial<StockHolding>, opts?: { date?: string; wallet?: string; fee?: number }) => {
    const txDate = opts?.date ?? todayISO();
    const wallet = opts?.wallet ?? defaultCashWallet();
    const fee = opts?.fee ?? 0;
    const current = stockHoldings.find((h) => h.id === id);
    if (!current) return;

    const oldShares = getStockShares(current);
    const newLots = updates.lots ?? current.lots;
    const newShares = Math.round(newLots * SHARES_PER_LOT);
    const shareDelta = newShares - oldShares;

    let realizedPnL = 0;
    let nextRealizedProfit = current.realizedProfit ?? 0;
    if (shareDelta < 0) {
      const sellPrice = updates.marketPrice ?? current.marketPrice;
      const avgPrice = updates.buyPrice ?? current.buyPrice;
      const gross = Math.abs(shareDelta) * (sellPrice - avgPrice);
      realizedPnL = gross - fee;
      nextRealizedProfit = (current.realizedProfit ?? 0) + realizedPnL;
    }

    const merged: StockHolding = {
      ...current,
      ...updates,
      realizedProfit: shareDelta < 0 ? nextRealizedProfit : (updates.realizedProfit ?? current.realizedProfit ?? 0),
      lastUpdated: txDate,
    };
    const next = stockHoldings.map((h) => (h.id === id ? merged : h));
    setStockHoldings(next);
    reconcileSahamAsset(next);
    if (realizedPnL !== 0) {
      const nextTotal = totalStockRealizedProfit + realizedPnL;
      setTotalStockRealizedProfit(nextTotal);
      applySahamRealizedToTarget(realizedPnL);
      void persistStockRealizedProfit(nextTotal);
    } else {
      // holdings ada tapi meta belum pernah dibuat → buat row 0 (id='main')
      void persistStockRealizedProfit(totalStockRealizedProfit);
    }

    if (shareDelta > 0) {
      const cost = Math.round(shareDelta * merged.buyPrice);
      // Cash-leg: top-up beli → kas berkurang
      adjustCashAsset(wallet, -cost);
      await addTransaction({
        date: txDate,
        amount: cost,
        category: 'Beli Saham',
        type: 'Investment',
        wallet,
        note: `Top up ${merged.ticker} +${merged.lots - current.lots} lot (auto · Portofolio Saham)`,
        isExcludeReport: false,
        skipAssetSync: true,
        targetId: '',
      });
    } else if (shareDelta < 0) {
      const grossProceeds = Math.abs(shareDelta) * merged.marketPrice;
      const netProceeds = Math.max(0, Math.round(grossProceeds - fee));
      // Cash-leg: jual → kas akun yang dipilih bertambah sebesar hasil bersih
      adjustCashAsset(wallet, netProceeds);
      await addTransaction({
        date: txDate,
        amount: netProceeds,
        category: 'Jual Saham',
        type: 'Investment',
        wallet,
        note: `Jual ${merged.ticker} ${Math.abs(merged.lots - current.lots)} lot @ Rp ${merged.marketPrice} (realized ${realizedPnL >= 0 ? '+' : ''}${realizedPnL}${fee ? ` net fee ${fee}` : ''} · Portofolio Saham)`,
        isExcludeReport: false,
        skipAssetSync: true,
        targetId: '',
      });
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('stock_holdings')
          .update({
            ticker: merged.ticker,
            company_name: merged.companyName ?? null,
            lots: merged.lots,
            buy_price: merged.buyPrice,
            market_price: merged.marketPrice,
            category: merged.category,
            strategy: merged.strategy,
            realized_profit: merged.realizedProfit ?? 0,
            last_updated: merged.lastUpdated,
          })
          .eq('id', id);
        if (error) {
          console.warn('Supabase stock holding update error:', error);
          noteWriteError('saham', error);
        } else console.log('[Finance] stock holding updated:', merged.ticker, id);
      } catch (err) {
        console.warn('Supabase stock holding update error:', err);
        noteWriteError('saham', err);
      }
    }
  };

  const deleteStockHolding = async (id: string, opts?: { date?: string; wallet?: string }) => {
    const txDate = opts?.date ?? todayISO();
    const wallet = opts?.wallet ?? defaultCashWallet();
    const target = stockHoldings.find((h) => h.id === id);
    const next = stockHoldings.filter((h) => h.id !== id);
    setStockHoldings(next);
    reconcileSahamAsset(next);

    if (target) {
      const shares = getStockShares(target);
      if (shares > 0) {
        const realizedPnL = shares * (target.marketPrice - target.buyPrice);
        if (realizedPnL !== 0) {
          const nextTotal = totalStockRealizedProfit + realizedPnL;
          setTotalStockRealizedProfit(nextTotal);
          applySahamRealizedToTarget(realizedPnL);
          void persistStockRealizedProfit(nextTotal);
        } else {
          // tetap pastikan meta row ada walau realized 0
          void persistStockRealizedProfit(totalStockRealizedProfit);
        }
        const proceeds = Math.round(shares * target.marketPrice);
        // Cash-leg: hapus/jual penuh → kas akun yang dipilih bertambah
        adjustCashAsset(wallet, proceeds);
        await addTransaction({
          date: txDate,
          amount: proceeds,
          category: 'Jual Saham',
          type: 'Investment',
          wallet,
          note: `Jual ${target.ticker} · ${target.lots} lot (${shares} lembar) @ Rp ${target.marketPrice}/lembar (realized ${realizedPnL >= 0 ? '+' : ''}${realizedPnL} · Portofolio Saham)`,
          isExcludeReport: false,
          skipAssetSync: true,
          targetId: '',
        });
      }
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('stock_holdings').delete().eq('id', id);
        if (error) {
          console.warn('Supabase stock holding delete error:', error);
          noteWriteError('saham', error);
        } else console.log('[Finance] stock holding deleted:', id);
      } catch (err) {
        console.warn('Supabase stock holding delete error:', err);
        noteWriteError('saham', err);
      }
    }
  };

  // ── Realized profit saham ──
  const resetStockRealizedProfit = async () => {
    setTotalStockRealizedProfit(0);
    setStockHoldings((prev) => prev.map((h) => ({ ...h, realizedProfit: 0 })));
    if (isSupabaseConfigured && supabase) {
      try {
        if (user) await supabase.from('stock_holdings_meta').upsert({ id: user.id, total_realized_profit: 0 }, { onConflict: 'id' });
        const { error } = await supabase.from('stock_holdings').update({ realized_profit: 0 }).neq('id', '__nonexistent__');
        if (error) console.warn('[Finance] reset realized profit holdings error:', error);
        console.log('[Finance] stock realized profit reset to 0');
      } catch (e) {
        console.warn('[Finance] reset realized profit failed:', e);
      }
    }
  };


  const resetDatabase = async () => {
    // Supabase-only: kosongkan transaksi di state + Supabase.
    setTransactions([]);
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('transactions').delete().neq('id', '__nonexistent__');
        if (error) console.warn('[Reset] Supabase delete transactions error:', error);
        else console.log('[Reset] Supabase transactions dikosongkan');
      } catch (e) {
        console.warn('[Reset] Supabase delete transactions failed:', e);
      }
    }
  };

  const resetToDefault = async () => {
    // Reset semua kosong — tanpa initial data (sesuai request)
    setTransactions([]);
    setRecoveryItems([]);
    setAssets([]);
    setStockHoldings([]);
    setTotalStockRealizedProfit(0);
    // Supabase-only: state dikosongkan di atas, persist ke Supabase di bawah (tanpa localStorage).
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('transactions').delete().neq('id', '__nonexistent__');
        await supabase.from('recovery_items').delete().neq('id', '__nonexistent__');
        await supabase.from('assets').delete().neq('id', '__nonexistent__');
        await supabase.from('stock_holdings').delete().neq('id', '__nonexistent__');
        await supabase.from('stock_holdings_meta').delete().neq('id', '__nonexistent__');
        console.log('[Reset] Supabase semua tabel dikosongkan (tanpa seed — semua kosong)');
      } catch (e) {
        console.warn('[Reset] Supabase reset failed:', e);
      }
    }
  };

  return (
    <FinanceContext.Provider
      value={{
        activeTab,
        setActiveTab,
        transactions,
        recoveryItems,
        assets,
        cashflow: filteredCashflow,
        selectedYear,
        setSelectedYear,
        isQuickAddOpen,
        setIsQuickAddOpen,
        isImporterOpen,
        setIsImporterOpen,
        isSupabaseActive: isSupabaseConfigured,
        supabaseError,
        retrySupabase,
        writeError,
        clearWriteError,
        summary,
        addTransaction,
        addBulkTransactions,
        deleteTransaction,
        updateTransaction,
        editingTx,
        openEditTransaction,
        updateRecoveryItem,
        addRecoveryItem,
        deleteRecoveryItem,
        updateAssetItem,
        renameAssetCascade,
        addAssetItem,
        deleteAssetItem,
        stockHoldings,
        addStockHolding,
        updateStockHolding,
        applyStockMarketPrices,
        deleteStockHolding,
        isLoaded,
        totalStockRealizedProfit,
        resetStockRealizedProfit,
        resetToDefault,
        resetDatabase,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance harus digunakan di dalam FinanceProvider');
  }
  return context;
}
