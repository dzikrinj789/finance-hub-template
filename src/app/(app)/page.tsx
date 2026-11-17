'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Topbar } from '@/components/dashboard/Topbar';
import { MobileBottomNav } from '@/components/dashboard/MobileBottomNav';
import { BodyPortal } from '@/components/ui/minimal';
import { CommandPalette } from '@/components/dashboard/CommandPalette';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { AssetBreakdown } from '@/components/dashboard/AssetBreakdown';
import { TargetProgressSummary } from '@/components/dashboard/TargetProgressSummary';
import { StockPortfolioSummary } from '@/components/dashboard/StockPortfolioSummary';
import { CashflowTransactionsTab } from '@/components/dashboard/CashflowTransactionsTab';
import { TargetRecoveryTab } from '@/components/dashboard/TargetRecoveryTab';
import { SetupTab } from '@/components/dashboard/SetupTab';
import { MarketAutoRefresh } from '@/components/dashboard/MarketAutoRefresh';
import { QuickAddModal } from '@/components/dashboard/QuickAddModal';
import { CashflowChartCard, CompositionCard, CumulativeCard } from '@/components/dashboard/DashboardCharts';
import { WalletCards } from '@/components/dashboard/WalletCards';
import { SpendingCategories } from '@/components/dashboard/SpendingCategories';
import { RecentTransactions } from '@/components/dashboard/DashboardExtras';
import { useFinance } from '@/context/FinanceContext';
import { useAuth } from '@/context/AuthContext';
import { MainTabType } from '@/types/finance';
import { Download, Plus, TriangleAlert, CalendarDays } from 'lucide-react';
import { YearScrollPicker } from '@/components/dashboard/YearScrollPicker';
import { DashboardContentSkeleton } from '@/components/dashboard/AppSkeleton';
import { togglePrivacy } from '@/lib/shell';
import { exportTransactionsCsv } from '@/lib/export-csv';
import { IS_UI_PREVIEW } from '@/lib/preview';
import { Toaster } from '@/components/ui/Toaster';
import { RingGradientDefs } from '@/components/ui/minimal';
import { toast } from '@/lib/toast';

const PAGE_TITLES: Record<MainTabType, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Ringkasan saldo, cashflow, dan alokasi aset',
  },
  cashflow: {
    title: 'Cashflow & Transaksi',
    subtitle: 'Semua catatan pemasukan dan pengeluaran',
  },
  recovery: {
    title: 'Target & Recovery',
    subtitle: 'Pemantauan target dan progres tabungan',
  },
  setup: {
    title: 'Setup & Importer',
    subtitle: 'Kelola akun, saldo, dan impor data Money Lover',
  },
};

const SHORTCUT_PAGES: MainTabType[] = ['dashboard', 'cashflow', 'recovery', 'setup'];

export default function DashboardPage() {
  // Data berasal dari FinanceProvider di RootLayout — initial fetch dengan useEffect([]) di level layout.
  // State murni dari Supabase (tanpa localStorage) sehingga semua device selalu sama.
  const {
    activeTab,
    setActiveTab,
    transactions,
    selectedYear,
    setSelectedYear,
    setIsQuickAddOpen,
    isQuickAddOpen,
    isLoaded,
    supabaseError,
    retrySupabase,
  } = useFinance();

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Sidebar desktop bisa diciutkan (sama seperti versi sebelumnya: state lokal, default terbuka)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Guard auth — layout sudah guard juga, ini fallback untuk direct access
  useEffect(() => {
    if (IS_UI_PREVIEW) return; // DEV-ONLY UI preview
    if (authLoading) return;
    if (!user) router.replace('/login');
  }, [authLoading, user, router]);

  // ── Keyboard shortcuts global: Ctrl/⌘K, 1–4, N, /, H ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = !!el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setFilterOpen(false);
        return;
      }
      if (typing || isQuickAddOpen) return;
      if (e.key >= '1' && e.key <= '4') {
        setActiveTab(SHORTCUT_PAGES[Number(e.key) - 1]);
        return;
      }
      if (e.key.toLowerCase() === 'h') {
        togglePrivacy();
        return;
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsQuickAddOpen(true);
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        setActiveTab('cashflow');
        setTimeout(() => document.getElementById('cashflow-search')?.focus(), 180);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isQuickAddOpen, setActiveTab, setIsQuickAddOpen]);

  // Fallback skeleton jika layout gate belum selesai
  if (!isLoaded) {
    return (
      <div className={`app ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <aside>
          <div className="side glass">
            <div className="h-10 w-10 skeleton rounded-xl" />
            <div className="grid gap-2 px-1 pt-5">
              <div className="h-9 skeleton rounded-xl" />
              <div className="h-9 skeleton rounded-xl" />
              <div className="h-9 skeleton rounded-xl" />
            </div>
          </div>
        </aside>
        <main>
          <DashboardContentSkeleton />
        </main>
      </div>
    );
  }

  const pageInfo = PAGE_TITLES[activeTab] ?? PAGE_TITLES.dashboard;

  const handleExportCSV = () => {
    exportTransactionsCsv(transactions);
    toast(`Export CSV · ${transactions.length} transaksi`, 'info');
  };

  return (
    <div className={`app ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <MarketAutoRefresh />
      {/* Sidebar kaca — desktop */}
      <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((v) => !v)} />

      {/* Kolom utama */}
      <main>
        <Topbar onOpenPalette={() => setPaletteOpen(true)} />

        {activeTab && (
          <div className="ph">
            <div>
              <h1>{pageInfo.title}</h1>
              <p>
                {pageInfo.subtitle}
                {activeTab === 'dashboard' && ` · ${selectedYear === 'all' ? 'Semua tahun' : `Tahun ${selectedYear}`}`}
              </p>
            </div>
            <div className="chips">
              {/* Filter tahun (YearScrollPicker existing) */}
              <div className="relative">
                <button className={`chip ${selectedYear !== 'all' ? 'on' : ''}`} onClick={() => setFilterOpen((v) => !v)}>
                  <CalendarDays size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
                  {selectedYear === 'all' ? 'Semua tahun' : selectedYear}
                </button>
                <AnimatePresence>
                  {filterOpen && (
                    <>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-10"
                        onClick={() => setFilterOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                        className="glass absolute right-0 mt-2 z-20 p-3.5 w-72 max-w-[calc(100vw-2rem)] lg:w-[380px]"
                        style={{ background: 'var(--glass-strong)', borderRadius: 18 }}
                      >
                        <p className="lbl" style={{ fontSize: 10, padding: '0 4px 6px' }}>
                          Periode Tahun
                        </p>
                        <YearScrollPicker
                          selectedYear={selectedYear}
                          onSelect={(yr) => {
                            setSelectedYear(yr as typeof selectedYear);
                            setFilterOpen(false);
                          }}
                          startYear={2020}
                          endYear={2070}
                        />
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {(activeTab === 'dashboard' || activeTab === 'cashflow') && (
                <button className="btn hide-m" onClick={handleExportCSV}>
                  <Download size={16} />
                  {activeTab === 'cashflow' ? 'Export CSV' : 'Export'}
                </button>
              )}

              {(activeTab === 'dashboard' || activeTab === 'cashflow') && (
                <button className="btn primary ph-add" onClick={() => setIsQuickAddOpen(true)} title="Catat Transaksi (N)">
                  <Plus size={16} strokeWidth={2.6} />
                  <span className="t-long">Catat Transaksi</span>
                  <span className="t-short">Catat</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Banner gagal baca Supabase — tampil di SEMUA tab agar kegagalan fetch tidak silent */}
        {supabaseError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass card mb-3 flex flex-col sm:flex-row sm:items-center gap-2"
            role="alert"
            style={{ borderColor: 'rgba(220,38,38,0.35)', marginBottom: 18 }}
          >
            <div className="flex items-start gap-2 flex-1">
              <TriangleAlert size={15} style={{ color: 'var(--red)' }} className="mt-0.5 shrink-0" />
              <p className="flex-1 text-xs leading-relaxed" style={{ color: 'var(--red)' }}>
                <span className="font-semibold">Gagal membaca database:</span> {supabaseError}
              </p>
            </div>
            <button onClick={retrySupabase} className="btn danger shrink-0">
              Coba lagi
            </button>
          </motion.div>
        )}

        {/* Konten tab */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(2px)' }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {activeTab === 'dashboard' && (
              <div className="kgrid">
                {/* Hero Net Worth s8 · Insight s4 · Income/Spending/Savings s4×3 */}
                <SummaryCards />
                <CashflowChartCard className="s8" />
                <CompositionCard className="s4" />
                <WalletCards className="s7" />
                <SpendingCategories className="s5" />
                <RecentTransactions className="s7" />
                {/* Widget lama tetap dipertahankan (kulit kaca via legacy skin) */}
                <CumulativeCard className="s7" />
                <section aria-label="Ringkasan Portofolio Saham" className="s5 legacy-slot">
                  <StockPortfolioSummary />
                </section>
                <section aria-label="Progres Target dan Recovery" className="s12">
                  <TargetProgressSummary />
                </section>
                <section aria-label="Alokasi Aset" className="s12">
                  <AssetBreakdown />
                </section>
              </div>
            )}

            {activeTab === 'cashflow' && (
              <section aria-label="Tabel Transaksi">
                <CashflowTransactionsTab />
              </section>
            )}

            {activeTab === 'recovery' && (
              <section aria-label="Target dan Recovery Modal">
                <TargetRecoveryTab />
              </section>
            )}

            {activeTab === 'setup' && (
              <section aria-label="Setup dan Importer" style={{ maxWidth: 1200 }}>
                <SetupTab />
              </section>
            )}

            {/* Footer */}
            <footer className="ver mono" style={{ marginTop: 28 }}>
              © 2026 Finance Hub
            </footer>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom nav mobile */}
      <MobileBottomNav />

      {/* FAB Catat Transaksi */}
      <BodyPortal>
        <button className="fab animate-fab-in" onClick={() => setIsQuickAddOpen(true)} title="Catat Transaksi (N)" aria-label="Catat Transaksi">
          <Plus size={18} strokeWidth={2.8} />
          <span className="t">Catat Transaksi</span>
        </button>
      </BodyPortal>

      {/* Floating Action Modal */}
      <QuickAddModal />

      {/* Command palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Toast kaca + gradient ring global */}
      <Toaster />
      <RingGradientDefs />
    </div>
  );
}
