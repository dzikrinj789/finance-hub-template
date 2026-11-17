'use client';

import { useRouter } from 'next/navigation';
import { useFinance } from '@/context/FinanceContext';
import { useAuth } from '@/context/AuthContext';
import { MainTabType } from '@/types/finance';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  Settings2,
  TrendingUp,
  Database,
  Sparkles,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { IS_UI_PREVIEW } from '@/lib/preview';

const NAV_ITEMS: { id: MainTabType; label: string; kbd: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', kbd: '1', icon: LayoutDashboard },
  { id: 'cashflow', label: 'Cashflow', kbd: '2', icon: ArrowLeftRight },
  { id: 'recovery', label: 'Target & Recovery', kbd: '3', icon: Target },
  { id: 'setup', label: 'Setup & Importer', kbd: '4', icon: Settings2 },
];

const APP_VERSION = 'v2.0 · Minimal';

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const { activeTab, setActiveTab, isSupabaseActive } = useFinance();
  const { signOut } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
    } finally {
      setLoggingOut(false);
      router.push('/login');
    }
  };

  return (
    <aside className={collapsed ? 'is-collapsed' : ''}>
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="side-toggle"
          aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
        >
          {collapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronLeft size={14} strokeWidth={2.5} />}
        </button>
      )}
      <div className="side glass">
        {/* Brand */}
        <div className="brand">
          <div className="logo">
            <TrendingUp size={20} strokeWidth={2.4} />
          </div>
          <div className="min-w-0 side-text">
            <b>Finance Hub</b>
            <small className="block truncate">Personal finance</small>
          </div>
        </div>

        {/* Nav */}
        <div className="navlabel side-text">Menu Utama</div>
        <nav>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <a
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={isActive ? 'active' : ''}
                role="button"
                tabIndex={0}
                aria-current={isActive ? 'page' : undefined}
                title={collapsed ? `${item.label} (${item.kbd})` : undefined}
                aria-label={item.label}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveTab(item.id);
                  }
                }}
              >
                <Icon size={18} strokeWidth={isActive ? 2.4 : 2} className="shrink-0" />
                <span className="truncate side-text">{item.label}</span>
                <span className="kbd mono side-text">{item.kbd}</span>
              </a>
            );
          })}
        </nav>

        {/* Foot: quick tip + live status + version + logout */}
        <div className="side-foot">
          <div className="glass card side-tip" style={{ padding: 16, borderRadius: 18, marginBottom: 12 }}>
            <div className="lbl" style={{ fontSize: 10 }}>
              <Sparkles size={14} style={{ color: 'var(--accent)' }} />
              Quick tip
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
              Tekan <b className="mono" style={{ color: 'var(--text)' }}>Ctrl/⌘ K</b> untuk command palette,{' '}
              <b className="mono" style={{ color: 'var(--text)' }}>H</b> sembunyikan saldo.
            </p>
          </div>
          <div
            className="live"
            title={collapsed ? (isSupabaseActive ? 'Supabase Live' : IS_UI_PREVIEW ? 'UI Preview · data contoh' : 'Local DB') : undefined}
          >
            <Database size={16} className="shrink-0" />
            <span className="side-text">{isSupabaseActive ? 'Supabase Live' : IS_UI_PREVIEW ? 'UI Preview · data contoh' : 'Local DB'}</span>
            <span className={`dot ${isSupabaseActive ? '' : IS_UI_PREVIEW ? 'idle' : 'off'}`} />
          </div>
          <div className="row side-verrow" style={{ margin: '12px 6px 4px' }}>
            <span className="ver mono side-text" style={{ margin: 0 }}>Finance Hub {APP_VERSION}</span>
            <button onClick={handleLogout} className="side-logout" title="Keluar" aria-label="Logout">
              <LogOut size={14} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
