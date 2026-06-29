import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Profile, UserPreferences } from '@/types/database'

export function useAuth() {
  const store = useAuthStore()

  useEffect(() => {
    // 1. Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      store.setSession(session)
      store.setUser(session?.user ?? null)
      if (session?.user) {
        loadUserData(session.user.id)
      } else {
        store.setLoading(false)
      }
    })

    // 2. Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        store.setSession(session)
        store.setUser(session?.user ?? null)
        if (session?.user) {
          await loadUserData(session.user.id)
        } else {
          store.setProfile(null)
          store.setPreferences(null)
          store.setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    user:        store.user,
    session:     store.session,
    profile:     store.profile,
    preferences: store.preferences,
    loading:     store.loading,
    isAuthenticated: !!store.session,
  }
}

async function loadUserData(userId: string) {
  const store = useAuthStore.getState()

  try {
    const [profileResult, prefsResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('user_preferences').select('*').eq('user_id', userId).single(),
    ])

    if (profileResult.data) store.setProfile(profileResult.data as Profile)
    if (prefsResult.data)   store.setPreferences(prefsResult.data as UserPreferences)
  } catch {
    // Non-critical: app works without profile data
  } finally {
    store.setLoading(false)
  }
}
