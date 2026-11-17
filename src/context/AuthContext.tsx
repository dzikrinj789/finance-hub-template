'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export interface AuthResult {
  error?: string;
  confirmRequired?: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  authActive: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      void Promise.resolve().then(() => setLoading(false));
      return;
    }

    // Safety: getSession tidak boleh menggantung loading selamanya.
    // Gagal/timeout → loading tetap dilepas (sesi null = diarahkan ke login oleh layout).
    let finished = false;
    const release = () => {
      if (!finished) {
        finished = true;
        setLoading(false);
      }
    };
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
      })
      .catch(() => {
        // abaikan — layout akan menangani sesi null
      })
      .finally(release);
    const safety = window.setTimeout(release, 10000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => {
      window.clearTimeout(safety);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Supabase belum dikonfigurasi.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message };
    }
    return {};
  };

  const signUp = async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Supabase belum dikonfigurasi.' };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return { error: error.message };
    }
    // Saat konfirmasi email aktif, session tidak langsung terbentuk.
    return { confirmRequired: !data.session };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const requestPasswordReset = async (email: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Supabase belum dikonfigurasi.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (error) {
      return { error: error.message };
    }
    return {};
  };

  const updatePassword = async (password: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Supabase belum dikonfigurasi.' };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return { error: error.message };
    }
    return {};
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        authActive: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        requestPasswordReset,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider');
  }
  return context;
}