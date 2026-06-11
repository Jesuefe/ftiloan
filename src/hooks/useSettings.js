import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('system_settings').select('*')
      if (error) throw error
      const map = {}
      data.forEach(row => { map[row.setting_key] = row.setting_value })
      return map
    },
    staleTime: 5 * 60 * 1000,
  })
}
