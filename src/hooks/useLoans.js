import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useLoans(filters = {}) {
  return useQuery({
    queryKey: ['loans', filters],
    queryFn: async () => {
      let q = supabase
        .from('loans')
        .select(`*, users!loans_user_id_fkey(id,first_name,last_name,email,phone), agents(id,users(first_name,last_name))`)
        .order('created_at', { ascending: false })

      if (filters.status)  q = q.eq('status', filters.status)
      if (filters.userId)  q = q.eq('user_id', filters.userId)
      if (filters.agentId) q = q.eq('agent_id', filters.agentId)
      if (filters.limit)   q = q.limit(filters.limit)

      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useLoan(id) {
  return useQuery({
    queryKey: ['loan', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loans')
        .select(`*, users!loans_user_id_fkey(*), guarantors(*), kyc_documents(*), repayment_schedule(*)`)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useUpdateLoanStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, notes, reason }) => {
      const update = { status, updated_at: new Date().toISOString() }
      if (notes)  update.admin_notes = notes
      if (reason) update.rejection_reason = reason
      const { data, error } = await supabase.from('loans').update(update).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['loan'] })
    },
  })
}
