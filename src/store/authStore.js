import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { storageSet, storageGet, storageRemove } from '@/lib/storage'

const SESSION_KEY = 'ftiloan_user'

export const useAuthStore = create((set, get) => ({
  user:    null,
  profile: null,
  loading: true,
  error:   null,

  init: async () => {
    try {
      const user = await storageGet(SESSION_KEY)
      if (user && user.id) {
        // Set cached data immediately — prevents flash to login screen
        set({ user, profile: user, loading: true })

        // Refresh from DB in background
        try {
          const { data } = await supabase
            .from('users').select('*').eq('id', user.id).single()

          if (data && data.status === 'active') {
            await storageSet(SESSION_KEY, data)
            set({ user: data, profile: data, loading: false })
          } else if (data && data.status !== 'active') {
            // Suspended — force logout
            await storageRemove(SESSION_KEY)
            set({ user: null, profile: null, loading: false })
          } else {
            // Network error — use cached
            set({ loading: false })
          }
        } catch(e) {
          // Offline — use cached session
          set({ loading: false })
        }
        return
      }
    } catch(e) {}
    set({ loading: false })
  },

  fetchProfile: async (userId) => {
    try {
      const { data } = await supabase
        .from('users').select('*').eq('id', userId).single()
      if (data) {
        set({ user: data, profile: data })
        await storageSet(SESSION_KEY, data)
      }
      return data
    } catch(e) { return null }
  },

  signIn: async (email, password) => {
    set({ error: null })
    try {
      const { data, error } = await supabase.rpc('verify_user_password', {
        p_email:    email.trim().toLowerCase(),
        p_password: password,
      })

      if (error || !data || data.length === 0) {
        return { error: 'Invalid email or password' }
      }

      const userId = data[0].user_id

      const { data: profile, error: profileError } = await supabase
        .from('users').select('*').eq('id', userId).single()

      if (profileError || !profile) {
        return { error: 'Could not load user profile' }
      }

      if (profile.status !== 'active') {
        return { error: 'Your account is not active. Contact admin.' }
      }

      await storageSet(SESSION_KEY, profile)
      set({ user: profile, profile })
      return { user: profile }

    } catch(e) {
      return { error: 'Login failed. Please try again.' }
    }
  },

  signOut: async () => {
    await storageRemove(SESSION_KEY)
    set({ user: null, profile: null })
  },

  isRole: (roles) => {
    const profile = get().profile
    if (!profile) return false
    const allowed = Array.isArray(roles) ? roles : [roles]
    return allowed.includes(profile.role)
  },
}))
