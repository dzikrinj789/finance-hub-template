'use client';

import React, { useMemo, useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { formatRupiah } from '@/lib/utils';
import {
  INCOME_CATEGORIES,
  INVESTMENT_CATEGORIES,
  INVESTMENT_GROUPS,
  NEEDS_CATEGORIES,
  OPERATIONAL_WALLETS,
  SAVINGS_CATEGORIES,
  TransactionType,
  WANTS_CATEGORIES,
  findLinkedRecoveryTargets,
  getPiutangAssetOptions,
  getSavingsAssetOptions,
  isPiutangAsset,
  parseTransferAssets,
  AssetCategory,
  StockStrategy,
  STOCK_STRATEGIES,
  getStockShares,
  isBalanceLockedTx,
  type Transaction,
} from '@/types/finance';
import { X, PlusCircle, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from '@/lib/toast';

const CATEGORY_PRESETS: Record<TransactionType, readonly string[]> = {
  Needs: NEEDS_CATEGORIES,
  Wants: WANTS_CATEGORIES,
  Savings: SAVINGS_CATEGORIES,
  Income: INCOME_CATEGORIES,
  Investment: INVESTMENT_CATEGORIES,
  'Internal Transfer': ['Pindah Antar Akun', 'Tarik Tunai', 'Top Up Saldo'],
};

const TYPE_STYLES: Record<
  TransactionType,
  { active: string; dot: string }
> = {
  Needs: {
    active: 'border-transparent bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white font-semibold',
    dot: 'bg-[#2563EB]',
  },
  Wants: {
    active: 'border-transparent bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white font-semibold',
    dot: 'bg-[#2563EB]',
  },
  Savings: {
    active: 'border-transparent bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white font-semibold',
    dot: 'bg-[#2563EB]',
  },
  Income: {
    active: 'border-transparent bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white font-semibold',
    dot: 'bg-[#2563EB]',
  },
  Investment: {
    active: 'border-transparent bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white font-semibold',
    dot: 'bg-[#2563EB]',
  },
  'Internal Transfer': {
    active: 'border-transparent bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white font-semibold',
    dot: 'bg-[#2563EB]',
  },
};

const TYPE_LABELS: Record<TransactionType, string> = {
  Needs: 'Needs',
  Wants: 'Wants',
  Savings: 'Savings',
  Income: 'Income',
  Investment: 'Investasi',
  'Internal Transfer': 'Transfer',
};

// Wrapper: form di-remount per transaksi yang diedit (key) sehingga state awal form
// langsung terisi dari transaksi tsb — tanpa effect sinkronisasi state.
export function QuickAddModal() {
  const { editingTx, isQuickAddOpen } = useFinance();
  return <QuickAddModalForm key={`${isQuickAddOpen ? 'open' : 'closed'}-${editingTx?.id ?? 'new'}`} editingTx={editingTx} />;
}

function QuickAddModalForm({ editingTx }: { editingTx: Transaction | null }) {
  const {
    isQuickAddOpen,
    setIsQuickAddOpen,
    addTransaction,
    recoveryItems,
    assets,
    stockHoldings,
    addStockHolding,
    updateStockHolding,
    updateTransaction,
  } = useFinance();
  const isEdit = Boolean(editingTx);
  // Auto-catat (dari Setup/Portofolio Saham) & Beli/Jual Saham: nominal/tipe/kategori/akun dikunci.
  const isLocked = editingTx ? isBalanceLockedTx(editingTx) : false;
  const editTransfer = editingTx && editingTx.type === 'Internal Transfer' ? parseTransferAssets(editingTx.category) : null;

  const [type, setType] = useState<TransactionType>(editingTx?.type ?? 'Needs');
  const [amountStr, setAmountStr] = useState<string>(
    editingTx ? Math.round(editingTx.amount).toLocaleString('id-ID') : ''
  );
  const [category, setCategory] = useState<string>(editingTx?.category ?? NEEDS_CATEGORIES[0]);
  const firstAccount =
    assets.find((a) => !isPiutangAsset(a) && a.name !== 'Saham' && !a.isGold)?.name ?? '';
  const [wallet, setWallet] = useState<string>(editingTx?.wallet ?? firstAccount);
  const [date, setDate] = useState<string>(editingTx?.date ?? new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState<string>(editingTx?.note ?? '');
  const [isExcludeReport, setIsExcludeReport] = useState<boolean>(editingTx?.isExcludeReport ?? false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [targetId, setTargetId] = useState<string>(editingTx?.targetId ?? '');
  const [transferFrom, setTransferFrom] = useState<string>(editTransfer?.from ?? '');
  const [transferTo, setTransferTo] = useState<string>(editTransfer?.to ?? '');

  // ── Kategori Savings dinamis: mengikuti wadah aset di Setup ──
  // Piutang dikecualikan → pelunasannya via Income 'Pelunasan Piutang'.
  const savingsOptions = useMemo(() => {
    const dyn = getSavingsAssetOptions(assets);
    if (dyn.length === 0) return [...SAVINGS_CATEGORIES];
    return dyn.includes('Top Up Saldo') ? dyn : [...dyn, 'Top Up Saldo'];
  }, [assets]);
  const savingsDisplayByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assets) map.set(a.name, a.displayName || a.name);
    return map;
  }, [assets]);
  const isSavingsDynamic = useMemo(
    () => getSavingsAssetOptions(assets).length > 0,
    [assets]
  );

  // ── Wadah piutang dari Setup untuk pelunasan (Income) ──
  const piutangOptions = useMemo(() => getPiutangAssetOptions(assets), [assets]);
  const [piutangAsset, setPiutangAsset] = useState<string>('');
  // Nilai aktif = pilihan user bila masih ada, else wadah pertama (tanpa effect)
  const activePiutangAsset =
    piutangAsset && piutangOptions.includes(piutangAsset)
      ? piutangAsset
      : (piutangOptions[0] ?? '');

  const getOptionsForType = (t: TransactionType): readonly string[] =>
    t === 'Savings' ? savingsOptions : CATEGORY_PRESETS[t];

  // Akun kas efek bila pengguna menamai wadahnya dengan RDN. Bukan rekening bawaan.
  const cashRdnName = useMemo(() => {
    const hit = assets.find((a) => /rdn|stockbit/i.test(`${a.name} ${a.displayName || ''}`));
    return hit?.name ?? '';
  }, [assets]);

  // Opsi Akun Dompet untuk saham: utamakan Cash RDN, lalu operasional + wadah likuid custom.
  const sahamWalletOptions = useMemo(() => {
    const opts: string[] = [];
    if (cashRdnName) opts.push(cashRdnName);
    for (const w of OPERATIONAL_WALLETS) if (!opts.includes(w)) opts.push(w);
    for (const a of assets) {
      if (isPiutangAsset(a)) continue;
      if (a.name === 'Saham' || a.isGold) continue;
      if (opts.includes(a.name)) continue;
      // hanya wadah kas-like (likuid / bank) agar tidak pilih goals
      if (a.category === 'likuid') opts.push(a.name);
    }
    return opts;
  }, [assets, cashRdnName]);
  const activeSahamWallet = sahamWalletOptions.includes(wallet) ? wallet : (sahamWalletOptions[0] ?? wallet);

  // Wadah yang bisa di-transfer (antar kas): semua non-piutang non-saham non-emas.
  // Fallback ke operasional bila Setup masih kosong.
  const transferableAssets: string[] = useMemo(() => {
    const list = assets
      .filter((a) => !isPiutangAsset(a) && a.name !== 'Saham' && !a.isGold)
      .map((a) => a.name as string);
    if (list.length > 0) return list;
    return [...OPERATIONAL_WALLETS] as string[];
  }, [assets]);
  const activeTransferFrom =
    transferFrom && transferableAssets.includes(transferFrom)
      ? transferFrom
      : (transferableAssets[0] ?? '');
  const activeTransferTo =
    transferTo && transferableAssets.includes(transferTo)
      ? transferTo
      : (transferableAssets[1] ?? transferableAssets[0] ?? '');

  // ── Saham holdings-aware state ──
  const [sahamTicker, setSahamTicker] = useState<string>('');
  const [sahamLotsStr, setSahamLotsStr] = useState<string>('');
  const [sahamPriceStr, setSahamPriceStr] = useState<string>('');
  const [sahamCategory, setSahamCategory] = useState<AssetCategory>('non_likuid');
  const [sahamStrategy, setSahamStrategy] = useState<StockStrategy>('Long-Term');
  const [sahamBrokerFeeStr, setSahamBrokerFeeStr] = useState<string>('');
  const [sahamExchangeFeeStr, setSahamExchangeFeeStr] = useState<string>('');

  const numericAmount = parseFloat(amountStr.replace(/[^0-9]/g, '')) || 0;

  // saham derived
  const isSahamBeli = type === 'Investment' && category === 'Beli Saham';
  const isSahamJual = type === 'Investment' && category === 'Jual Saham';
  const isSahamMode = !isLocked && (isSahamBeli || isSahamJual);
  const isTransferPindah = type === 'Internal Transfer' && /^pindah\s+/i.test(category);
  const sahamLots = parseFloat(sahamLotsStr.replace(',', '.')) || 0;
  // Harga desimal — dukung koma/titik ID/EN (contoh: "2.569" ID thousand→2569, "2,569"→2.569, "1.234,56"→1234.56)
  const parseSahamPrice = (s: string): number => {
    if (!s) return 0;
    let v = s.trim().replace(/\s/g, '');
    if (!v) return 0;
    if (v.includes('.') && v.includes(',')) {
      const lastDot = v.lastIndexOf('.');
      const lastComma = v.lastIndexOf(',');
      if (lastComma > lastDot) v = v.replace(/\./g, '').replace(',', '.');
      else v = v.replace(/,/g, '');
      v = v.replace(/[^0-9.\-]/g, '');
    } else if (v.includes(',')) {
      const parts = v.split(',');
      if (parts.length > 2) {
        const dec = parts.pop() as string;
        v = parts.join('') + '.' + dec;
      } else v = v.replace(',', '.');
      v = v.replace(/[^0-9.\-]/g, '');
    } else if (v.includes('.')) {
      const dotCount = (v.match(/\./g) || []).length;
      if (dotCount > 1) v = v.replace(/\./g, '').replace(/[^0-9.\-]/g, '');
      else {
        const [intPart, decPart] = v.split('.');
        if (decPart && decPart.length === 3 && /^\d{1,4}$/.test(intPart)) v = intPart + decPart;
        v = v.replace(/[^0-9.\-]/g, '');
        const dotIdx = v.indexOf('.');
        if (dotIdx !== -1) v = v.slice(0, dotIdx + 1) + v.slice(dotIdx + 1).replace(/\./g, '');
      }
    } else v = v.replace(/[^0-9.\-]/g, '');
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const sahamPrice = parseSahamPrice(sahamPriceStr);
  const sahamDerivedAmount = sahamLots * 100 * sahamPrice;
  const sahamBrokerFee = parseSahamPrice(sahamBrokerFeeStr);
  const sahamExchangeFee = parseSahamPrice(sahamExchangeFeeStr);
  const sahamTotalFee = sahamBrokerFee + sahamExchangeFee;
  const sahamNetProceeds = Math.max(0, sahamDerivedAmount - sahamTotalFee);
  const selectedHolding = useMemo(
    () => stockHoldings.find((h) => h.ticker === sahamTicker.trim().toUpperCase()),
    [stockHoldings, sahamTicker]
  );
  const availableLots = selectedHolding?.lots ?? 0;
  const realizedPreview = useMemo(() => {
    if (!selectedHolding || sahamLots <= 0 || sahamPrice <= 0) return 0;
    const gross = (sahamPrice - selectedHolding.buyPrice) * sahamLots * 100;
    return gross - sahamTotalFee;
  }, [selectedHolding, sahamLots, sahamPrice, sahamTotalFee]);

  const matchingTargets = useMemo(() => {
    let linked = findLinkedRecoveryTargets(type, category, recoveryItems);
    // Pelunasan spesifik: utamakan target yang judulnya = wadah piutang terpilih
    if (type === 'Income' && category === 'Pelunasan Piutang' && activePiutangAsset) {
      const key = activePiutangAsset.trim().toLowerCase();
      const byTitle = recoveryItems.filter(
        (it) => it.title.trim().toLowerCase() === key
      );
      if (byTitle.length > 0) linked = byTitle;
    }
    return linked;
  }, [type, category, activePiutangAsset, recoveryItems]);

  const applyTargetSuggestion = (txType: TransactionType, cat: string, piutangName?: string) => {
    let linked = findLinkedRecoveryTargets(txType, cat, recoveryItems);
    const activePiutang = piutangName ?? activePiutangAsset;
    if (txType === 'Income' && cat === 'Pelunasan Piutang' && activePiutang) {
      const key = activePiutang.trim().toLowerCase();
      const byTitle = recoveryItems.filter(
        (it) => it.title.trim().toLowerCase() === key
      );
      if (byTitle.length > 0) linked = byTitle;
    }
    if (linked.length === 0) {
      setTargetId('');
      return;
    }
    const matched = linked.find(
      (it) => it.status !== 'Recovered' && it.recoveredAmount < it.targetAmount
    );
    setTargetId(matched?.id ?? linked[0]?.id ?? '');
  };

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    const firstCategory = getOptionsForType(newType)?.[0] ?? category;
    setCategory(firstCategory);
    applyTargetSuggestion(newType, firstCategory);
    if (newType === 'Internal Transfer') {
      setIsExcludeReport(true);
      // default transfer: akun kas efek → akun lain, bila pengguna punya keduanya
      if (transferableAssets.length >= 2) {
        const rdnIdx = transferableAssets.findIndex((n) => /rdn|stockbit/i.test(n));
        if (rdnIdx >= 0) {
          setTransferFrom(transferableAssets[rdnIdx]);
          setTransferTo(transferableAssets.find((_, i) => i !== rdnIdx) ?? transferableAssets[0]);
        }
      }
    } else {
      setIsExcludeReport(false);
    }
    // Saham memakai akun kas efek bila pengguna sudah menambahkannya
    if (newType === 'Investment' && cashRdnName) {
      setWallet(cashRdnName);
    }
    // reset saham fields when switching type
    if (newType !== 'Investment') {
      setSahamTicker('');
      setSahamLotsStr('');
      setSahamPriceStr('');
      setSahamBrokerFeeStr('');
      setSahamExchangeFeeStr('');
    }
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    applyTargetSuggestion(type, cat);
    // Saham → akun kas efek bila ada
    if ((cat === 'Beli Saham' || cat === 'Jual Saham') && cashRdnName) {
      setWallet(cashRdnName);
    }
    // Transfer lama "Pindah Saldo X ke Y" → petakan ke From/To existing bila cocok
    if (type === 'Internal Transfer') {
      const parsed = parseTransferAssets(cat);
      if (parsed) {
        const norm = (s: string) => s.trim().toLowerCase();
        const findExisting = (key: string) => {
          const k = norm(key);
          return (
            transferableAssets.find((n) => norm(n) === k) ??
            transferableAssets.find((n) => norm(n).includes(k) || k.includes(norm(n))) ??
            ''
          );
        };
        const f = findExisting(parsed.from);
        const t = findExisting(parsed.to);
        if (f) setTransferFrom(f);
        if (t) setTransferTo(t);
      }
    }
    // reset jika pindah dari saham ke non-saham
    if (!(cat === 'Beli Saham' || cat === 'Jual Saham')) {
      setSahamTicker('');
      setSahamLotsStr('');
      setSahamPriceStr('');
      setSahamBrokerFeeStr('');
      setSahamExchangeFeeStr('');
    }
    // jika Jual tapi belum ada holdings, beri hint
    if (cat === 'Jual Saham' && stockHoldings.length > 0 && !sahamTicker) {
      setSahamTicker(stockHoldings[0].ticker);
      setSahamPriceStr(String(stockHoldings[0].marketPrice));
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (!raw) {
      setAmountStr('');
      return;
    }
    const num = parseInt(raw, 10);
    setAmountStr(num.toLocaleString('id-ID'));
  };

  // Tambah baru, atau simpan perubahan bila sedang edit (saldo lama dibalik → baru diterapkan).
  const saveTx = (data: Omit<Transaction, 'id'>) =>
    editingTx ? updateTransaction(editingTx.id, data) : addTransaction(data);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── Holdings-aware saham flow ──
    if (isSahamMode) {
      if (!activeSahamWallet.trim()) {
        toast('Tambah akun dulu di Setup.', 'err');
        return;
      }
      setIsSubmitting(true);
      try {
        const ticker = sahamTicker.trim().toUpperCase();
        if (!ticker || sahamLots <= 0 || sahamPrice <= 0) return;

        if (isSahamBeli) {
          const sahamWallet = activeSahamWallet;
          const existing = stockHoldings.find((h) => h.ticker === ticker);
          if (existing) {
            // Top-up existing: weighted avg buy price
            const newLots = existing.lots + sahamLots;
            const totalCost = existing.lots * 100 * existing.buyPrice + sahamLots * 100 * sahamPrice;
            const newAvg = totalCost / (newLots * 100);
            await updateStockHolding(
              existing.id,
              {
                lots: newLots,
                buyPrice: newAvg,
                marketPrice: sahamPrice,
                category: sahamCategory,
                strategy: sahamStrategy,
              },
              { date, wallet: sahamWallet as string }
            );
          } else {
            await addStockHolding(
              {
                ticker,
                lots: sahamLots,
                buyPrice: sahamPrice,
                marketPrice: sahamPrice,
                category: sahamCategory,
                strategy: sahamStrategy,
              },
              { date, wallet: sahamWallet as string }
            );
          }
        } else if (isSahamJual) {
          const sahamWallet = activeSahamWallet;
          const existing = stockHoldings.find((h) => h.ticker === ticker);
          if (!existing) return;
          if (sahamLots > existing.lots) return;
          const newLots = Math.max(0, existing.lots - sahamLots);
          // update with reduced lots + sell price as marketPrice + fee untuk net realized
          await updateStockHolding(
            existing.id,
            {
              lots: newLots,
              marketPrice: sahamPrice,
            },
            { date, wallet: sahamWallet as string, fee: sahamTotalFee }
          );
        }

        // reset & close
        setSahamTicker('');
        setSahamLotsStr('');
        setSahamPriceStr('');
        setSahamBrokerFeeStr('');
        setSahamExchangeFeeStr('');
        setAmountStr('');
        setNote('');
        setTargetId('');
        setIsQuickAddOpen(false);
        toast(isEdit ? 'Perubahan transaksi tersimpan' : 'Transaksi tersimpan');
      } catch (err) {
        console.error(err);
        toast('Gagal menyimpan transaksi', 'err');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // ── Generic transaction flow ──
    // Transfer Pindah dinamis: Dari/Ke → kategori "Pindah X ke Y"
    const isTransferPindah = type === 'Internal Transfer' && /^pindah\s+/i.test(category);
    if (isTransferPindah) {
      if (numericAmount <= 0) return;
      if (!activeTransferFrom || !activeTransferTo || activeTransferFrom === activeTransferTo) return;
      setIsSubmitting(true);
      try {
        const dynCategory = `Pindah ${activeTransferFrom} ke ${activeTransferTo}`;
        await saveTx({
          date,
          amount: numericAmount,
          category: dynCategory,
          type,
          wallet: activeTransferTo,
          note: note.trim() || `Pindah saldo ${activeTransferFrom} → ${activeTransferTo}`,
          isExcludeReport: true,
          targetId: '',
        });
        setAmountStr('');
        setNote('');
        setTargetId('');
        setIsQuickAddOpen(false);
        toast(isEdit ? 'Perubahan transaksi tersimpan' : 'Transaksi tersimpan');
      } catch (err) {
        console.error(err);
        toast('Gagal menyimpan transaksi', 'err');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    if (numericAmount <= 0) return;
    if (!wallet.trim()) {
      toast('Tambah akun dulu di Setup.', 'err');
      return;
    }

    setIsSubmitting(true);
    try {
      // Pelunasan spesifik: tautkan otomatis ke target berjudul = wadah piutang
      let finalTargetId = targetId;
      if (!finalTargetId && type === 'Income' && category === 'Pelunasan Piutang' && activePiutangAsset) {
        const key = activePiutangAsset.trim().toLowerCase();
        const byTitle =
          recoveryItems.find(
            (it) =>
              it.title.trim().toLowerCase() === key &&
              it.status !== 'Recovered' &&
              it.recoveredAmount < it.targetAmount
          ) ?? recoveryItems.find((it) => it.title.trim().toLowerCase() === key);
        if (byTitle) finalTargetId = byTitle.id;
      }
      const defaultNote =
        type === 'Income' && category === 'Pelunasan Piutang'
          ? `Pelunasan ${activePiutangAsset || 'Piutang'}`
          : `Transaksi ${category}`;
      await saveTx({
        date,
        amount: numericAmount,
        category,
        type,
        wallet,
        note: note.trim() || defaultNote,
        isExcludeReport,
        targetId: finalTargetId,
      });

      // Reset form
      setAmountStr('');
      setNote('');
      setTargetId('');
      setIsQuickAddOpen(false);
      toast(isEdit ? 'Perubahan transaksi tersimpan' : 'Transaksi tersimpan');
    } catch (err) {
      console.error(err);
      toast('Gagal menyimpan transaksi', 'err');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* FAB dipindah ke shell (page.tsx .fab) — membuka modal yang sama via setIsQuickAddOpen */}
      {/* Modal Dialog */}
      {isQuickAddOpen && (
        <div
          className="qa-overlay fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsQuickAddOpen(false);
          }}
        >
          <div
            className="glass modal qa-modal w-full max-w-lg rounded-t-3xl sm:rounded-[22px] p-5 sm:p-6 overflow-hidden max-h-[92dvh] overflow-y-auto"
            style={{
              WebkitOverflowScrolling: 'touch',
              paddingBottom: 'max(1.25rem, calc(env(safe-area-inset-bottom) + 0.75rem))',
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <div className="ico" style={{ width: 36, height: 36, borderRadius: 12, color: 'var(--accent)' }}>
                  <PlusCircle className="h-4 w-4" />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{isEdit ? 'Edit Transaksi' : 'Catat Transaksi'}</h3>
                  <p className="text-[11px] text-[#5A6478]">
                    {isEdit ? 'Saldo wadah ikut dikoreksi otomatis' : 'Pilih tipe, akun, dan kategori'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsQuickAddOpen(false)}
                className="ibtn"
                style={{ width: 36, height: 36 }}
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {isLocked && (
                <div className="qa-lock-note rounded-xl border border-[var(--border)] bg-[var(--glass)] px-3 py-2 text-[11px] text-[#5A6478]">
                  🔒 Transaksi ini dicatat otomatis ({editingTx?.type === 'Investment' && /Saham/.test(editingTx?.category ?? '') ? 'Portofolio Saham' : 'Kelola Aset di Setup'}).
                  Hanya tanggal & catatan yang bisa diubah — nominal, tipe, kategori, dan akun dikunci agar saldo wadah tidak dobel.
                </div>
              )}
              <fieldset disabled={isLocked} className="contents">
              {/* Type Switcher */}
              <div>
                <label className="block text-[11px] text-[#6B7280] font-medium mb-1.5">
                  Tipe Transaksi
                </label>
                <div className="seg qa-seg">
                  {(Object.keys(TYPE_STYLES) as TransactionType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTypeChange(t)}
                      className={type === t ? 'on' : ''}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input — hidden when saham mode (auto-derived) */}
              {!isSahamMode ? (
                <div>
                  <label className="block text-[11px] text-[#6B7280] font-medium mb-1">
                    Nominal (IDR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 mono font-bold" style={{ fontSize: 18, color: 'var(--muted)' }}>
                      Rp
                    </span>
                    <input
                      type="text"
                      required={!isSahamMode}
                      placeholder="0"
                      value={amountStr}
                      onChange={handleAmountChange}
                      className="qa-amount amt-input w-full rounded-[14px] pl-12 pr-4 py-2.5"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-2 flex items-center justify-between">
                  <span className="text-[11px] text-[#1E40AF] font-medium flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" /> Nominal otomatis
                  </span>
                  <span className="text-sm font-bold font-mono text-[#1E40AF]">
                    {formatRupiah(sahamDerivedAmount)}
                  </span>
                </div>
              )}

              {/* Category Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-[#6B7280] font-medium">
                    Kategori Transaksi
                  </label>
                  <span className="text-[10px] text-[#9CA3AF] font-mono">
                    {type === 'Investment'
                      ? '4 Instrumen · 8 Arah'
                      : type === 'Savings' && isSavingsDynamic
                        ? `${savingsOptions.length} Pilihan · dari Setup`
                        : `${getOptionsForType(type)?.length} Pilihan`}
                  </span>
                </div>

                {type === 'Investment' ? (
                  <>
                    {/* Compact grouped — 4 instrumen x 2 arah */}
                    <div className="grid grid-cols-2 gap-2">
                      {INVESTMENT_GROUPS.map((group) => (
                        <div
                          key={group.id}
                          className="rounded-lg border border-[#E5E5E3] bg-[#FBFBFA] p-2"
                        >
                          <p className="text-[10px] font-bold text-[#374151] leading-none truncate">
                            {'shortLabel' in group
                              ? (group as unknown as { shortLabel: string }).shortLabel
                              : group.label}
                          </p>
                          <p className="text-[9px] text-[#9CA3AF] truncate hidden sm:block">
                            {group.label}
                          </p>
                          <div className="mt-1.5 grid grid-cols-2 gap-1">
                            {([group.inCategory, group.outCategory] as const).map((cat) => {
                              const isIn = cat === group.inCategory;
                              const shortAction = isIn
                                ? group.id === 'saham'
                                  ? 'Beli'
                                  : group.id === 'emas'
                                    ? 'Beli'
                                    : 'Top Up'
                                : group.id === 'saham'
                                  ? 'Jual'
                                  : group.id === 'emas'
                                    ? 'Jual'
                                    : 'Tarik';
                              const isActive = category === cat;
                              return (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => handleCategoryChange(cat)}
                                  className={`h-6 rounded-md text-[10px] font-medium transition border ${
                                    isActive
                                      ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                                      : 'bg-white text-[#6B7280] border-[#E5E5E3] hover:text-[#1A1A1A] hover:bg-[#F1F1EF]'
                                  }`}
                                  title={cat}
                                >
                                  {shortAction}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Hidden select keeps native form compat + allows legacy category still selected */}
                    <select
                      value={category}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="sr-only"
                      tabIndex={-1}
                      aria-hidden
                    >
                      {CATEGORY_PRESETS[type]?.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      {/* legacy fallback — jika transaksi lama punya kategori lama tetap bisa tampil */}
                      {!CATEGORY_PRESETS[type]?.includes(category as never) && (
                        <option value={category}>{category} (legacy)</option>
                      )}
                    </select>
                  </>
                ) : (
                  <>
                    <select
                      value={category}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full h-8 rounded-lg border border-[#E5E5E3] bg-white px-3 text-xs text-[#1A1A1A] focus:border-[#1A1A1A] mb-2"
                    >
                      {getOptionsForType(type)?.map((cat) => (
                        <option key={cat} value={cat}>
                          {type === 'Savings' && isSavingsDynamic && savingsDisplayByName.get(cat) && savingsDisplayByName.get(cat) !== cat
                            ? `${cat} — ${savingsDisplayByName.get(cat)}`
                            : cat}
                        </option>
                      ))}
                      {/* legacy fallback — kategori lama / sebelum aset Setup dimuat tetap bisa tampil */}
                      {!getOptionsForType(type)?.includes(category as never) && (
                        <option value={category}>{category} (legacy)</option>
                      )}
                    </select>

                    {/* Quick Chips */}
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                      {getOptionsForType(type)?.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => handleCategoryChange(cat)}
                          className={`rounded-md px-2 py-0.5 text-[10px] transition border ${
                            category === cat
                              ? 'qchip-on'
                              : 'bg-[#F7F7F5] text-[#6B7280] border-[#E5E5E3] hover:text-[#1A1A1A] hover:bg-[#F1F1EF]'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    {type === 'Savings' && isSavingsDynamic && (
                      <p className="text-[10px] text-[#9CA3AF] mt-1 font-mono">
                        Mengikuti wadah aset di Setup · piutang via Income Pelunasan Piutang
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* ── Picker wadah piutang (Income Pelunasan Piutang ← Setup) ── */}
              {type === 'Income' && category === 'Pelunasan Piutang' && piutangOptions.length > 0 && (
                <div>
                  <label className="block text-[11px] text-[#6B7280] font-medium mb-1">
                    Wadah Piutang (dari Setup)
                  </label>
                  <select
                    value={activePiutangAsset}
                    onChange={(e) => {
                      setPiutangAsset(e.target.value);
                      applyTargetSuggestion(type, category, e.target.value);
                    }}
                    className="w-full h-8 rounded-lg border border-[#E5E5E3] bg-white px-3 text-xs text-[#1A1A1A] focus:border-[#1A1A1A]"
                  >
                    {piutangOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                        {savingsDisplayByName.get(p) && savingsDisplayByName.get(p) !== p
                          ? ` — ${savingsDisplayByName.get(p)}`
                          : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#9CA3AF] mt-1 font-mono">
                    Pelunasan mengurangi nilai {activePiutangAsset || 'wadah piutang'} di Kelola Aset
                  </p>
                </div>
              )}

              {/* ── Holdings-aware Saham Section ── */}
              {isSahamMode && (
                <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[#1E40AF] flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {isSahamBeli ? 'Beli Saham — refer ke Holdings' : 'Jual Saham — pilih dari Holdings'}
                    </p>
                    <span className="text-[10px] font-mono text-[#60A5FA]">
                      {stockHoldings.length} holdings · 1 lot = 100 lbr
                    </span>
                  </div>

                  {isSahamBeli ? (
                    <>
                      {/* Ticker */}
                      <div>
                        <label className="block text-[11px] text-[#1E40AF] font-medium mb-1">
                          Kode Saham (Ticker)
                        </label>
                        <input
                          list="saham-ticker-list"
                          value={sahamTicker}
                          onChange={(e) => {
                            const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                            setSahamTicker(v);
                            const existing = stockHoldings.find((h) => h.ticker === v);
                            if (existing) {
                              setSahamCategory(existing.category ?? 'non_likuid');
                              setSahamStrategy(existing.strategy ?? 'Long-Term');
                              setSahamPriceStr(String(existing.marketPrice || existing.buyPrice));
                            }
                          }}
                          placeholder="TLKM, BBCA, BBRI..."
                          className="w-full h-8 rounded-lg border border-[#BFDBFE] bg-white px-3 text-xs font-mono font-bold uppercase text-[#1E3A8A] placeholder:text-[#93C5FD] focus:border-[#1E40AF]"
                        />
                        <datalist id="saham-ticker-list">
                          {stockHoldings.map((h) => (
                            <option key={h.id} value={h.ticker}>
                              {h.ticker} — {h.lots} lot @ {formatRupiah(h.buyPrice)}
                            </option>
                          ))}
                        </datalist>
                        {selectedHolding && (
                          <p className="text-[10px] text-[#3B82F6] mt-1 font-mono">
                            Existing: {selectedHolding.lots} lot · avg {formatRupiah(selectedHolding.buyPrice)} · market{' '}
                            {formatRupiah(selectedHolding.marketPrice)} · {getStockShares(selectedHolding)} lbr
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-[#1E40AF] font-medium mb-1">
                            Jumlah Lot
                          </label>
                          <input
                            inputMode="decimal"
                            value={sahamLotsStr}
                            onChange={(e) => setSahamLotsStr(e.target.value.replace(/[^0-9.,]/g, ''))}
                            placeholder="4"
                            className="w-full h-8 rounded-lg border border-[#BFDBFE] bg-white px-3 text-xs font-mono text-[#1E3A8A] focus:border-[#1E40AF]"
                          />
                          <p className="text-[10px] text-[#60A5FA] mt-0.5 font-mono">
                            = {sahamLots ? sahamLots * 100 : 0} lembar
                          </p>
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#1E40AF] font-medium mb-1">
                            Harga /lembar
                          </label>
                          <input
                            inputMode="decimal"
                            value={sahamPriceStr}
                            onChange={(e) => setSahamPriceStr(e.target.value.replace(/[^0-9.,]/g, ''))}
                            placeholder="2.520 atau 2,5"
                            className="w-full h-8 rounded-lg border border-[#BFDBFE] bg-white px-3 text-xs font-mono text-[#1E3A8A] focus:border-[#1E40AF]"
                          />
                          <p className="text-[10px] text-[#60A5FA] mt-0.5 font-mono truncate">
                            Total: {formatRupiah(sahamDerivedAmount)}
                          </p>
                        </div>
                      </div>

                      {/* Kategori & Strategi untuk new / top-up */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-[#1E40AF] font-medium mb-1">
                            Kategori
                          </label>
                          <select
                            value={sahamCategory}
                            onChange={(e) => setSahamCategory(e.target.value as AssetCategory)}
                            className="w-full h-8 rounded-lg border border-[#BFDBFE] bg-white px-2 text-xs text-[#1E3A8A] focus:border-[#1E40AF]"
                          >
                            <option value="non_likuid">Non-Likuid</option>
                            <option value="likuid">Likuid</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#1E40AF] font-medium mb-1">
                            Strategi
                          </label>
                          <select
                            value={sahamStrategy}
                            onChange={(e) => setSahamStrategy(e.target.value as StockStrategy)}
                            className="w-full h-8 rounded-lg border border-[#BFDBFE] bg-white px-2 text-xs text-[#1E3A8A] focus:border-[#1E40AF]"
                          >
                            {STOCK_STRATEGIES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {selectedHolding && sahamLots > 0 && sahamPrice > 0 && (
                        <p className="text-[10px] font-mono text-[#1E40AF] bg-white rounded-md border border-[#BFDBFE] px-2 py-1.5">
                          weighted avg baru: {formatRupiah((selectedHolding.lots * 100 * selectedHolding.buyPrice + sahamLots * 100 * sahamPrice) / ((selectedHolding.lots + sahamLots) * 100))}
                          {' · '}sisa {selectedHolding.lots}→{selectedHolding.lots + sahamLots} lot
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Jual: pilih holdings */}
                      {stockHoldings.length === 0 ? (
                        <div className="flex items-center gap-2 text-xs text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          Belum ada holdings — tidak bisa jual. Beli dulu di Beli Saham.
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-[11px] text-[#1E40AF] font-medium mb-1">
                              Pilih Saham dari Holdings
                            </label>
                            <select
                              value={sahamTicker}
                              onChange={(e) => {
                                setSahamTicker(e.target.value);
                                const h = stockHoldings.find((x) => x.ticker === e.target.value);
                                if (h) setSahamPriceStr(String(h.marketPrice));
                              }}
                              className="w-full h-8 rounded-lg border border-[#BFDBFE] bg-white px-2 text-xs font-mono text-[#1E3A8A] focus:border-[#1E40AF]"
                            >
                              <option value="">— Pilih ticker —</option>
                              {stockHoldings.map((h) => (
                                <option key={h.id} value={h.ticker}>
                                  {h.ticker} — {h.lots} lot · {getStockShares(h)} lbr · avg {formatRupiah(h.buyPrice)} · market{' '}
                                  {formatRupiah(h.marketPrice)}
                                </option>
                              ))}
                            </select>
                            {selectedHolding && (
                              <p className="text-[10px] text-[#3B82F6] mt-1 font-mono">
                                Tersedia {selectedHolding.lots} lot ({getStockShares(selectedHolding)} lbr) · {selectedHolding.strategy} ·{' '}
                                {selectedHolding.category}
                              </p>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] text-[#1E40AF] font-medium mb-1">
                                Lot dijual
                              </label>
                              <input
                                inputMode="decimal"
                                value={sahamLotsStr}
                                onChange={(e) => setSahamLotsStr(e.target.value.replace(/[^0-9.,]/g, ''))}
                                placeholder="1"
                                className="w-full h-8 rounded-lg border border-[#BFDBFE] bg-white px-3 text-xs font-mono text-[#1E3A8A] focus:border-[#1E40AF]"
                              />
                              {selectedHolding && sahamLots > availableLots && (
                                <p className="text-[10px] text-[#DC2626] mt-0.5">Melebihi {availableLots} lot</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-[11px] text-[#1E40AF] font-medium mb-1">
                                Harga jual /lembar
                              </label>
                              <input
                                inputMode="decimal"
                                value={sahamPriceStr}
                                onChange={(e) => setSahamPriceStr(e.target.value.replace(/[^0-9.,]/g, ''))}
                                placeholder={selectedHolding ? String(selectedHolding.marketPrice).replace('.', ',') : '2.520'}
                                className="w-full h-8 rounded-lg border border-[#BFDBFE] bg-white px-3 text-xs font-mono text-[#1E3A8A] focus:border-[#1E40AF]"
                              />
                            </div>
                          </div>
                          {/* Broker fee — sesuai Order Detail BSSR */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] text-[#1E40AF] font-medium mb-1">
                                Broker Fee
                              </label>
                              <input
                                inputMode="decimal"
                                value={sahamBrokerFeeStr}
                                onChange={(e) => setSahamBrokerFeeStr(e.target.value.replace(/[^0-9.,]/g, ''))}
                                placeholder="2.326,06"
                                className="w-full h-8 rounded-lg border border-[#BFDBFE] bg-white px-3 text-xs font-mono text-[#1E3A8A] focus:border-[#1E40AF]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-[#1E40AF] font-medium mb-1">
                                Exchange Fee
                              </label>
                              <input
                                inputMode="decimal"
                                value={sahamExchangeFeeStr}
                                onChange={(e) => setSahamExchangeFeeStr(e.target.value.replace(/[^0-9.,]/g, ''))}
                                placeholder="3.123,94"
                                className="w-full h-8 rounded-lg border border-[#BFDBFE] bg-white px-3 text-xs font-mono text-[#1E3A8A] focus:border-[#1E40AF]"
                              />
                            </div>
                          </div>
                          {sahamTotalFee > 0 && (
                            <p className="text-[10px] font-mono text-[#6B7280] bg-white rounded-md border border-[#BFDBFE] px-2 py-1.5">
                              Fee total {formatRupiah(sahamTotalFee)} · Net proceeds {formatRupiah(sahamNetProceeds)} (gross {formatRupiah(sahamDerivedAmount)} − fee)
                            </p>
                          )}
                          {selectedHolding && sahamLots > 0 && sahamLots <= availableLots && sahamPrice > 0 && (
                            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                              <div className="rounded-md bg-white border border-[#BFDBFE] px-2 py-1.5">
                                <p className="text-[10px] text-[#60A5FA]">Nominal jual</p>
                                <p className="font-bold text-[#1E3A8A]">{formatRupiah(sahamDerivedAmount)}</p>
                                {sahamTotalFee > 0 && <p className="text-[10px] text-[#6B7280]">Net {formatRupiah(sahamNetProceeds)}</p>}
                              </div>
                              <div
                                className={`rounded-md border px-2 py-1.5 ${realizedPreview >= 0 ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]' : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'}`}
                              >
                                <p className="text-[10px]">Realized P&L {sahamTotalFee > 0 ? '(net fee)' : ''}</p>
                                <p className="font-bold">
                                  {realizedPreview >= 0 ? '+' : ''}
                                  {formatRupiah(realizedPreview)}
                                </p>
                              </div>
                            </div>
                          )}
                          {selectedHolding && sahamLots === availableLots && availableLots > 0 && (
                            <p className="text-[10px] text-[#B45309] font-mono">Full sell — holdings {selectedHolding.ticker} akan 0 lot (tertutup)</p>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Link to Target */}
              {matchingTargets.length > 0 && (
                <div className="rounded-lg border border-[#E5E5E3] bg-[#F7F7F5] p-2.5">
                  <label className="block text-[11px] text-[#6B7280] font-medium mb-1">
                    Tautkan ke Target ({type})
                  </label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full h-8 rounded-lg border border-[#E5E5E3] bg-white px-3 text-xs text-[#1A1A1A] focus:border-[#1A1A1A]"
                  >
                    <option value="">— Tanpa target —</option>
                    {matchingTargets.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.title} (sisa {formatRupiah(it.targetAmount - it.recoveredAmount)})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#9CA3AF] mt-1 font-mono">
                    Sistem otomatis menautkan transaksi ke target berdasarkan kategori; nilai
                    Terealisasi & progres target diperbarui real-time.
                  </p>
                </div>
              )}

              {/* Transfer Pindah: Dari → Ke, akun diambil dari Setup */}
              {isTransferPindah && (
                <div className="rounded-xl border border-[#E5E5E3] bg-[#F7F7F5] p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-[#6B7280] font-medium mb-1">
                        Dari
                      </label>
                      <select
                        value={activeTransferFrom}
                        onChange={(e) => setTransferFrom(e.target.value)}
                        className="w-full h-8 rounded-lg border border-[#E5E5E3] bg-white px-2 text-xs text-[#1A1A1A] focus:border-[#1A1A1A]"
                      >
                        {transferableAssets.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#6B7280] font-medium mb-1">
                        Ke
                      </label>
                      <select
                        value={activeTransferTo}
                        onChange={(e) => setTransferTo(e.target.value)}
                        className="w-full h-8 rounded-lg border border-[#E5E5E3] bg-white px-2 text-xs text-[#1A1A1A] focus:border-[#1A1A1A]"
                      >
                        {transferableAssets.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#6B7280] font-mono">
                    {activeTransferFrom && activeTransferTo
                      ? activeTransferFrom === activeTransferTo
                        ? 'Pilih wadah berbeda — Dari dan Ke tidak boleh sama.'
                        : `Pindah ${formatRupiah(numericAmount)} · ${activeTransferFrom} − → ${activeTransferTo} + (netral, tanpa ubah total aset)`
                      : 'Pilih wadah asal & tujuan dari Setup.'}
                  </p>
                </div>
              )}

              </fieldset>

              {/* Account (Wallet) & Date Row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Wallet */}
                {!isTransferPindah && (
                  <div>
                    <label className="block text-[11px] text-[#6B7280] font-medium mb-1">
                      {isSahamMode ? 'Akun Dompet (Kas Saham)' : 'Akun Dompet'}
                    </label>
                    <select
                      value={isSahamMode ? activeSahamWallet : wallet}
                      disabled={isLocked}
                      onChange={(e) => setWallet(e.target.value)}
                      className="w-full h-8 rounded-lg border border-[#E5E5E3] bg-white px-2.5 text-xs text-[#1A1A1A] focus:border-[#1A1A1A]"
                    >
                      {(() => {
                        // Utamakan wadah Setup agar string wallet == nama aset (saldo pasti kena).
                        // Akhiran "Syariah" diabaikan supaya satu rekening tidak muncul dua kali.
                        const names = isSahamMode
                          ? sahamWalletOptions
                          : (() => {
                              const norm = (s: string) => s.trim().toLowerCase().replace(/\s+syariah$/, '');
                              const seen = new Set<string>();
                              const merged: string[] = [];
                              const push = (n: string) => {
                                const k = norm(n);
                                if (!k || seen.has(k)) return;
                                seen.add(k);
                                merged.push(n);
                              };
                              for (const n of transferableAssets) push(n);
                              for (const n of OPERATIONAL_WALLETS) push(n);
                              return merged;
                            })();
                        if (names.length === 0) {
                          return <option value="">Tambah akun di Setup</option>;
                        }
                        return names.map((w) => (
                          <option key={w} value={w}>
                            {w}
                            {isSahamMode && cashRdnName && w === cashRdnName ? ' — RDN' : ''}
                          </option>
                        ));
                      })()}
                    </select>
                    {isSahamMode && cashRdnName && (
                      <p className="text-[10px] text-[#1E40AF] mt-1 font-mono">
                        {isSahamBeli ? `Beli → ${cashRdnName} berkurang` : `Jual → ${cashRdnName} nambah`} otomatis · saldo bisa dipindah antar akun lewat Transfer.
                      </p>
                    )}
                  </div>
                )}

                {/* Date */}
                <div className={isTransferPindah ? 'col-span-2' : ''}>
                  <label className="block text-[11px] text-[#6B7280] font-medium mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-8 rounded-lg border border-[#E5E5E3] bg-white px-2.5 text-xs text-[#1A1A1A] focus:border-[#1A1A1A] font-mono"
                  />
                </div>
              </div>

              {/* Note / Description */}
              <div>
                <label className="block text-[11px] text-[#6B7280] font-medium mb-1">
                  Catatan / Keterangan
                </label>
                <input
                  type="text"
                  placeholder="Keterangan transaksi (opsional)..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full h-8 rounded-lg border border-[#E5E5E3] bg-white px-3 text-xs text-[#1A1A1A] placeholder-[#B5B5B0] focus:border-[#1A1A1A]"
                />
              </div>

              {/* Exclude Report Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="modalExclude"
                  checked={isExcludeReport}
                  onChange={(e) => setIsExcludeReport(e.target.checked)}
                  className="rounded border-[#CDCDC9] text-[#1A1A1A] focus:ring-0"
                />
                <label htmlFor="modalExclude" className="text-[11px] text-[#6B7280] cursor-pointer">
                  Abaikan dari laporan pengeluaran (Exclude Report)
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E3]">
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="h-9 px-4 rounded-full border border-[#E7EBF6] bg-white text-xs font-semibold text-[#5A6478] hover:text-[#0F1932] hover:bg-[#F4F6FC] active:scale-[0.98] transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (isSahamMode
                      ? isSahamBeli
                        ? !sahamTicker.trim() || sahamLots <= 0 || sahamPrice <= 0
                        : !sahamTicker || sahamLots <= 0 || sahamPrice <= 0 || (selectedHolding ? sahamLots > availableLots : true)
                      : isTransferPindah
                        ? numericAmount <= 0 || !activeTransferFrom || !activeTransferTo || activeTransferFrom === activeTransferTo
                        : numericAmount <= 0)
                  }
                  className="btn primary disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isSubmitting ? 'Menyimpan...' : isSahamMode ? (isSahamBeli ? 'Beli Saham' : 'Jual Saham') : isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
