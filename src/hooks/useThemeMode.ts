'use client';

import { useEffect, useState } from 'react';
import { getTheme, type ThemeMode } from '@/lib/shell';

/* Tema aktif (light/dark) untuk komponen yang butuh warna literal (mis. Recharts SVG). */
export function useThemeMode(): ThemeMode {
  const [mode, setMode] = useState<ThemeMode>('light');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- baca atribut DOM setelah hydrate
    setMode(getTheme());
    const on = (e: Event) => setMode((e as CustomEvent<ThemeMode>).detail);
    window.addEventListener('finance-hub:theme-changed', on);
    return () => window.removeEventListener('finance-hub:theme-changed', on);
  }, []);
  return mode;
}
