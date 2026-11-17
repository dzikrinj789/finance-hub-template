'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useFinance } from '@/context/FinanceContext';
import { GlassCard, Ring, AnimatedRupiah, ProgressBar } from '@/components/ui/minimal';
import { formatCompactRupiah, formatPercent, formatRupiah } from '@/lib/utils';
import { toast } from '@/lib/toast';
import {
  RECOVERY_MODAL_CATEGORIES,
  RecoveryItem,
  findAssetsForGoalCategory,
  getLinkedTransactionCategory,
  getRecoveryCategoryLabel,
  getSavingsAssetOptions,
  isGoalTargetCategory,
  isPiutangAsset,
  resolveSavingsWadahForTarget,
  type AssetItem,
  type Transaction,
} from '@/types/finance';
import {
  Target,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  X,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  ArrowDownLeft,
  Handshake,
  TrendingUp,
  LifeBuoy,
  ScrollText,
  Heart,
  RefreshCcw,
  Home,
  MoonStar,
  GraduationCap,
  Coins,
  Landmark,
  type LucideIcon,
} from 'lucide-react';

type ModalMode = 'add' | 'edit';

const getCategoryLabel = (cat: string): string => getRecoveryCategoryLabel(cat);

const isGoalCategory = (cat: string) => isGoalTargetCategory(cat);

const getStatusBadge = (status: RecoveryItem['status'], goal: boolean) => {
  switch (status) {
    case 'Recovered':
      return {
        bg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
        label: goal ? 'Tercapai' : 'Lunas',
        icon: CheckCircle2,
      };
    case 'Partial':
      return {
        bg: 'bg-amber-50 text-amber-600 border border-amber-100',
        label: goal ? 'Berkala' : 'Cicilan Bertahap',
        icon: Clock,
      };
    default:
      return {
        bg: 'bg-sky-50 text-sky-600 border border-sky-100',
        label: 'Dalam Proses',
        icon: AlertCircle,
      };
  }
};

/* ── Icon lucu + warna tint per kategori target (dipakai kartu mobile) ── */
const TARGET_ICONS: Record<string, LucideIcon> = {
  piutang: Handshake,
  saham: TrendingUp,
  dana_darurat: LifeBuoy,
  obligasi_sbn: ScrollText,
  tabungan_masa_depan: Heart,
  recovery_fund: RefreshCcw,
  dp_rumah: Home,
  tabungan_umroh: MoonStar,
  dana_pendidikan: GraduationCap,
  // Kategori dinamis (wadah Setup) di-fallback per kata kunci
  emas: Coins,
  reksadana: Landmark,
};

const TARGET_ICON_KEYWORD: [RegExp, string][] = [
  [/piutang/, 'piutang'],
  [/saham/, 'saham'],
  [/darurat/, 'dana_darurat'],
  [/obligasi|sbn/, 'obligasi_sbn'],
  [/masa depan/, 'tabungan_masa_depan'],
  [/recovery/, 'recovery_fund'],
  [/rumah/, 'dp_rumah'],
  [/umroh|haji/, 'tabungan_umroh'],
  [/pendidikan|sekolah/, 'dana_pendidikan'],
  [/emas/, 'emas'],
  [/reksa dana/, 'reksadana'],
];

/** Murni data: mengembalikan KUNCI (string) untuk lookup icon/tint */
function getTargetIconKey(category: string): string {
  const c = (category || '').trim();
  if (TARGET_ICONS[c]) return c;
  const lower = c.toLowerCase();
  for (const [re, key] of TARGET_ICON_KEYWORD) {
    if (re.test(lower)) return key;
  }
  return 'generic';
}

const TARGET_TINT: Record<string, string> = {
  piutang: '#F43F5E',
  saham: '#6366F1',
  dana_darurat: '#06B6D4',
  obligasi_sbn: '#7C3AED',
  tabungan_masa_depan: '#EC4899',
  recovery_fund: '#10B981',
  dp_rumah: '#3B82F6',
  tabungan_umroh: '#14B8A6',
  dana_pendidikan: '#F59E0B',
  emas: '#EAB308',
  reksadana: '#8B5CF6',
};

const TARGET_TINT_FALLBACK = '#64748B';

const STATUS_UI: Record<RecoveryItem['status'], { chip: string; iconText: string }> = {
  Pending: { chip: 'bg-sky-50 text-sky-600 border-sky-100', iconText: 'text-sky-500' },
  'In Progress': { chip: 'bg-sky-50 text-sky-600 border-sky-100', iconText: 'text-sky-500' },
  Partial: { chip: 'bg-amber-50 text-amber-600 border-amber-100', iconText: 'text-amber-500' },
  Recovered: { chip: 'bg-emerald-50 text-emerald-600 border-emerald-100', iconText: 'text-emerald-500' },
};

/** "Rp 125,36 Jt" → "125,36 Jt" (untuk kartu yang sempit) */
const compactNoRp = (v: number): string => formatCompactRupiah(v).replace('Rp ', '');

interface TargetRow {
  item: RecoveryItem;
  percent: number;
  remaining: number;
  badge: ReturnType<typeof getStatusBadge>;
  contribTxs: { id: string; date: string; note: string; category: string; wallet: string; amount: number }[];
  contribTotal: number;
  linkInfo: { type: string; category: string } | null;
  wadahLabel: string | null;
  wadahTotal: number;
  iconKey: string;
  tint: string;
}

/** Pre-compute satu baris target (dipakai tabel desktop & kartu mobile sekaligus) */
function buildTargetRows(
  items: RecoveryItem[],
  transactions: Transaction[],
  assets: AssetItem[]
): TargetRow[] {
  return items.map((item) => {
    const percent = item.targetAmount > 0 ? Math.min(100, (item.recoveredAmount / item.targetAmount) * 100) : 0;
    const remaining = Math.max(0, item.targetAmount - item.recoveredAmount);
    const badge = getStatusBadge(item.status, isGoalCategory(item.category));
    const contribTxs = transactions
      .filter((tx) => tx.targetId === item.id)
      .map((tx) => ({
        id: tx.id,
        date: tx.date,
        note: tx.note,
        category: tx.category,
        wallet: tx.wallet,
        amount: tx.amount,
      }));
    const contribTotal = contribTxs.reduce((sum, tx) => sum + tx.amount, 0);
    const linkInfo = getLinkedTransactionCategory(item.category);
    let wadahLabel: string | null = null;
    let wadahTotal = 0;
    const wadahNames = findAssetsForGoalCategory(item.category, assets);
    if (wadahNames.length > 0) {
      wadahTotal = wadahNames
        .map((n) => assets.find((a) => a.name === n))
        .filter((a): a is AssetItem => a != null)
        .reduce((sum, a) => sum + a.value, 0);
      wadahLabel = wadahNames.join(', ');
    }
    const iconKey = getTargetIconKey(item.category);
    return {
      item,
      percent,
      remaining,
      badge,
      contribTxs,
      contribTotal,
      linkInfo,
      wadahLabel,
      wadahTotal,
      iconKey,
      tint: TARGET_TINT[iconKey] ?? TARGET_TINT_FALLBACK,
    };
  });
}

/* ── Kartu target mobile (tap → expand detail + aksi) ── */
function TargetMobileCard({
  row,
  expanded,
  onToggle,
  onRecover,
  onEdit,
  onDelete,
  delay,
}: {
  row: TargetRow;
  expanded: boolean;
  onToggle: () => void;
  onRecover: () => void;
  onEdit: () => void;
  onDelete: () => void;
  delay: number;
}) {
  const { item, percent, remaining, contribTxs, contribTotal, wadahLabel, wadahTotal, linkInfo, iconKey, tint } = row;
  const statusUi = STATUS_UI[item.status];
  const ItemIcon = TARGET_ICONS[iconKey] ?? Target;
  const goal = isGoalCategory(item.category);

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
        className="w-full flex items-center gap-3 px-4 pt-3.5 pb-2 text-left transition-colors active:bg-[#F4F7FF]"
        aria-expanded={expanded}
      >
        <span
          className="h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: `${tint}1A`, color: tint }}
        >
          <ItemIcon size={18} strokeWidth={2.2} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block truncate text-[13px] font-semibold text-[#0F1932]">
            {item.title}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[8px] font-bold uppercase tracking-wide ${statusUi.chip}`}
            >
              {row.badge.label}
            </span>
            <span className="text-[10px] text-[#8A93A8] truncate">
              {contribTxs.length} transaksi
            </span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="money r block font-mono text-[12.5px] font-bold text-emerald-600 leading-none whitespace-nowrap">
            {compactNoRp(item.recoveredAmount)}
          </span>
          <span className="mt-1 block text-[9.5px] text-[#8A93A8] font-mono whitespace-nowrap">
            dari <span className="money">{compactNoRp(item.targetAmount)}</span>
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[#A8B0C2] transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </motion.button>

      {/* Progress mini */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <div className="progress-track flex-1">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="shrink-0 text-[10.5px] font-mono text-[#6B7280]">
          {formatPercent(percent)}
        </span>
      </div>

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
              <div className="rounded-2xl border border-[#EEEFF8] bg-[#F8FAFF] p-3 space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#A8B0C2]">
                  Detail {goal ? 'Target' : 'Pemulihan'}
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-[#8A93A8]">Kategori</span>
                    <span className="font-medium text-[#0F1932] text-right">
                      {getCategoryLabel(item.category)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-[#8A93A8]">Sisa Saldo</span>
                    <span className="money font-mono font-semibold text-rose-500">
                      {formatRupiah(remaining)}
                    </span>
                  </div>
                  {wadahLabel && (
                    <div className="flex items-start justify-between gap-3 text-[11.5px]">
                      <span className="text-[#8A93A8] shrink-0">Wadah</span>
                      <span className="font-mono text-[10.5px] text-[#374151] text-right">
                        {wadahLabel} · <span className="money">{formatRupiah(wadahTotal)}</span>
                      </span>
                    </div>
                  )}
                  {item.notes && (
                    <p className="text-[11px] text-[#5A6478] leading-relaxed border-t border-[#EEEFF8] pt-1.5">
                      {item.notes}
                    </p>
                  )}
                </div>

                {/* Transaksi kontributor */}
                <div className="border-t border-[#EEEFF8] pt-2">
                  {contribTxs.length === 0 ? (
                    <p className="text-[10.5px] text-[#8A93A8] leading-relaxed">
                      {linkInfo
                        ? `Tertaut otomatis saat kamu mencatat ${linkInfo.category} (${linkInfo.type}).`
                        : 'Belum ada transaksi tertaut ke target ini.'}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {contribTxs.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center gap-2 text-[11px] bg-white/80 border border-[#EEEFF8] rounded-xl px-2.5 py-1.5"
                        >
                          <span className="font-mono text-[10px] text-[#8A93A8] shrink-0">
                            {tx.date.slice(5).replace('-', '/')}
                          </span>
                          <span className="flex-1 min-w-0 truncate text-[#0F1932] font-medium">
                            {tx.note || tx.category}
                          </span>
                          <span className="money font-mono font-semibold text-emerald-600 shrink-0">
                            +{formatRupiah(tx.amount)}
                          </span>
                        </div>
                      ))}
                      <p className="text-[10px] text-[#8A93A8] text-right font-mono">
                        Terkumpul: <span className="money">{formatRupiah(contribTotal)}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Aksi */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={onRecover}
                    className="flex-1 h-9 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-transform"
                  >
                    <Plus size={14} strokeWidth={2.6} />
                    {goal ? 'Catat Realisasi' : 'Catat Pengembalian'}
                  </button>
                  <button
                    onClick={onEdit}
                    aria-label="Ubah target"
                    className="h-9 w-9 shrink-0 rounded-xl border border-[#E7EBF6] bg-white text-[#5A6478] flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={onDelete}
                    aria-label="Hapus target"
                    className="h-9 w-9 shrink-0 rounded-xl border border-rose-100 bg-rose-50 text-rose-500 flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <Trash2 size={14} />
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

export function TargetRecoveryTab() {
  const {
    recoveryItems,
    addRecoveryItem,
    updateRecoveryItem,
    deleteRecoveryItem,
    addTransaction,
    assets,
    transactions,
  } = useFinance();

  // Add / Edit modal state
  const [modal, setModal] = useState<{ mode: ModalMode; item: RecoveryItem | null } | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formNotes, setFormNotes] = useState('');
  // Kategori kanonis atau nama wadah Setup (dinamis, sejajar Savings)
  const [formCategory, setFormCategory] = useState<string>('piutang');
  const [formTargetStr, setFormTargetStr] = useState('');
  const [formRecoveredStr, setFormRecoveredStr] = useState('');
  const [formStatus, setFormStatus] = useState<RecoveryItem['status']>('Pending');

  // Record recovery modal state
  const [editingItem, setEditingItem] = useState<RecoveryItem | null>(null);
  const [incomingAmount, setIncomingAmount] = useState<string>('');
  const [targetWallet, setTargetWallet] = useState<string>('');
  const [alsoRecordTx, setAlsoRecordTx] = useState<boolean>(true);

  // Delete confirm state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Expanded target -> its contributing transactions
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Opsi wadah Setup (dinamis, sejajar kategori Savings di Catat Transaksi)
  const setupWadahOptions = useMemo(() => getSavingsAssetOptions(assets), [assets]);

  // Baris target yang sudah diproses (dipakai tabel desktop & kartu mobile)
  const targetRows = useMemo(
    () => buildTargetRows(recoveryItems, transactions, assets),
    [recoveryItems, transactions, assets]
  );

  // Filter tampilan daftar (presentasi saja, tidak mengubah data)
  const [listFilter, setListFilter] = useState<'all' | 'piutang' | 'goal'>('all');
  const visibleRows = useMemo(
    () =>
      listFilter === 'all'
        ? targetRows
        : targetRows.filter((r) => (listFilter === 'goal' ? isGoalCategory(r.item.category) : !isGoalCategory(r.item.category))),
    [targetRows, listFilter]
  );

  // Overview aggregates (dynamic, real-time)
  const totalTarget = recoveryItems.reduce((sum, it) => sum + it.targetAmount, 0);
  const totalRecovered = recoveryItems.reduce((sum, it) => sum + it.recoveredAmount, 0);
  const totalRemaining = Math.max(0, totalTarget - totalRecovered);
  const progressPercent =
    totalTarget > 0 ? Math.min(100, (totalRecovered / totalTarget) * 100) : 0;

  const openCreateModal = () => {
    setFormTitle('');
    setFormNotes('');
    setFormCategory('piutang');
    setFormTargetStr('');
    setFormRecoveredStr('');
    setFormStatus('Pending');
    setModal({ mode: 'add', item: null });
  };

  const openEditModal = (item: RecoveryItem) => {
    setFormTitle(item.title);
    setFormNotes(item.notes ?? '');
    setFormCategory(item.category);
    setFormTargetStr(String(item.targetAmount));
    setFormRecoveredStr(String(item.recoveredAmount));
    setFormStatus(item.status);
    setModal({ mode: 'edit', item });
  };

  const closeModal = () => setModal(null);

  const handleSubmitTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal) return;

    const target = parseFloat(formTargetStr.replace(/\D+/g, '')) || 0;
    if (!formTitle.trim() || target <= 0) return;

    let recovered = parseFloat(formRecoveredStr.replace(/\D+/g, '')) || 0;
    recovered = Math.min(recovered, target);
    const status: RecoveryItem['status'] = recovered >= target ? 'Recovered' : formStatus;
    const updatedAt = new Date().toISOString().split('T')[0];

    const data = {
      title: formTitle.trim(),
      notes: formNotes.trim(),
      category: formCategory,
      targetAmount: target,
      recoveredAmount: recovered,
      status,
      updatedAt,
    };

    if (modal.mode === 'add') {
      await addRecoveryItem(data);
    } else if (modal.item) {
      await updateRecoveryItem(modal.item.id, data);
    }
    closeModal();
  };

  const handleOpenRecoveryModal = (item: RecoveryItem) => {
    setEditingItem(item);
    setIncomingAmount('');
  };

  const handleSubmitRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const amount = parseFloat(incomingAmount.replace(/\D+/g, '')) || 0;
    if (amount <= 0) return;

    if (alsoRecordTx) {
      // Single path: linked transaction auto-updates Terealisasi via context.
      // Reverse lookup maps the target's category back to its transaction category & type.
      const linkInfo = getLinkedTransactionCategory(editingItem.category);
      let category = linkInfo?.category ?? 'Pelunasan Piutang';
      const type = linkInfo?.type ?? 'Income';

      // Goals → pakai wadah Setup aktual agar nilai wadah ikut bertambah.
      if (type === 'Savings') {
        const wadah =
          resolveSavingsWadahForTarget(editingItem, assets) ??
          (() => {
            const savingsNames = getSavingsAssetOptions(assets);
            const titleKey = editingItem.title.trim().toLowerCase();
            return savingsNames.find((n) => n.toLowerCase() === titleKey) ?? null;
          })();
        if (wadah) category = wadah;
      }

      const walletChoices = assets
        .filter((a) => a.category === 'likuid' && !a.isGold && !isPiutangAsset(a))
        .map((a) => a.name);
      const choices = walletChoices.map((name) => String(name));
      const wallet = choices.includes(targetWallet) ? targetWallet : choices[0] ?? '';
      if (!wallet) {
        toast('Tambah akun likuid di Setup sebelum mencatat realisasi.', 'err');
        return;
      }
      await addTransaction({
        date: new Date().toISOString().split('T')[0],
        amount,
        category,
        type,
        wallet,
        note: `${type === 'Savings' ? 'Alokasi' : 'Pengembalian modal / pelunasan'} ${editingItem.title}`,
        isExcludeReport: false,
        targetId: editingItem.id,
      });
    } else {
      const newRecovered = editingItem.recoveredAmount + amount;
      const isFinished = newRecovered >= editingItem.targetAmount;

      await updateRecoveryItem(editingItem.id, {
        recoveredAmount: Math.min(newRecovered, editingItem.targetAmount),
        status: isFinished ? 'Recovered' : 'Partial',
        updatedAt: new Date().toISOString().split('T')[0],
      });
    }

    setEditingItem(null);
  };

  // Reverse lookup for the "also record as transaction" modal (dynamic by target type)
  const editLinkInfo = editingItem
    ? getLinkedTransactionCategory(editingItem.category)
    : null;

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    await deleteRecoveryItem(deleteId);
    setDeleteId(null);
  };

  return (
    <div className="kgrid">
      {/* 1. Header Target Overview — Glass Minimal */}
      <GlassCard className="s12" as="div">
        <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="lbl ttl" style={{ fontSize: 15 }}>
              <Target style={{ width: 18 }} />
              Target &amp; Recovery Modal Tertahan
            </div>
            <div className="sub">
              Pantau seluruh target sekaligus. Perubahan langsung sinkron ke dashboard &amp; transaksi.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right' }}>
              <div className="lbl" style={{ justifyContent: 'flex-end' }}>Status Keseluruhan</div>
              <div className="big" style={{ marginTop: 4 }}>
                {formatPercent(progressPercent)}{' '}
                <span style={{ fontSize: 14, color: 'var(--muted)' }}>tercapai</span>
              </div>
            </div>
            <Ring percent={progressPercent} size={84} stroke={9} labelSize={14} label={formatPercent(progressPercent)} />
          </div>
        </div>
        <div className="stat3">
          <div className="stat">
            <div className="lbl"><Target style={{ width: 14 }} />Total Target</div>
            <div className="v2 mono"><AnimatedRupiah value={totalTarget} className="money" /></div>
          </div>
          <div className="stat">
            <div className="lbl" style={{ color: 'var(--green)' }}><CheckCircle2 style={{ width: 14 }} />Terealisasi</div>
            <div className="v2 mono pos"><AnimatedRupiah value={totalRecovered} className="money" /></div>
          </div>
          <div className="stat">
            <div className="lbl" style={{ color: 'var(--red)' }}><Clock style={{ width: 14 }} />Sisa Target</div>
            <div className="v2 mono neg"><AnimatedRupiah value={totalRemaining} className="money" /></div>
          </div>
        </div>
        <ProgressBar percent={progressPercent} height={12} style={{ marginTop: 18 }} />
      </GlassCard>

      {/* 2. Targets List */}
      <div className="glass card s12 tr-list">
        <div className="row tr-head" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="lbl ttl" style={{ fontSize: 15 }}>Daftar Target Pemulihan</div>
            <div className="sub">
              {recoveryItems.length === 0
                ? 'Belum ada target. Tambahkan target pemulihan pertama Anda.'
                : `${recoveryItems.length} target aktif · transaksi tertaut otomatis via target_id · klik ikon untuk lihat kontributor`}
            </div>
          </div>
          <div className="chips">
            <div className="chips hide-m">
              {([
                ['all', 'Semua'],
                ['piutang', 'Piutang'],
                ['goal', 'Tabungan'],
              ] as const).map(([k, l]) => (
                <button key={k} type="button" className={`chip ${listFilter === k ? 'on' : ''}`} onClick={() => setListFilter(k)}>
                  {l}
                </button>
              ))}
            </div>
            <button onClick={openCreateModal} className="btn primary">
              <Plus style={{ width: 16 }} />
              <span>Tambah Target</span>
            </button>
          </div>
        </div>

        {/* ── MOBILE: kartu target native (tap → expand) ── */}
        <div className="md:hidden">
          {targetRows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 px-6 text-center">
              <span className="h-12 w-12 rounded-2xl bg-[#F4F7FF] text-[#93C5FD] flex items-center justify-center">
                <Target size={22} strokeWidth={2} />
              </span>
              <p className="text-[13px] font-semibold text-[#0F1932]">Belum ada target</p>
              <p className="text-[11px] text-[#8A93A8] max-w-[240px] leading-relaxed">
                Tambahkan target pemulihan atau tabungan pertamamu untuk mulai dipantau.
              </p>
              <button
                onClick={openCreateModal}
                className="mt-1 h-9 px-4 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white text-[11.5px] font-semibold inline-flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
              >
                <Plus size={13} strokeWidth={2.5} />
                Tambah Target
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F3FA] pt-1">
              {visibleRows.map((row, i) => (
                <TargetMobileCard
                  key={row.item.id}
                  row={row}
                  expanded={expandedId === row.item.id}
                  onToggle={() => setExpandedId(expandedId === row.item.id ? null : row.item.id)}
                  onRecover={() => handleOpenRecoveryModal(row.item)}
                  onEdit={() => openEditModal(row.item)}
                  onDelete={() => setDeleteId(row.item.id)}
                  delay={Math.min(i * 0.015, 0.12)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Daftar target — desktop/tablet (baris glass, klik panah = kontributor) */}
        <div className="hidden md:block">
          {visibleRows.map((row) => {
            const item = row.item;
            const isExpanded = expandedId === item.id;
            const { percent, remaining, contribTxs, contribTotal, linkInfo, wadahLabel, wadahTotal } = row;
            const ItemIcon = TARGET_ICONS[row.iconKey] ?? Target;
            return (
              <div key={item.id}>
                <div className={`trow tr-row ${isExpanded ? 'open' : ''}`}>
                  <button
                    type="button"
                    className="ico tr-ico"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    title={contribTxs.length > 0 ? `Lihat ${contribTxs.length} transaksi kontributor` : 'Belum ada transaksi tertaut'}
                  >
                    <ItemIcon />
                    <ChevronRight className={`tr-chev ${isExpanded ? 'rot' : ''}`} />
                  </button>
                  <div className="min-w-0">
                    <b className="block truncate">{item.title}</b>
                    <small className="truncate">
                      {wadahLabel ? (
                        <>
                          Wadah {wadahLabel} · <span className="money">{formatRupiah(wadahTotal)}</span>
                        </>
                      ) : (
                        <>
                          {contribTxs.length} transaksi · total <span className="money">{formatRupiah(contribTotal)}</span>
                        </>
                      )}
                    </small>
                    {item.notes && <small className="tr-notes">{item.notes}</small>}
                  </div>
                  <div><span className="acc">{getCategoryLabel(item.category)}</span></div>
                  <div>
                    <small>Total target</small>
                    <b className="mono money">{formatRupiah(item.targetAmount)}</b>
                  </div>
                  <div>
                    <div className="row" style={{ fontSize: 12 }}>
                      <span className="sub" style={{ margin: 0 }}>
                        Sisa <span className="money">{formatRupiah(remaining)}</span>
                      </span>
                      <b className="mono">{formatPercent(percent)}</b>
                    </div>
                    <ProgressBar percent={Math.max(percent, 1.5)} style={{ marginTop: 8 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="ibtn sm" title={row.linkInfo?.type === 'Savings' || isGoalCategory(item.category) ? 'Catat realisasi' : 'Catat pengembalian modal'} onClick={() => handleOpenRecoveryModal(item)}>
                      <Plus style={{ width: 15 }} />
                    </button>
                    <button className="ibtn sm" title="Ubah target" onClick={() => openEditModal(item)}>
                      <Pencil style={{ width: 14 }} />
                    </button>
                    <button className="ibtn sm danger" title="Hapus target" onClick={() => setDeleteId(item.id)}>
                      <Trash2 style={{ width: 14 }} />
                    </button>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="tr-contrib"
                    >
                      <div className="row" style={{ marginBottom: 8 }}>
                        <span className="lbl">Transaksi Kontributor · {contribTxs.length} transaksi</span>
                        <span className="mono" style={{ fontSize: 11.5 }}>
                          Terkumpul <span className="money">{formatRupiah(contribTotal)}</span> dari{' '}
                          <span className="money">{formatRupiah(item.targetAmount)}</span>
                        </span>
                      </div>
                      {contribTxs.length === 0 ? (
                        <p className="sub" style={{ margin: 0 }}>
                          Belum ada transaksi yang tertaut ke target ini.{' '}
                          {linkInfo ? (
                            <>
                              Catat transaksi <strong>{linkInfo.category} ({linkInfo.type})</strong> dari Catat Transaksi Cepat untuk terhubung otomatis.
                            </>
                          ) : (
                            'Tambahkan transaksi dan tautkan ke target ini.'
                          )}
                        </p>
                      ) : (
                        <table className="tr-ctable">
                          <thead>
                            <tr>
                              <th>Tanggal</th>
                              <th>Keterangan</th>
                              <th>Kategori</th>
                              <th>Akun</th>
                              <th style={{ textAlign: 'right' }}>Nominal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {contribTxs.map((tx) => (
                              <tr key={tx.id}>
                                <td className="mono">{tx.date}</td>
                                <td className="truncate" style={{ maxWidth: 240 }}>{tx.note || '-'}</td>
                                <td>{tx.category}</td>
                                <td><span className="acc">{tx.wallet}</span></td>
                                <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                                  <span className="inline-flex items-center gap-1">
                                    <ArrowDownLeft style={{ width: 12, color: 'var(--muted)' }} />
                                    <span className="money">{formatRupiah(tx.amount)}</span>
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {recoveryItems.length === 0 && (
            <div className="trow tr-empty">
              <Target style={{ width: 16 }} />
              Tidak ada target pemulihan. Klik <strong>&nbsp;Tambah Target&nbsp;</strong> untuk mulai.
            </div>
          )}
          {recoveryItems.length > 0 && visibleRows.length === 0 && (
            <div className="trow tr-empty">Tidak ada target pada filter ini.</div>
          )}
        </div>
      </div>

      {/* Modal: Tambah / Ubah Target */}
      {modal && (
        <div className="k-overlay fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="w-full max-w-md glass k-dialog p-5 fade-in-up">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E3]">
              <div>
                <h3 className="text-sm font-bold text-[#1A1A1A]">
                  {modal.mode === 'add' ? 'Tambah Target Baru' : 'Ubah Target'}
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Pendataan target pemulihan modal
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-[#9CA3AF] hover:text-[#1A1A1A] p-1 rounded-md hover:bg-[#F1F1EF]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitTarget} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Nama Target</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Contoh: Dana Darurat, Target Saham BBCA"
                  className="w-full h-9 rounded-lg border border-[#E5E5E3] bg-white px-3 text-sm text-[#1A1A1A] focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Deskripsi</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Catatan singkat target (opsional)"
                  rows={2}
                  className="w-full rounded-lg border border-[#E5E5E3] bg-white px-3 py-2 text-sm text-[#1A1A1A] focus:border-[#1A1A1A] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">Kategori</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full h-9 rounded-lg border border-[#E5E5E3] bg-white px-3 text-xs text-[#1A1A1A] focus:border-[#1A1A1A]"
                  >
                    <optgroup label="Recovery Modal Tertahan">
                      {RECOVERY_MODAL_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {getCategoryLabel(c)}
                        </option>
                      ))}
                    </optgroup>
                    {setupWadahOptions.length > 0 && (
                      <optgroup label="Wadah Setup">
                        {setupWadahOptions.map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {/* Kategori lama (statis/custom) yang sudah tidak ada di daftar tetap bisa tampil */}
                    {!(
                      (RECOVERY_MODAL_CATEGORIES as readonly string[]).includes(formCategory) ||
                      setupWadahOptions.includes(formCategory)
                    ) && (
                      <option value={formCategory}>{getCategoryLabel(formCategory)} (sebelumnya)</option>
                    )}
                  </select>
                  {setupWadahOptions.length > 0 && (
                    <p className="text-[10px] text-[#9CA3AF] mt-1 font-mono">
                      Pilih wadah Setup (mis. Dana Darurat) agar sinkron dengan Savings
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as RecoveryItem['status'])}
                    className="w-full h-9 rounded-lg border border-[#E5E5E3] bg-white px-3 text-xs text-[#1A1A1A] focus:border-[#1A1A1A]"
                  >
                    <option value="Pending">Dalam Proses</option>
                    <option value="Partial">Cicilan Bertahap</option>
                    <option value="Recovered">Lunas</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">
                    Total Target (IDR)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={formatRupiah(Number(formTargetStr || 0), false)}
                    onChange={(e) => setFormTargetStr(e.target.value.replace(/\D+/g, ''))}
                    placeholder="0"
                    className="w-full h-9 rounded-lg border border-[#E5E5E3] bg-white px-3 text-sm text-[#1A1A1A] font-mono text-right focus:border-[#1A1A1A]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">
                    Terealisasi (IDR)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatRupiah(Number(formRecoveredStr || 0), false)}
                    onChange={(e) => setFormRecoveredStr(e.target.value.replace(/\D+/g, ''))}
                    placeholder="0"
                    className="w-full h-9 rounded-lg border border-[#E5E5E3] bg-white px-3 text-sm text-[#1A1A1A] font-mono text-right focus:border-[#1A1A1A]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E3]">
                <button
                  type="button"
                  onClick={closeModal}
                  className="h-8 px-3 rounded-lg border border-[#E5E5E3] bg-white text-xs text-[#6B7280] hover:text-[#1A1A1A] hover:bg-[#F1F1EF]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 rounded-lg bg-[#1A1A1A] text-xs font-semibold text-white hover:bg-black transition"
                >
                  {modal.mode === 'add' ? 'Tambah Target' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Catat Pengembalian Modal */}
      {editingItem && (
        <div className="k-overlay fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="w-full max-w-md glass k-dialog p-5 fade-in-up">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E3]">
              <div>
                <h3 className="text-sm font-bold text-[#1A1A1A]">
                  {isGoalCategory(editingItem.category)
                    ? 'Catat Realisasi Target'
                    : 'Catat Pengembalian Modal'}
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">{editingItem.title}</p>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="text-[#9CA3AF] hover:text-[#1A1A1A] p-1 rounded-md hover:bg-[#F1F1EF]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitRecovery} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">
                  Nominal yang Diterima (IDR)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="Contoh: 1.000.000"
                  value={formatRupiah(Number(incomingAmount || 0), false)}
                  onChange={(e) => setIncomingAmount(e.target.value.replace(/\D+/g, ''))}
                  className="w-full h-9 rounded-lg border border-[#E5E5E3] bg-white px-3 text-sm text-[#1A1A1A] font-mono text-right focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#6B7280] mb-1">
                  Masuk ke Akun Dompet (Summary)
                </label>
                <select
                  value={
                    (assets.some((a) => a.name === targetWallet) ? targetWallet : '') ||
                    assets.find((a) => a.category === 'likuid' && !a.isGold && !isPiutangAsset(a))?.name ||
                    ''
                  }
                  onChange={(e) => setTargetWallet(e.target.value)}
                  className="w-full h-9 rounded-lg border border-[#E5E5E3] bg-white px-3 text-xs text-[#1A1A1A] focus:border-[#1A1A1A]"
                >
                  {assets.filter((a) => a.category === 'likuid' && !a.isGold && !isPiutangAsset(a)).length === 0 ? (
                    <option value="">Tambah akun likuid di Setup</option>
                  ) : (
                    assets
                      .filter((a) => a.category === 'likuid' && !a.isGold && !isPiutangAsset(a))
                      .map((a) => (
                        <option key={a.name} value={a.name}>
                          {a.name}
                        </option>
                      ))
                  )}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="alsoRecordTx"
                  checked={alsoRecordTx}
                  onChange={(e) => setAlsoRecordTx(e.target.checked)}
                  className="rounded border-[#CDCDC9] text-[#1A1A1A] focus:ring-0"
                />
                <label htmlFor="alsoRecordTx" className="text-xs text-[#374151] cursor-pointer">
                  Otomatis catat transaksi {editLinkInfo?.type ?? 'Income'} (
                  {editLinkInfo?.category ?? 'Pelunasan Piutang'}) & tautkan ke target ini
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E3]">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="h-8 px-3 rounded-lg border border-[#E5E5E3] bg-white text-xs text-[#6B7280] hover:text-[#1A1A1A] hover:bg-[#F1F1EF]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 rounded-lg bg-[#1A1A1A] text-xs font-semibold text-white hover:bg-black transition"
                >
                  Simpan Realisasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Konfirmasi Hapus */}
      {deleteId && (
        <div className="k-overlay fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="w-full max-w-sm glass k-dialog p-5 fade-in-up">
            <div className="flex items-center gap-2 text-[#DC2626] pb-3 border-b border-[#E5E5E3]">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <h3 className="text-sm font-bold text-[#1A1A1A]">Hapus Target</h3>
            </div>

            <p className="mt-3 text-xs text-[#374151] leading-relaxed">
              Hapus target <strong>{recoveryItems.find((it) => it.id === deleteId)?.title}</strong>? Tindakan
              ini tidak dapat dibatalkan.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E3]">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="h-8 px-3 rounded-lg border border-[#E5E5E3] bg-white text-xs text-[#6B7280] hover:text-[#1A1A1A] hover:bg-[#F1F1EF]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="h-8 px-4 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-xs font-semibold text-white transition"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}