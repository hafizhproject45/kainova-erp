import { writable } from 'svelte/store';

export type UserRole = 'OWNER' | 'GUDANG' | 'KASIR';

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
}

const STORAGE_KEY = 'kainova_auth';

function loadInitialState(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AuthState;
  } catch {
    // localStorage tidak tersedia / data korup — fallback ke state kosong.
  }
  return { token: null, user: null };
}

export const authState = writable<AuthState>(loadInitialState());

authState.subscribe((state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
});

export function setSession(token: string, user: AuthUser) {
  authState.set({ token, user });
}

export function logout() {
  authState.set({ token: null, user: null });
}
