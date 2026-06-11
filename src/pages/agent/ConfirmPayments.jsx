import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { formatNaira, formatDate } from '@/lib/utils'
import { CheckCircle, XCircle } from 'lucide-react'

export default function AgentConfirmPayments() {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [flash, setFlash]   = useState(null)
  const [actuals, setActuals] = useState({})

  const { data: payments, isLoading } = useQuery({
    queryKey: ['agent-pending-payments', profile?.id],
    queryFn: async () => {
      const { data: agent } = await supabase.from('agents').select('id').eq('user_id', profile.id).single()
      if (!agent) return []
      const { data, error } = await supabase
        .from('payments')
        .select(`*, loans(loan_ref,amount,outstanding), users!payments_user_id_fkey(first_name,last_name,phone)`)
        .eq('agent_id', agent.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!profile?.id,
  })

  const confirm = useMutation({
    mutationFn: async ({ id, actual, loanId }) => {
      await supabase.from('payments').update({
        status: 'confirmed', actual_amount: actual, confirmed_at: new Date().toISOString()
      }).eq('id', id)
      const { data: loan } = await supabase.from('loans').select('outstanding,amount_paid,status').eq('id', loanId).single()
      if (loan) {
        const newOut  = Math.max(0, Number(loan.outstanding) - Number(actual))
        const newPaid = Number(loan.amount_paid) + Number(actual)
        const newStatus = newOut <= 10 ? 'completed' : loan.status === 'disbursed' ? 'active' : loan.status
        await supabase.from('loans').update({ outstanding: newOut, amount_paid: newPaid, status: newStatus }).eq('id', loanId)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-pending-payments'] })
      setFlash({ type:'success', msg:'Payment confirmed.' })
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  const reject = useMutation({
    mutationFn: async (id) => { await supabase.from('payments').update({ status:'rejected' }).eq('id', id) },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agent-pending-payments'] }); setFlash({ type:'success', msg:'Payment rejected.' }) },
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Confirm Payments</h1>
        <p className="text-sm text-gray-500">{payments?.length || 0} pending</p>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      {isLoading && <div className="py-8 text-center text-gray-400">Loading…</div>}

      <div className="space-y-4">
        {payments?.map(p => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-bold text-gray-900">{p.users?.first_name} {p.users?.last_name}</div>
                <div className="text-sm text-gray-500">{p.users?.phone} • {p.loans?.loan_ref}</div>
              </div>
              <Badge color="amber">Pending</Badge>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 uppercase mb-0.5">Claimed</div>
                <div className="font-bold text-green-600">{formatNaira(p.amount)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 uppercase mb-0.5">Outstanding</div>
                <div className="font-bold text-amber-600">{formatNaira(p.loans?.outstanding)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 uppercase mb-0.5">Method</div>
                <div className="font-medium capitalize">{p.payment_method?.replace('_',' ')}</div>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">ACTUAL AMOUNT RECEIVED (₦) *</label>
                <input type="number"
                  value={actuals[p.id] ?? p.amount}
                  onChange={e => setActuals(a => ({ ...a, [p.id]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"/>
              </div>
              <Button onClick={() => confirm.mutate({ id: p.id, actual: actuals[p.id] ?? p.amount, loanId: p.loan_id })}
                loading={confirm.isPending} className="gap-2">
                <CheckCircle size={15}/> Confirm
              </Button>
              <Button variant="danger" onClick={() => reject.mutate(p.id)} loading={reject.isPending} className="gap-2">
                <XCircle size={15}/> Reject
              </Button>
            </div>
          </div>
        ))}
        {!isLoading && !payments?.length && (
          <div className="py-16 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            No pending payments to confirm.
          </div>
        )}
      </div>
    </div>
  )
}
