'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  TrendingUp,
  Wallet,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  ArrowLeft,
  Mail,
  Lock,
  ShieldCheck,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthTransition } from '@/components/dashboard/AuthTransition';

type Mode = 'login' | 'register' | 'reset';

const HIGHLIGHTS = [
  { icon: Wallet, label: 'Net worth & saldo real-time' },
  { icon: ArrowRightLeft, label: 'Cashflow otomatis terkategori' },
  { icon: ShieldCheck, label: 'Recovery modal terpantau' },
];

function BrandPanel() {
  return (
    <div className="relative h-dvh hidden lg:flex flex-col justify-between overflow-hidden px-10 py-12 xl:px-14 hero-brand text-white select-none">
      {/* Ornamen */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute top-1/3 -left-16 h-64 w-64 rounded-full bg-white/[0.07] blur-xl" />
        <div className="absolute bottom-[-80px] right-12 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute bottom-[-40px] right-28 h-72 w-72 rounded-full border border-white/[0.14]" />
      </div>

      <div className="relative flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/25 backdrop-blur flex items-center justify-center shadow-lg">
          <TrendingUp size={19} strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <p className="text-[15px] font-bold tracking-tight">Finance Hub</p>
          <p className="text-[11px] text-white/65">Personal finance</p>
        </div>
      </div>

      <div className="relative max-w-[420px]">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-[2.6rem] xl:text-[2.9rem] font-bold tracking-tight leading-[1.12]"
        >
          Kelola uangmu <br />
          <span className="text-sky-200">dari satu tempat.</span>
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4 text-sm text-white/70 leading-relaxed"
        >
          Saldo akun, cashflow harian, dan target tabungan dalam satu dashboard.
        </motion.p>

        <div className="mt-8 space-y-2.5">
          {HIGHLIGHTS.map((h, i) => (
            <motion.div
              key={h.label}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.16 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3 rounded-xl bg-white/10 border border-white/15 backdrop-blur px-3.5 py-2.5"
            >
              <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <h.icon size={14} strokeWidth={2.2} />
              </span>
              <span className="text-[13px] font-medium text-white/90">{h.label}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="relative flex items-center gap-2 text-[10.5px] text-white/55 font-mono">
        <Sparkles size={11} className="text-sky-200" />
        Supabase Auth · © 2026 Finance Hub
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, authActive, signIn, signUp, requestPasswordReset } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Sudah login? langsung ke dashboard
  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  // Transisi branded sesaat setelah login sukses, baru pindah (cukup terbaca, tidak lambat)
  const goDashboard = () => {
    setRedirecting(true);
    window.setTimeout(() => router.push('/'), 1200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Masukkan alamat E-mail yang valid.');
      return;
    }
    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak sama.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        const result = await signIn(email, password);
        if (result.error) {
          setError(result.error);
        } else {
          goDashboard();
        }
      } else if (mode === 'register') {
        const result = await signUp(email, password);
        if (result.error) {
          setError(result.error);
        } else if (result.confirmRequired) {
          setInfo('Akun dibuat. Periksa email Anda dan klik tautan konfirmasi sebelum masuk.');
          setPassword('');
          setConfirmPassword('');
          switchMode('login');
        } else {
          goDashboard();
        }
      } else {
        const result = await requestPasswordReset(email);
        if (result.error) {
          setError(result.error);
        } else {
          setInfo('Tautan reset kata sandi telah dikirim ke email Anda.');
          switchMode('login');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isReset = mode === 'reset';

  const inputCls =
    'w-full h-12 rounded-xl border border-[#D7DDEE] bg-white pl-11 pr-11 text-sm text-[#0F1932] placeholder:text-[#A8B0C2] focus:border-[#2563EB]';

  return (
    <div className="h-dvh overflow-hidden bg-[#F2F5FD] lg:grid lg:grid-cols-[38%_62%] text-[#0F1932]">
      {redirecting && <AuthTransition stage="auth" />}
      <BrandPanel />

      {/* ── Form sisi kanan — compact, tanpa scroll ── */}
      <section className="relative h-dvh overflow-y-auto no-scrollbar flex flex-col justify-center px-5 sm:px-8 lg:px-16 xl:px-24 py-6">
        {/* Brand chip — mobile only (di desktop sudah ada panel kiri) */}
        <div className="mb-5 lg:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl hero-brand flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <TrendingUp size={17} strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight">Finance Hub</p>
              <p className="text-[10px] text-[#8A93A8]">Finance Hub</p>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[400px] mx-auto lg:mx-0"
        >
          {!authActive && (
            <p className="mb-4 text-xs text-[#B45309] bg-[#FEF3C7] border border-[#FCD34D] rounded-xl px-3 py-2">
              Supabase belum dikonfigurasi — autentikasi tidak berjalan.
            </p>
          )}

          <h1 className="text-[1.45rem] sm:text-[1.7rem] font-bold tracking-tight leading-tight">
            {mode === 'login' && 'Selamat datang kembali'}
            {mode === 'register' && 'Buat akun baru'}
            {mode === 'reset' && 'Atur ulang kata sandi'}
          </h1>
          <p className="text-[13px] text-[#5A6478] mt-1">
            {mode === 'login' && 'Masuk untuk melanjutkan ke dashboard Anda.'}
            {mode === 'register' && 'Daftar gratis untuk menikmati Finance Hub.'}
            {mode === 'reset' && 'Masukkan email untuk menerima tautan reset.'}
          </p>

          {mode !== 'reset' && (
            <div className="relative grid grid-cols-2 mt-5 mb-5 p-1 gap-1 bg-[#E9EEF9] rounded-2xl">
              <span
                className={`absolute top-1 bottom-1 rounded-xl bg-white shadow-[0_2px_10px_rgba(15,25,50,0.10)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]`}
                style={
                  mode === 'login'
                    ? { left: '4px', right: 'calc(50% + 2px)' }
                    : { left: 'calc(50% + 2px)', right: '4px' }
                }
              />
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`relative z-10 h-9 rounded-xl text-[13px] font-semibold transition-colors ${
                  mode === 'login' ? 'text-[#0F1932]' : 'text-[#8A93A8]'
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`relative z-10 h-9 rounded-xl text-[13px] font-semibold transition-colors ${
                  mode === 'register' ? 'text-[#0F1932]' : 'text-[#8A93A8]'
                }`}
              >
                Daftar
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            <div>
              {!isReset && (
                <label htmlFor="login-email" className="block text-xs font-semibold text-[#5A6478] mb-1.5">
                  E-mail
                </label>
              )}
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8B0C2]" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  inputMode="email"
                />
              </div>
            </div>

            {!isReset && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-xs font-semibold text-[#5A6478]">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="text-[11px] font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                    >
                      Lupa kata sandi?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8B0C2]" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder="min. 6 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-0 top-0 h-12 w-12 flex items-center justify-center text-[#A8B0C2] hover:text-[#0F1932] transition-colors"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label
                  htmlFor="login-confirm"
                  className="block text-xs font-semibold text-[#5A6478] mb-1.5"
                >
                  Konfirmasi Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8B0C2]" />
                  <input
                    id="login-confirm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Ulangi kata sandi"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3 py-2.5"
              >
                {error}
              </motion.p>
            )}
            {info && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-[#047857] bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl px-3 py-2.5"
              >
                {info}
              </motion.p>
            )}

            <motion.button
              type="submit"
              disabled={submitting || (!authActive && mode !== 'reset')}
              whileTap={{ scale: 0.985 }}
              className="w-full h-12 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_10px_24px_-8px_rgba(37,99,235,0.6)] transition-all active:shadow-[0_4px_12px_-4px_rgba(37,99,235,0.5)] disabled:opacity-60 disabled:cursor-wait"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/35 border-t-white animate-spin" />
                  Memproses…
                </>
              ) : mode === 'register' ? (
                <>
                  <UserPlus size={16} strokeWidth={2.25} />
                  Daftar
                </>
              ) : isReset ? (
                <>
                  <Mail size={16} strokeWidth={2.25} />
                  Kirim Tautan Reset
                </>
              ) : (
                <>
                  <LogIn size={16} strokeWidth={2.25} />
                  Masuk ke Dashboard
                </>
              )}
            </motion.button>
          </form>

          {isReset ? (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-xs text-[#5A6478] hover:text-[#0F1932] inline-flex items-center gap-1.5 font-medium transition-colors"
              >
                <ArrowLeft size={12} />
                Kembali ke Masuk
              </button>
            </div>
          ) : (
            <p className="mt-5 text-center text-[11px] text-[#8A93A8] leading-relaxed">
              Masuk berarti Anda menyetujui{' '}
              <span className="text-[#0F1932] font-medium cursor-pointer hover:underline">
                Ketentuan Layanan
              </span>{' '}
              &amp;{' '}
              <span className="text-[#0F1932] font-medium cursor-pointer hover:underline">
                Kebijakan Privasi
              </span>
              .
            </p>
          )}

          <p className="mt-5 lg:mt-6 text-center text-[10px] text-[#A8B0C2] font-mono hidden sm:block">
            Finance Hub · v1.1 · Autentikasi lewat Supabase Auth
          </p>
        </motion.div>
      </section>
    </div>
  );
}
