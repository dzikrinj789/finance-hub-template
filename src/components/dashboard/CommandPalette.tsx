'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  Settings2,
  PlusCircle,
  Eye,
  SunMoon,
  Download,
  UploadCloud,
  X,
} from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { MainTabType } from '@/types/finance';
import { togglePrivacy, toggleTheme } from '@/lib/shell';
import { exportTransactionsCsv } from '@/lib/export-csv';

interface Cmd {
  group: 'Navigasi' | 'Aksi';
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  kbd?: string;
  run: () => void;
}

/* Command palette Ctrl/⌘+K — navigasi antar tab + aksi cepat.
   Semua aksi memakai fungsi existing (setActiveTab, setIsQuickAddOpen, export CSV). */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { setActiveTab, transactions, setIsQuickAddOpen } = useFinance();
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Cmd[]>(() => {
    const nav = (id: MainTabType, label: string, icon: typeof LayoutDashboard, kbd: string): Cmd => ({
      group: 'Navigasi',
      label: `Buka ${label}`,
      icon,
      kbd,
      run: () => setActiveTab(id),
    });
    return [
      nav('dashboard', 'Dashboard', LayoutDashboard, '1'),
      nav('cashflow', 'Cashflow', ArrowLeftRight, '2'),
      nav('recovery', 'Target & Recovery', Target, '3'),
      nav('setup', 'Setup & Importer', Settings2, '4'),
      {
        group: 'Aksi',
        label: 'Catat transaksi baru',
        icon: PlusCircle,
        kbd: 'N',
        run: () => setIsQuickAddOpen(true),
      },
      {
        group: 'Aksi',
        label: 'Sembunyikan / tampilkan saldo',
        icon: Eye,
        kbd: 'H',
        run: () => togglePrivacy(),
      },
      {
        group: 'Aksi',
        label: 'Ganti tema terang / gelap',
        icon: SunMoon,
        run: () => toggleTheme(),
      },
      {
        group: 'Aksi',
        label: 'Export data ke CSV',
        icon: Download,
        run: () => exportTransactionsCsv(transactions),
      },
      {
        group: 'Aksi',
        label: 'Import dari Money Lover',
        icon: UploadCloud,
        run: () => setActiveTab('setup'),
      },
    ];
  }, [setActiveTab, setIsQuickAddOpen, transactions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  // Reset query/seleksi saat palette dibuka (pola "adjust state on prop change")
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery('');
      setSel(0);
    }
  }

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  const runCmd = useCallback(
    (i: number) => {
      const c = filtered[i];
      if (!c) return;
      onClose();
      c.run();
    },
    [filtered, onClose],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runCmd(sel);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`.cmd[data-i="${sel}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open) return null;

  let lastGroup = '';

  return (
    <div
      className="overlay"
      style={{ zIndex: 70 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palette glass" role="dialog" aria-label="Command palette">
        <div className="inp">
          <CommandGlyph />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSel(0); }}
            onKeyDown={onKeyDown}
            placeholder="Ketik perintah atau halaman…"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup palette"
            style={{ background: 'none', border: 0, color: 'var(--faint)', cursor: 'pointer', display: 'grid' }}
          >
            <X size={16} />
          </button>
        </div>
        <div className="cmds" ref={listRef}>
          {filtered.length === 0 && <div className="empty">Tidak ada perintah</div>}
          {filtered.map((c, i) => {
            const groupHeader = c.group !== lastGroup ? (
              <div className="grp" key={`g-${c.group}-${i}`}>
                {c.group}
              </div>
            ) : null;
            lastGroup = c.group;
            const Icon = c.icon;
            return (
              <React.Fragment key={`${c.group}-${c.label}`}>
                {groupHeader}
                <div
                  className={`cmd ${i === sel ? 'sel' : ''}`}
                  data-i={i}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => runCmd(i)}
                >
                  <Icon size={17} />
                  {c.label}
                  {c.kbd && <small className="mono">{c.kbd}</small>}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CommandGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', flexShrink: 0 }}>
      <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
    </svg>
  );
}
