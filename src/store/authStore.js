import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export const useAuthStore = create((set, get) => ({
  user:    null,
  profile: null,
  loading: true,
  error:   null,

  init: async () => {
    try {
      // Check for existing session in localStorage
      const stored = localStorage.getItem('ftiloan_user')
      if (stored) {
        const user = JSON.parse(stored)
        set({ user, profile: user, loading: false })
        return
      }
    } catch (e) {}
    set({ loading: false })
  },

  fetchProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
      if (data) {
        set({ user: data, profile: data })
        localStorage.setItem('ftiloan_user', JSON.stringify(data))
      }
      return data
    } catch (e) {
      return null
    }
  },

  signIn: async (email, password) => {
    set({ error: null })
    try {
      // Use Supabase RPC to verify password
      const { data, error } = await supabase.rpc('verify_user_password', {
        p_email:    email.trim().toLowerCase(),
        p_password: password,
      })

      if (error || !data || data.length === 0) {
        return { error: 'Invalid email or password' }
      }

      const userId = data[0].user_id

      // Fetch full profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileError || !profile) {
        return { error: 'Could not load user profile' }
      }

      if (profile.status !== 'active') {
        return { error: 'Your account is not active. Contact admin.' }
      }

      localStorage.setItem('ftiloan_user', JSON.stringify(profile))
      set({ user: profile, profile })
      return { user: profile }

    } catch (e) {
      return { error: 'Login failed. Please try again.' }
    }
  },

  signOut: async () => {
    localStorage.removeItem('ftiloan_user')
    set({ user: null, profile: null })
  },

  isRole: (roles) => {
    const profile = get().profile
    if (!profile) return false
    const allowed = Array.isArray(roles) ? roles : [roles]
    return allowed.includes(profile.role)
  },
}))
