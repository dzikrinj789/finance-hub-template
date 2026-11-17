'use client';

import React, { useEffect, useRef, useState } from 'react';

interface AnchorModalProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
}

// Penghitung global: beberapa modal bisa terbuka berlapis. Body hanya di-restore
// saat lock terakhir dilepas — mencegah overflow 'hidden' bocor dan mengunci scroll halaman.
let bodyLockCount = 0;

export function AnchorModal({ open, anchorEl, onClose, title, subtitle, children, footer, maxWidth = 480 }: AnchorModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Position near anchor (desktop) or center (mobile)
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (window.innerWidth < 768 || !anchorEl) {
        setPos(null);
        return;
      }
      const rect = anchorEl.getBoundingClientRect();
      let top = rect.top + 40;
      let left = rect.left - 20;
      // Tinggi modal nyata (bukan asumsi 320px) agar footer Simpan tidak terpotong di bawah viewport
      const h = modalRef.current?.offsetHeight ?? 320;
      // Clamp to viewport so modal never off-screen
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.min(maxWidth, vw * 0.9);
      if (left + w > vw - 16) left = vw - w - 16;
      if (left < 16) left = 16;
      if (top + h > vh - 16) top = Math.max(16, vh - h - 16);
      setPos((p) => (p && p.top === top && p.left === left ? p : { top, left }));
    };
    update();
    // Ukur ulang saat isi modal berubah tinggi (mis. peta/foto dimuat)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (ro && modalRef.current) ro.observe(modalRef.current);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorEl, maxWidth]);

  // ESC + focus trap — onClose disimpan di ref agar tidak re-trigger tiap ketik
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Esc yang sudah ditangani anak (mis. menutup dropdown combobox) tidak menutup modal
      if (e.key === 'Escape' && !e.defaultPrevented) onCloseRef.current();
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    // Focus first input hanya sekali saat modal dibuka
    const timer = setTimeout(() => {
      const el = modalRef.current?.querySelector<HTMLElement>('input');
      el?.focus();
    }, 30);
    const prevOverflow = document.body.style.overflow;
    bodyLockCount += 1;
    if (bodyLockCount === 1) document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      bodyLockCount = Math.max(0, bodyLockCount - 1);
      if (bodyLockCount === 0) document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const isAnchored = !!pos && typeof window !== 'undefined' && window.innerWidth >= 768;

  return (
    <>
      <div
        className="fixed inset-0 z-[998]"
        style={{ backgroundColor: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`anchor-modal fixed z-[999] bg-white rounded-xl shadow-[0_6px_20px_rgba(0,0,0,0.1)] w-[90%] m-0 flex flex-col overflow-hidden ${isAnchored ? '' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'}`}
        style={
          isAnchored && pos
            ? {
                top: `${pos.top}px`,
                left: `${pos.left}px`,
                maxWidth: `${maxWidth}px`,
                animation: 'dropIn 220ms ease-out',
              }
            : {
                maxWidth: `${maxWidth}px`,
                animation: 'dropIn 220ms ease-out',
              }
        }
      >
        {/* Header hijau matcha */}
        <div className="bg-green-600 text-white px-5 py-3 rounded-t-xl flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-semibold leading-none">{title}</h3>
            {subtitle && <p className="text-[11px] text-white/80 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition" aria-label="Tutup">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="anchor-modal-body p-5 overflow-y-auto overscroll-contain flex-1 min-h-0">{children}</div>
        {footer && <div className="px-5 pb-5 flex justify-end gap-2 shrink-0">{footer}</div>}
      </div>
    </>
  );
}
