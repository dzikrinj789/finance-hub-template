'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useFinance } from '@/context/FinanceContext';
import {
  generateSampleMoneyLoverWorkbook,
  parseMoneyLoverFile,
  ParseResult,
} from '@/lib/excel-parser';
import { formatRupiah, formatDateIndo } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { getGoldPrice, formatGoldQty, GoldPriceInfo } from '@/lib/gold-price';
import { refreshMarket, setMarketPollEnabled, useMarketStatus } from '@/lib/market-refresh';
import { formatMarketClock, IhsgStrip } from '@/components/dashboard/IhsgStrip';
import {
  INCOME_CATEGORIES,
  NEEDS_CATEGORIES,
  WANTS_CATEGORIES,
  ASSET_WALLETS,
  planWadahRename,
  AssetCategory,
  AssetItem,
  AssetWallet,
  StockHolding,
  StockStrategy,
  STOCK_STRATEGIES,
  computeGoldValue,
  getStockCostValue,
  getStockMarketValue,
  getStockProfitLoss,
  getStockProfitLossPercent,
  getStockShares,
  getSavingsAssetOptions,
  buildAssetDeltaTransaction,
  isPiutangAsset,
} from '@/types/finance';
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Edit2,
  Check,
  Plus,
  X,
  Coins,
  RefreshCw,
  ChartCandlestick,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Landmark,
  MoonStar,
  Sprout,
  TrendingUp,
  Bike,
  Handshake,
  Wallet,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';

const ASSET_ICON_MAP: Record<string, LucideIcon> = {
  Mandiri: Landmark,
  'Jago Syariah': MoonStar,
  Bibit: Sprout,
  Saham: TrendingUp,
  'Emas Fisik': Coins,
  Motor: Bike,
  'Piutang Teman': Handshake,
  Wallet,
};

const ASSET_ICON_KEYWORD: Array<[RegExp, string]> = [
  [/emas/i, 'Emas Fisik'],
  [/piutang/i, 'Piutang Teman'],
  [/motor/i, 'Motor'],
  [/saham|bursa|idx/i, 'Saham'],
  [/bibit/i, 'Bibit'],
  [/jago/i, 'Jago Syariah'],
  [/mandiri/i, 'Mandiri'],
];

function getAssetIconKey(name: string, isGold?: boolean): string {
  if (isGold) return 'Emas Fisik';
  if (ASSET_ICON_MAP[name]) return name;
  for (const [re, key] of ASSET_ICON_KEYWORD) {
    if (re.test(name)) return key;
  }
  return 'Wallet';
}

const ASSET_CATEGORY_TINT: Record<string, string> = {
  Mandiri: '#16A34A',
  'Jago Syariah': '#10B981',
  Bibit: '#06B6D4',
  Saham: '#6366F1',
  'Emas Fisik': '#D97706',
  Motor: '#F97316',
  'Piutang Teman': '#EC4899',
};

const ASSET_TINT_FALLBACK = '#2563EB';

export function SetupTab() {
  const {
    assets,
    updateAssetItem,
    renameAssetCascade,
    addAssetItem,
    deleteAssetItem,
    stockHoldings,
    addStockHolding,
    updateStockHolding,
    applyStockMarketPrices,
    deleteStockHolding,
    totalStockRealizedProfit,
    resetStockRealizedProfit,
    addBulkTransactions,
    addTransaction,
    recoveryItems,
    resetDatabase,
    resetToDefault,
    transactions,
    isSupabaseActive,
    supabaseError,
    writeError,
    clearWriteError,
  } = useFinance();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Importer states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // Reset database modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);

  // Asset editing state
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    name: string;
    displayName: string;
    category: AssetCategory;
    valueStr: string;
    isGold: boolean;
    goldQtyStr: string;
    priceStr: string;
  } | null>(null);
  const [isAddAssetOpen, setIsAddAssetOpen] = useState<boolean>(false);
  const [addDraft, setAddDraft] = useState<{
    name: string;
    displayName: string;
    category: AssetCategory;
    valueStr: string;
    isGold: boolean;
    goldQtyStr: string;
    goldPriceStr: string;
  }>({
    name: '',
    displayName: '',
    category: 'likuid',
    valueStr: '',
    isGold: false,
    goldQtyStr: '',
    goldPriceStr: '',
  });

  // Emas Fisik: harga per gram = Galeri24 ANTAM 1 gram buyback (via /api/gold-price)
  const [goldPrice, setGoldPrice] = useState<GoldPriceInfo | null>(null);
  const [goldLoading, setGoldLoading] = useState<boolean>(true);
  const [goldError, setGoldError] = useState<string | null>(null);

  // ── Manajemen Portofolio Saham (sub-modul Kelola Aset & Modal) ──
  // Spec: Kode Saham, Jumlah Lot, Harga Beli/Lembar, Harga Saat Ini, Kategori, Strategi
  const [isAddStockOpen, setIsAddStockOpen] = useState<boolean>(false);
  const market = useMarketStatus();
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState<boolean>(true);
  const [addStockDraft, setAddStockDraft] = useState<{
    ticker: string;
    lotStr: string;
    buyStr: string;
    marketStr: string;
    category: AssetCategory;
    strategy: StockStrategy;
  }>({ ticker: '', lotStr: '', buyStr: '', marketStr: '', category: 'non_likuid', strategy: 'Long-Term' });
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editStockDraft, setEditStockDraft] = useState<{
    ticker: string;
    lotStr: string;
    buyStr: string;
    marketStr: string;
    category: AssetCategory;
    strategy: StockStrategy;
  } | null>(null);
  // Sort tabel saham: Symbol (A-Z/Z-A) & P&L (rugi-terbesar ↔ cuan-terbesar) — tanpa ubah isi
  const [stockSortKey, setStockSortKey] = useState<'symbol' | 'pnl' | null>(null);
  const [stockSortDir, setStockSortDir] = useState<'asc' | 'desc'>('asc');
  const toggleStockSort = (key: 'symbol' | 'pnl') => {
    if (stockSortKey === key) {
      setStockSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setStockSortKey(key);
      setStockSortDir('asc');
    }
  };
  const sortedStockHoldings = useMemo(() => {
    if (!stockSortKey) return stockHoldings;
    const arr = [...stockHoldings];
    if (stockSortKey === 'symbol') {
      arr.sort((a, b) =>
        stockSortDir === 'asc'
          ? a.ticker.localeCompare(b.ticker)
          : b.ticker.localeCompare(a.ticker)
      );
    } else {
      arr.sort((a, b) => {
        const pa = getStockProfitLoss(a);
        const pb = getStockProfitLoss(b);
        return stockSortDir === 'asc' ? pa - pb : pb - pa;
      });
    }
    return arr;
  }, [stockHoldings, stockSortKey, stockSortDir]);
  // Sort tabel wadah aset: Nama (A-Z/Z-A) & Nilai Saldo (terkecil ↔ terbesar) — tanpa ubah isi
  const [assetSortKey, setAssetSortKey] = useState<'name' | 'value' | null>(null);
  const [assetSortDir, setAssetSortDir] = useState<'asc' | 'desc'>('asc');
  const toggleAssetSort = (key: 'name' | 'value') => {
    if (assetSortKey === key) {
      setAssetSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setAssetSortKey(key);
      setAssetSortDir('asc');
    }
  };
  const sortedAssets = useMemo(() => {
    if (!assetSortKey) return assets;
    const arr = [...assets];
    if (assetSortKey === 'name') {
      arr.sort((a, b) =>
        assetSortDir === 'asc'
          ? a.name.localeCompare(b.name, 'id')
          : b.name.localeCompare(a.name, 'id')
      );
    } else {
      arr.sort((a, b) =>
        assetSortDir === 'asc' ? a.value - b.value : b.value - a.value
      );
    }
    return arr;
  }, [assets, assetSortKey, assetSortDir]);

  // Parse angka gram (2,5 / 2.5) dan harga rupiah murni
  const parseDecimal = (s: string): number | null => {
    const n = parseFloat(s.trim().replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const digitPrice = (s: string): number => {
    const n = parseFloat(s.replace(/\D/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  // Harga saham: desimal (IDR/lembar bisa pecahan) — dukung koma & titik sesuai format ID/EN
  // "2.569" (ID thousand) → 2569, "2,569" / "2.569" decimal → 2.569, "1.234,56" → 1234.56
  const parsePrice = (s: string): number => {
    if (!s) return 0;
    const trimmed = s.trim();
    if (!trimmed) return 0;
    let v = trimmed.replace(/\s/g, '');
    if (v.includes('.') && v.includes(',')) {
      const lastDot = v.lastIndexOf('.');
      const lastComma = v.lastIndexOf(',');
      if (lastComma > lastDot) {
        // ID: 1.234.567,89 → 1234567.89
        v = v.replace(/\./g, '').replace(',', '.');
      } else {
        // EN: 1,234,567.89 → 1234567.89
        v = v.replace(/,/g, '');
      }
      v = v.replace(/[^0-9.\-]/g, '');
    } else if (v.includes(',')) {
      const parts = v.split(',');
      if (parts.length > 2) {
        const dec = parts.pop() as string;
        v = parts.join('') + '.' + dec;
      } else {
        v = v.replace(',', '.');
      }
      v = v.replace(/[^0-9.\-]/g, '');
    } else if (v.includes('.')) {
      const dotCount = (v.match(/\./g) || []).length;
      if (dotCount > 1) {
        // ID thousand groups: 1.234.567 → 1234567
        v = v.replace(/\./g, '');
        v = v.replace(/[^0-9.\-]/g, '');
      } else {
        const [intPart, decPart] = v.split('.');
        // Heuristik ID thousand: "2.569", "12.345", "123.456" (sufiks 3 digit + int 1-4 digit) → 2569
        // User yang butuh desimal 2.569 pakai koma: "2,569" → 2.569
        if (decPart && decPart.length === 3 && /^\d{1,4}$/.test(intPart)) {
          v = intPart + decPart;
          v = v.replace(/[^0-9.\-]/g, '');
        } else {
          v = v.replace(/[^0-9.\-]/g, '');
          const dotIdx = v.indexOf('.');
          if (dotIdx !== -1) v = v.slice(0, dotIdx + 1) + v.slice(dotIdx + 1).replace(/\./g, '');
        }
      }
    } else {
      v = v.replace(/[^0-9.\-]/g, '');
    }
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  const totalAssets = assets.reduce((sum, a) => sum + a.value, 0);
  const liquidTotal = assets
    .filter((a) => a.category === 'likuid')
    .reduce((sum, a) => sum + a.value, 0);
  const nonLiquidTotal = totalAssets - liquidTotal;

  // Manajemen Portofolio Saham: nilai turunan & total portofolio
  const addStockLots = parseDecimal(addStockDraft.lotStr);
  const addStockBuy = parsePrice(addStockDraft.buyStr);
  const addStockMarket = parsePrice(addStockDraft.marketStr);
  const addStockShares = (addStockLots ?? 0) * getStockShares({ lots: 1 });
  const addStockMarketValue = addStockShares * (addStockMarket || addStockBuy);

  const portfolioCostTotal = stockHoldings.reduce((s, h) => s + getStockCostValue(h), 0);
  const portfolioMarketTotal = stockHoldings.reduce((s, h) => s + getStockMarketValue(h), 0);
  const portfolioPl = portfolioMarketTotal - portfolioCostTotal;
  const portfolioPlPct = portfolioCostTotal > 0 ? (portfolioPl / portfolioCostTotal) * 100 : 0;
  const swingHoldings = stockHoldings.filter((h) => (h.strategy ?? 'Long-Term') === 'Swing');
  const swingMarketTotal = swingHoldings.reduce((s, h) => s + getStockMarketValue(h), 0);
  const swingCount = swingHoldings.length;

  const addGoldQty = addDraft.isGold ? (parseDecimal(addDraft.goldQtyStr) ?? 0) : 0;
  const addGoldPrice = addDraft.isGold ? digitPrice(addDraft.goldPriceStr) : 0;

  // Muat harga emas (cache 1 jam) begitu tab Setup dibuka
  // — fallback ke stale cache / harga terakhir Galeri24 bila situs gagal diambil
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await getGoldPrice(false);
      if (cancelled) return;
      setGoldLoading(false);
      if (p) {
        setGoldPrice(p);
        setGoldError(null);
      } else {
        setGoldError('Gagal memuat harga emas dari Galeri24.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Update otomatis Nilai Saldo semua aset emas (gram × harga/gram terbaru)
  useEffect(() => {
    if (!goldPrice) return;
    // Harga fallback (situs gagal diambil) tidak dipakai untuk menimpa nilai aset.
    if (goldPrice.stale) return;
    const fresh = goldPrice.sellPricePerGram;
    const goldAssets = assets.filter(
      (a) => a.isGold && a.goldQtyGr != null && a.goldQtyGr > 0 && a.pricePerGram !== fresh
    );
    if (goldAssets.length === 0) return;
    for (const a of goldAssets) {
      void updateAssetItem(a.id, {
        goldQtyGr: a.goldQtyGr,
        pricePerGram: fresh,
        value: computeGoldValue(a.goldQtyGr as number, fresh),
        lastUpdated: new Date().toISOString().slice(0, 10),
      });
    }
  }, [goldPrice, assets, updateAssetItem]);

  const handleRefreshGoldPrice = async () => {
    setGoldLoading(true);
    setGoldError(null);
    const p = await getGoldPrice(true);
    setGoldLoading(false);
    if (p) {
      setGoldPrice(p);
      // Jika stale fallback, beri info ringan bukan error merah
      if (p.stale) {
        setGoldError(null);
      }
    } else {
      setGoldError('Gagal mengambil harga terbaru dari Galeri24. Coba lagi nanti.');
    }
  };

  // Harga pasar: tombol ini, muat halaman, dan poll 30 dtk memakai siklus yang sama
  // (satu batch, tidak menulis ulang harga yang sama).
  const handleRefreshStockPrices = async () => {
    if (stockHoldings.length === 0) return;
    const outcome = await refreshMarket(
      () => stockHoldings,
      (updates) => applyStockMarketPrices(updates),
      { force: true }
    );
    if (outcome.skipped) return;
    if (outcome.updated.length > 0) {
      setSuccessMessage(
        `Harga diperbarui: ${outcome.updated.map((r) => `${r.ticker} ${formatRupiah(r.price)}`).join(', ')}`
      );
    } else if (outcome.failed.length === 0) {
      setSuccessMessage('Harga pasar sudah terbaru — tidak ada yang berubah.');
    }
  };

  const handleRefreshSingleStockPrice = async (h: StockHolding) => {
    const outcome = await refreshMarket(
      () => [h],
      (updates) => applyStockMarketPrices(updates),
      { force: true }
    );
    if (outcome.skipped) return;
    const hit = outcome.updated.find((r) => r.ticker.toUpperCase() === h.ticker.toUpperCase());
    if (hit) {
      setSuccessMessage(`Harga ${h.ticker} diperbarui ke ${formatRupiah(hit.price)} (dari market).`);
    } else if (!outcome.failed.includes(h.ticker.toUpperCase())) {
      setSuccessMessage(`Harga ${h.ticker} sudah terbaru (${formatRupiah(h.marketPrice)}).`);
    }
  };

  // Poll 30 dtk hanya saat kartu Setup ini terpasang dan opsi Realtime nyala.
  useEffect(() => {
    setMarketPollEnabled(isRealtimeEnabled && stockHoldings.length > 0);
    return () => setMarketPollEnabled(false);
  }, [isRealtimeEnabled, stockHoldings.length]);

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const result = await parseMoneyLoverFile(buffer);
      setParseResult(result);
      if (result.errors.length > 0) {
        setErrorMessage(result.errors.join(' '));
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal memproses file spreadsheet .xlsx.'
      );
      setParseResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadSample = () => {
    const buffer = generateSampleMoneyLoverWorkbook();
    const blob = new Blob([buffer as unknown as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finance-hub-sample.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCommitImport = async () => {
    if (!parseResult) return;
    const validRows = parseResult.rows.filter((r) => r.isValid);

    const toImport = validRows.map((r) => ({
      date: r.date,
      amount: r.amount,
      category: r.category,
      type: r.type,
      wallet: r.wallet,
      note: r.note,
      isExcludeReport: r.isExcludeReport,
    }));

    await addBulkTransactions(toImport);
    setSuccessMessage(`Berhasil mengimpor ${toImport.length} transaksi ke database.`);
    setParseResult(null);
    setFileName(null);
  };

  const handleStartEditAsset = (asset: AssetItem) => {
    const isGold = Boolean(asset.isGold || asset.name === 'Emas Fisik');
    setEditingAssetId(asset.id);
    setEditDraft({
      name: asset.name,
      displayName: asset.displayName,
      category: asset.category,
      valueStr: String(asset.value),
      isGold,
      goldQtyStr: asset.goldQtyGr != null ? String(asset.goldQtyGr) : '',
      priceStr:
        asset.pricePerGram != null
          ? String(asset.pricePerGram)
          : goldPrice
            ? String(goldPrice.sellPricePerGram)
            : '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingAssetId || !editDraft) return;

    const current = assets.find((a) => a.id === editingAssetId);
    if (!current) return;

    // ── Ganti nama wadah ──
    // Nama kosong → pakai nama lama (jangan simpan wadah tanpa nama).
    const oldName = (current.name || '').trim();
    const newName = editDraft.name.trim() || oldName;
    const renamed = newName !== oldName;
    // Keterangan Akun yang masih cermin nama lama (default saat tambah wadah) ikut
    // berganti, kecuali user mengubahnya sendiri di form ini.
    const oldDisplay = (current.displayName || '').trim();
    const draftDisplay = editDraft.displayName.trim();
    const newDisplay =
      renamed && draftDisplay === oldDisplay && (oldDisplay === '' || oldDisplay === oldName)
        ? newName
        : draftDisplay || newName;
    if (renamed) {
      // Transaksi & target menyimpan nama wadah sebagai teks → ikut diganti (cascade).
      const plan = planWadahRename(oldName, newName, transactions, recoveryItems);
      const builtIn = (ASSET_WALLETS as readonly string[]).includes(oldName);
      const lines = [
        `Ganti nama wadah "${oldName}" → "${newName}"?`,
        `${plan.txChanges.length} transaksi dan ${plan.targetChanges.length} target akan ikut diganti ke nama baru (hanya nama, nominal tidak berubah).`,
        plan.keywordLinkLost.length > 0
          ? `⚠ Nama baru tidak lagi mengandung kata kunci tujuan — target ini bisa lepas dari wadahnya: ${plan.keywordLinkLost.join(', ')}.`
          : '',
        builtIn
          ? `⚠ "${oldName}" adalah nama wadah bawaan yang dipakai sinkron transfer, saham, emas, dan piutang. Mengganti namanya bisa memutus sinkron otomatis itu.`
          : '',
      ].filter(Boolean);
      if (!window.confirm(lines.join('\n\n'))) return;
    }

    let assetDelta = 0;
    let updatedAsset: Partial<AssetItem> = {};

    if (editDraft.isGold) {
      const qty = parseDecimal(editDraft.goldQtyStr);
      const price = digitPrice(editDraft.priceStr) || current.pricePerGram || 0;
      if (qty && qty > 0) {
        updatedAsset = {
          name: newName as AssetWallet,
          displayName: newDisplay,
          category: editDraft.category,
          value: computeGoldValue(qty, price),
          isGold: true,
          goldQtyGr: qty,
          pricePerGram: price,
          lastUpdated: new Date().toISOString().slice(0, 10),
        };
        // Delta dihitung dari perubahan jumlah gram saja (perubahan harga ≠ transaksi)
        assetDelta = (qty - (current.goldQtyGr ?? 0)) * price;
      } else {
        // Jumlah gram masih kosong → pertahankan nilai manual yang sudah ada
        updatedAsset = {
          name: newName as AssetWallet,
          displayName: newDisplay,
          category: editDraft.category,
          value: current.value,
          isGold: true,
        };
      }
    } else {
      updatedAsset = {
        name: newName as AssetWallet,
        displayName: newDisplay,
        category: editDraft.category,
        value: digitPrice(editDraft.valueStr) || 0,
        isGold: false,
      };
      assetDelta = (digitPrice(editDraft.valueStr) || 0) - current.value;
    }

    if (renamed) {
      const res = await renameAssetCascade(editingAssetId, updatedAsset as Partial<AssetItem>, oldName, newName);
      if (!res.ok) {
        toast(res.error || 'Gagal ganti nama wadah.', 'err');
        return; // tetap di mode edit, tidak ada yang berubah
      }
      toast(
        `Nama wadah diganti ke "${newName}" · ${res.txCount} transaksi & ${res.targetCount} target ikut diperbarui.`,
        'ok'
      );
    } else {
      await updateAssetItem(editingAssetId, updatedAsset as Partial<AssetItem>);
    }

    // MODUL SYNC: perubahan nilai aset → transaksi otomatis di Cashflow
    // (skipAssetSync=true: nilai aset sudah final di atas, tanpa efek ganda)
    if (Math.abs(assetDelta) >= 1) {
      const cashName = assets.find(
        (a) =>
          a.id !== editingAssetId &&
          a.category === 'likuid' &&
          !a.isGold &&
          !isPiutangAsset(a) &&
          a.name !== 'Saham'
      )?.name;
      const draft = buildAssetDeltaTransaction(
        { ...current, ...updatedAsset } as AssetItem,
        assetDelta,
        cashName
      );
      if (draft) {
        await addTransaction({
          date: new Date().toISOString().split('T')[0],
          amount: draft.amount,
          category: draft.category,
          type: draft.type,
          wallet: draft.wallet,
          note: draft.note,
          isExcludeReport: draft.isExcludeReport,
          skipAssetSync: true,
        });
        // Pelunasan via edit langsung: piutang sudah dikurangi di atas,
        // masukkan juga ke kas (dompet draft) agar netral — cermin logika Cashflow.
        if (draft.type === 'Income' && draft.category === 'Pelunasan Piutang') {
          const w = (draft.wallet || '').trim().toLowerCase();
          const hay = (a: AssetItem) => `${a.name || ''} ${a.displayName || ''}`.toLowerCase();
          const cash =
            assets.find((a) => a.name === draft.wallet || a.displayName === draft.wallet) ??
            assets.find((a) => a.name.toLowerCase() === w) ??
            (w.includes('bibit') || w.includes('rdn') || w.includes('stockbit')
              ? assets.find((a) => /rdn|stockbit/i.test(hay(a))) ?? assets.find((a) => /bibit/i.test(hay(a)))
              : w.includes('mandiri')
                ? assets.find((a) => /mandiri/i.test(hay(a)))
                : w.includes('jago')
                  ? assets.find((a) => /jago/i.test(hay(a)))
                  : assets.find((a) => a.name.toLowerCase().includes(w)));
          if (cash && cash.id !== editingAssetId) {
            const today = new Date().toISOString().slice(0, 10);
            await updateAssetItem(cash.id, {
              value: Math.max(0, Math.round(cash.value + draft.amount)),
              lastUpdated: today,
            });
            setSuccessMessage(
              `Aset diperbarui & transaksi ${draft.category} (${formatRupiah(draft.amount)}) otomatis tercatat di Cashflow — kas ${cash.name} nambah ${formatRupiah(draft.amount)}.`
            );
          } else {
            setSuccessMessage(
              `Aset diperbarui & transaksi ${draft.category} (${formatRupiah(draft.amount)}) otomatis tercatat di Cashflow.`
            );
          }
        } else {
          setSuccessMessage(
            `Aset diperbarui & transaksi ${draft.category} (${formatRupiah(draft.amount)}) otomatis tercatat di Cashflow.`
          );
        }
      }
    }

    setEditingAssetId(null);
    setEditDraft(null);
  };

  const handleCancelEdit = () => {
    setEditingAssetId(null);
    setEditDraft(null);
  };

  const handleAddAsset = async () => {
    if (!addDraft.name.trim()) return;

    let assetDelta = 0;
    let assetData: Omit<AssetItem, 'id'>;

    if (addDraft.isGold) {
      const qty = parseDecimal(addDraft.goldQtyStr);
      const price = digitPrice(addDraft.goldPriceStr);
      if (!qty || qty <= 0 || price <= 0) return;
      assetDelta = qty * price;
      assetData = {
        name: addDraft.name.trim() as AssetWallet,
        displayName: addDraft.displayName.trim() || addDraft.name.trim(),
        category: addDraft.category,
        subCategory: 'emas',
        value: computeGoldValue(qty, price),
        details: '',
        isGold: true,
        goldQtyGr: qty,
        pricePerGram: price,
        lastUpdated: new Date().toISOString().slice(0, 10),
      };
    } else {
      const value = digitPrice(addDraft.valueStr);
      assetDelta = value;
      assetData = {
        name: addDraft.name.trim() as AssetWallet,
        displayName: addDraft.displayName.trim() || addDraft.name.trim(),
        category: addDraft.category,
        subCategory: addDraft.category === 'likuid' ? 'bank' : 'investasi',
        value,
        details: '',
      };
    }

    await addAssetItem(assetData);

    // MODUL SYNC: penambahan aset → transaksi pencatatan awal di Cashflow
    if (Math.abs(assetDelta) >= 1) {
      const cashName = assets.find(
        (a) => a.category === 'likuid' && !a.isGold && !isPiutangAsset(a) && a.name !== 'Saham'
      )?.name;
      const draft = buildAssetDeltaTransaction(assetData as AssetItem, assetDelta, cashName);
      if (draft) {
        await addTransaction({
          date: new Date().toISOString().split('T')[0],
          amount: draft.amount,
          category: draft.category,
          type: draft.type,
          wallet: draft.wallet,
          note: draft.note,
          isExcludeReport: draft.isExcludeReport,
          skipAssetSync: true,
        });
        setSuccessMessage(
          `Wadah aset ditambahkan & transaksi ${draft.category} (${formatRupiah(draft.amount)}) otomatis tercatat di Cashflow.`
        );
      }
    }

    setAddDraft({
      name: '',
      displayName: '',
      category: 'likuid',
      valueStr: '',
      isGold: false,
      goldQtyStr: '',
      goldPriceStr: '',
    });
    setIsAddAssetOpen(false);
  };

  const handleConfirmResetDb = () => {
    resetDatabase();
    setIsResetModalOpen(false);
    setSuccessMessage('Seluruh data transaksi telah dihapus. Database bersih & siap diimpor.');
  };

  // Setiap tambah/ubah/hapus langsung tulis ke Supabase (tidak perlu push manual).
  const handleDeleteAsset = async (asset: AssetItem) => {
    if (
      confirm(
        `Hapus wadah aset "${asset.displayName || asset.name}" (${formatRupiah(asset.value)})?\nNilai akan dihapus dari Total Aset, Overview, dan Asset Allocation.`
      )
    ) {
      await deleteAssetItem(asset.id);
    }
  };

  const handleAddStock = async () => {
    const ticker = addStockDraft.ticker.trim().toUpperCase();
    const lots = parseDecimal(addStockDraft.lotStr);
    const buy = parsePrice(addStockDraft.buyStr);
    const market = parsePrice(addStockDraft.marketStr) || buy;
    if (!ticker || !lots || lots <= 0 || !buy || buy <= 0 || !market || market <= 0) return;

    await addStockHolding({
      ticker,
      lots,
      buyPrice: buy,
      marketPrice: market,
      category: addStockDraft.category,
      strategy: addStockDraft.strategy,
    });
    setSuccessMessage(
      `Saham ${ticker} ditambahkan (${lots} lot · ${addStockDraft.strategy} · nilai pasar ${formatRupiah(getStockMarketValue({ lots, marketPrice: market }))}). Transaksi Beli Saham tercatat di Cashflow, aset 'Saham' sinkron & kas akun likuid berkurang bila ada.`
    );
    setAddStockDraft({ ticker: '', lotStr: '', buyStr: '', marketStr: '', category: 'non_likuid', strategy: 'Long-Term' });
    setIsAddStockOpen(false);
  };

  const handleStartStockEdit = (h: StockHolding) => {
    setEditingStockId(h.id);
    setEditStockDraft({
      ticker: h.ticker,
      lotStr: String(h.lots),
      buyStr: String(h.buyPrice),
      marketStr: String(h.marketPrice),
      category: h.category ?? 'non_likuid',
      strategy: h.strategy ?? 'Long-Term',
    });
  };

  const handleSaveStockEdit = async () => {
    if (!editingStockId || !editStockDraft) return;
    const current = stockHoldings.find((h) => h.id === editingStockId);
    if (!current) return;

    const lots = parseDecimal(editStockDraft.lotStr);
    const buy = parsePrice(editStockDraft.buyStr) || current.buyPrice;
    const market = parsePrice(editStockDraft.marketStr) || current.marketPrice;
    const ticker = editStockDraft.ticker.trim().toUpperCase() || current.ticker;
    if (!lots || lots <= 0 || !buy || buy <= 0 || !market || market <= 0) return;

    await updateStockHolding(editingStockId, {
      ticker,
      lots,
      buyPrice: buy,
      marketPrice: market,
      category: editStockDraft.category,
      strategy: editStockDraft.strategy,
    });
    setSuccessMessage(
      `Saham ${ticker} diperbarui (${editStockDraft.strategy}). Nilai investasi, P&L & total equity dihitung ulang — kurangi lot = Jual → kas akun likuid nambah, tambah lot = Beli → kas berkurang.`
    );
    setEditingStockId(null);
    setEditStockDraft(null);
  };

  const handleCancelStockEdit = () => {
    setEditingStockId(null);
    setEditStockDraft(null);
  };

  const handleDeleteStock = async (h: StockHolding) => {
    if (
      confirm(
        `Hapus saham ${h.ticker} (${h.lots} lot · nilai pasar ${formatRupiah(getStockMarketValue(h))})?\nPelepasan ini otomatis tercatat sebagai transaksi Jual Saham di Cashflow.`
      )
    ) {
      await deleteStockHolding(h.id);
      setSuccessMessage(
        `Saham ${h.ticker} dihapus. Transaksi Jual Saham (${formatRupiah(getStockMarketValue(h))}) tercatat di Cashflow, kas akun likuid nambah bila ada & realisasi target recovery ikut tersinkron.`
      );
    }
  };

  return (
    <div className="kgrid setup-grid">
      {/* 0. Cloud Sync (Supabase only — semua browser sama) */}
      <div className="glass card s12 setup-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <RefreshCw className="h-4 w-4 text-[#1A1A1A]" />
              <h3 className="sec-ttl">
                Cloud Sync (Supabase only — semua browser sama)
              </h3>
              <span
                className={`badge border text-[10px] ${
                  isSupabaseActive
                    ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]'
                    : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                }`}
              >
                {isSupabaseActive ? 'Supabase aktif' : 'Supabase mati'}
              </span>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {transactions.length} transaksi · {assets.length} wadah aset · {stockHoldings.length} saham —
              tiap tambah/ubah/hapus langsung tersimpan ke Supabase, semua device baca sumber yang sama.
            </p>
            {supabaseError && (
              <div className="mt-2 p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Supabase error: {supabaseError}</p>
                  <p className="mt-1 text-[11px] leading-relaxed">
                    Kalau di Supabase Table Editor datanya ADA tapi di sini 0: (1) jalankan{' '}
                    <code className="font-mono bg-white px-1 rounded border">supabase/schema.sql</code> di
                    Supabase → SQL Editor → Run (policy anon_full_access), (2) cek Vercel → Settings →
                    Environment Variables (NEXT_PUBLIC_SUPABASE_URL &amp; ANON_KEY) → Redeploy, (3) buka
                    Console browser (F12) lihat [Supabase] select ... error.
                  </p>
                </div>
              </div>
            )}
            {writeError && (
              <div className="mt-2 p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="font-semibold flex-1">{writeError}</p>
                <button
                  onClick={clearWriteError}
                  className="p-0.5 rounded hover:bg-white shrink-0"
                  title="Tutup peringatan"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => window.location.reload()}
              className="h-8 px-3 rounded-lg border border-[#E5E5E3] bg-white text-xs text-[#374151] hover:bg-[#F1F1EF] transition flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh dari Supabase</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Kelola Saldo Akun / Wadah Aset */}
      <div className={`glass card setup-card ${parseResult ? 's12' : 's8'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-[#E5E5E3]">
          <div>
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-[#1A1A1A]" />
              <h3 className="sec-ttl">
                Kelola Saldo Aset & Modal (Account Assets)
              </h3>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Tambah, ubah, atau hapus wadah aset · tersimpan otomatis &amp; sinkron real-time ke
              Overview dan Asset Allocation
            </p>
          </div>

          <button
            onClick={() => setIsAddAssetOpen((v) => !v)}
            className={`h-8 px-3 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 self-start sm:self-auto ${
              isAddAssetOpen
                ? 'bg-[#F1F1EF] text-[#1A1A1A] border border-[#CDCDC9] hover:bg-[#E5E5E3]'
                : 'bg-[#1A1A1A] text-white hover:bg-black shadow-sm'
            }`}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span>{isAddAssetOpen ? 'Tutup Form Tambah' : 'Tambah Wadah Aset'}</span>
          </button>
        </div>

        {/* Strip Harga Emas */}
        <div className="mt-4 rounded-lg border border-[#E5E5E3] bg-[#FBFBFA] px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Coins className="h-4 w-4 shrink-0 text-[#B45309]" />
            <div className="min-w-0">
              <p className="text-xs text-[#6B7280] flex flex-wrap items-center gap-x-1.5">
                Harga buyback emas per gram:
                <strong className="text-[#1A1A1A] font-bold">
                  {goldPrice ? formatRupiah(goldPrice.sellPricePerGram) : '—'}
                </strong>
                {goldPrice && (
                  <a
                    href={goldPrice.sourceUrl || 'https://galeri24.co.id/harga-emas#ANTAM'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono text-[#9CA3AF] hover:underline"
                    title="Sumber harga: Galeri24 · ANTAM · 1 gram · Harga Buyback"
                  >
                    · {goldPrice.source === 'galeri24' ? 'Galeri24 · ANTAM buyback' : 'Logam Mulia'} ·{' '}
                    {formatDateIndo(goldPrice.recordedDate)}
                  </a>
                )}
              </p>
              <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                Nilai Saldo Aset Emas = jumlah gram × harga buyback ANTAM 1 gram (Galeri24). Diperbarui otomatis tiap hari mengikuti harga terbaru di situs.
              </p>
              {goldPrice?.stale && (
                <p className="text-[10px] text-[#B45309] mt-0.5">
                  ⚠ Harga terbaru Galeri24 belum bisa diambil — memakai harga terakhir
                  {goldPrice.updatedLabel ? ` (${goldPrice.updatedLabel})` : ''}. Nilai aset emas tidak diubah otomatis.
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleRefreshGoldPrice}
            disabled={goldLoading}
            className="h-8 px-3 rounded-lg border border-[#E5E5E3] bg-white text-xs text-[#374151] hover:bg-[#F1F1EF] disabled:opacity-50 disabled:cursor-wait transition flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-[#B45309] ${goldLoading ? 'animate-spin' : ''}`}
            />
            <span>{goldLoading ? 'Memuat Harga...' : 'Cek Harga Terbaru'}</span>
          </button>
        </div>

        {goldError && (
          <p className="mt-2 text-[11px] text-[#B91C1C] flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {goldError}
          </p>
        )}

        {/* ── Mobile: form tambah + daftar kartu wadah aset ── */}
        <div className="md:hidden mt-4">
          {isAddAssetOpen && (
            <div className="mb-1 rounded-2xl border border-[#BFDBFE] bg-[#F8FAFF] p-3.5 space-y-2.5">
              <p className="text-[12px] font-bold text-[#1A1A1A] flex items-center gap-2">
                <span className="h-6 w-6 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                Wadah Aset Baru
              </p>
              <input
                value={addDraft.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setAddDraft((d) => ({
                    ...d,
                    name,
                    isGold: d.isGold || name.trim() === 'Emas Fisik',
                    goldPriceStr:
                      !d.goldPriceStr && name.trim() === 'Emas Fisik' && goldPrice
                        ? String(goldPrice.sellPricePerGram)
                        : d.goldPriceStr,
                  }));
                }}
                placeholder="Nama wadah"
                className="asset-input w-full"
              />
              <input
                value={addDraft.displayName}
                onChange={(e) => setAddDraft((d) => ({ ...d, displayName: e.target.value }))}
                placeholder="Keterangan akun"
                className="asset-input w-full"
              />
              <div className="grid grid-cols-2 gap-2.5 items-center">
                <select
                  value={addDraft.category}
                  onChange={(e) => setAddDraft((d) => ({ ...d, category: e.target.value as AssetCategory }))}
                  className="asset-input w-full"
                >
                  <option value="likuid">Likuid</option>
                  <option value="non_likuid">Non-Likuid</option>
                </select>
                <label className="flex items-center gap-1.5 text-[10px] text-[#6B7280] cursor-pointer select-none font-sans">
                  <input
                    type="checkbox"
                    checked={addDraft.isGold}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAddDraft((d) => ({
                        ...d,
                        isGold: checked,
                        goldPriceStr:
                          checked && !d.goldPriceStr && goldPrice
                            ? String(goldPrice.sellPricePerGram)
                            : d.goldPriceStr,
                      }));
                      if (checked && !goldPrice) handleRefreshGoldPrice();
                    }}
                    className="accent-[#1A1A1A]"
                  />
                  Aset emas · gram
                </label>
              </div>
              {addDraft.isGold ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <input
                      inputMode="decimal"
                      value={addDraft.goldQtyStr}
                      onChange={(e) =>
                        setAddDraft((d) => ({ ...d, goldQtyStr: e.target.value.replace(/[^0-9.,]/g, '') }))
                      }
                      placeholder="0"
                      className="asset-input min-w-0 flex-1 text-right"
                    />
                    <span className="text-[10px] text-[#9CA3AF] shrink-0">gr</span>
                    <span className="text-[#9CA3AF] shrink-0">×</span>
                    <input
                      inputMode="numeric"
                      value={formatRupiah(Number(addDraft.goldPriceStr || 0), false)}
                      onChange={(e) =>
                        setAddDraft((d) => ({ ...d, goldPriceStr: e.target.value.replace(/\D+/g, '') }))
                      }
                      placeholder="0"
                      className="asset-input min-w-0 flex-1 text-right"
                    />
                    <span className="text-[10px] text-[#9CA3AF] shrink-0">/gr</span>
                  </div>
                  <p className="text-[10px] font-mono text-[#6B7280]">
                    = {formatRupiah(computeGoldValue(addGoldQty, addGoldPrice))}
                  </p>
                </>
              ) : (
                <input
                  inputMode="numeric"
                  value={formatRupiah(Number(addDraft.valueStr || 0), false)}
                  onChange={(e) => setAddDraft((d) => ({ ...d, valueStr: e.target.value.replace(/\D+/g, '') }))}
                  placeholder="0"
                  className="asset-input w-full text-right"
                />
              )}
              <div className="flex gap-2 pt-0.5">
                <button
                  onClick={handleAddAsset}
                  disabled={!addDraft.name.trim() || (addDraft.isGold && (!addGoldQty || !addGoldPrice))}
                  className="flex-1 h-9 rounded-xl bg-[#1A1A1A] text-white text-xs font-bold disabled:opacity-40 transition flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  <Check className="h-4 w-4" /> Simpan
                </button>
                <button
                  onClick={() => setIsAddAssetOpen(false)}
                  className="h-9 px-4 rounded-xl border border-[#E5E5E3] bg-white text-xs font-semibold text-[#6B7280] hover:text-[#1A1A1A] transition"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-[#F1F3FA]">
            {sortedAssets.map((asset, i) => {
              const isEditing = editingAssetId === asset.id;
              const iconKey = getAssetIconKey(asset.name, asset.isGold);
              const RowIcon = ASSET_ICON_MAP[iconKey] ?? Wallet;
              const tint = ASSET_CATEGORY_TINT[iconKey] ?? ASSET_TINT_FALLBACK;
              const editGoldQty =
                isEditing && editDraft?.isGold ? (parseDecimal(editDraft.goldQtyStr) ?? 0) : 0;
              const editGoldPrice =
                isEditing && editDraft?.isGold ? digitPrice(editDraft.priceStr ?? '') : 0;
              const editComputed = computeGoldValue(editGoldQty, editGoldPrice);
              return (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 26, delay: Math.min(i * 0.015, 0.12) }}
                  className="py-3"
                >
                  <button
                    type="button"
                    onClick={() => (isEditing ? handleCancelEdit() : handleStartEditAsset(asset))}
                    className="w-full flex items-center gap-3 text-left"
                  >
                    <span
                      className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${tint}1A`, color: tint }}
                    >
                      <RowIcon className="h-5 w-5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-[#1A1A1A] truncate">{asset.name}</span>
                        {asset.isGold && (
                          <span className="badge shrink-0 border border-[#FCD34D] bg-[#FEF3C7] text-[#B45309]">
                            Emas
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <span
                          className={`badge border text-[9px] ${
                            asset.category === 'likuid'
                              ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]'
                              : 'bg-[#F7F7F5] text-[#6B7280] border-[#E5E5E3]'
                          }`}
                        >
                          {asset.category === 'likuid' ? 'Likuid' : 'Non-Likuid'}
                        </span>
                        {asset.displayName && (
                          <span className="text-[10px] text-[#9CA3AF] truncate">{asset.displayName}</span>
                        )}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="money r block text-sm font-bold text-[#1A1A1A] whitespace-nowrap">
                        {formatRupiah(asset.value)}
                      </span>
                      {asset.isGold && asset.goldQtyGr != null && asset.pricePerGram != null && (
                        <span className="block text-[9px] font-mono text-[#9CA3AF] whitespace-nowrap">
                          {formatGoldQty(asset.goldQtyGr)} × {formatRupiah(asset.pricePerGram)}
                        </span>
                      )}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-[#9CA3AF] shrink-0 transition-transform ${isEditing ? 'rotate-180' : ''}`}
                    />
                  </button>

                  <AnimatePresence>
                    {isEditing && editDraft && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 rounded-2xl border border-[#BFDBFE] bg-[#F8FAFF] p-3.5 space-y-2.5">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-[#6B7280]">
                            Ubah Wadah
                          </p>
                          <div className="grid grid-cols-2 gap-2.5">
                            <input
                              value={editDraft.name}
                              onChange={(e) => setEditDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                              className="asset-input w-full"
                            />
                            <input
                              value={editDraft.displayName}
                              onChange={(e) => setEditDraft((d) => (d ? { ...d, displayName: e.target.value } : d))}
                              className="asset-input w-full"
                            />
                            <select
                              value={editDraft.category}
                              onChange={(e) =>
                                setEditDraft((d) => (d ? { ...d, category: e.target.value as AssetCategory } : d))
                              }
                              className="asset-input w-full"
                            >
                              <option value="likuid">Likuid</option>
                              <option value="non_likuid">Non-Likuid</option>
                            </select>
                            <label className="flex items-center gap-1.5 text-[10px] text-[#6B7280] cursor-pointer select-none font-sans">
                              <input
                                type="checkbox"
                                checked={editDraft.isGold}
                                onChange={(e) =>
                                  setEditDraft((d) => (d ? { ...d, isGold: e.target.checked } : d))
                                }
                                className="accent-[#1A1A1A]"
                              />
                              Aset emas · gram
                            </label>
                          </div>
                          {editDraft.isGold ? (
                            <>
                              <div className="flex items-center gap-1.5">
                                <input
                                  inputMode="decimal"
                                  value={editDraft.goldQtyStr}
                                  onChange={(e) =>
                                    setEditDraft((d) =>
                                      d ? { ...d, goldQtyStr: e.target.value.replace(/[^0-9.,]/g, '') } : d
                                    )
                                  }
                                  placeholder="0"
                                  className="asset-input min-w-0 flex-1 text-right"
                                />
                                <span className="text-[10px] text-[#9CA3AF] shrink-0">gr</span>
                                <span className="text-[#9CA3AF] shrink-0">×</span>
                                <input
                                  inputMode="numeric"
                                  value={formatRupiah(Number(editDraft.priceStr || 0), false)}
                                  onChange={(e) =>
                                    setEditDraft((d) =>
                                      d ? { ...d, priceStr: e.target.value.replace(/\D+/g, '') } : d
                                    )
                                  }
                                  placeholder="0"
                                  className="asset-input min-w-0 flex-1 text-right"
                                />
                                <span className="text-[10px] text-[#9CA3AF] shrink-0">/gr</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const p = goldPrice?.sellPricePerGram;
                                    if (p) {
                                      setEditDraft((d) => (d ? { ...d, priceStr: String(p) } : d));
                                    } else {
                                      handleRefreshGoldPrice();
                                    }
                                  }}
                                  disabled={goldLoading}
                                  className="text-[10px] font-mono text-[#B45309] disabled:opacity-40"
                                >
                                  {goldLoading
                                    ? 'muat harga...'
                                    : goldPrice
                                      ? `Pakai ${formatRupiah(goldPrice.sellPricePerGram)}`
                                      : 'Ambil harga terbaru'}
                                </button>
                                <span className="text-[10px] font-mono text-[#6B7280]">
                                  = {formatRupiah(editComputed)}
                                </span>
                              </div>
                            </>
                          ) : (
                            <input
                              inputMode="numeric"
                              value={formatRupiah(Number(editDraft.valueStr || 0), false)}
                              onChange={(e) =>
                                setEditDraft((d) =>
                                  d ? { ...d, valueStr: e.target.value.replace(/\D+/g, '') } : d
                                )
                              }
                              className="asset-input w-full text-right"
                            />
                          )}
                          <div className="flex gap-2 pt-0.5">
                            <button
                              onClick={handleSaveEdit}
                              className="flex-1 h-9 rounded-xl bg-[#1A1A1A] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-[0.98]"
                            >
                              <Check className="h-4 w-4" /> Simpan
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="h-9 px-4 rounded-xl border border-[#E5E5E3] bg-white text-xs font-semibold text-[#6B7280] hover:text-[#1A1A1A] transition"
                            >
                              Batal
                            </button>
                            <button
                              onClick={() => handleDeleteAsset(asset)}
                              className="h-9 w-9 shrink-0 rounded-xl border border-[#FECACA] bg-white text-[#DC2626] hover:bg-[#FFF7F7] transition flex items-center justify-center"
                              title="Hapus wadah"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {sortedAssets.length === 0 && !isAddAssetOpen && (
              <div className="py-8 text-center">
                <p className="text-xs text-[#9CA3AF] leading-relaxed">
                  Belum ada wadah aset. Tambah satu untuk mengisi saldo manual.
                </p>
                <button
                  onClick={() => setIsAddAssetOpen(true)}
                  className="mt-2 h-8 px-3 rounded-lg bg-[#1A1A1A] text-white text-xs font-semibold"
                >
                  + Tambah Wadah Aset
                </button>
              </div>
            )}
          </div>

          {assets.length > 0 && (
            <div className="mt-3 rounded-2xl border border-[#E5E5E3] bg-[#FBFBFA] px-3.5 py-2.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] uppercase tracking-wider font-semibold text-[#9CA3AF]">Total Aset</p>
                <p className="money text-sm font-bold text-[#1A1A1A] font-mono whitespace-nowrap">
                  {formatRupiah(totalAssets)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-mono text-[#059669] whitespace-nowrap">
                  Likuid <span className="money">{formatRupiah(liquidTotal)}</span>
                </p>
                <p className="text-[9px] font-mono text-[#9CA3AF] whitespace-nowrap">
                  Non-Likuid <span className="money">{formatRupiah(nonLiquidTotal)}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="hidden md:block mt-4 overflow-x-auto">
          <table className="notion-table">
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    onClick={() => toggleAssetSort('name')}
                    className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-[#1A1A1A] transition"
                    title="Urutkan Wadah A-Z / Z-A"
                  >
                    <span>Wadah Aset</span>
                    {assetSortKey === 'name' ? (
                      assetSortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </th>
                <th>Keterangan Akun</th>
                <th>Kategori</th>
                <th className="text-right">
                  <button
                    type="button"
                    onClick={() => toggleAssetSort('value')}
                    className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-[#1A1A1A] transition ml-auto"
                    title="Urutkan Nilai terkecil ↔ terbesar"
                  >
                    <span>Nilai Saldo (IDR)</span>
                    {assetSortKey === 'value' ? (
                      assetSortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </th>
                <th className="text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {/* Add-asset row */}
              {isAddAssetOpen && (
                <tr className="bg-[#F7F7F5]">
                  <td>
                    <input
                      value={addDraft.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setAddDraft((d) => ({
                          ...d,
                          name,
                          isGold: d.isGold || name.trim() === 'Emas Fisik',
                          goldPriceStr:
                            !d.goldPriceStr && name.trim() === 'Emas Fisik' && goldPrice
                              ? String(goldPrice.sellPricePerGram)
                              : d.goldPriceStr,
                        }));
                      }}
                      placeholder="Nama wadah"
                      className="asset-input w-28"
                    />
                  </td>
                  <td>
                    <input
                      value={addDraft.displayName}
                      onChange={(e) =>
                        setAddDraft((d) => ({ ...d, displayName: e.target.value }))
                      }
                      placeholder="Keterangan akun"
                      className="asset-input w-36"
                    />
                  </td>
                  <td>
                    <select
                      value={addDraft.category}
                      onChange={(e) =>
                        setAddDraft((d) => ({ ...d, category: e.target.value as AssetCategory }))
                      }
                      className="asset-input h-7"
                    >
                      <option value="likuid">Likuid</option>
                      <option value="non_likuid">Non-Likuid</option>
                    </select>
                    <label className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[#6B7280] cursor-pointer select-none font-sans">
                      <input
                        type="checkbox"
                        checked={addDraft.isGold}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setAddDraft((d) => ({
                            ...d,
                            isGold: checked,
                            goldPriceStr:
                              checked && !d.goldPriceStr && goldPrice
                                ? String(goldPrice.sellPricePerGram)
                                : d.goldPriceStr,
                          }));
                          if (checked && !goldPrice) handleRefreshGoldPrice();
                        }}
                        className="accent-[#1A1A1A]"
                      />
                      Aset emas · gram
                    </label>
                  </td>
                  <td className="text-right">
                    {addDraft.isGold ? (
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5">
                          <input
                            inputMode="decimal"
                            value={addDraft.goldQtyStr}
                            onChange={(e) =>
                              setAddDraft((d) => ({
                                ...d,
                                goldQtyStr: e.target.value.replace(/[^0-9.,]/g, ''),
                              }))
                            }
                            placeholder="0"
                            className="asset-input w-20 text-right"
                          />
                          <span className="text-[10px] text-[#9CA3AF]">gr</span>
                          <span className="text-[#9CA3AF]">×</span>
                          <input
                            inputMode="numeric"
                            value={formatRupiah(Number(addDraft.goldPriceStr || 0), false)}
                            onChange={(e) =>
                              setAddDraft((d) => ({
                                ...d,
                                goldPriceStr: e.target.value.replace(/\D+/g, ''),
                              }))
                            }
                            placeholder="0"
                            className="asset-input w-28 text-right"
                          />
                          <span className="text-[10px] text-[#9CA3AF]">/gr</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#6B7280]">
                          = {formatRupiah(computeGoldValue(addGoldQty, addGoldPrice))}
                        </span>
                      </div>
                    ) : (
                      <input
                        inputMode="numeric"
                        value={formatRupiah(Number(addDraft.valueStr || 0), false)}
                        onChange={(e) =>
                          setAddDraft((d) => ({
                            ...d,
                            valueStr: e.target.value.replace(/\D+/g, ''),
                          }))
                        }
                        placeholder="0"
                        className="asset-input w-36 text-right"
                      />
                    )}
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center gap-1">
                      <button
                        onClick={handleAddAsset}
                        disabled={
                          !addDraft.name.trim() ||
                          (addDraft.isGold && (!addGoldQty || !addGoldPrice))
                        }
                        className="p-1 rounded-md hover:bg-white text-[#1A1A1A] disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Tambah"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setIsAddAssetOpen(false)}
                        className="p-1 rounded-md hover:bg-white text-[#6B7280] hover:text-[#1A1A1A]"
                        title="Batal"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  </td>
                </tr>
              )}

              {sortedAssets.map((asset) => {
                const isEditing = editingAssetId === asset.id;
                const editGoldQty =
                  isEditing && editDraft?.isGold ? (parseDecimal(editDraft.goldQtyStr) ?? 0) : 0;
                const editGoldPrice =
                  isEditing && editDraft?.isGold ? digitPrice(editDraft.priceStr ?? '') : 0;
                const editComputed = computeGoldValue(editGoldQty, editGoldPrice);
                return (
                  <tr key={asset.id} className="hover:bg-[#F7F7F5]">
                    <td className="font-semibold text-[#1A1A1A]">
                      {isEditing ? (
                        <input
                          value={editDraft?.name ?? asset.name}
                          onChange={(e) =>
                            setEditDraft((d) => (d ? { ...d, name: e.target.value } : d))
                          }
                          className="asset-input w-28"
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          {asset.name}
                          {asset.isGold && (
                            <span className="badge border border-[#FCD34D] bg-[#FEF3C7] text-[#B45309]">
                              Emas
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="font-sans text-[#6B7280]">
                      {isEditing ? (
                        <input
                          value={editDraft?.displayName ?? asset.displayName}
                          onChange={(e) =>
                            setEditDraft((d) => (d ? { ...d, displayName: e.target.value } : d))
                          }
                          className="asset-input w-36"
                        />
                      ) : (
                        asset.displayName
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div>
                          <select
                            value={editDraft?.category ?? asset.category}
                            onChange={(e) =>
                              setEditDraft((d) =>
                                d ? { ...d, category: e.target.value as AssetCategory } : d
                              )
                            }
                            className="asset-input h-7"
                          >
                            <option value="likuid">Likuid</option>
                            <option value="non_likuid">Non-Likuid</option>
                          </select>
                          <label className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[#6B7280] cursor-pointer select-none font-sans">
                            <input
                              type="checkbox"
                              checked={editDraft?.isGold ?? false}
                              onChange={(e) =>
                                setEditDraft((d) => (d ? { ...d, isGold: e.target.checked } : d))
                              }
                              className="accent-[#1A1A1A]"
                            />
                            Aset emas · gram
                          </label>
                        </div>
                      ) : (
                        <span
                          className={`badge ${
                            asset.category === 'likuid'
                              ? 'bg-[#F1F1EF] text-[#1A1A1A] border border-[#CDCDC9]'
                              : 'bg-[#F7F7F5] text-[#6B7280] border border-[#E5E5E3]'
                          }`}
                        >
                          {asset.category === 'likuid' ? 'Likuid' : 'Non-Likuid'}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      {isEditing ? (
                        editDraft?.isGold ? (
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1.5">
                              <input
                                inputMode="decimal"
                                value={editDraft.goldQtyStr}
                                onChange={(e) =>
                                  setEditDraft((d) =>
                                    d
                                      ? {
                                          ...d,
                                          goldQtyStr: e.target.value.replace(/[^0-9.,]/g, ''),
                                        }
                                      : d
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit();
                                  if (e.key === 'Escape') handleCancelEdit();
                                }}
                                placeholder="0"
                                className="asset-input w-20 text-right"
                              />
                              <span className="text-[10px] text-[#9CA3AF]">gr</span>
                              <span className="text-[#9CA3AF]">×</span>
                              <input
                                inputMode="numeric"
                                value={formatRupiah(Number(editDraft.priceStr || 0), false)}
                                onChange={(e) =>
                                  setEditDraft((d) =>
                                    d
                                      ? {
                                          ...d,
                                          priceStr: e.target.value.replace(/\D+/g, ''),
                                        }
                                      : d
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit();
                                  if (e.key === 'Escape') handleCancelEdit();
                                }}
                                placeholder="0"
                                className="asset-input w-28 text-right"
                              />
                              <span className="text-[10px] text-[#9CA3AF]">/gr</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const p = goldPrice?.sellPricePerGram;
                                  if (p) {
                                    setEditDraft((d) => (d ? { ...d, priceStr: String(p) } : d));
                                  } else {
                                    handleRefreshGoldPrice();
                                  }
                                }}
                                disabled={goldLoading}
                                className="text-[10px] font-mono text-[#B45309] hover:underline disabled:opacity-40"
                                title="Gunakan harga buyback ANTAM 1 gram dari Galeri24"
                              >
                                {goldLoading
                                  ? 'muat harga...'
                                  : goldPrice
                                    ? `Pakai ${formatRupiah(goldPrice.sellPricePerGram)}`
                                    : 'Ambil harga terbaru'}
                              </button>
                              <span className="text-[10px] font-mono text-[#6B7280]">
                                = {formatRupiah(editComputed)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <input
                            inputMode="numeric"
                            autoFocus
                            value={formatRupiah(Number(editDraft?.valueStr || 0), false)}
                            onChange={(e) =>
                              setEditDraft((d) =>
                                d ? { ...d, valueStr: e.target.value.replace(/\D+/g, '') } : d
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            className="asset-input w-36 text-right"
                          />
                        )
                      ) : asset.isGold && asset.goldQtyGr != null && asset.pricePerGram ? (
                        <span className="flex flex-col items-end gap-0.5">
                          <span className="money r text-[#1A1A1A] font-bold">
                            {formatRupiah(asset.value)}
                          </span>
                          <span className="text-[10px] font-mono text-[#9CA3AF]">
                            {formatGoldQty(asset.goldQtyGr)} ×{' '}
                            {formatRupiah(asset.pricePerGram)}
                          </span>
                        </span>
                      ) : (
                        <span className="money r text-[#1A1A1A] font-bold">
                          {formatRupiah(asset.value)}
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      {isEditing ? (
                        <span className="inline-flex items-center justify-center gap-1">
                          <button
                            onClick={handleSaveEdit}
                            className="p-1 rounded-md hover:bg-[#F1F1EF] text-[#1A1A1A]"
                            title="Simpan"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 rounded-md hover:bg-[#F1F1EF] text-[#6B7280] hover:text-[#1A1A1A]"
                            title="Batal"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleStartEditAsset(asset)}
                            className="p-1 text-[#9CA3AF] hover:text-[#1A1A1A] rounded-md hover:bg-[#F1F1EF]"
                            title="Ubah"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAsset(asset)}
                            className="p-1 text-[#9CA3AF] hover:text-[#DC2626] rounded-md hover:bg-[#FEF2F2]"
                            title="Hapus wadah aset"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!isAddAssetOpen && assets.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center">
                    <p className="text-xs text-[#9CA3AF]">
                      Belum ada wadah aset. Klik{' '}
                      <strong className="text-[#6B7280]">+ Tambah Wadah Aset</strong> untuk mengisi
                      saldo secara manual.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>

            {assets.length > 0 && (
              <tfoot>
                <tr className="bg-[#F7F7F5] border-t border-[#E5E5E3]">
                  <td colSpan={3} className="px-3 py-2.5 text-right">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-[#6B7280]">
                      Total Aset (IDR)
                    </p>
                    <p className="text-[10px] text-[#9CA3AF] font-mono">
                      Likuid <span className="money">{formatRupiah(liquidTotal)}</span> · Non-Likuid{' '}
                      <span className="money">{formatRupiah(nonLiquidTotal)}</span>
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-[#1A1A1A]">
                    <span className="money">{formatRupiah(totalAssets)}</span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 1. Importer Section */}
      <div className={`glass card setup-card ${parseResult ? 's12' : 's4'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#E5E5E3] gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#1A1A1A]" />
              <h3 className="sec-ttl">
                Money Lover (.xlsx) Importer
              </h3>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Impor transaksi dari file Money Lover. Nama akun di file sebaiknya sama dengan akun di Setup.
            </p>
          </div>

          <button
            onClick={handleDownloadSample}
            className="h-8 px-3 rounded-lg border border-[#E5E5E3] bg-[#F7F7F5] text-[#374151] text-xs hover:bg-[#F1F1EF] hover:border-[#CDCDC9] transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Download className="h-3.5 w-3.5 text-[#1A1A1A]" />
            <span>Unduh Contoh .xlsx</span>
          </button>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="drop setup-drop"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
            className="hidden"
          />
          <UploadCloud className="drop-ico" />
          <div>
            <b className="drop-ttl">
              {fileName ? fileName : 'Drop file .xlsx Money Lover'}
            </b>
            <p className="drop-sub">atau klik untuk pilih file · 
              Mendukung kolom DATE, CATEGORY, AMOUNT, NOTE, WALLET, EXCLUDE REPORT
            </p>
          </div>
        </div>

        {/* Status Alerts */}
        {isLoading && (
          <div className="mt-3 p-3 rounded-lg bg-[#F7F7F5] border border-[#E5E5E3] text-xs text-[#6B7280] animate-pulse font-mono">
            Sedang membaca dan memetakan data spreadsheet...
          </div>
        )}
        {errorMessage && (
          <div className="mt-3 p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mt-3 p-3 rounded-lg bg-[#F7F7F5] border border-[#E5E5E3] text-xs text-[#374151] flex items-center gap-2 font-mono">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Parse Preview Table */}
        {parseResult && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#1A1A1A] font-mono">
                Terdeteksi: <strong className="text-[#1A1A1A]">{parseResult.validCount}</strong> baris valid
              </span>
              <button
                onClick={handleCommitImport}
                className="h-8 px-4 rounded-lg bg-[#1A1A1A] text-white font-semibold text-xs hover:bg-black transition"
              >
                Konfirmasi & Masukkan ke Database
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto border border-[#E5E5E3] rounded-lg hidden md:block">
              <table className="notion-table">
                <thead className="bg-[#F7F7F5] sticky top-0">
                  <tr>
                    <th>Tanggal</th>
                    <th>Catatan</th>
                    <th>Kategori Hasil Map</th>
                    <th>Akun</th>
                    <th className="text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-[13px]">
                  {parseResult.rows.slice(0, 8).map((r, i) => (
                    <tr key={i} className="hover:bg-[#F7F7F5]">
                      <td className="text-[#6B7280]">{r.date}</td>
                      <td className="text-[#1A1A1A] truncate max-w-[150px]">{r.note}</td>
                      <td className="text-[#374151]">{r.category}</td>
                      <td className="text-[#374151]">{r.wallet}</td>
                      <td className="text-right text-[#1A1A1A]"><span className="money">{formatRupiah(r.amount)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: pratinjau baris impor sebagai list */}
            <div className="md:hidden max-h-64 overflow-y-auto no-scrollbar border border-[#E5E5E3] rounded-2xl bg-white divide-y divide-[#F1F3FA]">
              {parseResult.rows.slice(0, 10).map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className="font-mono text-[10px] text-[#9CA3AF] shrink-0">
                    {r.date.slice(-5)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-xs font-medium text-[#1A1A1A]">
                      {r.note || r.category}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 min-w-0">
                      <span className="badge max-w-[110px] truncate border border-[#DBEAFE] bg-[#EFF6FF] text-[#1D4ED8] text-[9px]">
                        {r.category}
                      </span>
                      <span className="text-[9px] font-mono text-[#9CA3AF] truncate">{r.wallet}</span>
                    </span>
                  </span>
                  <span
                    className={`money r text-xs font-bold font-mono whitespace-nowrap ${
                      r.type === 'Income' ? 'text-[#059669]' : 'text-[#1A1A1A]'
                    }`}
                  >
                    {r.type === 'Income' ? '+' : ''}
                    {formatRupiah(Math.abs(r.amount))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2b. Kelola Aset Saham — Stock Portfolio Management (Full CRUD + Integrasi) */}
      <div className="glass card s12 setup-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-[#E5E5E3]">
          <div>
            <div className="flex items-center gap-2">
              <ChartCandlestick className="h-4 w-4 text-[#1A1A1A]" />
              <h3 className="sec-ttl">
                Kelola Aset Saham — Stock Portfolio
              </h3>
              <span className="badge border border-[#E5E5E3] bg-[#F7F7F5] text-[#6B7280]">1 lot = 100 lbr</span>
              <span className="badge border border-[#DBEAFE] bg-[#EFF6FF] text-[#1D4ED8]">CRUD Penuh</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Kelola portofolio saham: Kategori Likuid/Non-Likuid · Strategi Swing/Long-Term · Beli/Jual sinkron
              Cashflow &amp; Pemulihan Portofolio
            </p>
          </div>
          <button
            onClick={() => setIsAddStockOpen((v) => !v)}
            className={`h-8 px-3 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 self-start sm:self-auto ${
              isAddStockOpen
                ? 'bg-[#F1F1EF] text-[#1A1A1A] border border-[#CDCDC9] hover:bg-[#E5E5E3]'
                : 'bg-[#1A1A1A] text-white hover:bg-black shadow-sm'
            }`}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span>{isAddStockOpen ? 'Tutup Form Tambah' : 'Tambah Saham'}</span>
          </button>
        </div>

        <IhsgStrip className="mt-4" />

        {/* Dashboard ringkas: Total Modal · Nilai Pasar · P&L · Swing · Realized */}
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="rounded-lg border border-[#E5E5E3] bg-[#FBFBFA] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#9CA3AF]">Total Modal Saham</p>
            <p className="money text-sm font-bold text-[#1A1A1A] font-mono mt-0.5">{formatRupiah(portfolioCostTotal)}</p>
            <p className="text-[10px] font-mono text-[#9CA3AF]">Investasi · Σ lot × Harga Rata-rata</p>
          </div>
          <div className="rounded-lg border border-[#E5E5E3] bg-[#FBFBFA] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#9CA3AF]">Nilai Pasar</p>
            <p className="money text-sm font-bold text-[#1A1A1A] font-mono mt-0.5">{formatRupiah(portfolioMarketTotal)}</p>
            <p className="text-[10px] font-mono text-[#9CA3AF]">Σ lot × Harga Saat Ini</p>
          </div>
          <div className={`rounded-lg border px-3 py-2.5 ${portfolioPl >= 0 ? 'border-[#A7F3D0] bg-[#ECFDF5]' : 'border-[#FECACA] bg-[#FEF2F2]'}`}>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#6B7280]">P&amp;L Unrealized</p>
            <p className={`money text-sm font-bold font-mono mt-0.5 ${portfolioPl >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
              {portfolioPl >= 0 ? '+' : ''}{formatRupiah(portfolioPl)}
            </p>
            <p className={`text-[10px] font-mono ${portfolioPl >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>{portfolioPl >= 0 ? '+' : ''}{portfolioPlPct.toFixed(2)}%</p>
          </div>
          <div className="rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#3B82F6]">Swing Position</p>
            <p className="text-sm font-bold text-[#1E40AF] font-mono mt-0.5">{swingCount} saham · <span className="money">{formatRupiah(swingMarketTotal)}</span></p>
            <p className="text-[10px] font-mono text-[#60A5FA]">{swingCount === 0 ? 'Tidak ada posisi Swing' : `${swingCount} posisi strategi Swing`}</p>
          </div>
          <div className={`rounded-lg border px-3 py-2.5 flex flex-col ${totalStockRealizedProfit >= 0 ? 'border-[#E5E5E3] bg-[#F7F7F5]' : 'border-[#FECACA] bg-[#FFF7F7]'}`}>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#6B7280]">Realized Profit</p>
            <p className={`money text-sm font-bold font-mono mt-0.5 ${totalStockRealizedProfit >= 0 ? 'text-[#1A1A1A]' : 'text-[#DC2626]'}`}>
              {totalStockRealizedProfit >= 0 ? '+' : ''}{formatRupiah(totalStockRealizedProfit)}
            </p>
            <p className="text-[10px] font-mono text-[#9CA3AF]">Akumulasi P&amp;L terealisasi (jual)</p>
            {totalStockRealizedProfit !== 0 && (
              <button
                onClick={async () => {
                  if (confirm(`Reset Realized Profit ${formatRupiah(totalStockRealizedProfit)} jadi 0?\nIni 0-kan total + per-saham realized (ulang dari awal).`)) {
                    await resetStockRealizedProfit();
                    setSuccessMessage('Realized Profit di-reset ke 0 — siap ulang dari awal.');
                  }
                }}
                className="mt-2 h-6 px-2 rounded-md border border-[#E5E5E3] bg-white text-[10px] font-medium text-[#6B7280] hover:text-[#DC2626] hover:border-[#FECACA] hover:bg-[#FFF7F7] transition self-start flex items-center gap-1"
                title="Reset realized profit ke 0 (Supabase stock_holdings_meta + stock_holdings)"
              >
                <RotateCcw className="h-3 w-3" /> Reset ke 0
              </button>
            )}
          </div>
        </div>

        {/* ── Mobile: form tambah saham + kartu posisi ── */}
        <div className="md:hidden mt-4">
          {isAddStockOpen && (
            <div className="mb-1 rounded-2xl border border-[#BFDBFE] bg-[#F8FAFF] p-3.5 space-y-2.5">
              <p className="text-[12px] font-bold text-[#1A1A1A] flex items-center gap-2">
                <span className="h-6 w-6 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                  <ChartCandlestick className="h-3.5 w-3.5" />
                </span>
                Posisi Saham Baru
              </p>
              <input
                value={addStockDraft.ticker}
                onChange={(e) => setAddStockDraft((d) => ({ ...d, ticker: e.target.value.toUpperCase() }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddStock();
                  if (e.key === 'Escape') setIsAddStockOpen(false);
                }}
                placeholder="BBRI"
                className="asset-input w-full font-mono"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <select
                  value={addStockDraft.category}
                  onChange={(e) => setAddStockDraft((d) => ({ ...d, category: e.target.value as AssetCategory }))}
                  className="asset-input w-full"
                  title="Kategori aset"
                >
                  <option value="likuid">Likuid</option>
                  <option value="non_likuid">Non-Likuid</option>
                </select>
                <select
                  value={addStockDraft.strategy}
                  onChange={(e) => setAddStockDraft((d) => ({ ...d, strategy: e.target.value as StockStrategy }))}
                  className="asset-input w-full"
                  title="Strategi"
                >
                  {STOCK_STRATEGIES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="block text-[9px] uppercase tracking-wider text-[#9CA3AF] font-semibold mb-1">Jumlah Lot</span>
                  <input
                    inputMode="decimal"
                    value={addStockDraft.lotStr}
                    onChange={(e) => setAddStockDraft((d) => ({ ...d, lotStr: e.target.value.replace(/[^0-9.,]/g, '') }))}
                    placeholder="0"
                    className="asset-input w-full text-right"
                  />
                </label>
                <label className="block">
                  <span className="block text-[9px] uppercase tracking-wider text-[#9CA3AF] font-semibold mb-1">Harga Beli</span>
                  <input
                    inputMode="decimal"
                    value={addStockDraft.buyStr}
                    onChange={(e) => setAddStockDraft((d) => ({ ...d, buyStr: e.target.value.replace(/[^0-9.,]/g, '') }))}
                    placeholder="0"
                    className="asset-input w-full text-right"
                  />
                </label>
                <label className="block">
                  <span className="block text-[9px] uppercase tracking-wider text-[#9CA3AF] font-semibold mb-1">Harga Saat Ini</span>
                  <input
                    inputMode="decimal"
                    value={addStockDraft.marketStr}
                    onChange={(e) => setAddStockDraft((d) => ({ ...d, marketStr: e.target.value.replace(/[^0-9.,]/g, '') }))}
                    placeholder="0"
                    className="asset-input w-full text-right"
                  />
                </label>
                <div className="block">
                  <span className="block text-[9px] uppercase tracking-wider text-[#9CA3AF] font-semibold mb-1">Nilai & Modal</span>
                  <div className="h-[30px] rounded-lg border border-[#E5E5E3] bg-[#FBFBFA] px-2 flex items-center justify-between gap-1">
                    <span className="text-[9px] font-mono text-[#9CA3AF] truncate">{formatRupiah((addStockLots ?? 0) * 100 * addStockBuy)}</span>
                    <span className="text-[10px] font-mono font-bold text-[#1A1A1A] shrink-0">= {formatRupiah(addStockMarketValue)}</span>
                  </div>
                </div>
              </div>
              {addStockLots != null && addStockBuy > 0 && addStockMarket > 0 && (
                <p
                  className={`text-[10px] font-mono font-bold ${
                    addStockMarket >= addStockBuy ? 'text-[#059669]' : 'text-[#DC2626]'
                  }`}
                >
                  Estimasi P&amp;L {formatRupiah((addStockMarket - addStockBuy) * (addStockLots ?? 0) * 100)} (
                  {(((addStockMarket - addStockBuy) / addStockBuy) * 100).toFixed(2)}%)
                </p>
              )}
              <div className="flex gap-2 pt-0.5">
                <button
                  onClick={handleAddStock}
                  disabled={!addStockDraft.ticker.trim() || !addStockLots || addStockLots <= 0 || !addStockBuy || addStockBuy <= 0}
                  className="flex-1 h-9 rounded-xl bg-[#1A1A1A] text-white text-xs font-bold disabled:opacity-40 transition flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  <Check className="h-4 w-4" /> Simpan
                </button>
                <button
                  onClick={() => setIsAddStockOpen(false)}
                  className="h-9 px-4 rounded-xl border border-[#E5E5E3] bg-white text-xs font-semibold text-[#6B7280] hover:text-[#1A1A1A] transition"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-[#F1F3FA]">
            {sortedStockHoldings.map((h, i) => {
              const isEditing = editingStockId === h.id;
              const shares = getStockShares(h);
              const marketValue = getStockMarketValue(h);
              const pl = getStockProfitLoss(h);
              const plPct = getStockProfitLossPercent(h);
              const plPositive = pl >= 0;
              const cat = (h.category ?? 'non_likuid') as AssetCategory;
              const strat = (h.strategy ?? 'Long-Term') as StockStrategy;

              const editLots = isEditing && editStockDraft ? (parseDecimal(editStockDraft.lotStr) ?? 0) : 0;
              const editBuy = isEditing && editStockDraft ? parsePrice(editStockDraft.buyStr) : 0;
              const editMarket = isEditing && editStockDraft ? parsePrice(editStockDraft.marketStr) || editBuy : 0;
              const editPl = (editMarket - editBuy) * editLots * 100;
              const editPct = editBuy > 0 ? ((editMarket - editBuy) / editBuy) * 100 : 0;

              return (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 26, delay: Math.min(i * 0.015, 0.12) }}
                  className="py-3"
                >
                  <button
                    type="button"
                    onClick={() => (isEditing ? handleCancelStockEdit() : handleStartStockEdit(h))}
                    className="w-full flex items-center gap-3 text-left"
                  >
                    <span
                      className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: '#6366F11A', color: '#6366F1' }}
                    >
                      <ChartCandlestick className="h-5 w-5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-[#1A1A1A] font-mono">{h.ticker}</span>
                        <span
                          className={`badge border text-[9px] ${
                            strat === 'Swing'
                              ? 'bg-[#DBEAFE] text-[#1D4ED8] border-[#BFDBFE]'
                              : 'bg-[#F1F1EF] text-[#374151] border-[#E5E5E3]'
                          }`}
                        >
                          {strat}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`badge border text-[9px] ${
                            cat === 'likuid'
                              ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]'
                              : 'bg-[#F7F7F5] text-[#6B7280] border-[#E5E5E3]'
                          }`}
                        >
                          {cat === 'likuid' ? 'Likuid' : 'Non-Likuid'}
                        </span>
                        <span className="badge border border-[#E5E5E3] bg-[#F7F7F5] text-[#6B7280] text-[9px]">{shares} lbr</span>
                        {(h.realizedProfit ?? 0) !== 0 && (
                          <span
                            className={`text-[9px] font-mono font-bold ${
                              (h.realizedProfit ?? 0) >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'
                            }`}
                          >
                            realized <span className="money">{((h.realizedProfit ?? 0) >= 0 ? '+' : '') + formatRupiah(h.realizedProfit ?? 0)}</span>
                          </span>
                        )}
                      </span>
                      {h.companyName && (
                        <span className="mt-0.5 block text-[10px] font-sans text-[#9CA3AF] truncate">{h.companyName}</span>
                      )}
                    </span>
                    <span className="text-right shrink-0">
                      <span className="money r block text-sm font-bold text-[#1A1A1A] font-mono whitespace-nowrap">
                        {formatRupiah(marketValue)}
                      </span>
                      <span
                        className={`block text-[9px] font-mono font-bold whitespace-nowrap ${plPositive ? 'text-[#059669]' : 'text-[#DC2626]'}`}
                      >
                        <span className="money">{plPositive ? '+' : ''}
                        {formatRupiah(pl)}</span> ({plPositive ? '+' : ''}
                        {plPct.toFixed(2)}%)
                      </span>
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-[#9CA3AF] shrink-0 transition-transform ${isEditing ? 'rotate-180' : ''}`}
                    />
                  </button>

                  <AnimatePresence>
                    {isEditing && editStockDraft && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 rounded-2xl border border-[#BFDBFE] bg-[#F8FAFF] p-3.5 space-y-2.5">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-[#6B7280]">
                            Ubah {h.ticker}
                          </p>
                          <div className="grid grid-cols-2 gap-2.5">
                            <input
                              value={editStockDraft.ticker}
                              onChange={(e) =>
                                setEditStockDraft((d) => (d ? { ...d, ticker: e.target.value.toUpperCase() } : d))
                              }
                              className="asset-input w-full font-mono"
                            />
                            <input
                              inputMode="decimal"
                              value={editStockDraft.lotStr}
                              onChange={(e) =>
                                setEditStockDraft((d) =>
                                  d ? { ...d, lotStr: e.target.value.replace(/[^0-9.,]/g, '') } : d
                                )
                              }
                              placeholder="0"
                              className="asset-input w-full text-right"
                            />
                            <input
                              inputMode="decimal"
                              value={editStockDraft.buyStr}
                              onChange={(e) =>
                                setEditStockDraft((d) =>
                                  d ? { ...d, buyStr: e.target.value.replace(/[^0-9.,]/g, '') } : d
                                )
                              }
                              placeholder="0"
                              className="asset-input w-full text-right"
                            />
                            <input
                              inputMode="decimal"
                              value={editStockDraft.marketStr}
                              onChange={(e) =>
                                setEditStockDraft((d) =>
                                  d ? { ...d, marketStr: e.target.value.replace(/[^0-9.,]/g, '') } : d
                                )
                              }
                              placeholder="0"
                              className="asset-input w-full text-right"
                            />
                            <select
                              value={editStockDraft.category}
                              onChange={(e) =>
                                setEditStockDraft((d) =>
                                  d ? { ...d, category: e.target.value as AssetCategory } : d
                                )
                              }
                              className="asset-input w-full"
                            >
                              <option value="likuid">Likuid</option>
                              <option value="non_likuid">Non-Likuid</option>
                            </select>
                            <select
                              value={editStockDraft.strategy}
                              onChange={(e) =>
                                setEditStockDraft((d) =>
                                  d ? { ...d, strategy: e.target.value as StockStrategy } : d
                                )
                              }
                              className="asset-input w-full"
                            >
                              {STOCK_STRATEGIES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#6B7280]">
                            <span>Modal {formatRupiah(editLots * 100 * editBuy)}</span>
                            <span>
                              Nilai Pasar = {formatRupiah(editLots * 100 * editMarket)} ·{' '}
                              <span className={`font-bold ${editPl >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                                {editPl >= 0 ? '+' : ''}
                                {formatRupiah(editPl)} ({editPl >= 0 ? '+' : ''}
                                {editPct.toFixed(2)}%)
                              </span>
                            </span>
                          </div>
                          <div className="flex gap-2 pt-0.5">
                            <button
                              onClick={() => handleRefreshSingleStockPrice(h)}
                              disabled={market.loading}
                              className="h-9 w-9 shrink-0 rounded-xl border border-[#DBEAFE] bg-white text-[#1D4ED8] hover:bg-[#EFF6FF] transition flex items-center justify-center disabled:opacity-40"
                              title="Update harga saat ini dari market (IDX)"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${market.loading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                              onClick={handleSaveStockEdit}
                              className="flex-1 h-9 rounded-xl bg-[#1A1A1A] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-[0.98]"
                            >
                              <Check className="h-4 w-4" /> Simpan
                            </button>
                            <button
                              onClick={handleCancelStockEdit}
                              className="h-9 px-4 rounded-xl border border-[#E5E5E3] bg-white text-xs font-semibold text-[#6B7280] hover:text-[#1A1A1A] transition"
                            >
                              Batal
                            </button>
                            <button
                              onClick={() => handleDeleteStock(h)}
                              className="h-9 w-9 shrink-0 rounded-xl border border-[#FECACA] bg-white text-[#DC2626] hover:bg-[#FFF7F7] transition flex items-center justify-center"
                              title="Jual/hapus posisi"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {sortedStockHoldings.length === 0 && !isAddStockOpen && (
              <div className="py-8 text-center">
                <p className="text-xs text-[#9CA3AF] leading-relaxed">
                  Belum ada saham di portofolio. Catat posisi pertama (Beli Saham otomatis masuk Cashflow Investment &frasl; Saham).
                </p>
                <button
                  onClick={() => setIsAddStockOpen(true)}
                  className="mt-2 h-8 px-3 rounded-lg bg-[#1A1A1A] text-white text-xs font-semibold"
                >
                  + Tambah Saham
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="hidden md:block mt-4 overflow-x-auto">
          <table className="notion-table">
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    onClick={() => toggleStockSort('symbol')}
                    className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-[#1A1A1A] transition"
                    title="Urutkan Symbol A-Z / Z-A"
                  >
                    <span>Symbol</span>
                    {stockSortKey === 'symbol' ? (
                      stockSortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </th>
                <th className="text-right">Harga Saat Ini</th>
                <th className="text-right">Harga Rata-rata</th>
                <th className="text-right">Jumlah Lot</th>
                <th className="text-right">Nilai Pasar</th>
                <th className="text-right">Investasi</th>
                <th className="text-right">
                  <button
                    type="button"
                    onClick={() => toggleStockSort('pnl')}
                    className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-[#1A1A1A] transition ml-auto"
                    title="Urutkan P&L terkecil ↔ terbesar"
                  >
                    <span>P&amp;L</span>
                    {stockSortKey === 'pnl' ? (
                      stockSortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </th>
                <th className="text-right">Persentase</th>
                <th className="text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {/* Add-stock row — spec: Kode, Lot, Harga Beli/Lembar, Harga Saat Ini, Kategori, Strategi */}
              {isAddStockOpen && (
                <tr className="bg-[#F7F7F5]">
                  <td>
                    <div className="flex flex-col gap-1.5">
                      <input
                        value={addStockDraft.ticker}
                        onChange={(e) => setAddStockDraft((d) => ({ ...d, ticker: e.target.value.toUpperCase() }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddStock();
                          if (e.key === 'Escape') setIsAddStockOpen(false);
                        }}
                        placeholder="BBRI"
                        className="asset-input w-24"
                      />
                      <div className="flex gap-1">
                        <select
                          value={addStockDraft.category}
                          onChange={(e) => setAddStockDraft((d) => ({ ...d, category: e.target.value as AssetCategory }))}
                          className="asset-input h-6 text-[10px] px-1"
                          title="Kategori aset"
                        >
                          <option value="likuid">Likuid</option>
                          <option value="non_likuid">Non-Likuid</option>
                        </select>
                        <select
                          value={addStockDraft.strategy}
                          onChange={(e) => setAddStockDraft((d) => ({ ...d, strategy: e.target.value as StockStrategy }))}
                          className="asset-input h-6 text-[10px] px-1"
                          title="Strategi"
                        >
                          {STOCK_STRATEGIES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </td>
                  <td className="text-right">
                    <input
                      inputMode="decimal"
                      value={addStockDraft.marketStr}
                      onChange={(e) => setAddStockDraft((d) => ({ ...d, marketStr: e.target.value.replace(/[^0-9.,]/g, '') }))}
                      placeholder="0"
                      className="asset-input w-28 text-right"
                    />
                  </td>
                  <td className="text-right">
                    <input
                      inputMode="decimal"
                      value={addStockDraft.buyStr}
                      onChange={(e) => setAddStockDraft((d) => ({ ...d, buyStr: e.target.value.replace(/[^0-9.,]/g, '') }))}
                      placeholder="0"
                      className="asset-input w-28 text-right"
                    />
                  </td>
                  <td className="text-right">
                    <input
                      inputMode="decimal"
                      value={addStockDraft.lotStr}
                      onChange={(e) => setAddStockDraft((d) => ({ ...d, lotStr: e.target.value.replace(/[^0-9.,]/g, '') }))}
                      placeholder="0"
                      className="asset-input w-20 text-right"
                    />
                  </td>
                  <td className="text-right">
                    <span className="text-[10px] font-mono text-[#6B7280]">= {formatRupiah(addStockMarketValue)}</span>
                  </td>
                  <td className="text-right">
                    <span className="text-[10px] font-mono text-[#9CA3AF]">modal {formatRupiah((addStockLots ?? 0) * 100 * addStockBuy)}</span>
                  </td>
                  <td className="text-right">
                    {addStockLots != null && addStockBuy > 0 && addStockMarket > 0 ? (
                      <span className={`text-[10px] font-bold ${addStockMarket >= addStockBuy ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                        {formatRupiah((addStockMarket - addStockBuy) * (addStockLots ?? 0) * 100)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#9CA3AF]">—</span>
                    )}
                  </td>
                  <td className="text-right">
                    {addStockLots != null && addStockBuy > 0 && addStockMarket > 0 ? (
                      <span className={`text-[10px] font-mono ${addStockMarket >= addStockBuy ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                        {(((addStockMarket - addStockBuy) / addStockBuy) * 100).toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#9CA3AF]">—</span>
                    )}
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center gap-1">
                      <button
                        onClick={handleAddStock}
                        disabled={!addStockDraft.ticker.trim() || !addStockLots || addStockLots <= 0 || !addStockBuy || addStockBuy <= 0}
                        className="p-1 rounded-md hover:bg-white text-[#1A1A1A] disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Tambah saham (catat Beli Saham di Cashflow)"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setIsAddStockOpen(false)} className="p-1 rounded-md hover:bg-white text-[#6B7280] hover:text-[#1A1A1A]" title="Batal">
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  </td>
                </tr>
              )}

              {sortedStockHoldings.map((h) => {
                const isEditing = editingStockId === h.id;
                const shares = getStockShares(h);
                const costValue = getStockCostValue(h);
                const marketValue = getStockMarketValue(h);
                const pl = getStockProfitLoss(h);
                const plPct = getStockProfitLossPercent(h);
                const plPositive = pl >= 0;
                const cat = (h.category ?? 'non_likuid') as AssetCategory;
                const strat = (h.strategy ?? 'Long-Term') as StockStrategy;

                const editLots = isEditing && editStockDraft ? (parseDecimal(editStockDraft.lotStr) ?? 0) : 0;
                const editBuy = isEditing && editStockDraft ? parsePrice(editStockDraft.buyStr) : 0;
                const editMarket = isEditing && editStockDraft ? parsePrice(editStockDraft.marketStr) || editBuy : 0;
                const editPl = (editMarket - editBuy) * editLots * 100;
                const editPct = editBuy > 0 ? ((editMarket - editBuy) / editBuy) * 100 : 0;

                return (
                  <tr key={h.id} className="hover:bg-[#F7F7F5]">
                    <td className="font-semibold text-[#1A1A1A]">
                      {isEditing ? (
                        <div className="flex flex-col gap-1.5">
                          <input
                            value={editStockDraft?.ticker ?? h.ticker}
                            onChange={(e) => setEditStockDraft((d) => (d ? { ...d, ticker: e.target.value.toUpperCase() } : d))}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveStockEdit(); if (e.key === 'Escape') handleCancelStockEdit(); }}
                            className="asset-input w-24"
                          />
                          <div className="flex gap-1">
                            <select value={editStockDraft?.category ?? cat} onChange={(e) => setEditStockDraft((d) => (d ? { ...d, category: e.target.value as AssetCategory } : d))} className="asset-input h-6 text-[10px] px-1">
                              <option value="likuid">Likuid</option>
                              <option value="non_likuid">Non-Likuid</option>
                            </select>
                            <select value={editStockDraft?.strategy ?? strat} onChange={(e) => setEditStockDraft((d) => (d ? { ...d, strategy: e.target.value as StockStrategy } : d))} className="asset-input h-6 text-[10px] px-1">
                              {STOCK_STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1.5">
                            {h.ticker}
                            <span className={`badge border text-[9px] ${strat === 'Swing' ? 'bg-[#DBEAFE] text-[#1D4ED8] border-[#BFDBFE]' : 'bg-[#F1F1EF] text-[#374151] border-[#E5E5E3]'}`}>{strat}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className={`badge border text-[9px] ${cat === 'likuid' ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]' : 'bg-[#F7F7F5] text-[#6B7280] border-[#E5E5E3]'}`}>{cat === 'likuid' ? 'Likuid' : 'Non-Likuid'}</span>
                            <span className="badge border border-[#E5E5E3] bg-[#F7F7F5] text-[#6B7280] text-[9px]">{shares} lbr</span>
                          </span>
                          {h.companyName && <span className="text-[10px] font-sans text-[#9CA3AF]">{h.companyName}</span>}
                          {(h.realizedProfit ?? 0) !== 0 && (
                            <span className={`text-[10px] font-mono font-bold ${(h.realizedProfit ?? 0) >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>realized <span className="money">{formatRupiah(h.realizedProfit ?? 0)}</span></span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      {isEditing ? (
                        <input inputMode="decimal" value={editStockDraft?.marketStr ?? String(h.marketPrice)} onChange={(e) => setEditStockDraft((d) => (d ? { ...d, marketStr: e.target.value.replace(/[^0-9.,]/g, '') } : d))} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveStockEdit(); if (e.key === 'Escape') handleCancelStockEdit(); }} className="asset-input w-28 text-right" placeholder="0" />
                      ) : (
                        <span className="text-[#1A1A1A] font-bold">{formatRupiah(h.marketPrice)}</span>
                      )}
                    </td>
                    <td className="text-right">
                      {isEditing ? (
                        <input inputMode="decimal" value={editStockDraft?.buyStr ?? String(h.buyPrice)} onChange={(e) => setEditStockDraft((d) => (d ? { ...d, buyStr: e.target.value.replace(/[^0-9.,]/g, '') } : d))} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveStockEdit(); if (e.key === 'Escape') handleCancelStockEdit(); }} className="asset-input w-28 text-right" placeholder="0" />
                      ) : (
                        <span className="text-[#6B7280]">{formatRupiah(h.buyPrice)}</span>
                      )}
                    </td>
                    <td className="text-right">
                      {isEditing ? (
                        <input inputMode="decimal" value={editStockDraft?.lotStr ?? String(h.lots)} onChange={(e) => setEditStockDraft((d) => (d ? { ...d, lotStr: e.target.value.replace(/[^0-9.,]/g, '') } : d))} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveStockEdit(); if (e.key === 'Escape') handleCancelStockEdit(); }} className="asset-input w-20 text-right" />
                      ) : (
                        <span className="text-[#1A1A1A]">{h.lots}<span className="text-[10px] text-[#9CA3AF]"> lot</span></span>
                      )}
                    </td>
                    <td className="text-right">
                      {isEditing ? (
                        <span className="text-[10px] font-mono text-[#6B7280]">= {formatRupiah(editLots * 100 * editMarket)}</span>
                      ) : (
                        <span className="text-[#1A1A1A] font-bold">{formatRupiah(marketValue)}</span>
                      )}
                    </td>
                    <td className="text-right">
                      {isEditing ? (
                        <span className="text-[10px] font-mono text-[#9CA3AF]">{formatRupiah(editLots * 100 * editBuy)}</span>
                      ) : (
                        <span className="text-[#6B7280]">{formatRupiah(costValue)}</span>
                      )}
                    </td>
                    <td className="text-right">
                      {isEditing ? (
                        <span className={`text-[11px] font-bold ${editPl >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>{editPl >= 0 ? '+' : ''}{formatRupiah(editPl)}</span>
                      ) : (
                        <span className={`font-bold ${plPositive ? 'text-[#059669]' : 'text-[#DC2626]'}`}>{plPositive ? '+' : ''}{formatRupiah(pl)}</span>
                      )}
                    </td>
                    <td className="text-right">
                      {isEditing ? (
                        <span className={`text-[10px] font-mono ${editPl >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>{editPl >= 0 ? '+' : ''}{editPct.toFixed(2)}%</span>
                      ) : (
                        <span className={`text-[10px] font-mono font-bold ${plPositive ? 'text-[#059669]' : 'text-[#DC2626]'}`}>{plPositive ? '+' : ''}{plPct.toFixed(2)}%</span>
                      )}
                    </td>
                    <td className="text-center">
                      {isEditing ? (
                        <span className="inline-flex items-center justify-center gap-1">
                          <button onClick={handleSaveStockEdit} className="p-1 rounded-md hover:bg-[#F1F1EF] text-[#1A1A1A]" title="Simpan"><Check className="h-4 w-4" /></button>
                          <button onClick={handleCancelStockEdit} className="p-1 rounded-md hover:bg-[#F1F1EF] text-[#6B7280] hover:text-[#1A1A1A]" title="Batal"><X className="h-4 w-4" /></button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleRefreshSingleStockPrice(h)}
                            disabled={market.loading}
                            className="p-1 text-[#9CA3AF] hover:text-[#1D4ED8] rounded-md hover:bg-[#EFF6FF] disabled:opacity-40"
                            title="Update harga saat ini dari market (IDX)"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${market.loading ? 'animate-spin' : ''}`} />
                          </button>
                          <button onClick={() => handleStartStockEdit(h)} className="p-1 text-[#9CA3AF] hover:text-[#1A1A1A] rounded-md hover:bg-[#F1F1EF]" title="Ubah lot/harga/strategi"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDeleteStock(h)} className="p-1 text-[#9CA3AF] hover:text-[#DC2626] rounded-md hover:bg-[#FEF2F2]" title="Jual/hapus posisi"><Trash2 className="h-3.5 w-3.5" /></button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!isAddStockOpen && stockHoldings.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center">
                    <p className="text-xs text-[#9CA3AF]">
                      Belum ada saham di portofolio. Klik <strong className="text-[#6B7280]">+ Tambah Saham</strong> untuk mencatat posisi (Beli Saham otomatis masuk Cashflow Investment &frasl; Saham).
                    </p>
                  </td>
                </tr>
              )}
            </tbody>

            {stockHoldings.length > 0 && (
              <tfoot>
                <tr className="bg-[#F7F7F5] border-t border-[#E5E5E3]">
                  <td colSpan={4} className="px-3 py-2.5 text-right">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-[#6B7280]">Total Equity Saham</p>
                    <p className="text-[10px] font-mono text-[#9CA3AF]">{stockHoldings.length} posisi · {swingCount} Swing</p>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-[#1A1A1A]">
                    <span className="block text-[11px]">{formatRupiah(portfolioMarketTotal)}</span>
                    <span className="text-[10px] font-mono text-[#9CA3AF]">Nilai Pasar</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#6B7280]">
                    <span className="block text-[11px]">{formatRupiah(portfolioCostTotal)}</span>
                    <span className="text-[10px] text-[#9CA3AF]">Modal</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`block text-[11px] font-bold ${portfolioPl >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>{portfolioPl >= 0 ? '+' : ''}{formatRupiah(portfolioPl)}</span>
                    <span className={`text-[10px] font-mono ${portfolioPl >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>{portfolioPl >= 0 ? '+' : ''}{portfolioPlPct.toFixed(2)}%</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="block text-[10px] font-mono text-[#6B7280]">Realized</span>
                    <span className={`block text-[11px] font-bold ${totalStockRealizedProfit >= 0 ? 'text-[#1A1A1A]' : 'text-[#DC2626]'}`}>{totalStockRealizedProfit >= 0 ? '+' : ''}{formatRupiah(totalStockRealizedProfit)}</span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Update Harga Saat Ini — langsung dari market, tanpa chart */}
        <div className="mt-5 rounded-xl border border-[#E5E5E3] bg-[#FBFBFA] px-3 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`h-8 w-8 rounded-lg border border-[#E5E5E3] bg-white flex items-center justify-center shrink-0 ${market.loading ? 'animate-pulse' : ''}`}>
              <RefreshCw className={`h-4 w-4 ${market.loading ? 'animate-spin text-[#1D4ED8]' : 'text-[#1A1A1A]'}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#1A1A1A] flex items-center gap-2 flex-wrap">
                Update Harga Saat Ini — Market
                {isRealtimeEnabled && stockHoldings.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-normal text-[#059669] bg-[#ECFDF5] border border-[#A7F3D0] rounded-full px-2 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#059669] animate-pulse" /> Otomatis
                  </span>
                )}
              </p>
              <p className="text-[11px] text-[#6B7280] leading-tight">
                Harga terakhir IDX masuk ke kolom <strong>Harga Saat Ini</strong> saat halaman dibuka — Nilai Pasar &amp; P&amp;L ikut berubah.
              </p>
              <p className="text-[10px] font-mono text-[#9CA3AF] mt-0.5">
                {stockHoldings.length > 0
                  ? `${stockHoldings.map((h) => h.ticker).join(' · ')} — 1 lot = 100 lbr · `
                  : ''}
                {market.loading
                  ? 'Mengambil harga terakhir…'
                  : market.lastUpdatedAt
                    ? `Diperbarui ${formatMarketClock(market.lastUpdatedAt)} WIB${market.detail ? ` · ${market.detail}` : ''}`
                    : 'Menunggu muatan pertama'}
                {isRealtimeEnabled && stockHoldings.length > 0 ? ' · ulang tiap 30 dtk di halaman ini' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            <label className="flex items-center gap-1.5 text-[11px] text-[#374151] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRealtimeEnabled}
                onChange={(e) => setIsRealtimeEnabled(e.target.checked)}
                className="accent-[#1A1A1A] h-3.5 w-3.5"
              />
              Realtime
            </label>
            <button
              onClick={handleRefreshStockPrices}
              disabled={market.loading || stockHoldings.length === 0}
              className="h-8 px-4 rounded-lg bg-[#1A1A1A] text-white text-xs font-semibold hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5"
              title="Fetch harga IDX terbaru untuk semua holdings"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${market.loading ? 'animate-spin' : ''}`} />
              <span>{market.loading ? 'Memperbarui...' : `Update Harga${stockHoldings.length ? ` (${stockHoldings.length})` : ''}`}</span>
            </button>
          </div>
        </div>
        {market.error && (
          <p className="mt-2 text-[11px] text-[#DC2626] flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {market.error}
          </p>
        )}

        <p className="mt-3 text-[10px] leading-relaxed font-mono text-[#9CA3AF]">
          Sinkronisasi otomatis: <strong className="text-[#374151]">Beli</strong> (tambah lot) → <strong className="text-[#374151]">Beli Saham</strong> + kas akun likuid berkurang ·{' '}
          <strong className="text-[#374151]">Jual</strong> (kurangi lot / hapus) → <strong className="text-[#374151]">Jual Saham</strong> (Investment) di Cashflow + kas akun likuid nambah sebesar hasil bersih.
          Harga Saat Ini memperbarui Nilai Pasar &amp; total equity real-time. Realized P&amp;L dari penjualan otomatis menambah <strong className="text-[#374151]">Terealisasi</strong>{' '}
          target <strong className="text-[#374151]">Pemulihan Portofolio Saham</strong>. Swing Position terhitung terpisah.
          Harga terakhir diambil otomatis saat halaman dibuka (TradingView, cadangan Yahoo Finance .JK). Tombol <strong>Update Harga</strong> tetap bisa dipakai, atau edit manual kolom Harga Saat Ini.
        </p>
      </div>

      {/* 3. Official Structure Reference */}
      <div className="s12 grid grid-cols-1 md:grid-cols-2 gap-4 setup-ref">
        {/* Wallets Reference */}
        <div className="rounded-xl border border-[#E5E5E3] bg-[#FBFBFA] p-4">
          <h4 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider mb-2">
            Akun & instrumen
          </h4>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[#1A1A1A] font-semibold">Akun operasional:</span>
              <p className="text-[#6B7280] mt-1 text-[11px] leading-relaxed">
                Tidak ada rekening bawaan. Tambahkan akun di Kelola Aset — nama bebas, misalnya Dana Darurat atau Reksa Dana Pasar Uang.
              </p>
              {assets.length > 0 && (
                <ul className="list-disc list-inside text-[#6B7280] mt-1 font-mono text-[11px] space-y-0.5">
                  {assets.map((a) => (
                    <li key={a.id}>{a.displayName || a.name}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <span className="text-[#1A1A1A] font-semibold">Instrumen bawaan:</span>
              <ul className="list-disc list-inside text-[#6B7280] mt-1 font-mono text-[11px] space-y-0.5">
                {ASSET_WALLETS.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Categories Reference */}
        <div className="rounded-xl border border-[#E5E5E3] bg-[#FBFBFA] p-4">
          <h4 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider mb-2">
            Kategori bawaan
          </h4>
          <div className="space-y-2 text-xs font-mono text-[11px]">
            <div>
              <span className="text-[#1A1A1A] font-sans font-semibold">Income: </span>
              <span className="text-[#6B7280]">{INCOME_CATEGORIES.join(', ')}</span>
            </div>
            <div>
              <span className="text-[#374151] font-sans font-semibold">Needs: </span>
              <span className="text-[#6B7280]">{NEEDS_CATEGORIES.join(', ')}</span>
            </div>
            <div>
              <span className="text-[#374151] font-sans font-semibold">Wants: </span>
              <span className="text-[#6B7280]">{WANTS_CATEGORIES.join(', ')}</span>
            </div>
            <div>
              <span className="text-[#374151] font-sans font-semibold">Savings (mengikuti wadah di atas): </span>
              <span className="text-[#6B7280]">
                {(() => {
                  const dyn = getSavingsAssetOptions(assets);
                  const list = dyn.length > 0 ? [...dyn, 'Top Up Saldo'] : [];
                  return list.length > 0 ? list.join(', ') : '—';
                })()}
              </span>
              <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                Piutang tidak masuk Savings — pelunasannya via Income Pelunasan Piutang.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Danger Zone: Reset Database / Hapus Semua Data */}
      <div className="glass card s12 setup-danger">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
              <h3 className="text-sm font-bold text-[#B91C1C] uppercase tracking-wider">
                Reset Database / Hapus Semua Data
              </h3>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">
              Hapus semua transaksi ({transactions.length} baris) agar Anda bisa mengulang impor file .xlsx Money Lover dari awal secara bersih.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (confirm('Hapus semua akun, transaksi, target, dan saham di akun ini?')) {
                  resetToDefault();
                  setSuccessMessage('Data akun ini sudah dikosongkan.');
                }
              }}
              className="h-8 px-3 rounded-lg border border-[#E5E5E3] bg-white text-xs text-[#374151] hover:bg-[#F1F1EF] transition flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset ke Default</span>
            </button>

            <button
              onClick={() => setIsResetModalOpen(true)}
              className="h-8 px-3 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-xs font-semibold text-white transition flex items-center gap-1.5 shadow-sm"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Hapus Semua Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/30">
          <div className="w-full max-w-md rounded-xl border border-[#FECACA] bg-white p-5 shadow-2xl fade-in-up">
            <div className="flex items-center gap-2 text-[#DC2626] pb-3 border-b border-[#E5E5E3]">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h3 className="text-sm font-bold text-[#1A1A1A]">Konfirmasi Hapus Semua Data</h3>
            </div>

            <p className="mt-3 text-xs text-[#374151] leading-relaxed">
              Tindakan ini akan <strong>menghapus seluruh {transactions.length} baris transaksi</strong> dari IndexedDB / LocalStorage. Anda dapat memulai kembali dengan spreadsheet yang bersih atau mengimpor ulang file .xlsx Money Lover.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E3]">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="h-8 px-3 rounded-lg border border-[#E5E5E3] bg-white text-xs text-[#6B7280] hover:text-[#1A1A1A] hover:bg-[#F1F1EF]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmResetDb}
                className="h-8 px-4 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-xs font-semibold text-white transition"
              >
                Ya, Hapus Semua Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}