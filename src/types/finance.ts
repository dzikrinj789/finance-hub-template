export type TransactionType =
  | 'Needs'
  | 'Wants'
  | 'Savings'
  | 'Income'
  | 'Investment'
  | 'Internal Transfer';

export type MainTabType = 'dashboard' | 'cashflow' | 'recovery' | 'setup';

// No built-in bank or brokerage accounts. Users add their own in Setup.
export const OPERATIONAL_WALLETS: readonly string[] = [];
export type OperationalWallet = string;

// Built-in instrument buckets (not personal accounts). Bank and e-wallet
// names come from accounts the user creates in Setup.
export const ASSET_WALLETS = [
  'Saham',
  'Emas Fisik',
  'Motor',
  'Piutang Teman',
] as const;
export type AssetWallet = (typeof ASSET_WALLETS)[number];

// Income Sources
export const INCOME_CATEGORIES = [
  'Monthly Salary',
  'Freelance / Side Job',
  'Pelunasan Piutang',
  'Pencairan Investasi',
  'Others',
] as const;
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

// Needs (Kebutuhan Pokok)
export const NEEDS_CATEGORIES = [
  'Food & Groceries',
  'Utilities & Bill',
  'Transportation',
  'Family Support',
  'Personal Items',
  'Healthcare',
] as const;
export type NeedsCategory = (typeof NEEDS_CATEGORIES)[number];

// Wants (Keinginan & Gaya Hidup)
export const WANTS_CATEGORIES = [
  'Nongkrong & Kopi',
  'Shopping & Outfit',
  'Entertainment & Hobby',
  'Gifts & Donations',
  'Travel & Outing',
] as const;
export type WantsCategory = (typeof WANTS_CATEGORIES)[number];

// Investment (Aset & Modal: 4 instrumen compact)
// Dikelompokkan: Saham | Emas | Reksa Dana Pasar Uang | Reksa Dana Obligasi
// Masing-masing punya pasangan Beli/Jual atau Top Up/Tarik (8 kategori total).
export const INVESTMENT_CATEGORIES = [
  'Beli Saham',
  'Jual Saham',
  'Beli Emas',
  'Jual Emas',
  'Top Up Reksa Dana Pasar Uang',
  'Tarik Reksa Dana Pasar Uang',
  'Top Up Reksa Dana Obligasi',
  'Tarik Reksa Dana Obligasi',
] as const;
export type InvestmentCategory = (typeof INVESTMENT_CATEGORIES)[number];

// Kelompok compact untuk UI (4 instrumen x 2 arah = 8 kategori)
export const INVESTMENT_GROUPS = [
  {
    id: 'saham',
    label: 'Saham',
    categories: ['Beli Saham', 'Jual Saham'] as const,
    inCategory: 'Beli Saham' as const,
    outCategory: 'Jual Saham' as const,
  },
  {
    id: 'emas',
    label: 'Emas',
    categories: ['Beli Emas', 'Jual Emas'] as const,
    inCategory: 'Beli Emas' as const,
    outCategory: 'Jual Emas' as const,
  },
  {
    id: 'rdpu',
    label: 'Reksa Dana Pasar Uang',
    shortLabel: 'RD Pasar Uang',
    categories: ['Top Up Reksa Dana Pasar Uang', 'Tarik Reksa Dana Pasar Uang'] as const,
    inCategory: 'Top Up Reksa Dana Pasar Uang' as const,
    outCategory: 'Tarik Reksa Dana Pasar Uang' as const,
  },
  {
    id: 'rdob',
    label: 'Reksa Dana Obligasi',
    shortLabel: 'RD Obligasi',
    categories: ['Top Up Reksa Dana Obligasi', 'Tarik Reksa Dana Obligasi'] as const,
    inCategory: 'Top Up Reksa Dana Obligasi' as const,
    outCategory: 'Tarik Reksa Dana Obligasi' as const,
  },
] as const;

// Savings (Tabungan & Financial Goals)
export const SAVINGS_CATEGORIES = [
  'Dana Darurat',
  'Obligasi / SBN',
  'Tabungan Masa Depan',
  'Recovery Fund',
  'DP / Beli Rumah',
  'Tabungan Umroh',
  'Dana Pendidikan Anak',
  'Top Up Saldo',
] as const;
export type SavingsCategory = (typeof SAVINGS_CATEGORIES)[number];

export const ALL_OFFICIAL_CATEGORIES = [
  ...INCOME_CATEGORIES,
  ...NEEDS_CATEGORIES,
  ...WANTS_CATEGORIES,
  ...INVESTMENT_CATEGORIES,
  ...SAVINGS_CATEGORIES,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// KATEGORI SAVINGS DINAMIS: mengikuti wadah aset di Setup (Kelola Saldo Aset)
// Dropdown Savings di Catat Transaksi Cepat = nama wadah aset non-piutang.
// Piutang (nama/display mengandung "piutang" / subCategory piutang) dikecualikan
// → pelunasannya dicatat sebagai Income 'Pelunasan Piutang'.
// Isi Setup tidak diubah di sini; helper ini hanya membaca.
// ─────────────────────────────────────────────────────────────────────────────

export function isPiutangAssetName(name: string | null | undefined): boolean {
  if (!name) return false;
  return name.toLowerCase().includes('piutang');
}

export function isPiutangAsset(
  asset: Pick<AssetItem, 'name' | 'displayName' | 'subCategory'>
): boolean {
  if ((asset.subCategory as string) === 'piutang') return true;
  return isPiutangAssetName(asset.name) || isPiutangAssetName(asset.displayName);
}

// Wadah aset yang layak jadi opsi kategori Savings: semua wadah kecuali
// piutang (→ Income), instrumen investasi (Saham/Emas → Investment),
// dan dompet operasional (dipilih via Akun Dompet, bukan kategori).
export function getSavingsAssetOptions(
  assets: Pick<AssetItem, 'name' | 'displayName' | 'subCategory' | 'isGold'>[]
): string[] {
  const operational = new Set<string>([...OPERATIONAL_WALLETS]);
  const seen = new Set<string>();
  const options: string[] = [];
  for (const a of assets) {
    const name = (a.name || '').trim();
    if (!name || seen.has(name)) continue;
    if (
      isPiutangAsset(
        a as Pick<AssetItem, 'name' | 'displayName' | 'subCategory'>
      )
    )
      continue;
    if (a.isGold) continue;
    if (name === 'Saham' || name === 'Emas' || (a.subCategory as string) === 'saham' || (a.subCategory as string) === 'emas')
      continue;
    if (operational.has(name)) continue;
    seen.add(name);
    options.push(name);
  }
  return options;
}

// Daftar wadah piutang dari Setup untuk picker pelunasan (Income).
export function getPiutangAssetOptions(
  assets: Pick<AssetItem, 'name' | 'displayName' | 'subCategory'>[]
): string[] {
  const seen = new Set<string>();
  const options: string[] = [];
  for (const a of assets) {
    const name = (a.name || '').trim();
    if (!name || seen.has(name)) continue;
    if (!isPiutangAsset(a)) continue;
    seen.add(name);
    options.push(name);
  }
  return options;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  category: string;
  type: TransactionType;
  wallet: string;
  note: string;
  isExcludeReport: boolean;
  targetId?: string; // Linked recovery target (auto-updates Terealisasi)
  skipAssetSync?: boolean; // Auto-recorded from an asset change: do not re-apply to assets
  createdAt?: string;
}

export interface MoneyLoverRawRow {
  CATEGORY?: string;
  AMOUNT?: string | number;
  NOTE?: string;
  WALLET?: string;
  DATE?: string | number | Date;
  'EXCLUDE REPORT'?: string | boolean | number;
  [key: string]: unknown;
}

export interface ParsedImportRow {
  id: string;
  date: string;
  amount: number;
  category: string;
  type: TransactionType;
  wallet: string;
  note: string;
  isExcludeReport: boolean;
  rawCategory: string;
  confidenceScore: number;
  isValid: boolean;
  validationError?: string;
}

export type RecoveryTargetCategory =
  | 'piutang'
  | 'saham'
  | 'dana_darurat'
  | 'obligasi_sbn'
  | 'tabungan_masa_depan'
  | 'recovery_fund'
  | 'dp_rumah'
  | 'tabungan_umroh'
  | 'dana_pendidikan';

export const RECOVERY_MODAL_CATEGORIES: RecoveryTargetCategory[] = ['piutang', 'saham'];

export const GOAL_SAVINGS_CATEGORIES: RecoveryTargetCategory[] = [
  'dana_darurat',
  'obligasi_sbn',
  'tabungan_masa_depan',
  'recovery_fund',
  'dp_rumah',
  'tabungan_umroh',
  'dana_pendidikan',
];

// Official two-way mapping: transaction (type + category) -> target category(ies).
// Single source of truth used by resolver, QuickAdd and reverse lookup.
export const TRANSACTION_TO_TARGET_CATEGORY: Partial<
  Record<TransactionType, Record<string, RecoveryTargetCategory | RecoveryTargetCategory[]>>
> = {
  Income: {
    'Pelunasan Piutang': 'piutang',
    'Pencairan Investasi': 'saham',
  },
  Investment: {
    'Jual Saham': 'saham',
  },
  Savings: {
    'Dana Darurat': 'dana_darurat',
    'Obligasi / SBN': 'obligasi_sbn',
    'Tabungan Masa Depan': 'tabungan_masa_depan',
    'Recovery Fund': 'recovery_fund',
    'DP / Beli Rumah': 'dp_rumah',
    'Tabungan Umroh': 'tabungan_umroh',
    'Dana Pendidikan Anak': 'dana_pendidikan',
  },
};

// Forward: transaction (type + category) -> list of matching target categories
export function getMappedTargetCategories(
  type: TransactionType,
  category: string
): RecoveryTargetCategory[] {
  const map = TRANSACTION_TO_TARGET_CATEGORY[type];
  if (!map) return [];
  const value = map[category as keyof typeof map];
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// Reverse: target category -> the transaction category that feeds it.
// Kategori wadah custom (dinamis dari Setup) kembali sebagai Savings senama.
export function getLinkedTransactionCategory(
  targetCategory: string
): { type: TransactionType; category: string } | null {
  const entries = Object.entries(TRANSACTION_TO_TARGET_CATEGORY) as Array<
    [TransactionType, Record<string, RecoveryTargetCategory | RecoveryTargetCategory[]>]
  >;
  for (const [txType, map] of entries) {
    for (const [catName, mapped] of Object.entries(map)) {
      const arr = Array.isArray(mapped) ? mapped : [mapped];
      if ((arr as string[]).includes(targetCategory)) {
        return { type: txType, category: catName };
      }
    }
  }
  const key = (targetCategory || '').trim();
  if (!key) return null;
  // Wadah custom (mis. "Dana Darurat") diberi makan oleh Savings senama.
  if (!isPiutangAssetName(key)) {
    return { type: 'Savings', category: key };
  }
  return null;
}

// Kata kunci nama wadah Setup → kategori goal kanonis.
// "Reksa Dana Pasar Uang" tidak dipaksa ke satu goal; "Dana Darurat" → dana_darurat.
const WADAH_GOAL_KEYWORDS: Array<{ goal: RecoveryTargetCategory; keys: string[] }> = [
  { goal: 'tabungan_masa_depan', keys: ['masa depan'] },
  { goal: 'dana_darurat', keys: ['darurat', 'emergency'] },
  { goal: 'tabungan_umroh', keys: ['umroh', 'umrah', 'haji'] },
  { goal: 'dana_pendidikan', keys: ['pendidikan', 'sekolah'] },
  { goal: 'dp_rumah', keys: ['rumah', 'kpr', 'dp rumah'] },
  { goal: 'recovery_fund', keys: ['recovery'] },
  { goal: 'obligasi_sbn', keys: ['obligasi', 'sbn', 'surat berharga'] },
  { goal: 'saham', keys: ['saham'] },
  { goal: 'piutang', keys: ['piutang'] },
];

// Wadah Setup (mis. "Dana Darurat") → daftar goal kanonis yang diwakilinya.
export function findGoalCategoriesForWadah(wadahName: string | null | undefined): RecoveryTargetCategory[] {
  const key = (wadahName || '').trim().toLowerCase();
  if (!key || key === 'top up saldo') return [];
  const goals: RecoveryTargetCategory[] = [];
  for (const { goal, keys } of WADAH_GOAL_KEYWORDS) {
    if (keys.some((k) => key.includes(k))) goals.push(goal);
  }
  return goals;
}

// Daftar wadah aset Setup yang mewakili sebuah kategori target.
// - Kategori = nama wadah itu sendiri → wadah itu.
// - Kategori kanonis (mis. tabungan_masa_depan) → wadah yang namanya mengandung katanya
//   (mis. "Tabungan Masa Depan"), kecuali piutang/saham/emas.
export function findAssetsForGoalCategory(
  targetCategory: string,
  assets: Pick<AssetItem, 'name' | 'displayName' | 'subCategory' | 'isGold'>[]
): string[] {
  const catKey = (targetCategory || '').trim();
  if (!catKey) return [];
  // Langsung nama wadah
  const direct = assets.some((a) => (a.name || '').trim() === catKey);
  if (direct) return [catKey];
  // Kanonis → cari wadah ber-kata-kunci sama
  const names: string[] = [];
  for (const a of assets) {
    const nm = (a.name || '').trim();
    if (!nm) continue;
    if (isPiutangAsset(a as Pick<AssetItem, 'name' | 'displayName' | 'subCategory'>)) continue;
    if (a.isGold || nm === 'Saham' || nm === 'Emas') continue;
    const goals = findGoalCategoriesForWadah(nm);
    if (goals.includes(catKey as RecoveryTargetCategory)) names.push(nm);
    // Judul/display juga dipertimbangkan
    const disp = (a.displayName || '').trim();
    if (disp && disp !== nm && findGoalCategoriesForWadah(disp).includes(catKey as RecoveryTargetCategory)) {
      if (!names.includes(nm)) names.push(nm);
    }
  }
  return names;
}

// Wadah Savings aktual untuk pencatatan realisasi sebuah target.
// Prioritas: nama wadah persis kategori → wadah se-kata-kunci (mis. "darurat" →
// Dana Darurat) → judul = nama wadah → fallback kategori apa adanya.
export function resolveSavingsWadahForTarget(
  target: Pick<RecoveryItem, 'title' | 'category'>,
  assets: Pick<AssetItem, 'name' | 'displayName' | 'subCategory' | 'isGold'>[]
): string | null {
  const catKey = (target.category || '').trim();
  if (assets.some((a) => (a.name || '').trim() === catKey)) return catKey;
  const byGoal = findAssetsForGoalCategory(catKey, assets);
  if (byGoal.length === 1) return byGoal[0];
  if (byGoal.length > 1) {
    // Bila beberapa wadah cocok, pilih yang judul targetnya menyebutnya
    const titleKey = (target.title || '').trim().toLowerCase();
    const byTitle = byGoal.find((n) => titleKey.includes(n.toLowerCase()));
    if (byTitle) return byTitle;
    return byGoal[0];
  }
  const titleKey = (target.title || '').trim().toLowerCase();
  if (titleKey) {
    const savingsNames = getSavingsAssetOptions(assets);
    const match = savingsNames.find((n) => n.toLowerCase() === titleKey);
    if (match) return match;
  }
  return null;
}

// Pencocokan target untuk transaksi: pemetaan resmi dulu, lalu fallback kategori
// atau judul yang sama (untuk kategori Savings dinamis = nama wadah aset Setup,
// mis. "Dana Darurat" menaut ke target berkategori/berjudul sama),
// lalu fallback kata kunci goal ("darurat" → dana_darurat).
export function findLinkedRecoveryTargets(
  type: TransactionType,
  category: string,
  recoveryItems: RecoveryItem[]
): RecoveryItem[] {
  const mapped = getMappedTargetCategories(type, category);
  if (mapped.length > 0) {
    return recoveryItems.filter((it) => (mapped as string[]).includes(it.category));
  }
  if (type === 'Savings') {
    const key = (category || '').trim().toLowerCase();
    if (!key || key === 'top up saldo') return [];
    const direct = recoveryItems.filter(
      (it) =>
        (it.category || '').trim().toLowerCase() === key ||
        (it.title || '').trim().toLowerCase() === key
    );
    if (direct.length > 0) return direct;
    // Fallback kata kunci: "Dana Darurat" → target dana_darurat
    const goals = findGoalCategoriesForWadah(category);
    if (goals.length > 0) {
      return recoveryItems.filter((it) => (goals as string[]).includes(it.category));
    }
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// MODUL SYNC: CASHFLOW & TRANSAKSI ↔ KELOLA ASET & MODAL
// Setiap transaksi investasi / pelunasan / pencairan / transfer antar dompet
// otomatis memperbarui nilai aset yang bersangkutan (arah: transaksi → aset).
// ─────────────────────────────────────────────────────────────────────────────

// Kategori transaksi -> wadah aset yang nilainya terpengaruh
export const TRANSACTION_TO_ASSET: Record<
  TransactionType,
  Record<string, { asset: AssetWallet; direction: 'in' | 'out' }>
> = {
  Investment: {
    'Beli Saham': { asset: 'Saham', direction: 'in' },
    'Jual Saham': { asset: 'Saham', direction: 'out' },
    'Beli Emas': { asset: 'Emas Fisik', direction: 'in' },
    'Jual Emas': { asset: 'Emas Fisik', direction: 'out' },
    // Reksa dana tidak punya wadah bawaan. Tujuannya akun yang pengguna buat
    // di Setup (lihat findUserReksaDanaAsset).
  },
  Income: {
    'Pelunasan Piutang': { asset: 'Piutang Teman', direction: 'out' },
  },
  Needs: {},
  Wants: {},
  Savings: {},
  'Internal Transfer': {},
};

// Aliran dana antar wadah aset untuk transaksi Internal Transfer
export const INTERNAL_TRANSFER_ASSET_FLOWS: Record<
  string,
  { fromAsset?: AssetWallet; toAsset?: AssetWallet }
> = {
  'Tarik Tunai': {}, // wallet transaksi = sumber dana
  'Top Up Saldo': {}, // wallet transaksi = tujuan dana
};

// Arah top up / tarik reksa dana. Wadah tujuan dipilih dari akun pengguna.
const REKSA_DANA_DIRECTION: Record<string, 'in' | 'out'> = {
  'Top Up Reksa Dana Pasar Uang': 'in',
  'Tarik Reksa Dana Pasar Uang': 'out',
  'Top Up Reksa Dana Obligasi': 'in',
  'Tarik Reksa Dana Obligasi': 'out',
  'Top Up Reksa Dana': 'in',
  'Tarik Reksa Dana': 'out',
};

export function reksaDanaDirection(category: string): 'in' | 'out' | null {
  return REKSA_DANA_DIRECTION[category] ?? null;
}

// Akun Setup yang menampung reksa dana, bila pengguna sudah membuatnya.
// Tidak membuat akun bernama lembaga tertentu.
export function findUserReksaDanaAsset(
  category: string,
  assets: Pick<AssetItem, 'name' | 'displayName' | 'subCategory' | 'isGold'>[]
): string | null {
  if (!reksaDanaDirection(category)) return null;
  const wantObligasi = /obligasi/i.test(category) && !/pasar uang/i.test(category);
  const wantPasarUang = /pasar uang/i.test(category);
  const candidates = assets.filter((a) => {
    if (a.isGold) return false;
    const name = (a.name || '').trim();
    if (!name || name === 'Saham' || name === 'Emas' || name === 'Emas Fisik') return false;
    if (isPiutangAsset(a)) return false;
    const hay = `${name} ${a.displayName || ''}`.toLowerCase();
    return /reksa|rdpu|pasar uang|obligasi/.test(hay);
  });
  const specific = candidates.find((a) => {
    const hay = `${a.name} ${a.displayName || ''}`.toLowerCase();
    if (wantObligasi) return /obligasi/.test(hay);
    if (wantPasarUang) return /pasar uang|rdpu/.test(hay);
    return /reksa/.test(hay);
  });
  return (specific ?? candidates[0])?.name?.trim() || null;
}

// Transfer dinamis: "Pindah <Dari> ke <Ke>" antar akun yang ada di Setup.
// Format lama "Pindah Saldo X ke Y" tetap didukung (prefix "Saldo " dibuang).
export function parseTransferAssets(category: string): { from: string; to: string } | null {
  const c = (category || '').trim();
  if (!/^pindah\s+/i.test(c)) return null;
  let rest = c.replace(/^pindah\s+/i, '').trim();
  rest = rest.replace(/^saldo\s+/i, '').trim();
  const parts = rest.split(/\s+ke\s+/i);
  if (parts.length !== 2) return null;
  const from = parts[0].trim();
  const to = parts[1].trim();
  if (!from || !to) return null;
  return { from, to };
}

export function getTransactionAssetDeltas(
  tx: Pick<Transaction, 'type' | 'category' | 'amount' | 'wallet' | 'isExcludeReport'>
): Array<{ asset: AssetWallet; delta: number }> {
  const deltas: Array<{ asset: AssetWallet; delta: number }> = [];

  const rule = TRANSACTION_TO_ASSET[tx.type]?.[tx.category];

  // Investment & recovery Income: single-asset movement
  if (rule && (tx.type === 'Investment' || tx.type === 'Income')) {
    deltas.push({
      asset: rule.asset,
      delta: rule.direction === 'in' ? tx.amount : -tx.amount,
    });
  }

  // Internal transfers: move money between wallets without changing net worth
  if (tx.type === 'Internal Transfer') {
    const flow = INTERNAL_TRANSFER_ASSET_FLOWS[tx.category];
    if (flow) {
      if (flow.fromAsset && flow.toAsset) {
        deltas.push({ asset: flow.fromAsset, delta: -tx.amount });
        deltas.push({ asset: flow.toAsset, delta: tx.amount });
      } else if (flow.fromAsset) {
        deltas.push({ asset: flow.fromAsset, delta: -tx.amount });
      } else if (flow.toAsset) {
        deltas.push({ asset: flow.toAsset, delta: tx.amount });
      } else if (tx.category === 'Tarik Tunai') {
        deltas.push({ asset: tx.wallet as AssetWallet, delta: -tx.amount });
      } else if (tx.category === 'Top Up Saldo') {
        deltas.push({ asset: tx.wallet as AssetWallet, delta: tx.amount });
      } else {
        // Fallback dinamis agar kategori legacy yang belum dipetakan tetap jalan
        const parsed = parseTransferAssets(tx.category);
        if (parsed) {
          deltas.push({ asset: parsed.from as AssetWallet, delta: -tx.amount });
          deltas.push({ asset: parsed.to as AssetWallet, delta: tx.amount });
        }
      }
    } else {
      // Kategori dinamis "Pindah <Dari> ke <Ke>" antar akun pengguna
      const parsed = parseTransferAssets(tx.category);
      if (parsed) {
        deltas.push({ asset: parsed.from as AssetWallet, delta: -tx.amount });
        deltas.push({ asset: parsed.to as AssetWallet, delta: tx.amount });
      } else if (tx.category === 'Tarik Tunai') {
        deltas.push({ asset: tx.wallet as AssetWallet, delta: -tx.amount });
      } else if (tx.category === 'Top Up Saldo') {
        deltas.push({ asset: tx.wallet as AssetWallet, delta: tx.amount });
      }
    }
  }

  return deltas;
}

// Arah: perubahan aset (penambahan/pembelian) → pencatatan transaksi otomatis.
// Dipakai Setup (Kelola Aset & Modal) saat wadah aset ditambah / nilainya diubah.
export interface AssetDeltaDraft {
  type: TransactionType;
  category: string;
  amount: number;
  wallet: OperationalWallet;
  isExcludeReport: boolean;
  note: string;
}

// Transaksi yang dicatat OTOMATIS dari perubahan aset (Setup "Kelola Aset" & Portofolio Saham)
// dibuat dengan skipAssetSync=true (nilai aset sudah final). Flag itu tidak punya kolom di DB,
// jadi setelah reload dikenali lagi dari catatan bawaannya — supaya hapus transaksi auto-catat
// tidak mengembalikan saldo yang sudah dikoreksi di Kelola Aset.
const AUTO_ASSET_SYNC_NOTE = /auto-catat|tercatat dari Kelola Aset|Portofolio Saham\)\s*$/i;
export function isAutoAssetSyncNote(note: string | null | undefined): boolean {
  return AUTO_ASSET_SYNC_NOTE.test(note || '');
}

// Transaksi Beli/Jual Saham dikelola Portofolio Saham (lot & harga rata-rata) — edit nominal
// dari Cashflow tidak aman (lot tidak ikut berubah), jadi hanya tanggal & catatan yang boleh diubah.
export function isStockPortfolioTx(tx: Pick<Transaction, 'type' | 'category'>): boolean {
  return tx.type === 'Investment' && (tx.category === 'Beli Saham' || tx.category === 'Jual Saham');
}

/** Transaksi yang nominal/tipe/kategori/akunnya dikunci saat diedit (tanpa efek saldo). */
export function isBalanceLockedTx(tx: Pick<Transaction, 'type' | 'category' | 'note' | 'skipAssetSync'>): boolean {
  return Boolean(tx.skipAssetSync) || isAutoAssetSyncNote(tx.note) || isStockPortfolioTx(tx);
}

export function buildAssetDeltaTransaction(
  asset: Pick<AssetItem, 'name' | 'displayName' | 'subCategory' | 'goldQtyGr' | 'pricePerGram' | 'value'>,
  delta: number,
  cashWallet?: string
): AssetDeltaDraft | null {
  if (Math.abs(delta) < 1) return null;

  const direction = delta > 0 ? 'in' : 'out';
  const amount = Math.abs(delta);
  const ownName = (asset.name as string) || '';
  const label = asset.displayName || asset.name;
  // Nama wadah custom "Emas" diperlakukan sama seperti "Emas Fisik".
  const nameKey = ownName === 'Emas' ? 'Emas Fisik' : ownName;
  const isInstrument = nameKey === 'Saham' || nameKey === 'Emas Fisik';
  const isPiutang =
    (asset.subCategory as string) === 'piutang' ||
    isPiutangAssetName(ownName) ||
    isPiutangAssetName(asset.displayName);
  // Instrumen & piutang memakai akun kas yang dipilih. Rekening lain mencatat dirinya sendiri.
  const wallet = (isInstrument || isPiutang ? (cashWallet || '').trim() : '') || ownName;

  switch (nameKey) {
    case 'Saham':
      return {
        type: 'Investment',
        category: direction === 'in' ? 'Beli Saham' : 'Jual Saham',
        amount,
        wallet,
        isExcludeReport: false,
        note: `${direction === 'in' ? 'Pembelian' : 'Penjualan'} portofolio Saham · auto-catat dari Kelola Aset`,
      };
    case 'Emas Fisik':
      return {
        type: 'Investment',
        category: direction === 'in' ? 'Beli Emas' : 'Jual Emas',
        amount,
        wallet,
        isExcludeReport: false,
        note: `${direction === 'in' ? 'Pembelian' : 'Penjualan'} ${label} · auto-catat dari Kelola Aset`,
      };
    case 'Piutang Teman':
      if (direction === 'out') {
        return {
          type: 'Income',
          category: 'Pelunasan Piutang',
          amount,
          wallet,
          isExcludeReport: false,
          note: `Pelunasan piutang tercatat dari Kelola Aset · ${label}`,
        };
      }
      return null;
    default: {
      // Wadah custom dari Setup (isi Setup tidak diubah; ini hanya auto-catat Cashflow):
      // - rekening likuid (bank / kas / e-wallet) → Top Up Saldo atau Tarik Tunai
      // - piutang custom berkurang → Income Pelunasan Piutang
      // - wadah tabungan/goals custom bertambah → Savings sesuai nama wadah
      const assetName = asset.name as string;
      const sub = asset.subCategory as string;
      if (sub === 'bank' || sub === 'cash' || sub === 'e_wallet') {
        return {
          type: direction === 'in' ? 'Savings' : 'Internal Transfer',
          category: direction === 'in' ? 'Top Up Saldo' : 'Tarik Tunai',
          amount,
          wallet: assetName,
          isExcludeReport: true,
          note: `Perubahan saldo ${label} · auto-catat dari Kelola Aset`,
        };
      }
      if (isPiutangAssetName(assetName) || isPiutangAssetName(asset.displayName)) {
        if (direction === 'out') {
          return {
            type: 'Income',
            category: 'Pelunasan Piutang',
            amount,
            wallet,
            isExcludeReport: false,
            note: `Pelunasan piutang tercatat dari Kelola Aset · ${label}`,
          };
        }
        return null;
      }
      if (direction === 'in') {
        return {
          type: 'Savings',
          category: assetName,
          amount,
          wallet,
          isExcludeReport: false,
          note: `Alokasi ${label} · auto-catat dari Kelola Aset`,
        };
      }
      return null;
    }
  }
}

export interface RecoveryItem {
  id: string;
  title: string;
  // Kategori kanonis (RecoveryTargetCategory) atau nama wadah Setup (dinamis,
  // mis. "Dana Darurat") agar target sejajar dengan kategori Savings.
  category: string;
  targetAmount: number;
  recoveredAmount: number;
  status: 'Pending' | 'In Progress' | 'Recovered' | 'Partial';
  dueDate?: string;
  notes?: string;
  updatedAt?: string;
}

// Label badge kategori target: kanonis dipetakan, wadah custom tampil apa adanya.
export function getRecoveryCategoryLabel(cat: string | null | undefined): string {
  const key = (cat || '').trim();
  const staticLabels: Record<string, string> = {
    piutang: 'Piutang',
    saham: 'Saham',
    dana_darurat: 'Dana Darurat',
    obligasi_sbn: 'Obligasi / SBN',
    tabungan_masa_depan: 'Tabungan Masa Depan',
    recovery_fund: 'Recovery Fund',
    dp_rumah: 'DP / Beli Rumah',
    tabungan_umroh: 'Tabungan Umroh',
    dana_pendidikan: 'Dana Pendidikan Anak',
  };
  return staticLabels[key] ?? (key || '—');
}

// Wadah savings custom dihitung sebagai goals (seperti 7 kategori kanonis).
export function isGoalTargetCategory(cat: string | null | undefined): boolean {
  const key = (cat || '').trim();
  if ((GOAL_SAVINGS_CATEGORIES as readonly string[]).includes(key)) return true;
  if ((RECOVERY_MODAL_CATEGORIES as readonly string[]).includes(key)) return false;
  return !isPiutangAssetName(key);
}

export type AssetCategory = 'likuid' | 'non_likuid';
export type AssetSubCategory =
  | 'bank'
  | 'cash'
  | 'e_wallet'
  | 'saham'
  | 'obligasi'
  | 'emas'
  | 'kendaraan'
  | 'piutang'
  | 'investasi';

export interface AssetItem {
  id: string;
  name: AssetWallet;
  displayName: string;
  category: AssetCategory;
  subCategory: AssetSubCategory;
  value: number;
  details: string;
  // Emas Fisik: value = goldQtyGr × pricePerGram (harga buyback ANTAM 1 gram, Galeri24)
  isGold?: boolean;
  goldQtyGr?: number;
  pricePerGram?: number;
  lastUpdated?: string;
}

// Nilai Saldo emas (IDR) = jumlah gram × harga per gram (buyback ANTAM 1 gram, Galeri24)
export function computeGoldValue(qtyGr: number, pricePerGram: number): number {
  return Math.max(0, Math.round(qtyGr * pricePerGram));
}

// ─────────────────────────────────────────────────────────────────────────────
// MODUL: MANAJEMEN PORTOFOLIO SAHAM (sub-modul Kelola Aset & Modal)
// 1 lot = 100 lembar (konvensi Bursa Efek Indonesia). Nilai wadah aset 'Saham'
// = Σ lembar × harga pasar (di-reconcile real-time oleh FinanceContext).
// ─────────────────────────────────────────────────────────────────────────────

export const SHARES_PER_LOT = 100;

export type StockStrategy = 'Swing' | 'Long-Term';
export const STOCK_STRATEGIES: readonly StockStrategy[] = ['Swing', 'Long-Term'] as const;

export interface StockHolding {
  id: string;
  ticker: string; // Kode Saham, mis. BBRI
  companyName?: string; // nama emiten (opsional)
  lots: number; // Jumlah lot (1 lot = 100 lembar)
  buyPrice: number; // harga beli per lembar / harga rata-rata (IDR)
  marketPrice: number; // harga saat ini per lembar (IDR)
  category: AssetCategory; // Likuid / Non-Likuid (untuk klasifikasi aset)
  strategy: StockStrategy; // Swing vs Long-Term
  realizedProfit?: number; // akumulasi P&L terealisasi dari penjualan parsial
  lastUpdated?: string;
}

export function getStockShares(h: Pick<StockHolding, 'lots'>): number {
  return Math.round(h.lots * SHARES_PER_LOT);
}

export function getStockCostValue(h: Pick<StockHolding, 'lots' | 'buyPrice'>): number {
  return getStockShares(h) * h.buyPrice;
}

export function getStockMarketValue(
  h: Pick<StockHolding, 'lots' | 'marketPrice'>
): number {
  return getStockShares(h) * h.marketPrice;
}

export function getStockProfitLoss(h: StockHolding): number {
  return (h.marketPrice - h.buyPrice) * getStockShares(h);
}

export function getStockProfitLossPercent(h: StockHolding): number {
  if (h.buyPrice <= 0) return 0;
  return ((h.marketPrice - h.buyPrice) / h.buyPrice) * 100;
}

// Total nilai pasar portofolio = nilai saldo wadah aset 'Saham'
export function computeStockPortfolioValue(
  holdings: Pick<StockHolding, 'lots' | 'marketPrice'>[]
): number {
  return holdings.reduce((sum, h) => sum + getStockMarketValue(h), 0);
}

export function computeStockCostTotal(
  holdings: Pick<StockHolding, 'lots' | 'buyPrice'>[]
): number {
  return holdings.reduce((sum, h) => sum + getStockCostValue(h), 0);
}

export function computeStockRealizedProfitTotal(holdings: Pick<StockHolding, 'realizedProfit'>[]): number {
  return holdings.reduce((sum, h) => sum + (h.realizedProfit ?? 0), 0);
}

export function computeStockUnrealizedPL(holdings: StockHolding[]): number {
  return computeStockPortfolioValue(holdings) - computeStockCostTotal(holdings);
}

export function getSwingHoldings(holdings: StockHolding[]): StockHolding[] {
  return holdings.filter((h) => h.strategy === 'Swing');
}

export function computeSwingPositionValue(holdings: StockHolding[]): number {
  return computeStockPortfolioValue(getSwingHoldings(holdings));
}

export interface CashflowPoint {
  period: string; // e.g., '2026-01' or 'Jan 26'
  year: number;
  month: number;
  income: number;
  expenses: number;
  savings: number;
  netSavingsRate: number; // percentage (0 - 100)
}

export interface SummaryMetrics {
  totalIncome: number;
  totalSpending: number;
  monthlySavingsRate: number; // percentage
  netWorth: number;
  liquidTotal: number;
  nonLiquidTotal: number;
  needsAmount: number;
  wantsAmount: number;
  savingsAmount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ganti nama wadah (Setup) → ikut ganti referensi TEKS nama di transaksi & target.
// Murni teks: tidak pernah mengubah nominal/tanggal/tipe. Cocok PERSIS (case-sensitive,
// sesuai yang tersimpan) — baris lain tidak tersentuh.
export interface WadahRenameTxChange {
  id: string;
  before: { wallet: string; category: string };
  after: { wallet: string; category: string };
}
export interface WadahRenameTargetChange {
  id: string;
  before: { title: string; category: string };
  after: { title: string; category: string };
}
export interface WadahRenamePlan {
  txChanges: WadahRenameTxChange[];
  targetChanges: WadahRenameTargetChange[];
  // Target yang tertaut lewat kata kunci (mis. "darurat") dan akan lepas karena nama baru
  // tidak lagi mengandung kata kuncinya.
  keywordLinkLost: string[];
}

// Ganti token nama pada format transfer "Pindah [Saldo ]<Dari> ke <Ke>" (bukan substring buta).
export function renameInTransferCategory(category: string, oldName: string, newName: string): string {
  // Kategori transfer resmi (pemetaan tetap di kode) tidak diubah.
  if (Object.prototype.hasOwnProperty.call(INTERNAL_TRANSFER_ASSET_FLOWS, category)) return category;
  const m = /^(\s*pindah\s+(?:saldo\s+)?)(.*)$/i.exec(category || '');
  if (!m) return category;
  const parts = m[2].split(/(\s+ke\s+)/i);
  if (parts.length !== 3) return category;
  const [from, sep, to] = parts;
  const nextFrom = from.trim() === oldName ? from.replace(oldName, newName) : from;
  const nextTo = to.trim() === oldName ? to.replace(oldName, newName) : to;
  if (nextFrom === from && nextTo === to) return category;
  return `${m[1]}${nextFrom}${sep}${nextTo}`;
}

export function planWadahRename(
  oldName: string,
  newName: string,
  transactions: Pick<Transaction, 'id' | 'type' | 'category' | 'wallet'>[],
  recoveryItems: Pick<RecoveryItem, 'id' | 'title' | 'category'>[]
): WadahRenamePlan {
  const empty: WadahRenamePlan = { txChanges: [], targetChanges: [], keywordLinkLost: [] };
  if (!oldName || !newName || oldName === newName) return empty;
  const txChanges: WadahRenameTxChange[] = [];
  for (const t of transactions) {
    const wallet = t.wallet === oldName ? newName : t.wallet;
    let category = t.category;
    if (t.type === 'Savings' && t.category === oldName) category = newName;
    else if (t.type === 'Internal Transfer' || /^\s*pindah\s+/i.test(t.category || ''))
      category = renameInTransferCategory(t.category, oldName, newName);
    if (wallet !== t.wallet || category !== t.category) {
      txChanges.push({
        id: t.id,
        before: { wallet: t.wallet, category: t.category },
        after: { wallet, category },
      });
    }
  }
  const targetChanges: WadahRenameTargetChange[] = [];
  for (const it of recoveryItems) {
    const title = it.title === oldName ? newName : it.title;
    const category = it.category === oldName ? newName : it.category;
    if (title !== it.title || category !== it.category) {
      targetChanges.push({
        id: it.id,
        before: { title: it.title, category: it.category },
        after: { title, category },
      });
    }
  }
  const oldGoals = findGoalCategoriesForWadah(oldName);
  const newGoals = findGoalCategoriesForWadah(newName);
  const lostGoals = oldGoals.filter((g) => !newGoals.includes(g));
  const keywordLinkLost = recoveryItems
    .filter((it) => (lostGoals as string[]).includes(it.category))
    .map((it) => it.title);
  return { txChanges, targetChanges, keywordLinkLost };
}
