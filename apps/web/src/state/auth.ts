import { create } from 'zustand'
import { clearTokens, login, logout, type SessionUser } from '../lib/api'

interface AuthState {
  user?: SessionUser
  ready: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  ready: true,
  signIn: async (email, password) => set({ user: await login(email, password), ready: true }),
  signOut: async () => { await logout(); clearTokens(); set({ user: undefined, ready: true }) },
}))