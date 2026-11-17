'use client';

import { BodyPortal } from '@/components/ui/minimal';

import { useFinance } from '@/context/FinanceContext';
import { MainTabType } from '@/types/finance';
import { LayoutDashboard, ArrowLeftRight, Target, Settings2 } from 'lucide-react';

const NAV: { id: MainTabType; label: string; icon: typeof LayoutDashboard; short: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, short: 'Home' },
  { id: 'cashflow', label: 'Cashflow', icon: ArrowLeftRight, short: 'Cashflow' },
  { id: 'recovery', label: 'Target', icon: Target, short: 'Target' },
  { id: 'setup', label: 'Setup', icon: Settings2, short: 'Setup' },
];

/* Bottom-nav mobile — gaya .mobnav mockup (kaca, aksen lembut) */
export function MobileBottomNav() {
  const { activeTab, setActiveTab, isQuickAddOpen } = useFinance();

  // Sembunyikan nav saat modal quick-add terbuka agar tidak menimpa sheet & tombol Simpan
  if (isQuickAddOpen) return null;

  return (
    <BodyPortal>
    <nav className="mobnav glass" aria-label="Navigasi bawah">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = activeTab === item.id;
        return (
          <a
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActiveTab(item.id);
              }
            }}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            className={active ? 'active' : ''}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 2} />
            {item.short}
          </a>
        );
      })}
    </nav>
    </BodyPortal>
  );
}
