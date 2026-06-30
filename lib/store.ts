import { create } from "zustand";

interface AuthState {
  accessToken: string | null;
  accountId: string | null;
  setAuth: (accessToken: string | null, accountId?: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  accountId: null,
  setAuth: (accessToken, accountId = null) =>
    set({ accessToken, accountId }),
}));
