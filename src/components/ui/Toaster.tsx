'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { TOAST_EVENT, type ToastInput, type ToastTone } from '@/lib/toast';

interface Item {
  id: number;
  message: string;
  tone: ToastTone;
  out: boolean;
}

const ICONS = { ok: CheckCircle2, err: TriangleAlert, info: Info } as const;

/* Tumpukan toast kaca (pojok kanan atas; full-width di mobile).
   Juga menampilkan writeError dari FinanceContext sebagai toast gagal
   (tanpa menghapusnya — banner di Setup tetap tampil). */
export function Toaster() {
  const { writeError } = useFinance();
  const [items, setItems] = useState<Item[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const add = (message: string, tone: ToastTone) => {
      const id = ++seq.current;
      setItems((list) => [...list.slice(-3), { id, message, tone, out: false }]);
      window.setTimeout(() => setItems((l) => l.map((t) => (t.id === id ? { ...t, out: true } : t))), 3000);
      window.setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3400);
    };
    const onToast = (e: Event) => {
      const d = (e as CustomEvent<ToastInput>).detail;
      add(d.message, d.tone ?? 'ok');
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  useEffect(() => {
    if (!writeError) return;
    window.dispatchEvent(
      new CustomEvent<ToastInput>(TOAST_EVENT, { detail: { message: `Gagal menyimpan: ${writeError}`, tone: 'err' } }),
    );
  }, [writeError]);

  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => {
        const Icon = ICONS[t.tone];
        return (
          <div key={t.id} className={`toast glass ${t.out ? 'out' : ''}`} role={t.tone === 'err' ? 'alert' : 'status'}>
            <span className={`ico toast-ico ${t.tone}`}>
              <Icon size={16} strokeWidth={2.3} />
            </span>
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
