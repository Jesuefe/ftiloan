import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     || 'https://douswgukwnvuvktjshbx.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvdXN3Z3Vrd252dXZrdGpzaGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5ODk1ODAsImV4cCI6MjA5NjU2NTU4MH0.FZsx9DYixKBMAgmoLcloShTNM73k0liO88_A2EhOgyo'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
