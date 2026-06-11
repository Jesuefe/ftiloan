import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function usePayments(filters = {}) {
  return useQuery({
    queryKey: ['payments', filters],
    queryFn: async () => {
      let q = supabase
        .from('payments')
        .select(`*, loans(loan_ref,amount), users!payments_user_id_fkey(first_name,last_name,phone)`)
        .order('created_at', { ascending: false })

      if (filters.status) q = q.eq('status', filters.status)
      if (filters.loanId) q = q.eq('loan_id', filters.loanId)

      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useConfirmPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, actualAmount }) => {
      const { data, error } = await supabase
        .from('payments')
        .update({ status: 'confirmed', actual_amount: actualAmount, confirmed_at: new Date().toISOString() })
        .eq('id', id)
        .select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['loans'] })
    },
  })
}
