import * as XLSX from 'xlsx';
import {
  ParsedImportRow,
  TransactionType,
} from '@/types/finance';

// Exact mapping rules from keywords to Official Categories & Types
interface MappingRule {
  category: string;
  type: TransactionType;
  keywords: string[];
}

const CATEGORY_RULES: MappingRule[] = [
  // INCOME
  {
    category: 'Monthly Salary',
    type: 'Income',
    keywords: ['gaji', 'salary', 'payroll', 'upah', 'honor', 'bonus kantor', 'thr'],
  },
  {
    category: 'Freelance / Side Job',
    type: 'Income',
    keywords: ['freelance', 'side job', 'side project', 'proyek', 'komisi', 'jasa', 'konsultasi'],
  },
  {
    category: 'Pelunasan Piutang',
    type: 'Income',
    keywords: ['pelunasan piutang', 'bayar utang', 'kembalikan pinjaman', 'piutang teman', 'pelunasan'],
  },
  {
    category: 'Pencairan Investasi',
    type: 'Income',
    keywords: ['pencairan investasi', 'dividen', 'dividend', 'kupon sbn', 'bunga deposito', 'profit investasi', 'imbal hasil'],
  },

  // NEEDS
  {
    category: 'Food & Groceries',
    type: 'Needs',
    keywords: [
      'makan',
      'makanan',
      'groceries',
      'belanja bulanan',
      'supermarket',
      'sembako',
      'beras',
      'pasar',
      'sayur',
      'lauk',
      'indomaret',
      'alfamart',
      'dapur',
      'catering',
      'warteg',
      'gas elpiji',
      'air galon',
    ],
  },
  {
    category: 'Utilities & Bill',
    type: 'Needs',
    keywords: [
      'listrik',
      'pln',
      'token listrik',
      'tagihan listrik',
      'pdam',
      'air pdam',
      'wifi',
      'internet',
      'indihome',
      'biznet',
      'pulsa',
      'kuota',
      'paket data',
      'iuran lingkungan',
      'kebersihan',
    ],
  },
  {
    category: 'Transportation',
    type: 'Needs',
    keywords: [
      'bensin',
      'bbm',
      'pertalite',
      'pertamax',
      'spbu',
      'shell',
      'transport',
      'ongkos',
      'tol',
      'e-toll',
      'parkir',
      'servis motor',
      'ganti oli',
      'krl',
      'mrt',
      'transjakarta',
      'busway',
      'grab',
      'gojek',
    ],
  },
  {
    category: 'Family Support',
    type: 'Needs',
    keywords: ['orang tua', 'ortu', 'keluarga', 'family support', 'transfer orang tua', 'adik', 'bantuan keluarga'],
  },
  {
    category: 'Personal Items',
    type: 'Needs',
    keywords: [
      'sabun',
      'odol',
      'shampoo',
      'deterjen',
      'perlengkapan mandi',
      'laundry',
      'cukur rambut',
      'kebutuhan pribadi',
      'personal items',
    ],
  },
  {
    category: 'Healthcare',
    type: 'Needs',
    keywords: [
      'bpjs',
      'kesehatan',
      'obat',
      'apotek',
      'dokter',
      'klinik',
      'rumah sakit',
      'vitamin',
      'gigi',
      'checkup',
    ],
  },

  // WANTS
  {
    category: 'Nongkrong & Kopi',
    type: 'Wants',
    keywords: [
      'kopi',
      'ngopi',
      'coffee',
      'cafe',
      'starbucks',
      'janji jiwa',
      'kenangan',
      'fore',
      'nongkrong',
      'boba',
      'dessert',
      'camilan',
      'snack',
    ],
  },
  {
    category: 'Shopping & Outfit',
    type: 'Wants',
    keywords: [
      'baju',
      'celana',
      'outfit',
      'fashion',
      'sepatu',
      'sneakers',
      'tas',
      'shopee belanja',
      'tokopedia',
      'uniqlo',
      'zara',
      'h&m',
      'shopping',
    ],
  },
  {
    category: 'Entertainment & Hobby',
    type: 'Wants',
    keywords: [
      'bioskop',
      'cinema',
      'xxi',
      'cgv',
      'nonton',
      'film',
      'game',
      'steam',
      'playstation',
      'topup game',
      'netflix',
      'spotify',
      'youtube premium',
      'hobi',
    ],
  },
  {
    category: 'Gifts & Donations',
    type: 'Wants',
    keywords: ['sedekah', 'donasi', 'infaq', 'zakat', 'hadiah', 'kado', 'traktir', 'charity', 'sumbangan'],
  },
  {
    category: 'Travel & Outing',
    type: 'Wants',
    keywords: [
      'travel',
      'liburan',
      'vacation',
      'staycation',
      'hotel',
      'villa',
      'tiket pesawat',
      'wisata',
      'jalan-jalan',
      'pantai',
      'trip',
    ],
  },

  // SAVINGS
  {
    category: 'Dana Darurat',
    type: 'Savings',
    keywords: ['dana darurat', 'emergency fund', 'simpanan darurat'],
  },
  {
    category: 'Obligasi / SBN',
    type: 'Savings',
    keywords: ['obligasi', 'sbn', 'ori', 'sukuk', 'fr00', 'surat berharga negara'],
  },
  {
    category: 'Tabungan Masa Depan',
    type: 'Savings',
    keywords: ['tabungan masa depan', 'masa depan'],
  },
  {
    category: 'Recovery Fund',
    type: 'Savings',
    keywords: ['recovery fund', 'recovery', 'target pemulihan', 'pemulihan modal'],
  },
  {
    category: 'DP / Beli Rumah',
    type: 'Savings',
    keywords: ['dp rumah', 'beli rumah', 'kpr', 'tabungan rumah', 'properti'],
  },
  {
    category: 'Tabungan Umroh',
    type: 'Savings',
    keywords: ['umroh', 'haji', 'tabungan umroh', 'umrah'],
  },
  {
    category: 'Dana Pendidikan Anak',
    type: 'Savings',
    keywords: ['pendidikan anak', 'sekolah anak', 'kuliah', 'dana pendidikan'],
  },
];

const INTERNAL_TRANSFER_KEYWORDS = [
  'transfer antar rekening',
  'antar rekening',
  'antar dompet',
  'tarik tunai',
  'setor tunai',
  'top up',
  'topup',
  'pindah dana',
  'internal transfer',
  'mutasi rekening',
  'tukar uang',
];

/**
 * Normalizes header keys to standard Money Lover names
 */
function findMatchingKey(row: Record<string, unknown>, candidateKeys: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const candidate of candidateKeys) {
    const found = keys.find(
      (k) => k.trim().toLowerCase() === candidate.trim().toLowerCase()
    );
    if (found) return found;
  }
  return undefined;
}

/**
 * Clean & parse numerical currency strings
 */
export function cleanAmount(val: unknown): number {
  if (typeof val === 'number') return Math.abs(val);
  if (!val) return 0;
  const str = String(val)
    .replace(/[^\d.,-]/g, '')
    .trim();

  // If format is Indonesian e.g. 1.500.000,00 or 1500000
  let normalized = str;
  if (normalized.includes('.') && normalized.includes(',')) {
    // 1.250.000,00
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes('.')) {
    // Check if dot is thousands separator: 1.500.000
    const parts = normalized.split('.');
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      normalized = normalized.replace(/\./g, '');
    }
  } else if (normalized.includes(',')) {
    // 1250,50
    normalized = normalized.replace(',', '.');
  }

  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * Parses date string or Excel serial date into YYYY-MM-DD
 */
export function cleanDate(val: unknown): string {
  if (!val) return new Date().toISOString().split('T')[0];

  // If number, Excel date serial
  if (typeof val === 'number') {
    const parsedDate = new Date((val - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0];
    }
  }

  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      return val.toISOString().split('T')[0];
    }
  }

  const str = String(val).trim();

  // Handle DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  // Handle YYYY-MM-DD
  const yyyymmdd = str.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (yyyymmdd) {
    const year = yyyymmdd[1];
    const month = yyyymmdd[2].padStart(2, '0');
    const day = yyyymmdd[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Keep the spreadsheet's account name. Blank cells fall back to "Cash".
 * Institution names are not rewritten to a built-in account.
 */
export function normalizeWallet(val: unknown): string {
  const raw = String(val ?? '').trim();
  if (!raw) return 'Cash';
  return raw;
}

/**
 * Map a free-text category or note onto the built-in categories.
 */
export function categorizeTransaction(
  categoryName: string,
  noteText: string,
  excludeReport: boolean
): { category: string; type: TransactionType; confidenceScore: number } {
  const combined = `${categoryName} ${noteText}`.toLowerCase().trim();

  // 1. Check if excluded or explicitly internal transfer
  if (excludeReport) {
    return {
      category: 'Internal Transfer',
      type: 'Internal Transfer',
      confidenceScore: 0.95,
    };
  }

  for (const kw of INTERNAL_TRANSFER_KEYWORDS) {
    if (combined.includes(kw)) {
      return {
        category: 'Internal Transfer',
        type: 'Internal Transfer',
        confidenceScore: 0.9,
      };
    }
  }

  // 2. Direct exact match with official categories
  for (const rule of CATEGORY_RULES) {
    if (rule.category.toLowerCase() === categoryName.trim().toLowerCase()) {
      return {
        category: rule.category,
        type: rule.type,
        confidenceScore: 1.0,
      };
    }
  }

  // 3. Keyword matching
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (combined.includes(kw)) {
        return {
          category: rule.category,
          type: rule.type,
          confidenceScore: 0.85,
        };
      }
    }
  }

  // 4. Fallback: Needs (Food & Groceries)
  return {
    category: 'Food & Groceries',
    type: 'Needs',
    confidenceScore: 0.5,
  };
}

export interface ParseResult {
  rows: ParsedImportRow[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  detectedColumns: Record<string, string>;
  errors: string[];
}

/**
 * Main parser function to process Money Lover Excel files
 */
export async function parseMoneyLoverFile(buffer: ArrayBuffer): Promise<ParseResult> {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Spreadsheet kosong atau tidak memiliki lembar kerja (worksheet).');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

  if (!rawJson || rawJson.length === 0) {
    throw new Error('Tidak ada baris data yang ditemukan di dalam spreadsheet.');
  }

  const sampleRow = rawJson[0];
  const categoryKey = findMatchingKey(sampleRow, ['CATEGORY', 'Kategori', 'Category', 'Kat']);
  const amountKey = findMatchingKey(sampleRow, ['AMOUNT', 'Jumlah', 'Amount', 'Nominal', 'Nilai']);
  const noteKey = findMatchingKey(sampleRow, ['NOTE', 'Catatan', 'Note', 'Keterangan', 'Deskripsi']);
  const walletKey = findMatchingKey(sampleRow, ['WALLET', 'Dompet', 'Wallet', 'Akun', 'Rekening']);
  const dateKey = findMatchingKey(sampleRow, ['DATE', 'Tanggal', 'Date', 'Waktu']);
  const excludeKey = findMatchingKey(sampleRow, ['EXCLUDE REPORT', 'Exclude', 'Exclude Report', 'Abaikan']);

  const detectedColumns: Record<string, string> = {};
  if (categoryKey) detectedColumns['CATEGORY'] = categoryKey;
  if (amountKey) detectedColumns['AMOUNT'] = amountKey;
  if (noteKey) detectedColumns['NOTE'] = noteKey;
  if (walletKey) detectedColumns['WALLET'] = walletKey;
  if (dateKey) detectedColumns['DATE'] = dateKey;
  if (excludeKey) detectedColumns['EXCLUDE REPORT'] = excludeKey;

  const errors: string[] = [];
  if (!amountKey) {
    errors.push("Kolom 'AMOUNT' atau 'Jumlah' tidak terdeteksi.");
  }

  const parsedRows: ParsedImportRow[] = rawJson.map((row, index) => {
    const rawCategory = categoryKey ? String(row[categoryKey] || '').trim() : '';
    const rawNote = noteKey ? String(row[noteKey] || '').trim() : '';
    const rawAmount = amountKey ? row[amountKey] : 0;
    const rawDate = dateKey ? row[dateKey] : '';
    const rawWallet = walletKey ? row[walletKey] : '';
    const rawExclude = excludeKey ? row[excludeKey] : false;

    const isExcludeReport =
      rawExclude === true ||
      rawExclude === 1 ||
      String(rawExclude).toLowerCase() === 'yes' ||
      String(rawExclude).toLowerCase() === 'true' ||
      String(rawExclude).toLowerCase() === '1';

    const amount = cleanAmount(rawAmount);
    const date = cleanDate(rawDate);
    const wallet = normalizeWallet(rawWallet);

    const { category, type, confidenceScore } = categorizeTransaction(
      rawCategory,
      rawNote,
      isExcludeReport
    );

    const isValid = amount > 0;
    const validationError = isValid ? undefined : 'Nominal transaksi nol atau tidak valid';

    return {
      id: `row-${index}-${Date.now()}`,
      date,
      amount,
      category,
      type,
      wallet,
      note: rawNote || (rawCategory ? `Transaksi ${rawCategory}` : 'Pencatatan'),
      isExcludeReport,
      rawCategory,
      confidenceScore,
      isValid,
      validationError,
    };
  });

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    validCount,
    invalidCount,
    detectedColumns,
    errors,
  };
}

/** Example Money Lover workbook with obviously fake rows. */
export function generateSampleMoneyLoverWorkbook(): Uint8Array {
  const data = [
    {
      DATE: '2026-09-01',
      CATEGORY: 'Monthly Salary',
      AMOUNT: 5000000,
      NOTE: 'Contoh gaji',
      WALLET: 'Bank',
      'EXCLUDE REPORT': 'No',
    },
    {
      DATE: '2026-09-02',
      CATEGORY: 'Freelance / Side Job',
      AMOUNT: 500000,
      NOTE: 'Contoh pekerjaan sampingan',
      WALLET: 'Bank',
      'EXCLUDE REPORT': 'No',
    },
    {
      DATE: '2026-09-03',
      CATEGORY: 'Food & Groceries',
      AMOUNT: 150000,
      NOTE: 'Contoh belanja dapur',
      WALLET: 'Cash',
      'EXCLUDE REPORT': 'No',
    },
    {
      DATE: '2026-09-04',
      CATEGORY: 'Utilities & Bill',
      AMOUNT: 200000,
      NOTE: 'Contoh tagihan listrik',
      WALLET: 'Bank',
      'EXCLUDE REPORT': 'No',
    },
    {
      DATE: '2026-09-05',
      CATEGORY: 'Transportation',
      AMOUNT: 50000,
      NOTE: 'Contoh transport',
      WALLET: 'Cash',
      'EXCLUDE REPORT': 'No',
    },
    {
      DATE: '2026-09-06',
      CATEGORY: 'Dana Darurat',
      AMOUNT: 300000,
      NOTE: 'Contoh tabungan darurat',
      WALLET: 'Investments',
      'EXCLUDE REPORT': 'No',
    },
    {
      DATE: '2026-09-07',
      CATEGORY: 'Nongkrong & Kopi',
      AMOUNT: 35000,
      NOTE: 'Contoh kopi',
      WALLET: 'Cash',
      'EXCLUDE REPORT': 'No',
    },
    {
      DATE: '2026-09-08',
      CATEGORY: 'Shopping & Outfit',
      AMOUNT: 100000,
      NOTE: 'Contoh belanja',
      WALLET: 'Cash',
      'EXCLUDE REPORT': 'No',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'MoneyLover_Transactions');
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(buffer);
}
