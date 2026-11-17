/**
 * Agregasi grafik Pemasukan vs Pengeluaran.
 * Klasifikasi sama dengan chart bulanan sebelumnya:
 *   Masuk  = Income
 *   Keluar = Needs + Wants + Savings + Investment
 *   Net    = Masuk − Keluar
 * Tidak dihitung: isExcludeReport, Internal Transfer (termasuk Pindah wadah),
 * dan kategori yang diawali "Pindah ".
 * Hari tanpa transaksi diisi nol supaya garis tidak putus.
 */

export type CashflowRange = '7' | '30' | '90' | 'all';
export type CashflowGrain = 'day' | 'week' | 'month';

export interface CashflowTx {
  date: string;
  amount: number;
  type: string;
  category: string;
  isExcludeReport: boolean;
}

export interface CashflowPoint {
  key: string;
  /** Label sumbu. Untuk harian: tanggal angka ("16"). Untuk minggu/bulan: label pendek. */
  axisLabel: string;
  /** Nama bulan di atas sumbu harian; kosong bila tidak perlu ditandai. */
  monthMark: string;
  fullLabel: string;
  income: number;
  expense: number;
  net: number;
  includesToday: boolean;
}

export interface CashflowSeriesModel {
  points: CashflowPoint[];
  start: string;
  end: string;
  today: string;
  hasData: boolean;
  domain: [number, number];
  ticks: number[];
  rangeLabel: string;
  grainLabel: string;
  yearLabel: string;
  pointMin: number;
  spansYears: boolean;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const EXPENSE = new Set(['Needs', 'Wants', 'Savings', 'Investment']);
const PINDAH = /^\s*pindah\s+/i;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_LONG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
const WEEKDAYS_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const GRAIN_LABEL: Record<CashflowGrain, string> = {
  day: 'Per hari',
  week: 'Per minggu',
  month: 'Per bulan',
};

export function isCashflowChartTx(tx: CashflowTx): boolean {
  if (tx.isExcludeReport) return false;
  if (tx.type === 'Internal Transfer') return false;
  if (PINDAH.test(tx.category || '')) return false;
  return tx.type === 'Income' || EXPENSE.has(tx.type);
}

export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return formatISO(d);
}

function parseISO(iso: string): Date {
  const m = ISO.exec(iso);
  if (!m) return new Date(NaN);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function formatISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isISO(iso: string): boolean {
  if (!ISO.test(iso)) return false;
  return formatISO(parseISO(iso)) === iso;
}

function daysInclusive(a: string, b: string): number {
  const ms = parseISO(b).getTime() - parseISO(a).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

function monthIndex(iso: string): number {
  return Number(iso.slice(5, 7)) - 1;
}

function dayNum(iso: string): number {
  return Number(iso.slice(8, 10));
}

function shortDate(iso: string, withYear: boolean): string {
  const mon = MONTHS[monthIndex(iso)];
  const base = `${dayNum(iso)} ${mon}`;
  return withYear ? `${base} ${iso.slice(2, 4)}` : base;
}

function longDate(iso: string): string {
  const dt = parseISO(iso);
  const weekday = WEEKDAYS_LONG[dt.getUTCDay()];
  return `${weekday}, ${dayNum(iso)} ${MONTHS_LONG[monthIndex(iso)]} ${iso.slice(0, 4)}`;
}

function spanLabel(from: string, to: string): string {
  if (from === to) return longDate(from);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  if (sameMonth) {
    return `${dayNum(from)}\u2013${dayNum(to)} ${MONTHS_LONG[monthIndex(from)]} ${from.slice(0, 4)}`;
  }
  if (sameYear) {
    return `${dayNum(from)} ${MONTHS_LONG[monthIndex(from)]} \u2013 ${dayNum(to)} ${MONTHS_LONG[monthIndex(to)]} ${from.slice(0, 4)}`;
  }
  return `${shortDate(from, true)} \u2013 ${shortDate(to, true)}`;
}

function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 4000) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return out;
}

interface DaySum {
  income: number;
  expense: number;
}

function resolveWindow(
  dates: string[],
  selectedYear: string,
  range: CashflowRange,
  today: string,
): { start: string; end: string } | null {
  const scoped = dates.filter((d) => (selectedYear === 'all' || d.startsWith(selectedYear)) && isISO(d)).sort();
  if (scoped.length === 0) return null;
  const first = scoped[0];
  const last = scoped[scoped.length - 1];
  const yearStart = selectedYear === 'all' ? '' : `${selectedYear}-01-01`;
  const yearEnd = selectedYear === 'all' ? '' : `${selectedYear}-12-31`;

  let end = today;
  if (selectedYear === 'all') {
    end = last > today ? last : today;
  } else if (today < yearStart || today > yearEnd) {
    end = last;
  } else {
    end = last > today && last <= yearEnd ? last : today;
  }
  if (yearStart && end < yearStart) end = yearStart;
  if (yearEnd && end > yearEnd) end = yearEnd;

  let start = range === 'all' ? first : addDays(end, -(Number(range) - 1));
  if (yearStart && start < yearStart) start = yearStart;
  if (start > end) start = end;
  if (daysInclusive(start, end) > 4000) start = addDays(end, -3999);
  return { start, end };
}

function niceStep(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const n = rough / pow;
  const f = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return f * pow;
}

export function niceAxis(min: number, max: number): { domain: [number, number]; ticks: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max) || (min === 0 && max === 0)) {
    return { domain: [0, 1], ticks: [0, 1] };
  }
  let lo = Math.min(0, min);
  let hi = Math.max(0, max);
  if (lo === hi) hi = lo + 1;
  const pad = (hi - lo) * 0.08;
  lo = Math.min(0, lo - (lo < 0 ? pad : 0));
  hi = Math.max(0, hi + (hi > 0 ? pad : 0));
  const step = niceStep((hi - lo) / 4);
  const niceLo = Math.floor(lo / step) * step;
  const niceHi = Math.ceil(hi / step) * step;
  const count = Math.max(1, Math.round((niceHi - niceLo) / step));
  const ticks: number[] = [];
  for (let i = 0; i <= count; i += 1) {
    ticks.push(Math.round((niceLo + i * step) * 1e6) / 1e6);
  }
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks };
}

function rangeText(range: CashflowRange, start: string, end: string): string {
  if (range === 'all') return 'seluruh periode';
  const n = Number(range);
  const count = daysInclusive(start, end);
  return count === n ? `${n} hari terakhir` : `${count} hari pada periode`;
}

export function buildCashflowSeries(
  transactions: readonly CashflowTx[],
  selectedYear: string,
  range: CashflowRange,
  grain: CashflowGrain,
  now: Date = new Date(),
): CashflowSeriesModel {
  const today = todayISO(now);
  const qualifying = transactions.filter(isCashflowChartTx);
  const window = resolveWindow(
    qualifying.map((tx) => tx.date),
    selectedYear,
    range,
    today,
  );
  const yearLabel = selectedYear === 'all' ? 'semua tahun' : `tahun ${selectedYear}`;
  const empty: CashflowSeriesModel = {
    points: [],
    start: today,
    end: today,
    today,
    hasData: false,
    domain: [0, 1],
    ticks: [0, 1],
    rangeLabel: range === 'all' ? 'seluruh periode' : `${range} hari terakhir`,
    grainLabel: GRAIN_LABEL[grain],
    yearLabel,
    pointMin: 36,
    spansYears: false,
  };
  if (!window) return empty;

  const byDay = new Map<string, DaySum>();
  for (const tx of qualifying) {
    if (tx.date < window.start || tx.date > window.end) continue;
    if (!isISO(tx.date) || !Number.isFinite(tx.amount)) continue;
    const bucket = byDay.get(tx.date) ?? { income: 0, expense: 0 };
    if (tx.type === 'Income') bucket.income += tx.amount;
    else bucket.expense += tx.amount;
    byDay.set(tx.date, bucket);
  }

  const days = eachDate(window.start, window.end);
  const spansYears = window.start.slice(0, 4) !== window.end.slice(0, 4);
  const points: CashflowPoint[] = [];

  if (grain === 'day') {
    days.forEach((iso, index) => {
      const sum = byDay.get(iso) ?? { income: 0, expense: 0 };
      const prev = index > 0 ? days[index - 1] : '';
      const markMonth = index === 0 || iso.slice(0, 7) !== prev.slice(0, 7);
      points.push({
        key: iso,
        axisLabel: String(dayNum(iso)),
        monthMark: markMonth ? MONTHS[monthIndex(iso)] : '',
        fullLabel: longDate(iso),
        income: sum.income,
        expense: sum.expense,
        net: sum.income - sum.expense,
        includesToday: iso === today,
      });
    });
  } else if (grain === 'week') {
    let i = 0;
    while (i < days.length) {
      const from = days[i];
      // Pekan Senin–Minggu. Bucket pertama boleh terpotong bila rentang mulai di tengah pekan.
      const dow = parseISO(from).getUTCDay();
      const daysUntilSunday = dow === 0 ? 0 : 7 - dow;
      const weekEnd = addDays(from, daysUntilSunday);
      let j = i;
      while (j + 1 < days.length && days[j + 1] <= weekEnd) j += 1;
      const to = days[j];
      let income = 0;
      let expense = 0;
      for (let k = i; k <= j; k += 1) {
        const sum = byDay.get(days[k]);
        if (!sum) continue;
        income += sum.income;
        expense += sum.expense;
      }
      points.push({
        key: from,
        axisLabel: shortDate(from, spansYears),
        monthMark: '',
        fullLabel: spanLabel(from, to),
        income,
        expense,
        net: income - expense,
        includesToday: today >= from && today <= to,
      });
      i = j + 1;
    }
  } else {
    let i = 0;
    while (i < days.length) {
      const from = days[i];
      const month = from.slice(0, 7);
      let j = i;
      while (j + 1 < days.length && days[j + 1].startsWith(month)) j += 1;
      const to = days[j];
      let income = 0;
      let expense = 0;
      for (let k = i; k <= j; k += 1) {
        const sum = byDay.get(days[k]);
        if (!sum) continue;
        income += sum.income;
        expense += sum.expense;
      }
      const mon = spansYears ? `${MONTHS[monthIndex(from)]} ${from.slice(2, 4)}` : MONTHS[monthIndex(from)];
      points.push({
        key: month,
        axisLabel: mon,
        monthMark: '',
        fullLabel: `${MONTHS_LONG[monthIndex(from)]} ${from.slice(0, 4)}`,
        income,
        expense,
        net: income - expense,
        includesToday: today >= from && today <= to,
      });
      i = j + 1;
    }
  }

  let min = 0;
  let max = 0;
  for (const p of points) {
    min = Math.min(min, p.net);
    max = Math.max(max, p.income, p.expense, p.net);
  }
  const axis = niceAxis(min, max);
  const pointMin = grain === 'day' ? 34 : grain === 'week' ? (spansYears ? 78 : 58) : spansYears ? 68 : 52;

  return {
    points,
    start: window.start,
    end: window.end,
    today,
    hasData: true,
    domain: axis.domain,
    ticks: axis.ticks,
    rangeLabel: rangeText(range, window.start, window.end),
    grainLabel: GRAIN_LABEL[grain],
    yearLabel,
    pointMin,
    spansYears,
  };
}
