'use client';

import React, { useEffect, useState } from 'react';
import { Search, Eye, EyeOff, Moon, Sun, Bell } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { getGreeting, getTheme, isPrivacyOn, togglePrivacy, toggleTheme, type ThemeMode } from '@/lib/shell';

/* Topbar kaca sticky — greeting + tanggal + search/command + mata + tema + notif + avatar */
export function Topbar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { transactions } = useFinance();
  const { user } = useAuth();
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();
  const displayName = user?.email?.split('@')[0] || '';
  const initials = (displayName.slice(0, 2) || 'FH').toUpperCase();

  const [theme, setThemeState] = useState<ThemeMode>('light');
  // default tersembunyi (sama dengan class html.privacy dari init script) → ikon EyeOff tanpa mismatch
  const [privacy, setPrivacyState] = useState(true);
  const [bellOpen, setBellOpen] = useState(false);
  const [todayStr, setTodayStr] = useState('');
  const [greet, setGreet] = useState('');

  useEffect(() => {
    // Client-only hydration fix (tanggal, sapaan & ikon tema dari localStorage)
    /* eslint-disable react-hooks/set-state-in-effect */
    setThemeState(getTheme());
    setPrivacyState(isPrivacyOn());
    setTodayStr(
      new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    );
    setGreet(getGreeting());
    /* eslint-enable react-hooks/set-state-in-effect */

    const onThemeChange = (e: Event) => setThemeState((e as CustomEvent<ThemeMode>).detail);
    const onPrivacyChange = (e: Event) => setPrivacyState((e as CustomEvent<boolean>).detail);
    window.addEventListener('finance-hub:theme-changed', onThemeChange);
    window.addEventListener('finance-hub:privacy-changed', onPrivacyChange);
    return () => {
      window.removeEventListener('finance-hub:theme-changed', onThemeChange);
      window.removeEventListener('finance-hub:privacy-changed', onPrivacyChange);
    };
  }, []);

  return (
    <div className="top glass">
      <div className="greet">
        <h3>
          {greet ? (
            <>
              {greet}
              {displayName ? (
                <>
                  , <span>{displayName}</span>
                </>
              ) : null}{' '}
              👋
            </>
          ) : (
            <span suppressHydrationWarning>&nbsp;</span>
          )}
        </h3>
        <p suppressHydrationWarning>
          {todayStr ? `${todayStr} · ${transactions.length} transaksi tercatat` : '\u00A0'}
        </p>
      </div>

      {/* Search / command pill */}
      <button type="button" className="search" onClick={onOpenPalette} aria-label="Buka command palette">
        <Search size={16} />
        Cari atau jalankan perintah…
        <span className="k mono">Ctrl K</span>
      </button>

      {/* Privacy (mata) */}
      <button
        type="button"
        className="ibtn"
        title={privacy ? 'Tampilkan saldo (H)' : 'Sembunyikan saldo (H)'}
        aria-label={privacy ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
        aria-pressed={!privacy}
        onClick={() => setPrivacyState(togglePrivacy())}
      >
        {privacy ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>

      {/* Theme toggle */}
      <button
        type="button"
        className="ibtn"
        title="Ganti tema"
        aria-label="Ganti tema"
        onClick={() => setThemeState(toggleTheme())}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Notifikasi */}
      <div className="relative hidden md:block">
        <button
          type="button"
          className="ibtn"
          title="Notifikasi"
          aria-label="Notifikasi"
          onClick={() => {
            setBellOpen((v) => !v);
            if (!bellOpen) markAllRead();
          }}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span
              className="absolute top-2 right-2 h-2 w-2 rounded-full"
              style={{ background: 'var(--red)' }}
            />
          )}
        </button>
        {bellOpen && (
          <div
            className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border p-3 shadow-lg z-50"
            style={{ background: 'var(--glass-strong)', borderColor: 'var(--border)', backdropFilter: 'blur(18px)' }}
          >
            <div className="row px-1 pb-2">
              <span className="lbl" style={{ fontSize: 10 }}>
                Notifikasi
              </span>
              <button className="chip" onClick={() => { clearAll(); setBellOpen(false); }}>
                Bersihkan
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className="px-1 pb-1" style={{ fontSize: 12, color: 'var(--muted)' }}>
                Belum ada notifikasi baru.
              </p>
            ) : (
              <div className="grid gap-1 max-h-64 overflow-y-auto no-scrollbar">
                {notifications.slice(0, 12).map((n) => (
                  <div key={n.id} className="check" style={{ cursor: 'default', marginTop: 0 }}>
                    <div className="box" style={{ background: 'var(--glass-2)' }} />
                    <div className="min-w-0">
                      <p className="truncate" style={{ fontSize: 12.5 }}>
                        {n.label}
                      </p>
                      <p style={{ fontSize: 10.5, color: 'var(--faint)' }}>{n.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Avatar */}
      <div className="avatar" title={displayName || 'Account'}>
        {initials}
      </div>
    </div>
  );
}
