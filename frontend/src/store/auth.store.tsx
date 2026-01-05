import { create } from 'zustand';

export type AuthUser = {
  id: string;
  email?: string;
  name?: string;
};

type AuthState = {
  user: AuthUser | null;
  token: string | null;

  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,

  setAuth: (user, token) => set({ user, token }),
  clearAuth: () => set({ user: null, token: null }),
}));
