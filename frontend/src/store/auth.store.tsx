import React, { createContext, useContext, useMemo, useState } from 'react';
import type { Me } from '../api/auth.api';
import { clearLocationId, clearToken, getToken, setToken } from '../utils/storage';

type AuthState = {
  token: string | null;
  user: Me | null;
  setAuth: (token: string, user: Me) => void;
  setUser: (user: Me | null) => void;
  logout: () => void;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<Me | null>(null);

  const value = useMemo<AuthState>(() => ({
    token,
    user,
    setAuth: (t, u) => {
      setToken(t);
      setTokenState(t);
      setUser(u);
    },
    setUser,
    logout: () => {
      clearToken();
      clearLocationId();
      setTokenState(null);
      setUser(null);
    }
  }), [token, user]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
