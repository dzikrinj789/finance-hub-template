import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount: number, withPrefix: boolean = true): string {
  if (!Number.isFinite(amount)) amount = 0;
  const hasFraction = Math.abs(amount % 1) >= 0.0005;
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    maximumFractionDigits: hasFraction ? 4 : 0,
    minimumFractionDigits: 0,
  }).format(amount);

  return withPrefix ? `Rp ${formatted}` : formatted;
}

export function formatCompactRupiah(amount: number): string {
  const abs = Math.abs(amount || 0);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    const val = (abs / 1_000_000_000).toFixed(2).replace(/\.00$/, '').replace('.', ',');
    return `${sign}Rp ${val} Miliar`;
  }
  if (abs >= 1_000_000) {
    const val = (abs / 1_000_000).toFixed(2).replace(/\.00$/, '').replace('.', ',');
    return `${sign}Rp ${val} Jt`;
  }
  if (abs >= 1_000) {
    const val = (abs / 1_000).toFixed(0);
    return `${sign}Rp ${val} Rb`;
  }
  return formatRupiah(amount);
}

export function formatPercent(value: number): string {
  if (isNaN(value)) return '0%';
  return `${value.toFixed(1)}%`;
}

export function formatDateIndo(dateString: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}
