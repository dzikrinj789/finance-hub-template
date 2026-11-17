'use client';

import { Transaction } from '@/types/finance';

/* Export CSV transaksi — logic lama dari page.tsx, dipindah agar
   CommandPalette & tombol Export memakai sumber yang sama. */
export function exportTransactionsCsv(transactions: Transaction[]) {
  const header = [
    'Tanggal',
    'Keterangan',
    'Kategori',
    'Tipe',
    'Akun',
    'Nominal (IDR)',
    'Exclude Report',
  ];
  const rows = transactions.map((tx) => [
    tx.date,
    tx.note,
    tx.category,
    tx.type,
    tx.wallet,
    String(tx.amount),
    tx.isExcludeReport ? 'Ya' : 'Tidak',
  ]);
  const escapeCell = (cell: string) => `"${String(cell).replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finance-hub-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
