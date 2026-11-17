'use client';

/* Toast ringan (event bus) — dipakai shell, QuickAddModal, Cashflow, dll.
   Murni presentasi: tidak menyimpan apa pun, tidak menyentuh data. */
export type ToastTone = 'ok' | 'err' | 'info';
export interface ToastInput {
  message: string;
  tone?: ToastTone;
}

export const TOAST_EVENT = 'finance-hub:toast';

export function toast(message: string, tone: ToastTone = 'ok') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ToastInput>(TOAST_EVENT, { detail: { message, tone } }));
}
