'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, KeyRound, TrendingUp } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const { user, loading, updatePassword, signOut } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const inputCls =
    'w-full h-11 rounded-lg border border-[#CDCDC9] bg-white px-3.5 text-sm text-[#1A1A1A] placeholder:text-[#B5B5B0] focus:border-[#1A1A1A] focus:ring-2 focus:ring-[#E5E5E3]';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password.length < 6) {
      setError('Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak sama.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await updatePassword(password);
      if (result.error) {
        setError(result.error);
      } else {
        await signOut();
        setInfo('Kata sandi berhasil diperbarui. Silakan masuk kembali.');
        setTimeout(() => router.push('/login'), 1200);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-3 bg-[#F7F7F5]">
        <div className="w-10 h-10 rounded-xl bg-[#059669] flex items-center justify-center text-white">
          <TrendingUp size={20} strokeWidth={2.5} />
        </div>
        <span className="w-5 h-5 rounded-full border-2 border-[#E5E5E3] border-t-[#1A1A1A] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#F7F7F5] px-4">
        <div className="w-full max-w-[380px] bg-white border border-[#E5E5E3] rounded-2xl p-8 text-center shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center mx-auto mb-4">
            <KeyRound size={18} />
          </div>
          <h1 className="text-lg font-bold text-[#1A1A1A]">Tautan tidak valid</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Tautan reset sudah kedaluwarsa atau tidak dikenali. Minta tautan baru dari halaman masuk.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="mt-6 w-full h-11 rounded-lg bg-[#1A1A1A] text-white text-sm font-semibold hover:bg-black transition-all"
          >
            Kembali ke Masuk
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#F7F7F5] px-4">
      <div className="w-full max-w-[380px] bg-white border border-[#E5E5E3] rounded-2xl p-8 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-[#059669] text-white flex items-center justify-center mb-4">
          <KeyRound size={18} />
        </div>
        <h1 className="text-xl font-bold text-[#1A1A1A] tracking-tight">Atur kata sandi baru</h1>
        <p className="text-sm text-[#6B7280] mt-1 mb-6">
          Untuk akun <span className="font-medium text-[#1A1A1A]">{user.email}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="np" className="block text-xs font-semibold text-[#374151] mb-1.5">
              Kata sandi baru
            </label>
            <div className="relative">
              <input
                id="np"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="min. 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls + ' pr-11'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-[#9CA3AF] hover:text-[#1A1A1A] transition-colors"
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="nc" className="block text-xs font-semibold text-[#374151] mb-1.5">
              Konfirmasi kata sandi
            </label>
            <input
              id="nc"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Ulangi kata sandi baru"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputCls}
            />
          </div>

          {error && (
            <p className="text-xs text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {info && (
            <p className="text-xs text-[#047857] bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg px-3 py-2">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-lg bg-[#1A1A1A] text-white text-sm font-semibold hover:bg-black flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60"
          >
            {submitting ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Menyimpan...
              </>
            ) : (
              'Simpan kata sandi baru'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}