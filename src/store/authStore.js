import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { storageSet, storageGet, storageRemove } from '@/lib/storage'

export const useAuthStore = create((set, get) => ({
  user:    null,
  profile: null,
  loading: true,
  error:   null,

  init: async () => {
    try {
      const user = storageGet('ftiloan_user')
      if (user && user.id) {
        // Restore session immediately — no network wait
        set({ user, profile: user, loading: false })

        // Refresh profile in background silently
        supabase.from('users').select('*').eq('id', user.id).single()
          .then(({ data }) => {
            if (data && data.status === 'active') {
              storageSet('ftiloan_user', data)
              set({ user: data, profile: data })
            } else if (data && data.status !== 'active') {
              storageRemove('ftiloan_user')
              set({ user: null, profile: null })
            }
          })
          .catch(() => {}) // Ignore network errors — keep cached session
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
        storageSet('ftiloan_user', data)
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

      storageSet('ftiloan_user', profile)
      set({ user: profile, profile })
      return { user: profile }

    } catch(e) {
      return { error: 'Login failed. Please try again.' }
    }
  },

  signOut: async () => {
    storageRemove('ftiloan_user')
    set({ user: null, profile: null })
  },

  isRole: (roles) => {
    const profile = get().profile
    if (!profile) return false
    const allowed = Array.isArray(roles) ? roles : [roles]
    return allowed.includes(profile.role)
  },
}))
