'use client';

import React, { useEffect, useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { AuthTransition } from '@/components/dashboard/AuthTransition';
import { IS_UI_PREVIEW } from '@/lib/preview';

/**
 * Layout-level data gate untuk Finance Hub.
 * - Initial data fetch dilakukan di FinanceProvider (RootLayout) dengan useEffect[] — state murni dari Supabase.
 * - Splash branded HANYA untuk user yang sudah login (selama data dimuat, min. 2 dtk).
 *   Pengunjung belum-login langsung redirect tanpa splash (tidak nyangkut).
 * - Setelah isLoaded + auth siap, render children dengan fade-in halus agar tidak ngeglitch.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useFinance();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Guard auth tetap di level layout — hindari flash content sebelum redirect
  useEffect(() => {
    if (IS_UI_PREVIEW) return; // DEV-ONLY UI preview: lewati redirect login
    if (authLoading) return;
    if (!user) router.replace('/login');
  }, [authLoading, user, router]);

  // Splash minimal 900ms sejak layout mount — cukup terbaca tanpa terasa lambat.
  const MIN_SPLASH_MS = 900;
  const [minElapsed, setMinElapsed] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    return () => window.clearTimeout(t);
  }, []);

  // Belum login (sesi sudah dicek) → langsung redirect TANPA splash,
  // agar kunjungan awal tidak nyangkut di animasi loading. Splash hanya muncul
  // setelah klik login (overlay) dan selama data dimuat untuk user yang login.
  // Layout-level transition: splash branded yang sama dengan overlay login.
  // - Sesi sudah pasti + belum login → null + redirect (TANPA splash, tidak nyangkut).
  // - Sesi masih dicek → blank sekilas (tanpa animasi kedip).
  // - Sudah login → splash sampai data siap + durasi minimal 2 dtk (tidak glitch).
  // Safety timeout di AuthContext + FinanceContext menjamin gate ini tidak macet selamanya.
  if (!IS_UI_PREVIEW && !authLoading && !user) {
    return null;
  }
  if (authLoading) {
    return null;
  }
  if (!isLoaded || !minElapsed) {
    return <AuthTransition stage="data" />;
  }

  // Data siap — fade-in halus
  return <div className="animate-content-fade-in">{children}</div>;
}
