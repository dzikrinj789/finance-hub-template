'use client';

/* Helper shell bersama: tema, privacy, toast-dongkrak. Dipakai Topbar,
   CommandPalette, dan keyboard shortcuts agar state selalu sinkron. */

import { toast } from './toast';

export type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'finance-hub:theme';

export function getTheme(): ThemeMode {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function setTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  if (mode === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent<ThemeMode>('finance-hub:theme-changed', { detail: mode }));
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  toast(next === 'dark' ? 'Mode gelap aktif' : 'Mode terang aktif', 'info');
  return next;
}

/* Privacy: default SELALU tersembunyi saat halaman dimuat (dipasang themeInitScript
   di layout). Status "tampil" sengaja TIDAK disimpan ke storage — hanya class di
   <html>, jadi bertahan selama tab terbuka (pindah section) tapi reload/tab baru
   kembali tersembunyi. */
export function isPrivacyOn(): boolean {
  if (typeof document === 'undefined') return true;
  return document.documentElement.classList.contains('privacy');
}

export function setPrivacy(on: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('privacy', on);
  window.dispatchEvent(new CustomEvent<boolean>('finance-hub:privacy-changed', { detail: on }));
}

export function togglePrivacy(): boolean {
  const next = !isPrivacyOn();
  setPrivacy(next);
  toast(next ? 'Saldo disembunyikan' : 'Saldo ditampilkan', 'info');
  return next;
}

/* Greeting sesuai jam — sama seperti semantik mockup */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}
