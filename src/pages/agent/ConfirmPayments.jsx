import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { formatNaira, formatDate, formatDateTime } from '@/lib/utils'
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react'

export default function AgentConfirmPayments() {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [flash, setFlash]    = useState(null)
  const [actuals, setActuals] = useState({})
  const [tab, setTab]        = useState('pending')

  const { data: payments, isLoading } = useQuery({
    queryKey: ['agent-payments', profile?.id, tab],
    queryFn: async () => {
      const { data: agent } = await supabase.from('agents').select('id').eq('user_id', profile.id).single()
      if (!agent) return []

      let q = supabase.from('payments')
        .select(`*, loans(loan_ref,amount,outstanding,user_id), users!payments_user_id_fkey(first_name,last_name,phone)`)
        .eq('agent_id', agent.id)
        .order('created_at', { ascending: false })

      if (tab === 'pending')   q = q.eq('status','pending')
      if (tab === 'confirmed') q = q.eq('status','confirmed')
      if (tab === 'rejected')  q = q.eq('status','rejected')

      const { data, error } = await q
      if (error) throw error
      return data || []
    },
    enabled: !!profile?.id,
  })

  const confirm = useMutation({
    mutationFn: async ({ pay, actual }) => {
      const confirmedAmt = Number(actual)
      if (confirmedAmt <= 0) throw new Error('Enter valid amount')

      // Update payment
      await supabase.from('payments').update({
        status:       'confirmed',
        actual_amount: confirmedAmt,
        confirmed_at:  new Date().toISOString(),
      }).eq('id', pay.id)

      // Smart allocation to repayment schedule
      let remaining = confirmedAmt
      const { data: rows } = await supabase.from('repayment_schedule')
        .select('*').eq('loan_id', pay.loan_id)
        .in('status',['pending','overdue','partial'])
        .order('due_date', { ascending: true })

      for (const r of rows || []) {
        if (remaining < 0.01) break
        const still = Number(r.amount_due) - Number(r.amount_paid)
        if (still <= 0) continue
        if (remaining >= still) {
          await supabase.from('repayment_schedule').update({
            status:'paid', amount_paid:r.amount_due, paid_at:new Date().toISOString()
          }).eq('id', r.id)
          remaining = Math.round((remaining - still) * 100) / 100
        } else {
          await supabase.from('repayment_schedule').update({
            status:'partial', amount_paid: Math.round((Number(r.amount_paid)+remaining)*100)/100
          }).eq('id', r.id)
          remaining = 0
        }
      }

      // Update loan balance
      const { data: loan } = await supabase.from('loans').select('outstanding,amount_paid,status').eq('id', pay.loan_id).single()
      if (loan) {
        const newOut  = Math.max(0, Number(loan.outstanding) - confirmedAmt)
        const newPaid = Number(loan.amount_paid) + confirmedAmt
        const newStatus = newOut <= 10 ? 'completed' : loan.status === 'disbursed' ? 'active' : loan.status
        await supabase.from('loans').update({ outstanding: newOut, amount_paid: newPaid, status: newStatus }).eq('id', pay.loan_id)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-payments'] })
      setFlash({ type:'success', msg:'Payment confirmed and schedule updated.' })
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  const reject = useMutation({
    mutationFn: async (id) => { await supabase.from('payments').update({ status:'rejected' }).eq('id', id) },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agent-payments'] }); setFlash({ type:'success', msg:'Payment rejected.' }) },
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Confirm Payments</h1>
        <p className="text-sm text-gray-500">Review and confirm client payment submissions</p>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {['pending','confirmed','rejected'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all
              ${tab===t?'bg-brand-600 text-white':'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t}
            {t === 'pending' && payments?.length > 0 && tab !== 'pending' && (
              <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 rounded-full">{payments.length}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading && <div className="py-8 text-center text-gray-400">Loading…</div>}

      <div className="space-y-4">
        {payments?.map(p => (
          <div key={p.id} className={`bg-white rounded-xl shadow-sm p-5 border ${
            p.status==='pending' ? 'border-amber-200' : p.status==='confirmed' ? 'border-green-200' : 'border-red-200'
          }`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-bold text-gray-900">{p.users?.first_name} {p.users?.last_name}</div>
                <div className="text-sm text-gray-500">{p.users?.phone} • <span className="font-mono text-xs">{p.loans?.loan_ref}</span></div>
                <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(p.created_at)}</div>
              </div>
              <Badge color={p.status==='confirmed'?'green':p.status==='rejected'?'red':'amber'}>
                {p.status}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-2.5">
                <div className="text-xs text-gray-400 uppercase mb-0.5">Claimed</div>
                <div className="font-bold text-green-600">{formatNaira(p.amount)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2.5">
                <div className="text-xs text-gray-400 uppercase mb-0.5">Outstanding</div>
                <div className="font-bold text-amber-600">{formatNaira(p.loans?.outstanding)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2.5">
                <div className="text-xs text-gray-400 uppercase mb-0.5">Method</div>
                <div className="font-medium capitalize text-xs">{p.payment_method?.replace('_',' ')}</div>
              </div>
            </div>

            {/* Payment slip */}
            {p.slip_file && (
              <div className="mb-3">
                <a href={`https://ftiloan.b-cdn.net/${p.slip_file}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-xs text-brand-600 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2 hover:bg-brand-100 transition-colors">
                  <ExternalLink size={12}/>
                  View Payment Slip / Receipt
                </a>
              </div>
            )}

            {p.status === 'pending' && (
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">ACTUAL AMOUNT RECEIVED (₦) *</label>
                  <input type="number"
                    value={actuals[p.id] ?? p.amount}
                    onChange={e => setActuals(a => ({...a, [p.id]: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"/>
                </div>
                <Button onClick={() => confirm.mutate({ pay:p, actual: actuals[p.id] ?? p.amount })}
                  loading={confirm.isPending} className="gap-2 flex-shrink-0">
                  <CheckCircle size={15}/> Confirm
                </Button>
                <Button variant="danger" onClick={() => reject.mutate(p.id)} loading={reject.isPending} className="flex-shrink-0">
                  <XCircle size={15}/>
                </Button>
              </div>
            )}

            {p.status === 'confirmed' && (
              <div className="text-xs text-green-600">
                ✓ Confirmed {formatNaira(p.actual_amount || p.amount)} on {formatDateTime(p.confirmed_at)}
              </div>
            )}
          </div>
        ))}
        {!isLoading && !payments?.length && (
          <div className="py-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            No {tab} payments.
          </div>
        )}
      </div>
    </div>
  )
}
