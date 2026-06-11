import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useClients(filters = {}) {
  return useQuery({
    queryKey: ['clients', filters],
    queryFn: async () => {
      let q = supabase
        .from('users')
        .select('*')
        .eq('role', 'client')
        .order('created_at', { ascending: false })

      if (filters.agentZoneId) q = q.eq('zone_id', filters.agentZoneId)
      if (filters.search) q = q.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)

      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useClient(id) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*, loans(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}
