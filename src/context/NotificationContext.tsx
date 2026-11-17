'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type NotificationKind = 'add' | 'update' | 'delete';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  label: string;
  title: string;
  createdAt: string;
  read: boolean;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => void;
  clearAll: () => void;
  push: (input: { kind: NotificationKind; label: string; title: string }) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const KIND_VERB: Record<NotificationKind, string> = {
  add: 'ditambahkan',
  update: 'diperbarui',
  delete: 'dihapus',
};

// Batas jumlah notifikasi yang disimpan di memori — lama terbuang (FIFO).
const MAX_NOTIFICATIONS = 80;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const lastKeyRef = useRef<string>('');
  const lastAtRef = useRef<number>(0);

  const push = useCallback(
    (input: { kind: NotificationKind; label: string; title: string }) => {
      // Dedup: esto yang sama dalam <1.5 dtk (kaskade realtime burst) tidak di-push ulang
      const key = `${input.kind}:${input.label}:${input.title}`;
      const now = Date.now();
      if (key === lastKeyRef.current && now - lastAtRef.current < 1500) return;
      lastKeyRef.current = key;
      lastAtRef.current = now;
      setNotifications((prev) => {
        const next: AppNotification[] = [
          {
            id: `${input.kind}-${key}-${now}-${Math.random().toString(36).slice(2, 6)}`,
            kind: input.kind,
            label: input.label,
            title: `${input.title} ${KIND_VERB[input.kind]}`,
            createdAt: new Date(now).toISOString(),
            read: false,
          },
          ...prev,
        ];
        return next.slice(0, MAX_NOTIFICATIONS);
      });
    },
    []
  );

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    lastKeyRef.current = '';
  }, []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, markAllRead, clearAll, push }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications harus digunakan di dalam NotificationProvider');
  return ctx;
}
