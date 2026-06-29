import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile, UserPreferences } from '@/types/database'

interface AuthState {
  user:        User | null
  session:     Session | null
  profile:     Profile | null
  preferences: UserPreferences | null
  loading:     boolean

  setUser:        (user: User | null) => void
  setSession:     (session: Session | null) => void
  setProfile:     (profile: Profile | null) => void
  setPreferences: (prefs: UserPreferences | null) => void
  setLoading:     (loading: boolean) => void
  reset:          () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user:        null,
  session:     null,
  profile:     null,
  preferences: null,
  loading:     true,

  setUser:        (user)    => set({ user }),
  setSession:     (session) => set({ session }),
  setProfile:     (profile) => set({ profile }),
  setPreferences: (prefs)   => set({ preferences: prefs }),
  setLoading:     (loading) => set({ loading }),
  reset: () => set({
    user:        null,
    session:     null,
    profile:     null,
    preferences: null,
    loading:     false,
  }),
}))
