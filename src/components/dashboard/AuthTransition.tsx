'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';

const AUTH_MESSAGES = ['Masuk berhasil', 'Menghubungkan ke Supabase…', 'Menyiapkan dashboard…'];

const DATA_MESSAGES = [
  'Menghubungkan ke Supabase…',
  'Memuat transaksi…',
  'Menghitung ringkasan…',
  'Menyiapkan dashboard…',
];

/**
 * Layar transisi branded setelah login — satu gaya untuk dua tahap:
 * - stage "auth": overlay di halaman login sesaat setelah sign-in sukses.
 * - stage "data": gate di (app)/layout selama isLoaded false.
 * Pesan berganti otomatis; tanpa localStorage, murni presentasional.
 */
export function AuthTransition({ stage = 'data' }: { stage?: 'auth' | 'data' }) {
  const messages = stage === 'auth' ? AUTH_MESSAGES : DATA_MESSAGES;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % messages.length), 1400);
    return () => clearInterval(t);
  }, [messages.length]);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-[#0A1128] text-white select-none"
      role="status"
      aria-live="polite"
      aria-label="Memuat Finance Hub"
    >
      {/* Glow latar — halus, bukan full gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(52% 38% at 50% 42%, rgba(37,99,235,0.22), transparent 70%), radial-gradient(70% 50% at 85% 115%, rgba(59,130,246,0.10), transparent 65%)',
        }}
      />

      {/* Logo + ring */}
      <div className="relative auth-pop">
        <span aria-hidden="true" className="absolute inset-0 rounded-3xl bg-[#3B82F6]/40 animate-ping" />
        <div className="relative w-16 h-16 rounded-3xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] border border-white/20 flex items-center justify-center shadow-lg shadow-blue-950/60">
          <TrendingUp size={30} strokeWidth={2.5} className="text-white" />
        </div>
      </div>

      <div className="relative text-center px-6">
        <p className="text-lg font-bold tracking-tight leading-tight">Finance Hub</p>
        <p key={idx} className="fade-in-up text-xs text-[#8FA6D8] mt-1.5">
          {messages[idx]}
        </p>
      </div>

      {/* Indeterminate bar */}
      <div className="relative w-44 h-1 rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
        <div className="auth-bar-fill" />
      </div>

      <p className="relative text-[10px] text-white/40 font-mono">Supabase · © 2026 Finance Hub</p>
    </div>
  );
}
