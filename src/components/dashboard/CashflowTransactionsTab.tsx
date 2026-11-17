'use client';

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from '@/lib/toast';
import { AnimatedRupiah, GlassCard } from '@/components/ui/minimal';
import { useFinance } from '@/context/FinanceContext';
import { formatRupiah } from '@/lib/utils';
import {
  ALL_OFFICIAL_CATEGORIES,
  TransactionType,
  type Transaction,
  isBalanceLockedTx,
} from '@/types/finance';
import type { LucideIcon } from 'lucide-react';
import {
  Search,
  Trash2,
  Pencil,
  Lock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Repeat,
  PlusCircle,
  Target,
  RotateCcw,
  Inbox,
  Banknote,
  Laptop,
  Handshake,
  Wallet,
  Sparkles,
  ShoppingBasket,
  Receipt,
  Car,
  HeartHandshake,
  ShoppingBag,
  HeartPulse,
  Coffee,
  Shirt,
  Gamepad2,
  Gift,
  Plane,
  TrendingUp,
  TrendingDown,
  Coins,
  Landmark,
  ScrollText,
  LifeBuoy,
  Heart,
  RefreshCcw,
  Home,
  MoonStar,
  GraduationCap,
  PiggyBank,
} from 'lucide-react';

/* ── Mobile app-style palette per tipe transaksi ── */
const NEUTRAL_ICON = 'bg-[var(--glass-2)] border border-[var(--border)]';
const TYPE_UI: Record<
  TransactionType,
  { chip: string; iconBg: string; iconText: string; amount: string; sign: string }
> = {
  Income: { chip: 'tp inc', iconBg: NEUTRAL_ICON, iconText: 'text-[var(--green)]', amount: 'text-[var(--green)]', sign: '+' },
  Needs: { chip: 'tp needs', iconBg: NEUTRAL_ICON, iconText: 'text-[var(--accent)]', amount: 'text-[var(--red)]', sign: '−' },
  Wants: { chip: 'tp wants', iconBg: NEUTRAL_ICON, iconText: 'text-[var(--muted)]', amount: 'text-[var(--red)]', sign: '−' },
  Savings: { chip: 'tp wants', iconBg: NEUTRAL_ICON, iconText: 'text-[var(--muted)]', amount: 'text-[var(--red)]', sign: '−' },
  Investment: { chip: 'tp wants', iconBg: NEUTRAL_ICON, iconText: 'text-[var(--muted)]', amount: 'text-[var(--red)]', sign: '−' },
  'Internal Transfer': { chip: 'tp trf', iconBg: NEUTRAL_ICON, iconText: 'text-[var(--faint)]', amount: 'text-[var(--muted)]', sign: '⇄' },
};

/* Kelas chip tipe untuk tabel desktop (mockup .tp) */
const TYPE_CHIP: Record<TransactionType, string> = {
  Income: 'inc',
  Needs: 'needs',
  Wants: 'wants',
  Savings: 'wants',
  Investment: 'wants',
  'Internal Transfer': 'trf',
};

/* Titik warna brand akun (mockup .acc i) */
const WALLET_DOT: Record<string, string> = {
  'Jago Syariah': '#F59E0B',
  Jago: '#F59E0B',
  Mandiri: '#2563EB',
  Bibit: '#10B981',
  Stockbit: '#10B981',
  Saham: '#64748B',
};

const TYPE_FALLBACK_KEY: Record<TransactionType, string> = {
  Income: 'Monthly Salary',
  Needs: 'Food & Groceries',
  Wants: 'Others',
  Savings: 'Top Up Saldo',
  Investment: 'Beli Emas',
  'Internal Transfer': 'Tarik Tunai',
};

/* ── Icon lucu per kategori (resmi 32 + dinami/nama dinamis di-fallback per kata kunci) ── */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  // Income
  'Monthly Salary': Banknote,
  'Freelance / Side Job': Laptop,
  'Pelunasan Piutang': Handshake,
  'Pencairan Investasi': Wallet,
  Others: Sparkles,
  // Needs
  'Food & Groceries': ShoppingBasket,
  'Utilities & Bill': Receipt,
  Transportation: Car,
  'Family Support': HeartHandshake,
  'Personal Items': ShoppingBag,
  Healthcare: HeartPulse,
  // Wants
  'Nongkrong & Kopi': Coffee,
  'Shopping & Outfit': Shirt,
  'Entertainment & Hobby': Gamepad2,
  'Gifts & Donations': Gift,
  'Travel & Outing': Plane,
  // Investment
  'Beli Saham': TrendingUp,
  'Jual Saham': TrendingDown,
  'Beli Emas': Coins,
  'Jual Emas': Coins,
  'Top Up Reksa Dana Pasar Uang': Landmark,
  'Tarik Reksa Dana Pasar Uang': Landmark,
  'Top Up Reksa Dana Obligasi': ScrollText,
  'Tarik Reksa Dana Obligasi': ScrollText,
  // Savings
  'Dana Darurat': LifeBuoy,
  'Obligasi / SBN': ScrollText,
  'Tabungan Masa Depan': Heart,
  'Recovery Fund': RefreshCcw,
  'DP / Beli Rumah': Home,
  'Tabungan Umroh': MoonStar,
  'Dana Pendidikan Anak': GraduationCap,
  'Top Up Saldo': PiggyBank,
  'Tarik Tunai': Banknote,
};

/** Fallback per kata kunci untuk kategori dinamis (wadah Setup) */
const KEYWORD_ICON_KEY: [RegExp, string][] = [
  [/transfer/, 'Tarik Tunai'],
  [/emas/, 'Beli Emas'],
  [/saham/, 'Beli Saham'],
  [/obligasi|sbn/, 'Obligasi / SBN'],
  [/reksa dana/, 'Top Up Reksa Dana Pasar Uang'],
  [/piutang/, 'Pelunasan Piutang'],
  [/gaji/, 'Monthly Salary'],
  [/masa depan/, 'Tabungan Masa Depan'],
  [/umroh|haji/, 'Tabungan Umroh'],
  [/rumah/, 'DP / Beli Rumah'],
  [/darurat/, 'Dana Darurat'],
  [/pendidikan|sekolah/, 'Dana Pendidikan Anak'],
];

/** Mengembalikan KUNCI icon (string, bukan komponen) — murni data, aman dipanggil saat render */
function getTxIconKey(category: string, type: TransactionType): string {
  const c = (category || '').trim();
  if (CATEGORY_ICONS[c]) return c;
  const lower = c.toLowerCase();
  for (const [re, key] of KEYWORD_ICON_KEY) {
    if (re.test(lower)) return key;
  }
  return TYPE_FALLBACK_KEY[type];
}

const ICON_BY_KEY: Record<string, LucideIcon> = {
  ...CATEGORY_ICONS,
  ArrowLeftRight: ArrowLeftRight,
};

const BULAN_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** "2026-10-13" → "13 Okt" / "13 Okt 2026" */
function fmtDateId(date: string, withYear = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date || '');
  if (!m) return date;
  return `${Number(m[3])} ${BULAN_ID[Number(m[2]) - 1]}${withYear ? ` ${m[1]}` : ''}`;
}

/** "2026-10" → "Oktober 2026" */
function fmtMonthId(ym: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(ym || '');
  if (!m) return ym;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

/* ── Baris transaksi mobile (flat list, tap untuk expand detail) ── */
function TxRow({
  tx,
  expanded,
  targetTitle,
  onToggle,
  onEdit,
  onDelete,
  delay,
}: {
  tx: Transaction;
  expanded: boolean;
  targetTitle?: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  delay: number;
}) {
  const ui = TYPE_UI[tx.type];
  const Icon = ICON_BY_KEY[getTxIconKey(tx.category, tx.type)] ?? Sparkles;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay }}
    >
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={{ scale: 0.985 }}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[var(--glass-2)]"
        aria-expanded={expanded}
      >
        <span
          className={`h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center ${ui.iconBg} ${ui.iconText}`}
        >
          <Icon size={18} strokeWidth={2.2} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block truncate text-[13px] font-semibold text-[#0F1932]">
            {tx.note || tx.category}
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-[10.5px] text-[#8A93A8]">
            <span className="max-w-[120px] truncate">{tx.category}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{tx.wallet}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0 font-mono text-[10px]">{fmtDateId(tx.date)}</span>
            {tx.targetId && <Target className="h-3 w-3 shrink-0 text-[var(--accent)]" />}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className={`money font-mono text-[13px] font-bold leading-none ${ui.amount}`}>
            {ui.sign}
            {formatRupiah(tx.amount)}
          </span>
          <span
            className={`${ui.chip} max-w-[92px] truncate`}
            style={{ fontSize: 9, padding: '2px 7px' }}
          >
            {tx.type}
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[#A8B0C2] transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3.5">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--glass)] p-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#A8B0C2]">
                  Detail Transaksi
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-4 text-[11.5px]">
                    <span className="text-[#8A93A8] shrink-0">Catatan</span>
                    <span className="font-medium text-[#0F1932] text-right">{tx.note || '-'}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4 text-[11.5px]">
                    <span className="text-[#8A93A8] shrink-0">Tanggal</span>
                    <span className="font-medium font-mono text-[#0F1932]">{fmtDateId(tx.date, true)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4 text-[11.5px]">
                    <span className="text-[#8A93A8] shrink-0">Tipe</span>
                    <span
                      className={ui.chip}
                    >
                      {tx.type}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4 text-[11.5px]">
                    <span className="text-[#8A93A8] shrink-0">Akun Dompet</span>
                    <span className="font-medium text-[#0F1932]">{tx.wallet}</span>
                  </div>
                  {tx.category && (
                    <div className="flex items-start justify-between gap-4 text-[11.5px]">
                      <span className="text-[#8A93A8] shrink-0">Kategori</span>
                      <span className="font-medium text-[#0F1932] text-right">{tx.category}</span>
                    </div>
                  )}
                  {targetTitle && (
                    <div className="flex items-start justify-between gap-4 text-[11.5px]">
                      <span className="text-[#8A93A8] shrink-0">Target</span>
                      <span className="inline-flex items-center gap-1 text-[var(--accent)] font-medium text-right">
                        <Target className="h-3 w-3 shrink-0" />
                        {targetTitle}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={onEdit} className="btn justify-center">
                    {isBalanceLockedTx(tx) ? <Lock className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                    Edit
                  </button>
                  <button type="button" onClick={onDelete} className="btn danger justify-center">
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Empty state mobile (lucu, dengan tombol reset filter) ── */
function MobileEmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 px-6 text-center">
      <motion.span
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        className="ico h-12 w-12 rounded-2xl"
      >
        <Inbox size={22} strokeWidth={2} />
      </motion.span>
      <p className="text-[13px] font-semibold text-[#0F1932]">Tidak ada transaksi</p>
      <p className="text-[11px] text-[#8A93A8] max-w-[230px] leading-relaxed">
        Catat transaksi pertama, atau ubah filter bila data sudah ada.
      </p>
      <button
        onClick={onReset}
        className="btn primary mt-1"
      >
        <RotateCcw size={12} strokeWidth={2.4} />
        Reset Filter
      </button>
    </div>
  );
}

export function CashflowTransactionsTab() {
  const { transactions, deleteTransaction, setIsQuickAddOpen, openEditTransaction, recoveryItems } = useFinance();
  // Konfirmasi hapus (dialog kaca, bukan window.confirm)
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedWallet, setSelectedWallet] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Mobile: id transaksi yang accordion detailnya terbuka
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedWallet('all');
    setSelectedCategory('all');
    setSelectedType('all');
    setSelectedMonth('all');
    setCurrentPageSafe(1);
    setExpandedTx(null);
  };

  const setCurrentPageSafe = (page: number) => {
    setCurrentPage(page);
    setExpandedTx(null);
  };

  // Available months extracted from transactions
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.date) {
        months.add(tx.date.substring(0, 7)); // YYYY-MM
      }
    });
    return Array.from(months).sort().reverse();
  }, [transactions]);

  const availableWallets = useMemo(() => {
    const names = new Set<string>();
    for (const tx of transactions) {
      const name = (tx.wallet || '').trim();
      if (name) names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'id'));
  }, [transactions]);

  // Opsi kategori: resmi + kategori dinamis (nama wadah Setup) yang dipakai transaksi
  const availableCategories = useMemo(() => {
    const known = new Set<string>(ALL_OFFICIAL_CATEGORIES as readonly string[]);
    const extra: string[] = [];
    for (const tx of transactions) {
      if (tx.category && !known.has(tx.category)) {
        known.add(tx.category);
        extra.push(tx.category);
      }
    }
    return [...(ALL_OFFICIAL_CATEGORIES as readonly string[]), ...extra.sort()];
  }, [transactions]);

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      // Wallet filter
      if (selectedWallet !== 'all' && tx.wallet !== selectedWallet) {
        return false;
      }
      // Category filter
      if (selectedCategory !== 'all' && tx.category !== selectedCategory) {
        return false;
      }
      // Type filter
      if (selectedType !== 'all' && tx.type !== selectedType) {
        return false;
      }
      // Month filter
      if (selectedMonth !== 'all' && !tx.date.startsWith(selectedMonth)) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCategory = tx.category.toLowerCase().includes(q);
        const matchesNote = tx.note.toLowerCase().includes(q);
        const matchesWallet = tx.wallet.toLowerCase().includes(q);
        const matchesAmount = String(tx.amount).includes(q);
        if (!matchesCategory && !matchesNote && !matchesWallet && !matchesAmount) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, selectedWallet, selectedCategory, selectedType, selectedMonth, searchQuery]);

  // Filtered summary calculations
  const filteredSummary = useMemo(() => {
    let income = 0;
    let expense = 0;

    filtered.forEach((tx) => {
      if (tx.isExcludeReport || tx.type === 'Internal Transfer') return;
      if (tx.type === 'Income') {
        income += tx.amount;
      } else {
        expense += tx.amount;
      }
    });

    return {
      income,
      expense,
      net: income - expense,
    };
  }, [filtered]);

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPageSafe(page);
    }
  };

  // Sort (presentasi saja; data & filter tetap sama)
  const [sortKey, setSortKey] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const toggleSort = (key: 'date' | 'amount') => {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(-1);
    }
    setCurrentPageSafe(1);
  };
  const sortedPage = useMemo(() => {
    const rows = filtered.map((t, i) => [t, i] as const);
    rows.sort(([a, ia], [b, ib]) => {
      const r = sortKey === 'amount' ? a.amount - b.amount : a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      return r * sortDir || ia - ib;
    });
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize).map(([t]) => t);
  }, [filtered, sortKey, sortDir, currentPage, pageSize]);

  const handleDelete = (tx: Transaction) => setPendingDelete(tx);
  const confirmDelete = () => {
    const tx = pendingDelete;
    setPendingDelete(null);
    if (!tx) return;
    void Promise.resolve(deleteTransaction(tx.id)).then(
      () => toast(`“${tx.note || tx.category}” dihapus`, 'info'),
      () => toast('Gagal menghapus transaksi', 'err'),
    );
    setExpandedTx(null);
  };

  const amountNode = (tx: Transaction) => {
    if (tx.type === 'Income') return <span className="pos money">+ {formatRupiah(tx.amount)}</span>;
    if (tx.type === 'Internal Transfer')
      return (
        <span className="money" style={{ color: 'var(--muted)' }}>
          ⇄ {formatRupiah(tx.amount)}
        </span>
      );
    return <span className="neg money">− {formatRupiah(tx.amount)}</span>;
  };

  const showingFrom = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingTo = Math.min(currentPage * pageSize, filtered.length);

  return (
    <div className="kgrid">
      {/* ── Ringkasan terfilter (3 kartu kaca) ── */}
      <GlassCard tilt className="s4 cf-stat">
        <div className="row">
          <div className="lbl">Filtered Income</div>
          <div className="ico">
            <ArrowDownLeft size={18} />
          </div>
        </div>
        <div className="big mono money">
          <AnimatedRupiah value={filteredSummary.income} />
        </div>
        <div className="sub">Total pemasukan sesuai filter</div>
      </GlassCard>
      <GlassCard tilt className="s4 cf-stat">
        <div className="row">
          <div className="lbl">Filtered Spending</div>
          <div className="ico">
            <ArrowUpRight size={18} />
          </div>
        </div>
        <div className="big mono money">
          <AnimatedRupiah value={filteredSummary.expense} />
        </div>
        <div className="sub">Needs, wants, savings &amp; investasi (tanpa transfer internal)</div>
      </GlassCard>
      <GlassCard tilt className="s4 cf-stat">
        <div className="row">
          <div className="lbl">Net Cashflow</div>
          <div className="ico">
            <Repeat size={18} />
          </div>
        </div>
        <div className={`big mono money ${filteredSummary.net >= 0 ? 'pos' : 'neg'}`}>
          <AnimatedRupiah value={filteredSummary.net} signed />
        </div>
        <div className="sub">Income − Spending</div>
      </GlassCard>

      {/* ── Tabel transaksi ── */}
      <GlassCard className="s12">
        <div className="tools">
          <div className="inp">
            <Search />
            <input
              id="cashflow-search"
              type="text"
              placeholder="Cari transaksi (keterangan, kategori, akun)…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPageSafe(1);
              }}
            />
          </div>
          <div className="cf-selects no-scrollbar">
            <select
              aria-label="Filter akun"
              value={selectedWallet}
              onChange={(e) => {
                setSelectedWallet(e.target.value);
                setCurrentPageSafe(1);
              }}
            >
              <option value="all">Semua Akun</option>
              {availableWallets.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter kategori"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPageSafe(1);
              }}
              style={{ maxWidth: 200 }}
            >
              <option value="all">Semua Kategori</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter tipe"
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPageSafe(1);
              }}
            >
              <option value="all">Semua Tipe</option>
              <option value="Income">Income</option>
              <option value="Needs">Needs</option>
              <option value="Wants">Wants</option>
              <option value="Savings">Savings</option>
              <option value="Investment">Investment</option>
              <option value="Internal Transfer">Internal Transfer</option>
            </select>
            {availableMonths.length > 0 && (
              <select
                aria-label="Filter bulan"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setCurrentPageSafe(1);
                }}
              >
                <option value="all">Semua Bulan</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {fmtMonthId(m)}
                  </option>
                ))}
              </select>
            )}
            <button type="button" className="btn hide-m" onClick={() => setIsQuickAddOpen(true)}>
              <PlusCircle size={16} />
              Catat
            </button>
          </div>
        </div>

        <div className="row sub" style={{ margin: '0 4px 6px' }}>
          <span>
            Menampilkan {filtered.length === 0 ? 0 : `${showingFrom}–${showingTo}`} dari {filtered.length} transaksi
            {filtered.length !== transactions.length && ` (total ${transactions.length})`}
          </span>
          <span className="hide-m">
            Klik header untuk urutkan · tekan <span className="mono">/</span> untuk cari
          </span>
        </div>

        {/* ── MOBILE: list kaca, tap untuk detail ── */}
        <div className="md:hidden cf-mobile-list">
          {sortedPage.length === 0 ? (
            <MobileEmptyState onReset={resetFilters} />
          ) : (
            sortedPage.map((tx, i) => {
              const targetTitle = tx.targetId ? recoveryItems.find((it) => it.id === tx.targetId)?.title : undefined;
              return (
                <TxRow
                  key={tx.id}
                  tx={tx}
                  expanded={expandedTx === tx.id}
                  targetTitle={targetTitle}
                  onToggle={() => setExpandedTx((cur) => (cur === tx.id ? null : tx.id))}
                  onEdit={() => openEditTransaction(tx)}
                  onDelete={() => handleDelete(tx)}
                  delay={Math.min(i * 0.015, 0.12)}
                />
              );
            })
          )}
        </div>

        {/* ── DESKTOP: tabel kaca ── */}
        <div className="hidden md:block tablewrap">
          <table className="glass-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('date')} className="th-sort">
                  Tanggal {sortKey === 'date' ? (sortDir === -1 ? '↓' : '↑') : '↕'}
                </th>
                <th>Keterangan</th>
                <th>Kategori</th>
                <th>Akun</th>
                <th>Tipe</th>
                <th onClick={() => toggleSort('amount')} className="th-sort" style={{ textAlign: 'right' }}>
                  Nominal {sortKey === 'amount' ? (sortDir === -1 ? '↓' : '↑') : '↕'}
                </th>
                <th style={{ width: 76 }} />
              </tr>
            </thead>
            <tbody>
              {sortedPage.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    {transactions.length === 0
                      ? 'Belum ada transaksi. Tambah akun di Setup, lalu tekan Catat Transaksi.'
                      : 'Tidak ada transaksi yang cocok dengan filter.'}{' '}
                    <button type="button" className="chip" onClick={resetFilters} style={{ marginLeft: 8 }}>
                      Reset filter
                    </button>
                  </td>
                </tr>
              ) : (
                sortedPage.map((tx, i) => (
                  <tr
                    key={tx.id}
                    className="cf-row"
                    style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
                    onClick={() => openEditTransaction(tx)}
                    title="Klik untuk edit transaksi"
                  >
                    <td className="mono" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                      {tx.date}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ maxWidth: 280 }} className="truncate">
                        {tx.note || '-'}
                      </div>
                      {tx.targetId && (
                        <span className="acc" style={{ marginTop: 4, fontSize: 10.5, padding: '2px 8px' }} title="Tertaut ke target">
                          <Target size={11} />
                          {recoveryItems.find((it) => it.id === tx.targetId)?.title ?? 'Target'}
                        </span>
                      )}
                    </td>
                    <td>{tx.category}</td>
                    <td>
                      <span className="acc">
                        <i style={{ background: WALLET_DOT[tx.wallet] ?? 'var(--faint)' }} />
                        {tx.wallet}
                      </span>
                    </td>
                    <td>
                      <span className={`tp ${TYPE_CHIP[tx.type]}`}>{tx.type}</span>
                    </td>
                    <td className="amtcell">{amountNode(tx)}</td>
                    <td style={{ width: 76 }} onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="row-edit"
                          onClick={() => openEditTransaction(tx)}
                          title={isBalanceLockedTx(tx) ? 'Edit tanggal & catatan (auto-catat)' : 'Edit transaksi'}
                          aria-label="Edit transaksi"
                        >
                          {isBalanceLockedTx(tx) ? <Lock size={15} /> : <Pencil size={15} />}
                        </button>
                        <button type="button" className="row-del" onClick={() => handleDelete(tx)} title="Hapus transaksi" aria-label="Hapus transaksi">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="row cf-pager">
          <div className="hide-m" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="sub" style={{ margin: 0 }}>
              Per halaman
            </span>
            <select
              aria-label="Jumlah per halaman"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPageSafe(1);
              }}
              className="cf-pagesize"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', marginRight: 'auto' }} className="md:mr-0!">
            <button
              type="button"
              className="ibtn"
              style={{ width: 36, height: 36 }}
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="mono sub" style={{ margin: '0 6px' }}>
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="ibtn"
              style={{ width: 36, height: 36 }}
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label="Halaman berikutnya"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </GlassCard>

      {/* ── Konfirmasi hapus (portal ke body: parent tab ber-transform membuat fixed tidak menutup layar) ── */}
      {typeof document !== 'undefined' &&
        createPortal(
      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            key="cf-del"
            className="qa-overlay fixed inset-0 z-[80] flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setPendingDelete(null);
            }}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="cf-del-title"
              className="glass modal cf-confirm w-full max-w-sm rounded-t-3xl sm:rounded-[22px] p-5"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            >
              <div className="flex items-start gap-3">
                <span className="cf-confirm-ico">
                  <Trash2 size={18} />
                </span>
                <div className="min-w-0">
                  <h3 id="cf-del-title" style={{ fontSize: 16, fontWeight: 800 }}>
                    Hapus transaksi ini?
                  </h3>
                  <p className="mt-1 truncate text-[12.5px] font-semibold">
                    {pendingDelete.note || pendingDelete.category}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-[#8A93A8]">
                    {pendingDelete.category} · {pendingDelete.wallet} · {fmtDateId(pendingDelete.date)} ·{' '}
                    <span className="money font-mono">{formatRupiah(pendingDelete.amount)}</span>
                  </p>
                </div>
              </div>
              <p className="cf-confirm-hint mt-3 rounded-xl px-3 py-2 text-[11px]">
                {isBalanceLockedTx(pendingDelete)
                  ? 'Transaksi auto-catat: saldo wadah tidak berubah saat dihapus.'
                  : 'Efek transaksi ke saldo wadah akan dibatalkan (dikembalikan seperti sebelum dicatat).'}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="btn" onClick={() => setPendingDelete(null)} autoFocus>
                  Batal
                </button>
                <button type="button" className="btn danger" onClick={confirmDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
          document.body
        )}
    </div>
  );
}